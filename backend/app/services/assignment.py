"""
Rider assignment.

Strategy for the prototype:
1. If pickup location is set AND riders have GPS, pick nearest available.
2. Otherwise, pick any available rider (first one wins).
3. If none available, leave the order in PENDING.

This is intentionally dumb. A real system would consider:
- Rider's current cash float (cap at COD_DAILY_CAP_UGX)
- Recent acceptance rate
- Active deliveries already in progress
- Distance from pickup
We can layer those in post-hackathon.
"""
from __future__ import annotations

import math
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import Order, OrderStatus, PaymentMode, Rider


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(
        math.radians(lat2)
    ) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def find_best_rider(db: Session, order: Order) -> Optional[Rider]:
    candidates = (
        db.query(Rider)
        .filter(Rider.is_active.is_(True), Rider.is_available.is_(True))
        .all()
    )
    if not candidates:
        return None

    # Filter out riders whose cash float would exceed the cap if they took this COD job
    if order.payment_mode == PaymentMode.COD:
        candidates = [
            r
            for r in candidates
            if r.cash_float_ugx + order.item_value_ugx <= settings.cod_daily_cap_ugx
        ]
        if not candidates:
            return None

    # If we have pickup coords + rider coords, pick nearest
    if order.pickup_lat is not None and order.pickup_lng is not None:
        located = [
            r for r in candidates if r.current_lat is not None and r.current_lng is not None
        ]
        if located:
            located.sort(
                key=lambda r: _haversine_km(
                    order.pickup_lat, order.pickup_lng, r.current_lat, r.current_lng
                )
            )
            return located[0]

    # Fallback: first available
    return candidates[0]


def estimated_minutes_for_delivery(order: Order) -> Optional[int]:
    """Rough ETA based on rider distance to customer. Used in customer tracking page."""
    rider = order.rider
    if rider is None or order.customer_lat is None or order.customer_lng is None:
        return None
    if rider.current_lat is None or rider.current_lng is None:
        return None

    km = _haversine_km(
        rider.current_lat, rider.current_lng, order.customer_lat, order.customer_lng
    )
    # Assume 20 km/h average boda speed in Kampala traffic
    minutes = (km / 20.0) * 60.0
    return max(1, int(round(minutes)))
