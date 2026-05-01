"""
Ledger service — escrow flow.

Money movements:

1. ESCROW DEPOSIT: customer pays product_price + delivery_fee into escrow.
   We create one ESCROW_DEPOSIT entry tagged to the order.

2. ESCROW RELEASE (on customer approval):
   - ESCROW_RELEASE_RIDER: rider gets full delivery_fee → rider wallet
   - ESCROW_RELEASE_SELLER: seller gets product_price - commission → seller wallet
   - ESCROW_RELEASE_PLATFORM: platform keeps commission + platform_fee

3. ESCROW REFUND (on dispute resolved buyer-fault):
   - ESCROW_REFUND: full amount returned to customer
   - But rider still gets paid (they did the labour)
   - Seller may be charged a PENALTY for return delivery

4. SELLER WITHDRAW: seller pulls money out of wallet to MoMo (mocked)
5. RIDER WITHDRAW: rider pulls earnings out of wallet to MoMo (mocked)
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import (
    EscrowStatus,
    LedgerEntry,
    LedgerEntryType,
    Order,
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
# Escrow deposit (customer paid)
# -----------------------------------------------------------------------------
def record_escrow_deposit(
    db: Session, order: Order, payment_ref: str | None = None
) -> LedgerEntry:
    order.escrow_status = EscrowStatus.HELD
    order.escrow_paid_at = datetime.utcnow()
    return _add_entry(
        db,
        entry_type=LedgerEntryType.ESCROW_DEPOSIT,
        amount_ugx=order.total_charge_ugx,
        description=(
            f"Customer paid UGX {order.total_charge_ugx:,} into escrow "
            f"for order {order.short_code}"
        ),
        order=order,
        seller=order.seller,
        external_ref=payment_ref,
    )


# -----------------------------------------------------------------------------
# Escrow release (customer approved delivery)
# -----------------------------------------------------------------------------
def release_escrow(db: Session, order: Order) -> list[LedgerEntry]:
    """
    Release the held escrow per the standard split:
    - Rider gets delivery_fee (always — they did the work)
    - Seller gets item_value - commission
    - Platform keeps commission + platform_fee
    """
    entries: list[LedgerEntry] = []

    # 1. Rider payout
    if order.rider:
        order.rider.wallet_balance_ugx += order.delivery_fee_ugx
        entries.append(_add_entry(
            db,
            entry_type=LedgerEntryType.ESCROW_RELEASE_RIDER,
            amount_ugx=order.delivery_fee_ugx,
            description=f"Delivery fee for {order.short_code}",
            order=order,
            rider=order.rider,
        ))

    # 2. Seller payout (item value minus commission)
    seller_take = order.seller_payout_ugx
    order.seller.wallet_balance_ugx += seller_take
    entries.append(_add_entry(
        db,
        entry_type=LedgerEntryType.ESCROW_RELEASE_SELLER,
        amount_ugx=seller_take,
        description=(
            f"Sale of {order.item_description} ({order.short_code}). "
            f"Commission: UGX {order.commission_ugx:,}"
        ),
        order=order,
        seller=order.seller,
    ))

    # 3. Platform take
    entries.append(_add_entry(
        db,
        entry_type=LedgerEntryType.ESCROW_RELEASE_PLATFORM,
        amount_ugx=order.platform_take_ugx,
        description=f"Platform fee + commission for {order.short_code}",
        order=order,
        seller=order.seller,
    ))

    order.escrow_status = EscrowStatus.RELEASED
    order.escrow_released_at = datetime.utcnow()
    return entries


# -----------------------------------------------------------------------------
# Escrow refund (dispute resolved buyer-fault, or rider couldn't deliver)
# -----------------------------------------------------------------------------
def refund_escrow(
    db: Session,
    order: Order,
    pay_rider_anyway: bool = True,
    penalize_seller: bool = True,
) -> list[LedgerEntry]:
    """
    Refund the customer. Rider still gets paid if they did the work.
    Seller eats the penalty for return delivery if at fault.
    """
    entries: list[LedgerEntry] = []

    # 1. Customer refund (full charge back)
    entries.append(_add_entry(
        db,
        entry_type=LedgerEntryType.ESCROW_REFUND,
        amount_ugx=order.total_charge_ugx,
        description=(
            f"Refund to customer for {order.short_code} — "
            f"customer rejected the item"
        ),
        order=order,
        seller=order.seller,
    ))

    # 2. Rider still gets paid if they did the trip
    if pay_rider_anyway and order.rider:
        order.rider.wallet_balance_ugx += order.delivery_fee_ugx
        entries.append(_add_entry(
            db,
            entry_type=LedgerEntryType.ESCROW_RELEASE_RIDER,
            amount_ugx=order.delivery_fee_ugx,
            description=(
                f"Delivery fee for {order.short_code} (paid despite refund — "
                f"rider performed the trip)"
            ),
            order=order,
            rider=order.rider,
        ))

    # 3. Seller penalty (the rider has to be paid; seller eats it because they
    # sent the wrong item or one not as described)
    if penalize_seller:
        # Take from seller wallet if there's balance, else they go negative
        order.seller.wallet_balance_ugx -= order.delivery_fee_ugx
        entries.append(_add_entry(
            db,
            entry_type=LedgerEntryType.PENALTY,
            amount_ugx=order.delivery_fee_ugx,
            description=(
                f"Return-delivery penalty for {order.short_code} — "
                f"item was rejected by customer"
            ),
            order=order,
            seller=order.seller,
        ))

    order.escrow_status = EscrowStatus.REFUNDED
    order.escrow_released_at = datetime.utcnow()
    return entries


# -----------------------------------------------------------------------------
# Wallet ops (mocked withdrawals)
# -----------------------------------------------------------------------------
def withdraw_seller(
    db: Session, seller: Seller, amount_ugx: int, ref: str | None = None
) -> LedgerEntry:
    if amount_ugx > seller.wallet_balance_ugx:
        raise ValueError(
            f"Insufficient balance: have UGX {seller.wallet_balance_ugx:,}, "
            f"want UGX {amount_ugx:,}"
        )
    seller.wallet_balance_ugx -= amount_ugx
    return _add_entry(
        db,
        entry_type=LedgerEntryType.SELLER_WALLET_WITHDRAW,
        amount_ugx=amount_ugx,
        description=f"Withdrawal to MoMo: UGX {amount_ugx:,}",
        seller=seller,
        external_ref=ref,
    )


def withdraw_rider(
    db: Session, rider: Rider, amount_ugx: int, ref: str | None = None
) -> LedgerEntry:
    if amount_ugx > rider.wallet_balance_ugx:
        raise ValueError(
            f"Insufficient balance: have UGX {rider.wallet_balance_ugx:,}, "
            f"want UGX {amount_ugx:,}"
        )
    rider.wallet_balance_ugx -= amount_ugx
    return _add_entry(
        db,
        entry_type=LedgerEntryType.RIDER_WALLET_WITHDRAW,
        amount_ugx=amount_ugx,
        description=f"Withdrawal to MoMo: UGX {amount_ugx:,}",
        rider=rider,
        external_ref=ref,
    )


# Back-compat for the signup welcome-credit code that called topup_seller_wallet
def topup_seller_wallet(
    db: Session, seller: Seller, amount_ugx: int, external_ref: str | None = None
) -> LedgerEntry:
    """Used for signup welcome credit and admin top-ups."""
    seller.wallet_balance_ugx += amount_ugx
    return _add_entry(
        db,
        entry_type=LedgerEntryType.SELLER_WALLET_TOPUP,
        amount_ugx=amount_ugx,
        description=f"Wallet top-up: UGX {amount_ugx:,}",
        seller=seller,
        external_ref=external_ref,
    )
