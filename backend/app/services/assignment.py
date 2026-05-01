"""
Rider assignment.
"""
from __future__ import annotations

import math
from typing import Optional

from sqlalchemy.orm import Session

from app.db.models import Order, Rider


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

    return candidates[0]


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
