"""
Database models for Tukole.

Core entities:
- Seller: small online business owner using Tukole.
- Rider: boda rider executing deliveries.
- Customer: end recipient. Tracked across orders so we can remember their
  pinned location ("rider-learned map").
- Order: a single delivery from seller to customer with escrow state.
- LedgerEntry: every money movement.
- Dispute: when a customer rejects a delivery.

Order status flow:
    PENDING -> AWAITING_PAYMENT -> PAID_INTO_ESCROW -> ASSIGNED ->
    PICKED_UP -> DELIVERING -> AT_CUSTOMER -> DELIVERED -> APPROVED -> SETTLED
    (or DISPUTED at AT_CUSTOMER, or FAILED at any point)

Escrow:
    Customer pays product_price + delivery_fee upfront -> sits in escrow.
    On APPROVED:
      - seller_payout = product_price * (1 - commission_rate)
      - rider_payout = delivery_fee
      - platform_keep = product_price * commission_rate + platform_fee
    On DISPUTED -> refunded to customer (seller penalised for return delivery).
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Float,
    Boolean,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# -----------------------------------------------------------------------------
# Enums
# -----------------------------------------------------------------------------
class OrderStatus(str, enum.Enum):
    PENDING = "pending"                     # Just created, no payment yet
    AWAITING_PAYMENT = "awaiting_payment"   # Sent to customer; waiting for them to pay
    PAID_INTO_ESCROW = "paid_into_escrow"   # Customer paid; rider can now pickup
    ASSIGNED = "assigned"                   # Rider has accepted
    PICKED_UP = "picked_up"                 # Rider has the package
    DELIVERING = "delivering"               # En route
    AT_CUSTOMER = "at_customer"             # Rider arrived; awaiting OTP
    DELIVERED = "delivered"                 # OTP verified; package handed over
    APPROVED = "approved"                   # Customer confirmed satisfaction
    SETTLED = "settled"                     # Funds released, all done
    DISPUTED = "disputed"                   # Customer rejected; funds frozen
    REFUNDED = "refunded"                   # Dispute resolved in customer's favour
    FAILED = "failed"                       # No-show, cancellation, etc.


class EscrowStatus(str, enum.Enum):
    NONE = "none"                # Nothing held yet
    HELD = "held"                # Customer paid; we're holding the funds
    RELEASED = "released"        # Distributed to seller + rider + platform
    REFUNDED = "refunded"        # Returned to customer
    PARTIAL = "partial"          # Negotiated split (rider paid, partial seller refund)


class PaymentMethod(str, enum.Enum):
    """How the customer paid into escrow."""
    MOMO = "momo"
    CARD = "card"
    AIRTEL_MONEY = "airtel_money"
    MOCK = "mock"                # Demo "Pay Now" button


class LedgerEntryType(str, enum.Enum):
    """Every money event gets one of these."""
    ESCROW_DEPOSIT = "escrow_deposit"           # Customer paid into escrow
    ESCROW_RELEASE_SELLER = "escrow_release_seller"
    ESCROW_RELEASE_RIDER = "escrow_release_rider"
    ESCROW_RELEASE_PLATFORM = "escrow_release_platform"
    ESCROW_REFUND = "escrow_refund"
    SELLER_WALLET_TOPUP = "seller_wallet_topup"
    SELLER_WALLET_WITHDRAW = "seller_wallet_withdraw"
    RIDER_WALLET_WITHDRAW = "rider_wallet_withdraw"
    PENALTY = "penalty"                          # Seller charged for return delivery


class DisputeReason(str, enum.Enum):
    DIFFERENT_ITEM = "different_item"
    DAMAGED = "damaged"
    NOT_RECEIVED = "not_received"
    OTHER = "other"


class DisputeVerdict(str, enum.Enum):
    PENDING = "pending"
    SELLER_FAULT = "seller_fault"
    BUYER_FAULT = "buyer_fault"
    RIDER_FAULT = "rider_fault"
    SETTLED_NEGOTIATED = "settled_negotiated"


class PhotoPhase(str, enum.Enum):
    SELLER_PICKUP = "seller_pickup"      # Rider at seller, item leaving
    RIDER_DROPOFF = "rider_dropoff"      # Rider at customer, handover
    CUSTOMER_DISPUTE = "customer_dispute" # Customer's photo of received item


class FleetStatus(str, enum.Enum):
    """The vetting status of a rider on a seller's fleet."""
    PENDING_VETTING = "pending_vetting"  # Tukole is reviewing the rider
    APPROVED = "approved"                 # Active member of the fleet
    SUSPENDED = "suspended"               # Temporarily off the fleet
    REMOVED = "removed"                   # No longer on this fleet


