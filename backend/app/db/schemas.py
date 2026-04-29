"""
Pydantic schemas for API requests and responses.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

from app.db.models import OrderStatus, PaymentMode, CashStatus, LedgerEntryType


# -----------------------------------------------------------------------------
# Seller
# -----------------------------------------------------------------------------
class SellerCreate(BaseModel):
    business_name: str
    owner_name: str
    phone: str
    email: Optional[str] = None
    location_area: Optional[str] = None


class SellerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_name: str
    owner_name: str
    phone: str
    location_area: Optional[str] = None
    wallet_balance_ugx: int
    created_at: datetime


# -----------------------------------------------------------------------------
# Rider
# -----------------------------------------------------------------------------
class RiderCreate(BaseModel):
    full_name: str
    phone: str
    nin: Optional[str] = None
    plate_number: Optional[str] = None
    stage: Optional[str] = None
    chairman_reference: Optional[str] = None


class RiderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    phone: str
    plate_number: Optional[str] = None
    stage: Optional[str] = None
    photo_url: Optional[str] = None
    is_available: bool
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    cash_float_ugx: int


class RiderLocationUpdate(BaseModel):
    lat: float
    lng: float


# -----------------------------------------------------------------------------
# Order
# -----------------------------------------------------------------------------
class OrderCreate(BaseModel):
    seller_id: str
    customer_name: str
    customer_phone: str
    customer_area: str
    customer_address_notes: Optional[str] = None
    customer_lat: Optional[float] = None
    customer_lng: Optional[float] = None
    item_description: str
    item_value_ugx: int = Field(gt=0)
    payment_mode: PaymentMode
    pickup_area: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    short_code: str
    seller_id: str
    rider_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_area: str
    customer_address_notes: Optional[str] = None
    customer_lat: Optional[float] = None
    customer_lng: Optional[float] = None
    pickup_area: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    item_description: str
    item_value_ugx: int
    payment_mode: PaymentMode
    cash_status: CashStatus
    status: OrderStatus
    failure_reason: Optional[str] = None
    created_at: datetime
    assigned_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    settled_at: Optional[datetime] = None


class OrderTrackOut(BaseModel):
    """Public tracking view — no sensitive data, what the customer sees."""
    short_code: str
    status: OrderStatus
    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    rider_plate: Optional[str] = None
    rider_lat: Optional[float] = None
    rider_lng: Optional[float] = None
    customer_lat: Optional[float] = None
    customer_lng: Optional[float] = None
    item_description: str
    estimated_minutes: Optional[int] = None


class OTPVerify(BaseModel):
    otp_code: str


class CashConfirm(BaseModel):
    confirmed: bool


class FailDelivery(BaseModel):
    reason: str


# -----------------------------------------------------------------------------
# Ledger
# -----------------------------------------------------------------------------
class LedgerEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    entry_type: LedgerEntryType
    amount_ugx: int
    description: str
    order_id: Optional[str] = None
    external_ref: Optional[str] = None
    created_at: datetime


class WalletTopup(BaseModel):
    amount_ugx: int = Field(gt=0)
    external_ref: Optional[str] = None


# -----------------------------------------------------------------------------
# WhatsApp inbound
# -----------------------------------------------------------------------------
class WhatsAppInbound(BaseModel):
    """Mirror of Twilio's inbound webhook payload (the bits we care about)."""
    From: str  # noqa: N815 — Twilio uses this casing
    Body: str  # noqa: N815
    MessageSid: Optional[str] = None  # noqa: N815
