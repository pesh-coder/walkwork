"""
Fleet management routes.

The vetted-fleet model is Tukole's core differentiator. Tukole (admin) assigns
specific riders to specific sellers' fleets after vetting them.

Endpoints:
  GET    /sellers/{id}/fleet                 — list riders on this seller's fleet
  POST   /sellers/{id}/fleet                 — add a rider to the fleet
  PATCH  /sellers/{id}/fleet/{assignment_id} — update status / notes / coverage
  DELETE /sellers/{id}/fleet/{assignment_id} — remove from fleet (soft-removes)
  GET    /riders/{id}/fleets                 — sellers this rider serves
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import FleetStatus, Rider, Seller, SellerRider
from app.db.schemas import (
    FleetAssignmentCreate,
    FleetAssignmentOut,
    FleetAssignmentUpdate,
    FleetMemberDetail,
    RiderOut,
)

router = APIRouter(tags=["fleet"])


def _get_seller(db: Session, seller_id: str) -> Seller:
    s = db.query(Seller).filter(Seller.id == seller_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Seller not found")
    return s


def _get_rider(db: Session, rider_id: str) -> Rider:
    r = db.query(Rider).filter(Rider.id == rider_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rider not found")
    return r


def _get_assignment(db: Session, assignment_id: str) -> SellerRider:
    a = db.query(SellerRider).filter(SellerRider.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return a


# -----------------------------------------------------------------------------
# Seller's perspective: who is on my fleet?
# -----------------------------------------------------------------------------
@router.get("/sellers/{seller_id}/fleet", response_model=list[FleetMemberDetail])
def list_fleet(seller_id: str, db: Session = Depends(get_db)):
    _get_seller(db, seller_id)
    assignments = (
        db.query(SellerRider)
        .filter(SellerRider.seller_id == seller_id)
        .order_by(SellerRider.assigned_at.desc())
        .all()
    )
    return [
        FleetMemberDetail(
            assignment=FleetAssignmentOut.model_validate(a),
            rider=RiderOut.model_validate(a.rider),
        )
        for a in assignments
        if a.rider
    ]


# -----------------------------------------------------------------------------
# Tukole admin: assign a rider to a seller
# -----------------------------------------------------------------------------
@router.post(
    "/sellers/{seller_id}/fleet",
    response_model=FleetAssignmentOut,
    status_code=201,
)
def add_to_fleet(
    seller_id: str,
    payload: FleetAssignmentCreate,
    db: Session = Depends(get_db),
):
    _get_seller(db, seller_id)
    _get_rider(db, payload.rider_id)

    # Check if there's already an assignment (active or otherwise)
    existing = (
        db.query(SellerRider)
        .filter(
            SellerRider.seller_id == seller_id,
            SellerRider.rider_id == payload.rider_id,
        )
        .first()
    )

    if existing:
        # Reactivate / update if it was previously removed
        existing.status = FleetStatus.APPROVED
        if payload.coverage_areas:
            existing.coverage_areas = payload.coverage_areas
        if payload.seller_instructions:
            existing.seller_instructions = payload.seller_instructions
        if payload.vetting_notes:
            existing.vetting_notes = payload.vetting_notes
        existing.assigned_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    assignment = SellerRider(
        seller_id=seller_id,
        rider_id=payload.rider_id,
        status=FleetStatus.APPROVED,
        coverage_areas=payload.coverage_areas,
        seller_instructions=payload.seller_instructions,
        vetting_notes=payload.vetting_notes,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.patch(
    "/sellers/{seller_id}/fleet/{assignment_id}",
    response_model=FleetAssignmentOut,
)
def update_assignment(
    seller_id: str,
    assignment_id: str,
    payload: FleetAssignmentUpdate,
    db: Session = Depends(get_db),
):
    a = _get_assignment(db, assignment_id)
    if a.seller_id != seller_id:
        raise HTTPException(status_code=400, detail="Assignment doesn't belong to this seller")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return a


@router.delete(
    "/sellers/{seller_id}/fleet/{assignment_id}",
    response_model=FleetAssignmentOut,
)
def remove_from_fleet(
    seller_id: str,
    assignment_id: str,
    db: Session = Depends(get_db),
):
    """Soft-remove: keeps the record for history, but excludes from assignment."""
    a = _get_assignment(db, assignment_id)
    if a.seller_id != seller_id:
        raise HTTPException(status_code=400, detail="Assignment doesn't belong to this seller")
    a.status = FleetStatus.REMOVED
    db.commit()
    db.refresh(a)
    return a


# -----------------------------------------------------------------------------
# Rider's perspective: which sellers do I serve?
# -----------------------------------------------------------------------------
@router.get("/riders/{rider_id}/fleets", response_model=list[FleetAssignmentOut])
def list_rider_fleets(rider_id: str, db: Session = Depends(get_db)):
    _get_rider(db, rider_id)
    return (
        db.query(SellerRider)
        .filter(SellerRider.rider_id == rider_id)
        .order_by(SellerRider.assigned_at.desc())
        .all()
    )
