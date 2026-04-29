"""
Short code generation for orders.

Short codes are human-friendly identifiers like TK1247 used in:
- WhatsApp messages
- SMS to customer
- Tracking URL slug
- Demo narrative
"""
from __future__ import annotations

import random
from sqlalchemy.orm import Session

from app.db.models import Order


def generate_short_code(db: Session) -> str:
    """
    Generate a short code like TK1247.
    Tries a random 4-digit number; retries on collision.
    For a demo with <10k orders this is fine.
    """
    for _ in range(20):
        code = f"TK{random.randint(1000, 9999)}"
        exists = db.query(Order).filter(Order.short_code == code).first()
        if not exists:
            return code
    # Fallback (extremely unlikely): timestamp suffix
    import time
    return f"TK{int(time.time()) % 100000}"
