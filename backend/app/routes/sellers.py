"""
Seller routes.
"""
from __future__ import annotations

import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import LedgerEntry, Order, Seller
from app.db.schemas import (
    LedgerEntryOut,
    OrderOut,
    SellerCreate,
    SellerOut,
    SellerUpdate,
    WalletTopup,
)
from app.services import ledger as ledger_service
from app.services.notifications import send_whatsapp

router = APIRouter(prefix="/sellers", tags=["sellers"])

WELCOME_CREDIT_UGX = 10_000


def _normalize_phone(phone: str) -> str:
    p = re.sub(r"[\s\-()]+", "", phone or "")
    if p.startswith("0") and len(p) >= 9:
        p = "+256" + p[1:]
    elif p.startswith("256"):
        p = "+" + p
    elif p.isdigit() and len(p) == 9:
        p = "+256" + p
    return p


def _slugify(text: str) -> str:
    """Kebab-case a string for use as a URL slug."""
    s = re.sub(r"[^\w\s-]", "", text.lower())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s or "shop"


def _ensure_unique_slug(db: Session, base: str, exclude_id: str | None = None) -> str:
    """Return `base`, or base-2, base-3, ... until unique."""
    slug = base
    n = 2
    while True:
        q = db.query(Seller).filter(Seller.slug == slug)
        if exclude_id:
            q = q.filter(Seller.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


# Brand palette for auto-assigned avatar colors
_AVATAR_COLORS = [
    "#0E6B6B", "#0C5757", "#3E9595", "#EF6018",
    "#C84B0A", "#FF7B3A", "#0A4444", "#6BB3B3",
]


def _pick_color(business_name: str) -> str:
    h = sum(ord(c) for c in business_name) if business_name else 0
    return _AVATAR_COLORS[h % len(_AVATAR_COLORS)]


@router.get("", response_model=list[SellerOut])
def list_all_sellers(db: Session = Depends(get_db)):
    """List all sellers — used by Tukole admin for fleet management."""
    return db.query(Seller).order_by(Seller.created_at.desc()).all()


@router.post("", response_model=SellerOut, status_code=201)
def create_seller(payload: SellerCreate, db: Session = Depends(get_db)):
    phone = _normalize_phone(payload.phone)
    existing = db.query(Seller).filter(Seller.phone == phone).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"This phone is already registered as {existing.business_name}.",
        )

    base_slug = _slugify(payload.business_name)
    slug = _ensure_unique_slug(db, base_slug)

    seller = Seller(
        business_name=payload.business_name.strip(),
        owner_name=payload.owner_name.strip(),
        phone=phone,
        email=payload.email,
        location_area=payload.location_area,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        pickup_notes=payload.pickup_notes,
        slug=slug,
        whatsapp_number=phone,
        profile_color=_pick_color(payload.business_name),
        wallet_balance_ugx=0,
    )
    db.add(seller)
    db.flush()

    # Welcome credit (logged on the ledger so the seller can see it)
    ledger_service.topup_seller_wallet(
        db, seller, WELCOME_CREDIT_UGX, external_ref="WELCOME-CREDIT"
    )

    db.commit()
    db.refresh(seller)

    try:
        first_name = (seller.owner_name.split() or [seller.owner_name])[0]
        send_whatsapp(
            seller.phone,
            (
                f"👋 Welcome to *Tukole*, {first_name}!\n\n"
                f"Your *{seller.business_name}* account is ready.\n"
                f"💰 Starter credit: UGX {WELCOME_CREDIT_UGX:,}\n\n"
                f"📊 Your dashboard:\n{settings.public_base_url}/seller/{seller.id}\n\n"
                f"From there you can create orders, see your bodas live on the map, "
                f"and track your earnings."
            ),
        )
    except Exception:
        pass

    return seller


@router.get("/{seller_id}", response_model=SellerOut)
def get_seller(seller_id: str, db: Session = Depends(get_db)):
    s = db.query(Seller).filter(Seller.id == seller_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Seller not found")
    return s


@router.get("/by-phone/{phone}", response_model=SellerOut)
def get_seller_by_phone(phone: str, db: Session = Depends(get_db)):
    p = _normalize_phone(phone)
    s = db.query(Seller).filter(Seller.phone == p).first()
    if not s:
        raise HTTPException(status_code=404, detail="Seller not found")
    return s


@router.patch("/{seller_id}", response_model=SellerOut)
def update_seller(seller_id: str, payload: SellerUpdate, db: Session = Depends(get_db)):
    s = db.query(Seller).filter(Seller.id == seller_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Seller not found")
    data = payload.model_dump(exclude_unset=True)

    # If slug is being changed, validate format and uniqueness
    if "slug" in data and data["slug"]:
        new_slug = _slugify(data["slug"])
        if new_slug != s.slug:
            data["slug"] = _ensure_unique_slug(db, new_slug, exclude_id=s.id)

    if "whatsapp_number" in data and data["whatsapp_number"]:
        data["whatsapp_number"] = _normalize_phone(data["whatsapp_number"])

    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.post("/{seller_id}/wallet", response_model=SellerOut)
def topup_wallet(seller_id: str, payload: WalletTopup, db: Session = Depends(get_db)):
    s = db.query(Seller).filter(Seller.id == seller_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Seller not found")
    ledger_service.topup_seller_wallet(
        db, s, payload.amount_ugx, external_ref=payload.external_ref
    )
    db.commit()
    db.refresh(s)
    return s


@router.get("/{seller_id}/orders", response_model=list[OrderOut])
def list_orders(seller_id: str, db: Session = Depends(get_db)):
    return (
        db.query(Order)
        .filter(Order.seller_id == seller_id)
        .order_by(Order.created_at.desc())
        .all()
    )


@router.get("/{seller_id}/ledger", response_model=list[LedgerEntryOut])
def list_ledger(seller_id: str, db: Session = Depends(get_db)):
    return (
        db.query(LedgerEntry)
        .filter(LedgerEntry.seller_id == seller_id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(200)
        .all()
    )
