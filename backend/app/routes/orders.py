"""
Order routes — escrow-aware managed marketplace.

State machine sequence:
    PENDING -> AWAITING_PAYMENT -> PAID_INTO_ESCROW -> ASSIGNED ->
    PICKED_UP -> DELIVERING -> AT_CUSTOMER -> DELIVERED -> APPROVED -> SETTLED
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import (
    Customer,
    Dispute,
    DisputeReason,
    DisputeVerdict,
    EscrowStatus,
    Order,
    OrderPhoto,
    OrderStatus,
    PaymentMethod,
    PhotoPhase,
    Rider,
    Seller,
)
from app.db.schemas import (
    CustomerApproval,
    CustomerPinUpdate,
    DeliveryQuoteRequest,
    DeliveryQuoteOut,
    DisputeOpen,
    DisputeOut,
    FailDelivery,
    MockPaymentRequest,
    OrderCreate,
    OrderOut,
    OrderTrackOut,
    OTPVerify,
    PhotoOut,
    PhotoUpload,
)
from app.services import (
    assignment,
    customers as customer_service,
    ledger as ledger_service,
    otp as otp_service,
)
from app.services.notifications import send_sms, send_whatsapp
from app.services.short_code import generate_short_code
from app.services.state_machine import StateError, assert_can_transition

router = APIRouter(tags=["orders"])


def _get_order_or_404(db: Session, order_id: str) -> Order:
    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return o


def _safe_transition(order: Order, target: OrderStatus) -> None:
    try:
        assert_can_transition(order.status, target)
    except StateError as e:
        raise HTTPException(status_code=409, detail=str(e))


def _customer_tracking_url(short_code: str) -> str:
    return f"{settings.public_base_url}/track/{short_code}"


# =============================================================================
# Delivery price quote (called by seller dashboard before they create an order)
# =============================================================================
@router.post("/pricing/quote", response_model=DeliveryQuoteOut)
def quote_delivery_price(payload: DeliveryQuoteRequest, db: Session = Depends(get_db)):
    """
    Compute a delivery quote for a seller -> drop-off pair.

    Used by the New Order form to show the seller a fair, transparent price
    BEFORE they commit. They can override if needed.
    """
    from app.services import pricing as pricing_service

    seller = db.query(Seller).filter(Seller.id == payload.seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    if seller.pickup_lat is None or seller.pickup_lng is None:
        raise HTTPException(
            status_code=400,
            detail="This seller hasn't set their pickup location yet.",
        )

    quote = pricing_service.quote_delivery(
        pickup_lat=seller.pickup_lat,
        pickup_lng=seller.pickup_lng,
        drop_lat=payload.drop_lat,
        drop_lng=payload.drop_lng,
        parcel_size=payload.parcel_size,
        is_raining=payload.is_raining,
    )
    return DeliveryQuoteOut(**quote.to_dict())


# =============================================================================
# Order creation (from seller dashboard)
# =============================================================================
@router.post("/sellers/{seller_id}/orders", response_model=OrderOut, status_code=201)
def create_order_for_seller(
    seller_id: str, payload: OrderCreate, db: Session = Depends(get_db)
):
    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")

    # Calculate the money split for this order
    delivery_fee = payload.delivery_fee_ugx or settings.delivery_price_ugx

    short_code = generate_short_code(db)
    order = Order(
        short_code=short_code,
        seller_id=seller.id,
        customer_name=payload.customer_name.strip(),
        customer_phone=payload.customer_phone.strip(),
        customer_area=payload.customer_area.strip(),
        customer_address_notes=payload.customer_address_notes,
        item_description=payload.item_description.strip(),
        item_value_ugx=payload.item_value_ugx,
        delivery_fee_ugx=delivery_fee,
        commission_rate_bps=500,  # 5% commission on item value
        platform_fee_ugx=settings.platform_fee_ugx,
        pickup_area=seller.location_area,
        pickup_lat=seller.pickup_lat,
        pickup_lng=seller.pickup_lng,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.flush()

    # Link to customer record (and inherit pin if known)
    customer_service.attach_customer_to_order(db, order)

    # Move to AWAITING_PAYMENT and notify the customer
    order.status = OrderStatus.AWAITING_PAYMENT
    db.commit()
    db.refresh(order)

    track_url = _customer_tracking_url(order.short_code)
    sms_body = (
        f"Hi {order.customer_name}, {seller.business_name} prepared your order "
        f"of {order.item_description}. "
        f"Confirm your address and pay UGX {order.total_charge_ugx:,} (held safely "
        f"in Tukole escrow until you receive it):\n{track_url}"
    )
    # Send via SMS (universal — no app, no opt-in needed)
    send_sms(order.customer_phone, sms_body)
    # Also try WhatsApp as a bonus (works for sandbox-joined numbers)
    send_whatsapp(order.customer_phone, sms_body)

    return order


# =============================================================================
# Public tracking (customer webview)
# =============================================================================
@router.get("/track/{short_code}", response_model=OrderTrackOut)
def track_order(short_code: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.short_code == short_code).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    rider = order.rider
    seller = order.seller
    eta = assignment.estimated_minutes_for_delivery(order)

    # OTP is only revealed to the customer once they've paid into escrow
    show_otp = order.escrow_status == EscrowStatus.HELD and order.otp_code is not None

    # Compute seller initials inline (kept simple to avoid an extra import)
    def _initials(name: str) -> str:
        parts = [p for p in (name or "").split() if p]
        if not parts:
            return "T"
        if len(parts) == 1:
            return parts[0][:2].upper()
        return (parts[0][0] + parts[-1][0]).upper()

    return OrderTrackOut(
        short_code=order.short_code,
        status=order.status,
        escrow_status=order.escrow_status,
        seller_business_name=seller.business_name if seller else None,
        seller_slug=seller.slug if seller else None,
        seller_initials=_initials(seller.business_name) if seller else None,
        seller_profile_color=(seller.profile_color if seller else None) or "#0E6B6B",
        rider_name=rider.full_name if rider else None,
        rider_phone=rider.phone if rider else None,
        rider_plate=rider.plate_number if rider else None,
        rider_lat=rider.current_lat if rider else None,
        rider_lng=rider.current_lng if rider else None,
        customer_lat=order.customer_lat,
        customer_lng=order.customer_lng,
        customer_plus_code=order.customer_plus_code,
        customer_pin_confirmed=order.customer_pin_confirmed_at is not None,
        pickup_lat=order.pickup_lat,
        pickup_lng=order.pickup_lng,
        item_description=order.item_description,
        item_value_ugx=order.item_value_ugx,
        delivery_fee_ugx=order.delivery_fee_ugx,
        total_charge_ugx=order.total_charge_ugx,
        estimated_minutes=eta,
        otp_code=order.otp_code if show_otp else None,
    )


# =============================================================================
# Customer actions on the tracking page
# =============================================================================
@router.post("/track/{short_code}/pin", response_model=OrderTrackOut)
def confirm_customer_pin(
    short_code: str, payload: CustomerPinUpdate, db: Session = Depends(get_db)
):
    """Customer drops their pin on the satellite map."""
    order = db.query(Order).filter(Order.short_code == short_code).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.customer_lat = payload.lat
    order.customer_lng = payload.lng
    order.customer_plus_code = payload.plus_code
    if payload.landmark_photo:
        order.customer_landmark_photo = payload.landmark_photo
    if payload.landmark_notes:
        order.customer_address_notes = payload.landmark_notes
    order.customer_pin_confirmed_at = datetime.utcnow()

    # Persist on the customer record (rider-learned map)
    if order.customer_id:
        customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if customer:
            customer_service.update_customer_pin(
                db,
                customer,
                lat=payload.lat,
                lng=payload.lng,
                plus_code=payload.plus_code,
                landmark_photo=payload.landmark_photo,
                landmark_notes=payload.landmark_notes,
                area=order.customer_area,
            )

    db.commit()
    db.refresh(order)
    return track_order(short_code, db)


@router.post("/track/{short_code}/pay", response_model=OrderTrackOut)
def mock_payment(
    short_code: str, payload: MockPaymentRequest, db: Session = Depends(get_db)
):
    """
    Simulate the customer paying into escrow.
    In production this would be a Pesapal/MoMo callback.
    """
    order = db.query(Order).filter(Order.short_code == short_code).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.escrow_status == EscrowStatus.HELD:
        # Already paid — return current state, idempotent
        return track_order(short_code, db)

    if order.status not in (OrderStatus.AWAITING_PAYMENT, OrderStatus.PENDING):
        raise HTTPException(
            status_code=409,
            detail=f"Order is in {order.status.value}; cannot accept payment",
        )

    # Generate the OTP now — customer will see it on their tracking page
    order.otp_code = otp_service.generate_otp()
    order.otp_sent_at = datetime.utcnow()

    # Record escrow deposit and move to PAID_INTO_ESCROW
    order.payment_method = payload.method
    order.payment_external_ref = f"MOCK-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    ledger_service.record_escrow_deposit(db, order, payment_ref=order.payment_external_ref)
    order.status = OrderStatus.PAID_INTO_ESCROW

    # Auto-assign a rider now that funds are secured
    rider = assignment.find_best_rider(db, order)
    if rider:
        order.rider_id = rider.id
        order.status = OrderStatus.ASSIGNED
        order.assigned_at = datetime.utcnow()
        rider.is_available = False

    # Notify the seller via WhatsApp + SMS
    seller = order.seller
    if seller:
        notify = (
            f"💰 Order {order.short_code} secured!\n"
            f"Customer paid UGX {order.total_charge_ugx:,} into escrow.\n"
            f"Item: {order.item_description}\n"
            f"Rider: {rider.full_name if rider else '(searching...)'}"
        )
        send_whatsapp(seller.phone, notify)

    db.commit()
    db.refresh(order)
    return track_order(short_code, db)


@router.post("/track/{short_code}/approve", response_model=OrderTrackOut)
def customer_approve_delivery(
    short_code: str, payload: CustomerApproval, db: Session = Depends(get_db)
):
    """
    Customer marks the delivery as satisfactory. This releases the escrow.
    """
    order = db.query(Order).filter(Order.short_code == short_code).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatus.DELIVERED:
        raise HTTPException(
            status_code=409,
            detail=f"Order is in {order.status.value}; cannot be approved yet",
        )

    if not payload.approved:
        raise HTTPException(status_code=400, detail="Use /dispute to reject")

    _safe_transition(order, OrderStatus.APPROVED)
    order.status = OrderStatus.APPROVED
    order.approved_at = datetime.utcnow()

    # Release escrow per the standard split
    ledger_service.release_escrow(db, order)
    order.status = OrderStatus.SETTLED
    order.settled_at = datetime.utcnow()

    # Bump the customer's delivery count for the rider-learned map
    if order.customer_id:
        c = db.query(Customer).filter(Customer.id == order.customer_id).first()
        if c:
            customer_service.increment_delivery_count(db, c)

    # Free the rider
    if order.rider:
        order.rider.is_available = True

    # Notify the seller
    seller = order.seller
    if seller:
        send_whatsapp(
            seller.phone,
            (
                f"✅ Order {order.short_code} settled!\n"
                f"Customer approved delivery.\n"
                f"You earned: UGX {order.seller_payout_ugx:,}\n"
                f"Wallet balance: UGX {seller.wallet_balance_ugx:,}"
            ),
        )

    db.commit()
    db.refresh(order)
    return track_order(short_code, db)


@router.post("/track/{short_code}/dispute", response_model=DisputeOut)
def customer_dispute(
    short_code: str, payload: DisputeOpen, db: Session = Depends(get_db)
):
    """
    Customer rejects the delivery. Order moves to DISPUTED, escrow stays held.
    """
    order = db.query(Order).filter(Order.short_code == short_code).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in (OrderStatus.DELIVERED, OrderStatus.AT_CUSTOMER):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot dispute order in {order.status.value}",
        )

    order.status = OrderStatus.DISPUTED
    dispute = Dispute(
        order_id=order.id,
        reason=payload.reason,
        customer_message=payload.customer_message,
        verdict=DisputeVerdict.PENDING,
    )
    db.add(dispute)
    db.flush()

    # Notify the seller
    seller = order.seller
    if seller:
        send_whatsapp(
            seller.phone,
            (
                f"⚠️ Order {order.short_code} has been disputed.\n"
                f"Reason: {payload.reason.value.replace('_', ' ')}\n"
                f"Customer says: {payload.customer_message or '(no message)'}\n\n"
                f"Funds remain in escrow until resolved. Open the order on your "
                f"dashboard to respond."
            ),
        )

    db.commit()
    db.refresh(dispute)
    return dispute


# =============================================================================
# Rider state transitions
# =============================================================================
@router.post("/orders/{order_id}/picked-up", response_model=OrderOut)
def mark_picked_up(order_id: str, db: Session = Depends(get_db)):
    o = _get_order_or_404(db, order_id)
    _safe_transition(o, OrderStatus.PICKED_UP)
    o.status = OrderStatus.PICKED_UP
    o.picked_up_at = datetime.utcnow()
    db.commit()
    db.refresh(o)
    return o


@router.post("/orders/{order_id}/start-delivery", response_model=OrderOut)
def start_delivery(order_id: str, db: Session = Depends(get_db)):
    o = _get_order_or_404(db, order_id)
    _safe_transition(o, OrderStatus.DELIVERING)
    o.status = OrderStatus.DELIVERING
    db.commit()
    db.refresh(o)
    return o


@router.post("/orders/{order_id}/arrived", response_model=OrderOut)
def mark_arrived(order_id: str, db: Session = Depends(get_db)):
    o = _get_order_or_404(db, order_id)
    _safe_transition(o, OrderStatus.AT_CUSTOMER)
    o.status = OrderStatus.AT_CUSTOMER
    o.arrived_at = datetime.utcnow()

    # Re-send the OTP via SMS in case the customer missed it
    if o.otp_code:
        send_sms(
            o.customer_phone,
            (
                f"Tukole: Your delivery code is *{o.otp_code}*. "
                f"Read it to the rider after you've checked your "
                f"{o.item_description}. Order: {o.short_code}"
            ),
        )

    db.commit()
    db.refresh(o)
    return o


@router.post("/orders/{order_id}/verify-otp", response_model=OrderOut)
def verify_otp(order_id: str, payload: OTPVerify, db: Session = Depends(get_db)):
    o = _get_order_or_404(db, order_id)
    if o.status != OrderStatus.AT_CUSTOMER:
        raise HTTPException(
            status_code=409,
            detail=f"Order is in {o.status.value}; cannot verify OTP yet",
        )
    if not otp_service.verify_otp(o.otp_code, payload.otp_code):
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    o.otp_verified_at = datetime.utcnow()
    o.delivered_at = datetime.utcnow()
    o.status = OrderStatus.DELIVERED
    db.commit()
    db.refresh(o)
    return o


@router.post("/orders/{order_id}/fail", response_model=OrderOut)
def fail_order(order_id: str, payload: FailDelivery, db: Session = Depends(get_db)):
    o = _get_order_or_404(db, order_id)
    if o.status in (OrderStatus.SETTLED, OrderStatus.REFUNDED, OrderStatus.FAILED):
        raise HTTPException(status_code=409, detail="Order is terminal")
    o.status = OrderStatus.FAILED
    o.failure_reason = payload.reason
    if o.rider:
        o.rider.is_available = True
    # If escrow was held, refund the customer
    if o.escrow_status == EscrowStatus.HELD:
        ledger_service.refund_escrow(db, o, pay_rider_anyway=False, penalize_seller=False)
    db.commit()
    db.refresh(o)
    return o


# =============================================================================
# Photos
# =============================================================================
@router.post("/orders/{order_id}/photos", response_model=PhotoOut, status_code=201)
def upload_photo(order_id: str, payload: PhotoUpload, db: Session = Depends(get_db)):
    o = _get_order_or_404(db, order_id)
    photo = OrderPhoto(
        order_id=o.id,
        phase=payload.phase,
        image_data=payload.image_data,
        caption=payload.caption,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


@router.get("/orders/{order_id}/photos", response_model=list[PhotoOut])
def list_photos(order_id: str, db: Session = Depends(get_db)):
    return (
        db.query(OrderPhoto)
        .filter(OrderPhoto.order_id == order_id)
        .order_by(OrderPhoto.created_at.asc())
        .all()
    )


# =============================================================================
# Get / list
# =============================================================================
@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: str, db: Session = Depends(get_db)):
    return _get_order_or_404(db, order_id)
