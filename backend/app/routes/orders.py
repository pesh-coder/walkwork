"""
Order routes — the heart of the delivery flow.

Endpoints:
- POST   /orders                                  Create order (auto-assigns rider)
- GET    /orders/{order_id}                       Get full order
- POST   /orders/{order_id}/picked-up             Rider confirms pickup
- POST   /orders/{order_id}/start-delivery        Rider en route
- POST   /orders/{order_id}/arrived               Rider at customer; sends OTP
- POST   /orders/{order_id}/verify-otp            Rider enters OTP from customer
- POST   /orders/{order_id}/confirm-cash          Rider deposited cash to MoMo
- POST   /orders/{order_id}/fail                  Mark failed (customer no-show etc.)
- GET    /track/{short_code}                      Public tracking view (no auth)
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import (
    CashStatus,
    Order,
    OrderStatus,
    PaymentMode,
    Rider,
    Seller,
)
from app.db.schemas import (
    CashConfirm,
    FailDelivery,
    OTPVerify,
    OrderCreate,
    OrderOut,
    OrderTrackOut,
)
from app.services import assignment, ledger as ledger_service, otp as otp_service
from app.services.notifications import send_sms, send_whatsapp
from app.services.short_code import generate_short_code
from app.services.state_machine import StateError, assert_can_transition

router = APIRouter(tags=["orders"])


def _get_order_or_404(db: Session, order_id: str) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _safe_transition(order: Order, target: OrderStatus) -> None:
    try:
        assert_can_transition(order.status, target)
    except StateError as e:
        raise HTTPException(status_code=409, detail=str(e))


def _customer_tracking_url(short_code: str) -> str:
    return f"{settings.public_base_url}/track/{short_code}"


# -----------------------------------------------------------------------------
# Order creation
# -----------------------------------------------------------------------------
@router.post("/orders", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    seller = db.query(Seller).filter(Seller.id == payload.seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    if seller.wallet_balance_ugx < settings.platform_fee_ugx:
        raise HTTPException(
            status_code=402,
            detail=(
                f"Insufficient wallet balance. Need UGX {settings.platform_fee_ugx:,}, "
                f"have UGX {seller.wallet_balance_ugx:,}. Top up to continue."
            ),
        )

    short_code = generate_short_code(db)

    order = Order(
        short_code=short_code,
        seller_id=seller.id,
        customer_name=payload.customer_name,
        customer_phone=payload.customer_phone,
        customer_area=payload.customer_area,
        customer_address_notes=payload.customer_address_notes,
        customer_lat=payload.customer_lat,
        customer_lng=payload.customer_lng,
        pickup_area=payload.pickup_area or seller.location_area,
        pickup_lat=payload.pickup_lat,
        pickup_lng=payload.pickup_lng,
        item_description=payload.item_description,
        item_value_ugx=payload.item_value_ugx,
        payment_mode=payload.payment_mode,
        cash_status=(
            CashStatus.AWAITING_COLLECTION
            if payload.payment_mode == PaymentMode.COD
            else CashStatus.NOT_APPLICABLE
        ),
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.flush()  # get order.id

    # Charge platform fee immediately
    ledger_service.charge_platform_fee(db, order)

    # Try to assign a rider right away
    rider = assignment.find_best_rider(db, order)
    if rider:
        order.rider_id = rider.id
        order.status = OrderStatus.ASSIGNED
        order.assigned_at = datetime.utcnow()
        rider.is_available = False  # one job at a time for the demo

    db.commit()
    db.refresh(order)

    # Notify customer with tracking link
    send_sms(
        order.customer_phone,
        f"Hi {order.customer_name}, your order from {seller.business_name} "
        f"({order.short_code}) is on the way. Track live: "
        f"{_customer_tracking_url(order.short_code)}",
    )

    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    return _get_order_or_404(db, order_id)


# -----------------------------------------------------------------------------
# State transitions (rider-initiated)
# -----------------------------------------------------------------------------
@router.post("/orders/{order_id}/picked-up", response_model=OrderOut)
def mark_picked_up(order_id: str, db: Session = Depends(get_db)):
    order = _get_order_or_404(db, order_id)
    _safe_transition(order, OrderStatus.PICKED_UP)
    order.status = OrderStatus.PICKED_UP
    order.picked_up_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/start-delivery", response_model=OrderOut)
def start_delivery(order_id: str, db: Session = Depends(get_db)):
    order = _get_order_or_404(db, order_id)
    _safe_transition(order, OrderStatus.DELIVERING)
    order.status = OrderStatus.DELIVERING
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/arrived", response_model=OrderOut)
def mark_arrived(order_id: str, db: Session = Depends(get_db)):
    """Rider at customer location → generate OTP and SMS to customer."""
    order = _get_order_or_404(db, order_id)
    _safe_transition(order, OrderStatus.OTP_PENDING)

    code = otp_service.generate_otp()
    order.otp_code = code
    order.otp_sent_at = datetime.utcnow()
    order.status = OrderStatus.OTP_PENDING

    db.commit()
    db.refresh(order)

    send_sms(
        order.customer_phone,
        f"Tukole: Your delivery code is *{code}*. "
        f"Read it to the rider to confirm receipt of your {order.item_description}. "
        f"Order: {order.short_code}",
    )
    return order


@router.post("/orders/{order_id}/verify-otp", response_model=OrderOut)
def verify_otp(order_id: str, payload: OTPVerify, db: Session = Depends(get_db)):
    order = _get_order_or_404(db, order_id)
    if order.status != OrderStatus.OTP_PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"Order is in {order.status.value}, cannot verify OTP",
        )

    if not otp_service.verify_otp(order.otp_code, payload.otp_code):
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    order.otp_verified_at = datetime.utcnow()
    order.delivered_at = datetime.utcnow()
    order.status = OrderStatus.DELIVERED

    if order.payment_mode == PaymentMode.COD:
        order.cash_status = CashStatus.COLLECTED

    # For MoMo: settle right away (no cash to chase).
    if order.payment_mode == PaymentMode.MOMO:
        ledger_service.settle_order(db, order)
        order.status = OrderStatus.SETTLED
        order.settled_at = datetime.utcnow()
        # Free up the rider
        if order.rider:
            order.rider.is_available = True

    db.commit()
    db.refresh(order)

    # Notify seller via WhatsApp (or SMS if no WA)
    seller = order.seller
    if seller and seller.phone:
        body_lines = [
            f"✅ Order {order.short_code} delivered to {order.customer_name}",
            f"Item: {order.item_description}",
            f"Amount: UGX {order.item_value_ugx:,}",
        ]
        if order.payment_mode == PaymentMode.MOMO:
            body_lines.append(
                f"Payment: MoMo direct → expected in your account."
            )
        else:
            body_lines.append(
                f"Cash collected by rider. Awaiting MoMo deposit."
            )
        body_lines.append(f"Wallet balance: UGX {seller.wallet_balance_ugx:,}")
        send_whatsapp(seller.phone, "\n".join(body_lines))

    return order


@router.post("/orders/{order_id}/confirm-cash", response_model=OrderOut)
def confirm_cash_deposited(
    order_id: str, payload: CashConfirm, db: Session = Depends(get_db)
):
    """COD only: rider confirms they deposited the cash to platform MoMo."""
    order = _get_order_or_404(db, order_id)

    if order.payment_mode != PaymentMode.COD:
        raise HTTPException(status_code=409, detail="This is not a COD order")

    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=409,
            detail=f"Order in {order.status.value}; deliver before confirming cash",
        )

    if not payload.confirmed:
        raise HTTPException(status_code=400, detail="Cash deposit not confirmed")

    # Run full COD settlement
    ledger_service.settle_order(db, order, momo_ref="MOCK-MOMO-DEPOSIT")
    order.cash_status = CashStatus.DEPOSITED
    order.status = OrderStatus.SETTLED
    order.settled_at = datetime.utcnow()

    # Free up the rider
    if order.rider:
        order.rider.is_available = True

    db.commit()
    db.refresh(order)

    # Tell the seller their money is now in the wallet
    seller = order.seller
    if seller and seller.phone:
        send_whatsapp(
            seller.phone,
            (
                f"💰 Cash for {order.short_code} settled.\n"
                f"UGX {order.item_value_ugx:,} added to your wallet.\n"
                f"New balance: UGX {seller.wallet_balance_ugx:,}"
            ),
        )

    return order


@router.post("/orders/{order_id}/fail", response_model=OrderOut)
def fail_order(order_id: str, payload: FailDelivery, db: Session = Depends(get_db)):
    order = _get_order_or_404(db, order_id)

    if order.status in (OrderStatus.SETTLED, OrderStatus.FAILED):
        raise HTTPException(status_code=409, detail="Order is already terminal")

    order.status = OrderStatus.FAILED
    order.failure_reason = payload.reason

    if order.rider:
        order.rider.is_available = True

    db.commit()
    db.refresh(order)
    return order


# -----------------------------------------------------------------------------
# Public tracking
# -----------------------------------------------------------------------------
@router.get("/track/{short_code}", response_model=OrderTrackOut)
def track_order(short_code: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.short_code == short_code).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rider = order.rider
    eta = assignment.estimated_minutes_for_delivery(order)

    return OrderTrackOut(
        short_code=order.short_code,
        status=order.status,
        rider_name=rider.full_name if rider else None,
        rider_phone=rider.phone if rider else None,
        rider_plate=rider.plate_number if rider else None,
        rider_lat=rider.current_lat if rider else None,
        rider_lng=rider.current_lng if rider else None,
        customer_lat=order.customer_lat,
        customer_lng=order.customer_lng,
        item_description=order.item_description,
        estimated_minutes=eta,
    )