# -----------------------------------------------------------------------------
# Seller
# -----------------------------------------------------------------------------
class Seller(Base):
    __tablename__ = "sellers"

    id = Column(String, primary_key=True, default=_uuid)
    business_name = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, unique=True, index=True)
    email = Column(String, nullable=True)
    location_area = Column(String, nullable=True)

    # Pickup default location — set once when the seller signs up.
    # Used as the default origin for new orders.
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)
    pickup_notes = Column(Text, nullable=True)

    # Wallet of money the seller has earned and can withdraw
    wallet_balance_ugx = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    orders = relationship("Order", back_populates="seller")
    ledger_entries = relationship("LedgerEntry", back_populates="seller")
    fleet_memberships = relationship("SellerRider", back_populates="seller", cascade="all, delete-orphan")


# -----------------------------------------------------------------------------
# Rider
# -----------------------------------------------------------------------------
class Rider(Base):
    __tablename__ = "riders"

    id = Column(String, primary_key=True, default=_uuid)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, unique=True, index=True)
    nin = Column(String, nullable=True)
    plate_number = Column(String, nullable=True)
    photo_url = Column(Text, nullable=True)              # Selfie/profile (base64 ok)
    stage = Column(String, nullable=True)
    chairman_reference = Column(String, nullable=True)

    # Live state
    is_active = Column(Boolean, default=True, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_location_at = Column(DateTime, nullable=True)

    # Earnings wallet (gets paid per completed delivery)
    wallet_balance_ugx = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    orders = relationship("Order", back_populates="rider")
    ledger_entries = relationship("LedgerEntry", back_populates="rider")
    fleet_memberships = relationship("SellerRider", back_populates="rider")


# -----------------------------------------------------------------------------
# SellerRider — the vetted-fleet association
# -----------------------------------------------------------------------------
class SellerRider(Base):
    """
    A rider's membership on a specific seller's fleet.

    This is the heart of Tukole's differentiator: bodas aren't anonymous,
    they're vetted by Tukole and dedicated to specific businesses.

    A rider can be on multiple sellers' fleets (covering several shops in
    the same area), and a seller has multiple riders covering them.

    Carries metadata about the relationship — when assigned, vetting status,
    seller-specific notes, and performance stats just for this pair.
    """
    __tablename__ = "seller_riders"

    id = Column(String, primary_key=True, default=_uuid)
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False, index=True)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=False, index=True)

    status = Column(SAEnum(FleetStatus), default=FleetStatus.APPROVED, nullable=False)

    # Tukole's notes on this assignment
    vetting_notes = Column(Text, nullable=True)

    # Seller-specific instructions for this rider
    seller_instructions = Column(Text, nullable=True)

    # Performance counters for this seller-rider pair
    deliveries_completed = Column(Integer, default=0, nullable=False)
    deliveries_failed = Column(Integer, default=0, nullable=False)

    # Coverage area for this assignment (free text — "Bukoto + Ntinda")
    coverage_areas = Column(String, nullable=True)

    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_active_at = Column(DateTime, nullable=True)

    seller = relationship("Seller", back_populates="fleet_memberships")
    rider = relationship("Rider", back_populates="fleet_memberships")


# -----------------------------------------------------------------------------
# Customer — recipient of deliveries. Persisted so we remember their pin.
# -----------------------------------------------------------------------------
class Customer(Base):
    """
    The "rider-learned map": once a customer has dropped a pin and uploaded
    a gate photo on one delivery, future Tukole orders to that phone number
    inherit the location and visual context.
    """
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=_uuid)
    phone = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=True)

    # Most recent confirmed pin location (their "home")
    last_lat = Column(Float, nullable=True)
    last_lng = Column(Float, nullable=True)
    last_plus_code = Column(String, nullable=True)
    last_landmark_photo = Column(Text, nullable=True)     # base64 data URL
    last_landmark_notes = Column(Text, nullable=True)
    last_area = Column(String, nullable=True)

    delivery_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    orders = relationship("Order", back_populates="customer")


