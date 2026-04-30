"""
Seller routes.

Endpoints:
- POST   /sellers                       Create a seller (with welcome credit)
- GET    /sellers/{seller_id}           Get seller (incl. wallet balance)
- POST   /sellers/{seller_id}/wallet    Top up wallet (mocked MoMo)
- GET    /sellers/{seller_id}/orders    List a seller's orders
- GET    /sellers/{seller_id}/ledger    Cash flow timeline (the differentiator)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import LedgerEntry, LedgerEntryType, Order, Seller
from app.db.schemas import (
    LedgerEntryOut,
    OrderOut,
    SellerCreate,
    SellerOut,
    WalletTopup,
)
from app.services import ledger as ledger_service
from app.services.notifications import send_whatsapp

router = APIRouter(prefix="/sellers", tags=["sellers"])


# Starter wallet credit — covers ~6 first deliveries so a new seller can get
# value from their first order without needing to top up MoMo first.
WELCOME_CREDIT_UGX = 10_000


def _normalize_phone(phone: str) -> str:
    """Normalize Ugandan phone numbers to E.164 (+256...)."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("0"):
        p = "+256" + p[1:]
    elif p.startswith("256"):
        p = "+" + p
    elif not p.startswith("+"):
        p = "+" + p
    return p


@router.post("", response_model=SellerOut, status_code=201)
def create_seller(payload: SellerCreate, db: Session = Depends(get_db)):
    phone = _normalize_phone(payload.phone)

    existing = db.query(Seller).filter(Seller.phone == phone).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"This phone is already registered as {existing.business_name}.",
        )

    seller = Seller(
        business_name=payload.business_name.strip(),
        owner_name=payload.owner_name.strip(),
        phone=phone,
        email=payload.email,
        location_area=payload.location_area,
        wallet_balance_ugx=0,  # we'll credit via the ledger so it shows up there
    )
    db.add(seller)
    db.flush()

    # Welcome credit — recorded as a ledger entry so it shows in the cash flow
    ledger_service.topup_seller_wallet(
        db, seller, WELCOME_CREDIT_UGX, external_ref="WELCOME-CREDIT"
    )

    db.commit()
    db.refresh(seller)

    # Send the seller their dashboard link via WhatsApp.
    # Wrapped in try/except since we don't want a Twilio hiccup to fail signup.
    try:
        send_whatsapp(
            seller.phone,
            (
                f"👋 Welcome to *Tukole*, {seller.owner_name.split()[0]}!\n\n"
                f"Your *{seller.business_name}* account is ready.\n"
                f"💰 Starter credit: UGX {WELCOME_CREDIT_UGX:,} (good for ~6 deliveries).\n\n"
                f"📊 Your dashboard:\n{settings.public_base_url}/seller/{seller.id}\n\n"
                f"To create an order, reply with:\n"
                f"*Order: <area>, <customer phone>, <name>, <item> UGX <amount> <COD or MOMO>*\n\n"
                f"Example:\n"
                f"Order: Bukoto, 0772999888, Jane, dress UGX 85,000 COD"
            ),
        )
    except Exception:
        # The seller is created; if WhatsApp failed they'll still see their
        # dashboard via the redirect on the frontend.
        pass

    return seller


@router.get("/{seller_id}", response_model=SellerOut)
def get_seller(seller_id: str, db: Session = Depends(get_db)):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    return seller


@router.get("/by-phone/{phone}", response_model=SellerOut)
def get_seller_by_phone(phone: str, db: Session = Depends(get_db)):
    """Used by WhatsApp webhook to look up the seller from the From number."""
    seller = db.query(Seller).filter(Seller.phone == phone).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    return seller


@router.post("/{seller_id}/wallet", response_model=SellerOut)
def topup_wallet(seller_id: str, payload: WalletTopup, db: Session = Depends(get_db)):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    ledger_service.topup_seller_wallet(
        db, seller, payload.amount_ugx, external_ref=payload.external_ref
    )
    db.commit()
    db.refresh(seller)
    return seller


@router.get("/{seller_id}/orders", response_model=list[OrderOut])
def list_orders(seller_id: str, db: Session = Depends(get_db)):
    orders = (
        db.query(Order)
        .filter(Order.seller_id == seller_id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return orders


@router.get("/{seller_id}/ledger", response_model=list[LedgerEntryOut])
def list_ledger(seller_id: str, db: Session = Depends(get_db)):
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.seller_id == seller_id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(200)
        .all()
    )
    return entries