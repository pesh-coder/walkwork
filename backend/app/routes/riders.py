"""
Rider routes.

Endpoints:
- POST   /riders                                Register a rider
- GET    /riders/{rider_id}                     Get rider (incl. cash float)
- GET    /riders/by-phone/{phone}               Look up by phone (used for login)
- POST   /riders/{rider_id}/location            Update GPS
- GET    /riders/{rider_id}/jobs                List rider's active orders
- GET    /riders/{rider_id}/earnings            List rider's earnings ledger
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import LedgerEntry, LedgerEntryType, Order, OrderStatus, Rider
from app.db.schemas import (
    LedgerEntryOut,
    OrderOut,
    RiderCreate,
    RiderLocationUpdate,
    RiderOut,
)

router = APIRouter(prefix="/riders", tags=["riders"])


@router.post("", response_model=RiderOut, status_code=201)
def create_rider(payload: RiderCreate, db: Session = Depends(get_db)):
    existing = db.query(Rider).filter(Rider.phone == payload.phone).first()
    if existing:
        raise HTTPException(status_code=409, detail="Rider with this phone already exists")

    rider = Rider(**payload.model_dump())
    db.add(rider)
    db.commit()
    db.refresh(rider)
    return rider


@router.get("/{rider_id}", response_model=RiderOut)
def get_rider(rider_id: str, db: Session = Depends(get_db)):
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    return rider


@router.get("/by-phone/{phone}", response_model=RiderOut)
def get_rider_by_phone(phone: str, db: Session = Depends(get_db)):
    rider = db.query(Rider).filter(Rider.phone == phone).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    return rider


@router.post("/{rider_id}/location", response_model=RiderOut)
def update_location(
    rider_id: str, payload: RiderLocationUpdate, db: Session = Depends(get_db)
):
    rider = db.query(Rider).filter(Rider.id == rider_id).first()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    rider.current_lat = payload.lat
    rider.current_lng = payload.lng
    rider.last_location_at = datetime.utcnow()
    db.commit()
    db.refresh(rider)
    return rider


@router.get("/{rider_id}/jobs", response_model=list[OrderOut])
def list_jobs(rider_id: str, db: Session = Depends(get_db)):
    """Active jobs for a rider (anything not yet settled or failed)."""
    active_statuses = [
        OrderStatus.ASSIGNED,
        OrderStatus.PICKED_UP,
        OrderStatus.DELIVERING,
        OrderStatus.OTP_PENDING,
        OrderStatus.DELIVERED,
    ]
    jobs = (
        db.query(Order)
        .filter(Order.rider_id == rider_id, Order.status.in_(active_statuses))
        .order_by(Order.assigned_at.desc())
        .all()
    )
    return jobs


@router.get("/{rider_id}/earnings", response_model=list[LedgerEntryOut])
def list_earnings(rider_id: str, db: Session = Depends(get_db)):
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.rider_id == rider_id,
            LedgerEntry.entry_type == LedgerEntryType.RIDER_EARNING,
        )
        .order_by(LedgerEntry.created_at.desc())
        .limit(100)
        .all()
    )
    return entries