# -----------------------------------------------------------------------------
# Order — now an escrow-aware managed marketplace order
# -----------------------------------------------------------------------------
class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=_uuid)
    short_code = Column(String, nullable=False, unique=True, index=True)

    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False, index=True)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=True, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=True, index=True)

    # Snapshot of customer info (kept on order in case Customer record changes)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_area = Column(String, nullable=False)
    customer_address_notes = Column(Text, nullable=True)
    customer_lat = Column(Float, nullable=True)
    customer_lng = Column(Float, nullable=True)
    customer_plus_code = Column(String, nullable=True)
    customer_landmark_photo = Column(Text, nullable=True)  # base64 data URL
    customer_pin_confirmed_at = Column(DateTime, nullable=True)

    # Pickup
    pickup_area = Column(String, nullable=True)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)

    # Item
    item_description = Column(String, nullable=False)
    item_value_ugx = Column(Integer, nullable=False)        # what customer pays for product

    # Money split — calculated at order-create time, settled on approval
    delivery_fee_ugx = Column(Integer, nullable=False, default=5000)
    commission_rate_bps = Column(Integer, nullable=False, default=500)  # 500 bps = 5%
    platform_fee_ugx = Column(Integer, nullable=False, default=1500)    # fixed take

    # Escrow
    escrow_status = Column(SAEnum(EscrowStatus), default=EscrowStatus.NONE, nullable=False)
    escrow_paid_at = Column(DateTime, nullable=True)
    escrow_released_at = Column(DateTime, nullable=True)
    payment_method = Column(SAEnum(PaymentMethod), nullable=True)
    payment_external_ref = Column(String, nullable=True)    # MoMo TXN id, etc.

    # Status
    status = Column(SAEnum(OrderStatus), default=OrderStatus.PENDING, nullable=False, index=True)
    failure_reason = Column(String, nullable=True)

    # OTP for delivery confirmation
    otp_code = Column(String, nullable=True)
    otp_sent_at = Column(DateTime, nullable=True)
    otp_verified_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    assigned_at = Column(DateTime, nullable=True)
    picked_up_at = Column(DateTime, nullable=True)
    arrived_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    settled_at = Column(DateTime, nullable=True)

    # Relationships
    seller = relationship("Seller", back_populates="orders")
    rider = relationship("Rider", back_populates="orders")
    customer = relationship("Customer", back_populates="orders")
    ledger_entries = relationship("LedgerEntry", back_populates="order")
    photos = relationship("OrderPhoto", back_populates="order", cascade="all, delete-orphan")
    disputes = relationship("Dispute", back_populates="order", cascade="all, delete-orphan")

    # ------------------ helpers ------------------
    @property
    def total_charge_ugx(self) -> int:
        """What the customer pays into escrow."""
        return self.item_value_ugx + self.delivery_fee_ugx

    @property
    def commission_ugx(self) -> int:
        return int(self.item_value_ugx * self.commission_rate_bps / 10000)

    @property
    def seller_payout_ugx(self) -> int:
        return self.item_value_ugx - self.commission_ugx

    @property
    def platform_take_ugx(self) -> int:
        return self.commission_ugx + self.platform_fee_ugx


# -----------------------------------------------------------------------------
# Order photo — pickup, drop-off, dispute evidence
# -----------------------------------------------------------------------------
class OrderPhoto(Base):
    __tablename__ = "order_photos"

    id = Column(String, primary_key=True, default=_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, index=True)
    phase = Column(SAEnum(PhotoPhase), nullable=False)
    image_data = Column(Text, nullable=False)   # base64 data URL (small files only)
    caption = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="photos")


# -----------------------------------------------------------------------------
# Dispute
# -----------------------------------------------------------------------------
class Dispute(Base):
    __tablename__ = "disputes"

    id = Column(String, primary_key=True, default=_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False, index=True)
    reason = Column(SAEnum(DisputeReason), nullable=False)
    customer_message = Column(Text, nullable=True)
    seller_message = Column(Text, nullable=True)
    verdict = Column(SAEnum(DisputeVerdict), default=DisputeVerdict.PENDING, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    order = relationship("Order", back_populates="disputes")


# -----------------------------------------------------------------------------
# Ledger
# -----------------------------------------------------------------------------
class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(String, primary_key=True, default=_uuid)
    entry_type = Column(SAEnum(LedgerEntryType), nullable=False)
    amount_ugx = Column(Integer, nullable=False)
    description = Column(String, nullable=False)

    order_id = Column(String, ForeignKey("orders.id"), nullable=True, index=True)
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=True, index=True)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=True, index=True)

    external_ref = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="ledger_entries")
    seller = relationship("Seller", back_populates="ledger_entries")
    rider = relationship("Rider", back_populates="ledger_entries")
