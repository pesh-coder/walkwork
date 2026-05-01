"""
Rider assignment — fleet-aware.

Strategy:
1. Look at the seller's approved fleet (SellerRider with status=APPROVED).
2. Of those, pick the closest available one to the pickup point.
3. If the seller has no fleet (or no fleet members are available), fall back
   to any active+available rider in the system. This is the "graceful
   degradation" so a brand-new seller isn't locked out of deliveries before
   Tukole has assigned bodas to their fleet.
"""
from __future__ import annotations

import math
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import (
    FleetStatus,
    Order,
    Rider,
    SellerRider,
)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(
        math.radians(lat2)
    ) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _pick_closest(riders: list[Rider], lat: float | None, lng: float | None) -> Optional[Rider]:
    if not riders:
        return None
    if lat is None or lng is None:
        return riders[0]
    located = [
        r for r in riders if r.current_lat is not None and r.current_lng is not None
    ]
    if not located:
        return riders[0]
    located.sort(
        key=lambda r: _haversine_km(lat, lng, r.current_lat, r.current_lng)
    )
    return located[0]


def find_best_rider(db: Session, order: Order) -> Optional[Rider]:
    """
    Pick the best rider for this order, preferring fleet members.
    """
    if not order.seller_id:
        return None

    # 1. Try the seller's approved fleet first
    fleet_assignments = (
        db.query(SellerRider)
        .filter(
            SellerRider.seller_id == order.seller_id,
            SellerRider.status == FleetStatus.APPROVED,
        )
        .all()
    )
    fleet_riders = [
        a.rider
        for a in fleet_assignments
        if a.rider and a.rider.is_active and a.rider.is_available
    ]

    chosen = _pick_closest(fleet_riders, order.pickup_lat, order.pickup_lng)
    if chosen:
        return chosen

    # 2. Graceful fallback: any active+available rider
    fallback = (
        db.query(Rider)
        .filter(Rider.is_active.is_(True), Rider.is_available.is_(True))
        .all()
    )
    return _pick_closest(fallback, order.pickup_lat, order.pickup_lng)


def estimated_minutes_for_delivery(order: Order) -> Optional[int]:
    rider = order.rider
    if rider is None or order.customer_lat is None or order.customer_lng is None:
        return None
    if rider.current_lat is None or rider.current_lng is None:
        return None

    km = _haversine_km(
        rider.current_lat, rider.current_lng, order.customer_lat, order.customer_lng
    )
    minutes = (km / 20.0) * 60.0
    return max(1, int(round(minutes)))


def is_rider_in_fleet(db: Session, seller_id: str, rider_id: str) -> bool:
    """Check if rider is on this seller's approved fleet."""
    return (
        db.query(SellerRider)
        .filter(
            SellerRider.seller_id == seller_id,
            SellerRider.rider_id == rider_id,
            SellerRider.status == FleetStatus.APPROVED,
        )
        .first()
        is not None
    )
