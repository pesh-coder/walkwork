"""
Ledger service — the heart of Tukole's cash trust differentiator.

Every shilling that moves through the system creates a LedgerEntry.
The seller dashboard reads from this to show:
- Running wallet balance
- Cash flow timeline ("UGX 85,000 collected at 2:43pm, deposited at 2:51pm")
- Money saved from prevented losses

For MoMo flow: only platform fee + rider earning entries.
For COD flow: the full cash journey (collected -> deposited -> seller payout).
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import (
    LedgerEntry,
    LedgerEntryType,
    Order,
    PaymentMode,
    Rider,
    Seller,
)


def _add_entry(
    db: Session,
    *,
    entry_type: LedgerEntryType,
    amount_ugx: int,
    description: str,
    order: Order | None = None,
    seller: Seller | None = None,
    rider: Rider | None = None,
    external_ref: str | None = None,
) -> LedgerEntry:
    entry = LedgerEntry(
        entry_type=entry_type,
        amount_ugx=amount_ugx,
        description=description,
        order_id=order.id if order else None,
        seller_id=seller.id if seller else None,
        rider_id=rider.id if rider else None,
        external_ref=external_ref,
    )
    db.add(entry)
    return entry


# -----------------------------------------------------------------------------
# Wallet operations
# -----------------------------------------------------------------------------
def topup_seller_wallet(
    db: Session, seller: Seller, amount_ugx: int, external_ref: str | None = None
) -> LedgerEntry:
    """Seller tops up their pre-paid wallet via MoMo."""
    seller.wallet_balance_ugx += amount_ugx
    return _add_entry(
        db,
        entry_type=LedgerEntryType.SELLER_WALLET_TOPUP,
        amount_ugx=amount_ugx,
        description=f"Wallet top-up: UGX {amount_ugx:,}",
        seller=seller,
        external_ref=external_ref,
    )


def charge_platform_fee(db: Session, order: Order) -> LedgerEntry:
    """Deduct platform fee from seller's wallet when order is created."""
    seller = order.seller
    fee = settings.platform_fee_ugx
    seller.wallet_balance_ugx -= fee
    return _add_entry(
        db,
        entry_type=LedgerEntryType.PLATFORM_FEE,
        amount_ugx=fee,
        description=f"Delivery fee for order {order.short_code}",
        order=order,
        seller=seller,
    )


# -----------------------------------------------------------------------------
# Delivery completion entries
# -----------------------------------------------------------------------------
def record_rider_earning(db: Session, order: Order) -> LedgerEntry:
    """Credit the rider for a completed delivery."""
    return _add_entry(
        db,
        entry_type=LedgerEntryType.RIDER_EARNING,
        amount_ugx=settings.rider_payout_ugx,
        description=f"Earnings for delivery {order.short_code}",
        order=order,
        rider=order.rider,
    )


def record_cod_collected(db: Session, order: Order) -> LedgerEntry:
    """Rider has received cash from customer at delivery."""
    rider = order.rider
    if rider is not None:
        rider.cash_float_ugx += order.item_value_ugx
    return _add_entry(
        db,
        entry_type=LedgerEntryType.COD_COLLECTED,
        amount_ugx=order.item_value_ugx,
        description=f"Cash collected from {order.customer_name} ({order.short_code})",
        order=order,
        rider=rider,
        seller=order.seller,
    )


def record_cod_deposited(
    db: Session, order: Order, momo_ref: str | None = None
) -> LedgerEntry:
    """Rider deposited cash to platform MoMo. Cash is now safe."""
    rider = order.rider
    if rider is not None:
        rider.cash_float_ugx -= order.item_value_ugx
    return _add_entry(
        db,
        entry_type=LedgerEntryType.COD_DEPOSITED,
        amount_ugx=order.item_value_ugx,
        description=f"Cash deposited to MoMo for {order.short_code}",
        order=order,
        rider=rider,
        seller=order.seller,
        external_ref=momo_ref,
    )


def credit_seller_for_cod(db: Session, order: Order) -> LedgerEntry:
    """Move COD funds into seller's wallet (after rider deposit)."""
    seller = order.seller
    seller.wallet_balance_ugx += order.item_value_ugx
    return _add_entry(
        db,
        entry_type=LedgerEntryType.SELLER_PAYOUT,
        amount_ugx=order.item_value_ugx,
        description=f"COD payout to seller for {order.short_code}",
        order=order,
        seller=seller,
    )


# -----------------------------------------------------------------------------
# Settlement orchestrator
# -----------------------------------------------------------------------------
def settle_order(db: Session, order: Order, momo_ref: str | None = None) -> list[LedgerEntry]:
    """
    Run the full settlement for a delivered order.

    For MoMo: just record rider earning (platform fee was charged at creation;
              customer paid seller directly outside our system).
    For COD: record collection -> deposit -> seller payout, plus rider earning.
    """
    entries: list[LedgerEntry] = []

    if order.payment_mode == PaymentMode.MOMO:
        entries.append(record_rider_earning(db, order))
    else:  # COD
        entries.append(record_cod_collected(db, order))
        entries.append(record_cod_deposited(db, order, momo_ref=momo_ref))
        entries.append(credit_seller_for_cod(db, order))
        entries.append(record_rider_earning(db, order))

    return entries
