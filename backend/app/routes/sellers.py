"""
Seller routes.

Endpoints:
- POST   /sellers                       Create a seller
- GET    /sellers/{seller_id}           Get seller (incl. wallet balance)
- POST   /sellers/{seller_id}/wallet    Top up wallet (mocked MoMo)
- GET    /sellers/{seller_id}/orders    List a seller's orders
- GET    /sellers/{seller_id}/ledger    Cash flow timeline (the differentiator)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import LedgerEntry, Order, Seller
from app.db.schemas import (
    LedgerEntryOut,
    OrderOut,
    SellerCreate,
    SellerOut,
    WalletTopup,
)
from app.services import ledger as ledger_service

router = APIRouter(prefix="/sellers", tags=["sellers"])


@router.post("", response_model=SellerOut, status_code=201)
def create_seller(payload: SellerCreate, db: Session = Depends(get_db)):
    existing = db.query(Seller).filter(Seller.phone == payload.phone).first()
    if existing:
        raise HTTPException(status_code=409, detail="Seller with this phone already exists")

    seller = Seller(**payload.model_dump())
    db.add(seller)
    db.commit()
    db.refresh(seller)
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
