"""
Rider routes.
"""
from __future__ import annotations

import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import LedgerEntry, LedgerEntryType, Order, OrderStatus, Rider
from app.db.schemas import (
    BatteryUpdate,
    LedgerEntryOut,
    OrderOut,
    RiderCreate,
    RiderLocationUpdate,
    RiderOut,
)
from app.services.notifications import send_whatsapp

router = APIRouter(prefix="/riders", tags=["riders"])


def _normalize_phone(phone: str) -> str:
    p = re.sub(r"[\s\-()]+", "", phone or "")
    if p.startswith("0") and len(p) >= 9:
        p = "+256" + p[1:]
    elif p.startswith("256"):
        p = "+" + p
    elif p.isdigit() and len(p) == 9:
        p = "+256" + p
    return p


@router.post("", response_model=RiderOut, status_code=201)
def create_rider(payload: RiderCreate, db: Session = Depends(get_db)):
    phone = _normalize_phone(payload.phone)
    existing = db.query(Rider).filter(Rider.phone == phone).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"This phone is already registered as {existing.full_name}.",
        )

    rider = Rider(
        full_name=payload.full_name.strip(),
        phone=phone,
        nin=payload.nin,
        plate_number=payload.plate_number,
        stage=payload.stage,
        chairman_reference=payload.chairman_reference,
        photo_url=payload.photo_url,
    )
    db.add(rider)
    db.commit()
    db.refresh(rider)

    try:
        first_name = (rider.full_name.split() or [rider.full_name])[0]
        send_whatsapp(
            rider.phone,
            (
                f"🏍️ Welcome to *Tukole*, {first_name}!\n\n"
                f"You're registered as a Tukole rider. Your dashboard:\n"
                f"{settings.public_base_url}/rider/{rider.id}\n\n"
                f"Open it on your phone — bookmark it or 'Add to Home Screen' "
                f"so you can accept jobs anytime."
            ),
        )
    except Exception:
        pass

    return rider


@router.get("/{rider_id}", response_model=RiderOut)
def get_rider(rider_id: str, db: Session = Depends(get_db)):
    r = db.query(Rider).filter(Rider.id == rider_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rider not found")
    return r


@router.get("/by-phone/{phone}", response_model=RiderOut)
def get_rider_by_phone(phone: str, db: Session = Depends(get_db)):
    p = _normalize_phone(phone)
    r = db.query(Rider).filter(Rider.phone == p).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rider not found")
    return r


@router.post("/{rider_id}/location", response_model=RiderOut)
def update_location(
    rider_id: str, payload: RiderLocationUpdate, db: Session = Depends(get_db)
):
    r = db.query(Rider).filter(Rider.id == rider_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rider not found")
    r.current_lat = payload.lat
    r.current_lng = payload.lng
    r.last_location_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    return r


@router.post("/{rider_id}/battery", response_model=RiderOut)
def update_battery(
    rider_id: str, payload: BatteryUpdate, db: Session = Depends(get_db)
):
    """
    Rider self-reports their battery level. Valid: full / most / half / low.
    Used by assignment to skip low-battery riders for long jobs.
    """
    r = db.query(Rider).filter(Rider.id == rider_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rider not found")

    level = (payload.level or "").strip().lower()
    if level not in ("full", "most", "half", "low"):
        raise HTTPException(
            status_code=400,
            detail="Battery level must be one of: full, most, half, low",
        )
    r.battery_level = level
    r.battery_updated_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    return r


@router.get("/{rider_id}/jobs", response_model=list[OrderOut])
def list_jobs(rider_id: str, db: Session = Depends(get_db)):
    """Active jobs for a rider — anything not yet settled / refunded / failed."""
    active_statuses = [
        OrderStatus.ASSIGNED,
        OrderStatus.PICKED_UP,
        OrderStatus.DELIVERING,
        OrderStatus.AT_CUSTOMER,
        OrderStatus.DELIVERED,
        OrderStatus.DISPUTED,
    ]
    return (
        db.query(Order)
        .filter(Order.rider_id == rider_id, Order.status.in_(active_statuses))
        .order_by(Order.assigned_at.desc().nullslast())
        .all()
    )


@router.get("/{rider_id}/history", response_model=list[OrderOut])
def list_history(rider_id: str, db: Session = Depends(get_db)):
    """Completed jobs for the rider."""
    return (
        db.query(Order)
        .filter(
            Order.rider_id == rider_id,
            Order.status.in_(
                [OrderStatus.SETTLED, OrderStatus.REFUNDED, OrderStatus.FAILED]
            ),
        )
        .order_by(Order.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/{rider_id}/earnings", response_model=list[LedgerEntryOut])
def list_earnings(rider_id: str, db: Session = Depends(get_db)):
    return (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.rider_id == rider_id,
            LedgerEntry.entry_type == LedgerEntryType.ESCROW_RELEASE_RIDER,
        )
        .order_by(LedgerEntry.created_at.desc())
        .limit(100)
        .all()
    )


@router.get("", response_model=list[RiderOut])
def list_active_riders(db: Session = Depends(get_db)):
    """Used for the seller's live map."""
    return db.query(Rider).filter(Rider.is_active.is_(True)).all()
