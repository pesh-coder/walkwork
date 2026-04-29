"""
OTP service for delivery confirmation.

The customer receives a 4-digit code by SMS when the rider marks "delivered".
The rider must collect this code from the customer and enter it in the app.
This proves the package physically reached the customer.
"""
from __future__ import annotations

import secrets


def generate_otp() -> str:
    """Generate a 4-digit numeric OTP. Avoids leading zeros for readability."""
    return f"{secrets.randbelow(9000) + 1000}"  # range 1000-9999


def verify_otp(stored: str | None, submitted: str) -> bool:
    if not stored or not submitted:
        return False
    return stored.strip() == submitted.strip()
