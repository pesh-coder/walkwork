"""
Pydantic schemas for the API.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

from app.db.models import (
    OrderStatus,
    EscrowStatus,
    PaymentMethod,
    LedgerEntryType,
    DisputeReason,
    DisputeVerdict,
    PhotoPhase,
    FleetStatus,
)


# -----------------------------------------------------------------------------
# Seller
# -----------------------------------------------------------------------------
class SellerCreate(BaseModel):
    business_name: str
    owner_name: str
    phone: str
    email: Optional[str] = None
    location_area: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    pickup_notes: Optional[str] = None


class SellerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_name: str
    owner_name: str
    phone: str
    email: Optional[str] = None
    location_area: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    pickup_notes: Optional[str] = None
    slug: Optional[str] = None
    bio: Optional[str] = None
    whatsapp_number: Optional[str] = None
    profile_color: Optional[str] = None
    wallet_balance_ugx: int
    created_at: datetime


class SellerUpdate(BaseModel):
    business_name: Optional[str] = None
    owner_name: Optional[str] = None
    location_area: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    pickup_notes: Optional[str] = None
    slug: Optional[str] = None
    bio: Optional[str] = None
    whatsapp_number: Optional[str] = None


class SellerPublicProfile(BaseModel):
    """The buyer-facing public profile served at /s/{slug}."""
    slug: str
    business_name: str
    bio: Optional[str] = None
    location_area: Optional[str] = None
    whatsapp_number: str
    profile_color: str
    initials: str

    # Showcase numbers — pitched as "verified delivery metrics"
    verified_deliveries: int
    on_time_rate_pct: int
    rating_out_of_5: float
    rating_count: int
    return_rate_pct: float
    days_active: int

    # Recent testimonials (anonymized first name + initial)
    testimonials: list[dict]


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
    photo_url: Optional[str] = None


class RiderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    phone: str
    nin: Optional[str] = None
    plate_number: Optional[str] = None
    photo_url: Optional[str] = None
    stage: Optional[str] = None
    is_active: bool
    is_available: bool
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    last_location_at: Optional[datetime] = None
    battery_level: str = "full"
    battery_updated_at: Optional[datetime] = None
    wallet_balance_ugx: int


class RiderLocationUpdate(BaseModel):
    lat: float
    lng: float


# -----------------------------------------------------------------------------
# Customer
# -----------------------------------------------------------------------------
class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    phone: str
    name: Optional[str] = None
    last_lat: Optional[float] = None
    last_lng: Optional[float] = None
    last_plus_code: Optional[str] = None
    last_landmark_notes: Optional[str] = None
    last_area: Optional[str] = None
    delivery_count: int
    created_at: datetime


# -----------------------------------------------------------------------------
# Order
# -----------------------------------------------------------------------------
class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_area: str
    customer_address_notes: Optional[str] = None
    item_description: str
    item_value_ugx: int = Field(gt=0)
    delivery_fee_ugx: Optional[int] = Field(default=None, gt=0)


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    short_code: str
    seller_id: str
    rider_id: Optional[str] = None
    customer_id: Optional[str] = None

    customer_name: str
    customer_phone: str
    customer_area: str
    customer_address_notes: Optional[str] = None
    customer_lat: Optional[float] = None
    customer_lng: Optional[float] = None
    customer_plus_code: Optional[str] = None
    customer_pin_confirmed_at: Optional[datetime] = None

    pickup_area: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None

    item_description: str
    item_value_ugx: int
    delivery_fee_ugx: int
    commission_rate_bps: int
    platform_fee_ugx: int

    escrow_status: EscrowStatus
    escrow_paid_at: Optional[datetime] = None
    escrow_released_at: Optional[datetime] = None
    payment_method: Optional[PaymentMethod] = None

    status: OrderStatus
    failure_reason: Optional[str] = None

    created_at: datetime
    assigned_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    settled_at: Optional[datetime] = None


class OrderTrackOut(BaseModel):
    """Public tracking view for the customer webview."""
    short_code: str
    status: OrderStatus
    escrow_status: EscrowStatus

    seller_business_name: Optional[str] = None
    seller_slug: Optional[str] = None
    seller_initials: Optional[str] = None
    seller_profile_color: Optional[str] = None

    rider_name: Optional[str] = None
    rider_phone: Optional[str] = None
    rider_plate: Optional[str] = None
    rider_lat: Optional[float] = None
    rider_lng: Optional[float] = None

    customer_lat: Optional[float] = None
    customer_lng: Optional[float] = None
    customer_plus_code: Optional[str] = None
    customer_pin_confirmed: bool = False

    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None

    item_description: str
    item_value_ugx: int
    delivery_fee_ugx: int
    total_charge_ugx: int

    estimated_minutes: Optional[int] = None
    otp_code: Optional[str] = None  # only shown to the customer once paid


class OTPVerify(BaseModel):
    otp_code: str


class CustomerPinUpdate(BaseModel):
    """Customer dropping their pin on the tracking webview."""
    lat: float
    lng: float
    plus_code: Optional[str] = None
    landmark_photo: Optional[str] = None       # base64 data URL
    landmark_notes: Optional[str] = None


class MockPaymentRequest(BaseModel):
    method: PaymentMethod = PaymentMethod.MOCK


class CustomerApproval(BaseModel):
    approved: bool


class FailDelivery(BaseModel):
    reason: str


# -----------------------------------------------------------------------------
# Photo upload
# -----------------------------------------------------------------------------
class PhotoUpload(BaseModel):
    phase: PhotoPhase
    image_data: str       # base64 data URL
    caption: Optional[str] = None


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    phase: PhotoPhase
    image_data: str
    caption: Optional[str] = None
    created_at: datetime


# -----------------------------------------------------------------------------
# Dispute
# -----------------------------------------------------------------------------
class DisputeOpen(BaseModel):
    reason: DisputeReason
    customer_message: Optional[str] = None


class DisputeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    order_id: str
    reason: DisputeReason
    customer_message: Optional[str] = None
    seller_message: Optional[str] = None
    verdict: DisputeVerdict
    created_at: datetime
    resolved_at: Optional[datetime] = None


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
# Fleet (SellerRider)
# -----------------------------------------------------------------------------
class FleetAssignmentCreate(BaseModel):
    rider_id: str
    coverage_areas: Optional[str] = None
    seller_instructions: Optional[str] = None
    vetting_notes: Optional[str] = None


class FleetAssignmentUpdate(BaseModel):
    status: Optional[FleetStatus] = None
    coverage_areas: Optional[str] = None
    seller_instructions: Optional[str] = None
    vetting_notes: Optional[str] = None


class FleetAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    seller_id: str
    rider_id: str
    status: FleetStatus
    vetting_notes: Optional[str] = None
    seller_instructions: Optional[str] = None
    deliveries_completed: int
    deliveries_failed: int
    coverage_areas: Optional[str] = None
    assigned_at: datetime
    last_active_at: Optional[datetime] = None


class FleetMemberDetail(BaseModel):
    """Combined view: assignment + rider details for fleet management UIs."""
    assignment: FleetAssignmentOut
    rider: RiderOut


# -----------------------------------------------------------------------------
# Pricing
# -----------------------------------------------------------------------------
class DeliveryQuoteRequest(BaseModel):
    seller_id: str
    drop_lat: float
    drop_lng: float
    parcel_size: str = "regular"  # 'regular' | 'large' | 'fragile'
    is_raining: bool = False


class DeliveryQuoteOut(BaseModel):
    distance_km: float
    estimated_minutes: int
    base_fare_ugx: int
    distance_charge_ugx: int
    time_charge_ugx: int
    parcel_supplement_ugx: int
    surge_multiplier: float
    surge_reason: Optional[str] = None
    subtotal_ugx: int
    total_ugx: int


# -----------------------------------------------------------------------------
# Battery
# -----------------------------------------------------------------------------
class BatteryUpdate(BaseModel):
    level: str  # 'full' | 'most' | 'half' | 'low'
