"""
Database models for Tukole.

Core entities:
- Seller: Instagram/WhatsApp business owner using Tukole for deliveries.
- Rider: Boda rider executing deliveries.
- Order: A single delivery job from seller to customer.
- LedgerEntry: Every money movement gets a row. This is the cash trust layer.

Status flow for Order:
    PENDING -> ASSIGNED -> PICKED_UP -> DELIVERING -> OTP_PENDING
    -> DELIVERED -> SETTLED
    (or FAILED at any point with a reason)
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
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class OrderStatus(str, enum.Enum):
    PENDING = "pending"          # Created, awaiting rider
    ASSIGNED = "assigned"        # Rider has accepted
    PICKED_UP = "picked_up"      # Rider collected from seller
    DELIVERING = "delivering"    # En route to customer
    OTP_PENDING = "otp_pending"  # Rider arrived, awaiting OTP from customer
    DELIVERED = "delivered"      # OTP verified, package handed over
    SETTLED = "settled"          # Cash reconciled (MoMo confirmed or COD deposited)
    FAILED = "failed"            # Failed delivery (no-show, refused, etc.)


class PaymentMode(str, enum.Enum):
    MOMO = "momo"                # Customer pays MoMo direct to seller
    COD = "cod"                  # Customer pays cash to rider on delivery


class CashStatus(str, enum.Enum):
    NOT_APPLICABLE = "not_applicable"   # MoMo flow, no cash to track
    AWAITING_COLLECTION = "awaiting_collection"
    COLLECTED = "collected"             # Rider has the cash
    DEPOSITED = "deposited"             # Rider sent it to platform MoMo
    DISPUTED = "disputed"               # Customer flagged a problem


class LedgerEntryType(str, enum.Enum):
    """Every money event gets one of these."""
    SELLER_WALLET_TOPUP = "seller_wallet_topup"
    PLATFORM_FEE = "platform_fee"
    RIDER_EARNING = "rider_earning"
    COD_COLLECTED = "cod_collected"
    COD_DEPOSITED = "cod_deposited"
    SELLER_PAYOUT = "seller_payout"
    REFUND = "refund"


# -----------------------------------------------------------------------------
# Seller
# -----------------------------------------------------------------------------
class Seller(Base):
    __tablename__ = "sellers"

    id = Column(String, primary_key=True, default=_uuid)
    business_name = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, unique=True, index=True)  # WhatsApp + login
    email = Column(String, nullable=True)
    location_area = Column(String, nullable=True)  # e.g., "Bukoto"

    # Wallet balance in UGX (whole shillings, no decimals — UGX has no subunit)
    wallet_balance_ugx = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    orders = relationship("Order", back_populates="seller")
    ledger_entries = relationship("LedgerEntry", back_populates="seller")


# -----------------------------------------------------------------------------
# Rider
# -----------------------------------------------------------------------------
class Rider(Base):
    __tablename__ = "riders"

    id = Column(String, primary_key=True, default=_uuid)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, unique=True, index=True)
    nin = Column(String, nullable=True)               # National ID
    plate_number = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    stage = Column(String, nullable=True)             # Boda stage they belong to
    chairman_reference = Column(String, nullable=True)

    # Live state
    is_active = Column(Boolean, default=True, nullable=False)
    is_available = Column(Boolean, default=True, nullable=False)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_location_at = Column(DateTime, nullable=True)

    # Cash float currently held (COD collected but not yet deposited)
    cash_float_ugx = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    orders = relationship("Order", back_populates="rider")
    ledger_entries = relationship("LedgerEntry", back_populates="rider")


# -----------------------------------------------------------------------------
# Order
# -----------------------------------------------------------------------------
class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=_uuid)
    short_code = Column(String, nullable=False, unique=True, index=True)  # e.g. "TK1247"

    seller_id = Column(String, ForeignKey("sellers.id"), nullable=False)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=True)

    # Customer info (no account — just contact)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_area = Column(String, nullable=False)
    customer_address_notes = Column(Text, nullable=True)
    customer_lat = Column(Float, nullable=True)
    customer_lng = Column(Float, nullable=True)

    # Pickup info (defaults to seller's location if not set)
    pickup_area = Column(String, nullable=True)
    pickup_lat = Column(Float, nullable=True)
    pickup_lng = Column(Float, nullable=True)

    # Item
    item_description = Column(String, nullable=False)
    item_value_ugx = Column(Integer, nullable=False)

    # Payment
    payment_mode = Column(SAEnum(PaymentMode), nullable=False)
    cash_status = Column(SAEnum(CashStatus), default=CashStatus.NOT_APPLICABLE, nullable=False)

    # Status
    status = Column(SAEnum(OrderStatus), default=OrderStatus.PENDING, nullable=False, index=True)
    failure_reason = Column(String, nullable=True)

    # OTP for delivery confirmation
    otp_code = Column(String, nullable=True)         # 4-digit string
    otp_sent_at = Column(DateTime, nullable=True)
    otp_verified_at = Column(DateTime, nullable=True)

    # Timestamps for the state machine
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    assigned_at = Column(DateTime, nullable=True)
    picked_up_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    settled_at = Column(DateTime, nullable=True)

    seller = relationship("Seller", back_populates="orders")
    rider = relationship("Rider", back_populates="orders")
    ledger_entries = relationship("LedgerEntry", back_populates="order")


# -----------------------------------------------------------------------------
# LedgerEntry — the cash trust layer
# -----------------------------------------------------------------------------
class LedgerEntry(Base):
    """
    Every shilling that moves through the system gets a row here.
    This is what powers the seller's "where's my money" view.
    """
    __tablename__ = "ledger_entries"

    id = Column(String, primary_key=True, default=_uuid)
    entry_type = Column(SAEnum(LedgerEntryType), nullable=False)
    amount_ugx = Column(Integer, nullable=False)  # Always positive; entry_type tells direction
    description = Column(String, nullable=False)

    order_id = Column(String, ForeignKey("orders.id"), nullable=True)
    seller_id = Column(String, ForeignKey("sellers.id"), nullable=True)
    rider_id = Column(String, ForeignKey("riders.id"), nullable=True)

    # External reference (MoMo transaction ID, etc.) — mocked for demo
    external_ref = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="ledger_entries")
    seller = relationship("Seller", back_populates="ledger_entries")
    rider = relationship("Rider", back_populates="ledger_entries")
