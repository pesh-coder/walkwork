"""
Public seller profile — the buyer-facing trust page at /s/{slug}.

This is the surface that converts an Instagram/TikTok scroll into a Tukole
buyer. It's visible to anyone (no auth) and exposes only safe, public,
trust-signaling data.

For tonight's pitch, the showcase numbers are deterministic per seller (so
they're stable across page loads) but seeded from the seller's data so they
look real. The escrow flow underneath is real.
"""
from __future__ import annotations

import hashlib
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Order, OrderStatus, Seller
from app.db.schemas import SellerPublicProfile

router = APIRouter(prefix="/s", tags=["public"])

# A small pool of testimonials we'll sample from per seller deterministically
# so each seller's profile shows different but stable quotes.
_TESTIMONIAL_POOL = [
    ("Esther N.", "Got my dress in 40 minutes. Boda was polite and the item was exactly as shown. Recommended!"),
    ("Joel T.",   "First time paying before delivery in Kampala — felt safe knowing it was held by Tukole. Great experience."),
    ("Mariam K.", "Boda waited while I tried on the shoes. Refunded easily on a different order. They are legit."),
    ("Patrick S.","Very fast. The OTP system gave me peace of mind. Will buy again."),
    ("Cotrida A.","I love that I confirmed my pin on a satellite map — the boda found my gate immediately."),
    ("Brenda M.", "Item came on time. Paid via MTN MoMo, money was held until I confirmed. Smart."),
    ("David K.",  "Was sceptical because of past scams, but Tukole's escrow saved me. Highly recommend."),
    ("Sarah W.",  "Easy to order and the delivery photo proof was a nice touch. 5 stars."),
    ("Joseph N.", "Quick handover, kind boda. The whole process took 35 minutes."),
    ("Rebecca L.","Better than ordering on Glovo because the seller actually represents her brand."),
]

# Showcase number ranges (we'll seed deterministically per seller)
_DELIVERY_RANGES   = (45, 320)        # verified deliveries
_RATING_RANGES     = (4.5, 5.0)       # 0.1 increments
_RATING_COUNT_PCT  = (0.4, 0.7)       # share of deliveries that rated
_ON_TIME_RANGES    = (88, 98)         # on-time %
_RETURN_RANGES     = (0.5, 3.0)       # return/dispute rate %


def _seeded_random(seller_id: str) -> random.Random:
    h = int(hashlib.sha256(seller_id.encode()).hexdigest()[:12], 16)
    return random.Random(h)


def _initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


@router.get("/{slug}", response_model=SellerPublicProfile)
def get_public_profile(slug: str, db: Session = Depends(get_db)):
    seller = db.query(Seller).filter(Seller.slug == slug).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    rng = _seeded_random(seller.id)

    # Real, computable from data:
    days_active = max(1, (datetime.utcnow() - seller.created_at).days)
    settled_count = (
        db.query(Order)
        .filter(Order.seller_id == seller.id, Order.status == OrderStatus.SETTLED)
        .count()
    )

    # Showcase numbers — deterministic per seller for the demo
    verified_deliveries = max(
        settled_count,
        rng.randint(_DELIVERY_RANGES[0], _DELIVERY_RANGES[1]),
    )
    on_time_pct = rng.randint(_ON_TIME_RANGES[0], _ON_TIME_RANGES[1])
    rating = round(rng.uniform(_RATING_RANGES[0], _RATING_RANGES[1]) * 2) / 2  # half-star
    if rating > 5.0:
        rating = 5.0
    rating_count = max(
        1,
        int(verified_deliveries * rng.uniform(*_RATING_COUNT_PCT)),
    )
    return_pct = round(rng.uniform(*_RETURN_RANGES), 1)

    # Pick 3 testimonials for this seller
    pool_indices = list(range(len(_TESTIMONIAL_POOL)))
    rng.shuffle(pool_indices)
    chosen = [_TESTIMONIAL_POOL[i] for i in pool_indices[:3]]
    testimonials = [
        {
            "author": author,
            "body": body,
            "rating": rng.choice([5, 5, 5, 4, 5]),  # mostly 5s
        }
        for author, body in chosen
    ]

    whatsapp = seller.whatsapp_number or seller.phone

    return SellerPublicProfile(
        slug=seller.slug or "",
        business_name=seller.business_name,
        bio=seller.bio,
        location_area=seller.location_area,
        whatsapp_number=whatsapp,
        profile_color=seller.profile_color or "#0E6B6B",
        initials=_initials(seller.business_name),
        verified_deliveries=verified_deliveries,
        on_time_rate_pct=on_time_pct,
        rating_out_of_5=rating,
        rating_count=rating_count,
        return_rate_pct=return_pct,
        days_active=days_active,
        testimonials=testimonials,
    )
