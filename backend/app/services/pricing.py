"""
Delivery pricing engine.

Auto-quotes a delivery fee using:
  base_fare + (distance_km × per_km) + (estimated_minutes × per_min)
  multiplied by a surge factor + parcel size supplements.

Numbers tuned for Kampala 2026 with electric boda economics. The numbers are
intentionally honest — defensible to investors and judges.

The seller can always override the auto-quote.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import math
from typing import Optional

# === Tunable constants ===
BASE_FARE_UGX       = 2_000     # covers pickup time, regardless of distance
PER_KM_UGX          = 800       # electric boda is ~half the fuel cost of petrol
PER_MIN_UGX         = 100       # covers traffic, customer wait time
AVG_SPEED_KMH       = 18        # realistic Kampala average

# Surge windows (24h Kampala time)
RUSH_HOURS          = (17, 19)  # 5 PM – 7 PM
RUSH_SURGE          = 1.30
RAIN_SURGE          = 1.50      # caller flags if raining; we don't auto-detect

# Parcel size supplements
PARCEL_LARGE_UGX    = 1_000
PARCEL_FRAGILE_UGX  = 3_000

# Final rounding — keep the numbers human-readable
ROUND_TO_UGX        = 500


@dataclass
class PricingQuote:
    distance_km: float
    estimated_minutes: int
    base_fare_ugx: int
    distance_charge_ugx: int
    time_charge_ugx: int
    parcel_supplement_ugx: int
    surge_multiplier: float
    surge_reason: Optional[str]
    subtotal_ugx: int
    total_ugx: int

    def to_dict(self) -> dict:
        return {
            "distance_km":            round(self.distance_km, 2),
            "estimated_minutes":      self.estimated_minutes,
            "base_fare_ugx":          self.base_fare_ugx,
            "distance_charge_ugx":    self.distance_charge_ugx,
            "time_charge_ugx":        self.time_charge_ugx,
            "parcel_supplement_ugx":  self.parcel_supplement_ugx,
            "surge_multiplier":       self.surge_multiplier,
            "surge_reason":           self.surge_reason,
            "subtotal_ugx":           self.subtotal_ugx,
            "total_ugx":              self.total_ugx,
        }


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def _round(amount: float) -> int:
    return int(round(amount / ROUND_TO_UGX) * ROUND_TO_UGX)


def quote_delivery(
    *,
    pickup_lat: float,
    pickup_lng: float,
    drop_lat: float,
    drop_lng: float,
    parcel_size: str = "regular",   # 'regular' | 'large' | 'fragile'
    is_raining: bool = False,
    now: Optional[datetime] = None,
) -> PricingQuote:
    """
    Compute a delivery quote.

    Distance and time are computed; surge is applied based on the time of day
    and the rain flag (which the seller can toggle if they know it's raining).
    """
    distance_km = haversine_km(pickup_lat, pickup_lng, drop_lat, drop_lng)
    distance_km = max(distance_km, 0.5)  # don't go below half a km
    minutes = max(1, int(round((distance_km / AVG_SPEED_KMH) * 60)))

    base = BASE_FARE_UGX
    distance_charge = int(distance_km * PER_KM_UGX)
    time_charge = minutes * PER_MIN_UGX

    parcel_supplement = 0
    if parcel_size == "large":
        parcel_supplement = PARCEL_LARGE_UGX
    elif parcel_size == "fragile":
        parcel_supplement = PARCEL_FRAGILE_UGX

    # Surge selection
    n = now or datetime.utcnow()
    surge = 1.0
    surge_reason: Optional[str] = None
    if is_raining:
        surge = RAIN_SURGE
        surge_reason = "rain"
    else:
        # Use Kampala local hour (UTC+3)
        local_hour = (n.hour + 3) % 24
        if RUSH_HOURS[0] <= local_hour < RUSH_HOURS[1]:
            surge = RUSH_SURGE
            surge_reason = "rush_hour"

    subtotal = base + distance_charge + time_charge + parcel_supplement
    total = _round(subtotal * surge)

    return PricingQuote(
        distance_km=distance_km,
        estimated_minutes=minutes,
        base_fare_ugx=base,
        distance_charge_ugx=distance_charge,
        time_charge_ugx=time_charge,
        parcel_supplement_ugx=parcel_supplement,
        surge_multiplier=surge,
        surge_reason=surge_reason,
        subtotal_ugx=subtotal,
        total_ugx=total,
    )
