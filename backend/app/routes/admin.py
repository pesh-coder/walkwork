"""
Admin / debug routes.

- POST /admin/seed: ensure demo riders exist (idempotent)
- POST /admin/reset: wipe all demo data
- GET  /admin/outbox: see all mocked SMS/WhatsApp messages
- GET  /admin/orders: list every order
- POST /admin/showtime: create a vibrant demo state with multiple in-flight orders
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import (
    Customer,
    Dispute,
    LedgerEntry,
    Order,
    OrderPhoto,
    Rider,
    Seller,
)
from app.services.notifications import MOCK_OUTBOX

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/outbox")
def view_outbox():
    return [
        {
            "channel": m.channel,
            "to": m.to,
            "body": m.body,
            "sent_at": m.sent_at.isoformat(),
            "sid": m.sid,
        }
        for m in MOCK_OUTBOX
    ]


@router.delete("/outbox")
def clear_outbox():
    MOCK_OUTBOX.clear()
    return {"ok": True}


@router.get("/orders")
def list_all_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(200).all()
    return [
        {
            "id": o.id,
            "short_code": o.short_code,
            "status": o.status.value,
            "escrow_status": o.escrow_status.value,
            "customer_name": o.customer_name,
            "customer_area": o.customer_area,
            "item": o.item_description,
            "value_ugx": o.item_value_ugx,
            "delivery_fee_ugx": o.delivery_fee_ugx,
            "rider": o.rider.full_name if o.rider else None,
            "seller": o.seller.business_name if o.seller else None,
            "created_at": o.created_at.isoformat(),
        }
        for o in orders
    ]


@router.post("/seed")
def seed_demo_riders(db: Session = Depends(get_db)):
    """Ensure Moses + Grace exist as default demo riders. Idempotent."""
    moses = (
        db.query(Rider).filter(Rider.phone == settings.demo_rider_moses_phone).first()
    )
    if not moses:
        moses = Rider(
            full_name="Moses Kato",
            phone=settings.demo_rider_moses_phone,
            nin="CM00012345",
            plate_number="UBE 123A",
            stage="Bukoto Stage",
            chairman_reference="Chairman David",
            current_lat=0.3500,
            current_lng=32.5950,
        )
        db.add(moses)

    grace = (
        db.query(Rider).filter(Rider.phone == settings.demo_rider_grace_phone).first()
    )
    if not grace:
        grace = Rider(
            full_name="Grace Nansubuga",
            phone=settings.demo_rider_grace_phone,
            nin="CM00067890",
            plate_number="UBF 456B",
            stage="Ntinda Stage",
            chairman_reference="Chairman Peter",
            current_lat=0.3580,
            current_lng=32.6100,
        )
        db.add(grace)

    db.commit()
    return {"ok": True, "rider_ids": {"moses": moses.id, "grace": grace.id}}


@router.post("/reset")
def reset_demo(db: Session = Depends(get_db)):
    """
    Wipe everything. Useful when DEMO_SELLER_PHONE changes or you want a
    pristine state for the live demo.
    """
    db.query(LedgerEntry).delete()
    db.query(Dispute).delete()
    db.query(OrderPhoto).delete()
    db.query(Order).delete()
    db.query(Customer).delete()
    db.query(Rider).delete()
    db.query(Seller).delete()
    db.commit()
    return {"ok": True, "message": "All demo data wiped."}


@router.post("/showtime")
def create_showtime_demo(
    seller_id: str | None = None,
    db: Session = Depends(get_db),
):
    """
    Create a vibrant, demo-ready state for the given seller:
    - 5 orders at varying stages (awaiting payment, paid, in transit, delivered, settled)
    - Riders positioned at different points across Kampala
    - Customers spread across different neighborhoods

    Pass ?seller_id=... or it'll use the first seller in the DB.
    """
    from datetime import timedelta
    from random import choice

    from app.db.models import OrderStatus, EscrowStatus, PaymentMethod
    from app.services import (
        customers as customer_service,
        ledger as ledger_service,
        otp as otp_service,
    )
    from app.services.short_code import generate_short_code

    # Pick the seller
    if seller_id:
        seller = db.query(Seller).filter(Seller.id == seller_id).first()
    else:
        seller = db.query(Seller).first()
    if not seller:
        return {"ok": False, "message": "No seller found. Sign up first."}

    # Make sure riders are seeded
    moses = db.query(Rider).filter(Rider.phone == settings.demo_rider_moses_phone).first()
    grace = db.query(Rider).filter(Rider.phone == settings.demo_rider_grace_phone).first()
    if not (moses and grace):
        return {"ok": False, "message": "Run /admin/seed first."}

    # Position the riders nicely across Kampala
    moses.current_lat = 0.3500
    moses.current_lng = 32.5950
    moses.is_available = True
    grace.current_lat = 0.3580
    grace.current_lng = 32.6100
    grace.is_available = True
    db.flush()

    # 5 mock orders at different stages
    demo_data = [
        {
            "customer_name": "Cotrida Akello",
            "customer_phone": "+256750000001",
            "customer_area": "Bugolobi",
            "item": "Black leather shoes, size 41",
            "value": 60_000,
            "stage": "delivering",
            "rider": moses,
            "lat": 0.3115, "lng": 32.6147,
            "rider_lat": 0.3290, "rider_lng": 32.6080,
        },
        {
            "customer_name": "Patricia Naluwooza",
            "customer_phone": "+256750000002",
            "customer_area": "Ntinda",
            "item": "Beaded handbag (cream)",
            "value": 35_000,
            "stage": "at_customer",
            "rider": grace,
            "lat": 0.3650, "lng": 32.6200,
            "rider_lat": 0.3650, "rider_lng": 32.6200,
        },
        {
            "customer_name": "James Okello",
            "customer_phone": "+256750000003",
            "customer_area": "Kololo",
            "item": "Wireless earbuds (white)",
            "value": 85_000,
            "stage": "paid_into_escrow",  # waiting for assignment
            "rider": None,
            "lat": 0.3380, "lng": 32.5870,
        },
        {
            "customer_name": "Sandra Kemigisha",
            "customer_phone": "+256750000004",
            "customer_area": "Muyenga",
            "item": "Floral sundress (size M)",
            "value": 45_000,
            "stage": "settled",
            "rider": moses,
            "lat": 0.3000, "lng": 32.6050,
        },
        {
            "customer_name": "Brian Tumwine",
            "customer_phone": "+256750000005",
            "customer_area": "Kabalagala",
            "item": "Throw pillow set (4 pcs)",
            "value": 28_000,
            "stage": "awaiting_payment",
            "rider": None,
            "lat": 0.2950, "lng": 32.5980,
        },
    ]

    created = []
    for item in demo_data:
        order = Order(
            short_code=generate_short_code(db),
            seller_id=seller.id,
            customer_name=item["customer_name"],
            customer_phone=item["customer_phone"],
            customer_area=item["customer_area"],
            item_description=item["item"],
            item_value_ugx=item["value"],
            delivery_fee_ugx=settings.delivery_price_ugx,
            commission_rate_bps=500,
            platform_fee_ugx=settings.platform_fee_ugx,
            pickup_area=seller.location_area,
            pickup_lat=seller.pickup_lat or 0.3500,
            pickup_lng=seller.pickup_lng or 32.5950,
            customer_lat=item["lat"],
            customer_lng=item["lng"],
            customer_pin_confirmed_at=datetime.utcnow() - timedelta(minutes=20),
        )
        db.add(order)
        db.flush()

        # Link to customer record
        customer_service.attach_customer_to_order(db, order)

        # Persist the pin onto the Customer record (rider-learned map)
        if order.customer_id:
            customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
            if customer:
                customer_service.update_customer_pin(
                    db, customer,
                    lat=item["lat"],
                    lng=item["lng"],
                    plus_code=None,
                    landmark_photo=None,
                    landmark_notes=None,
                    area=item["customer_area"],
                )

        stage = item["stage"]

        # Apply state based on stage
        if stage == "awaiting_payment":
            order.status = OrderStatus.AWAITING_PAYMENT
        elif stage == "paid_into_escrow":
            order.status = OrderStatus.PAID_INTO_ESCROW
            order.payment_method = PaymentMethod.MOCK
            order.otp_code = otp_service.generate_otp()
            ledger_service.record_escrow_deposit(db, order, payment_ref="DEMO")
        elif stage in ("delivering", "at_customer"):
            order.payment_method = PaymentMethod.MOCK
            order.otp_code = otp_service.generate_otp()
            ledger_service.record_escrow_deposit(db, order, payment_ref="DEMO")
            rider = item["rider"]
            order.rider_id = rider.id
            order.assigned_at = datetime.utcnow() - timedelta(minutes=15)
            order.picked_up_at = datetime.utcnow() - timedelta(minutes=10)
            if stage == "delivering":
                order.status = OrderStatus.DELIVERING
            else:
                order.status = OrderStatus.AT_CUSTOMER
                order.arrived_at = datetime.utcnow() - timedelta(minutes=2)
        elif stage == "settled":
            order.payment_method = PaymentMethod.MOCK
            order.otp_code = otp_service.generate_otp()
            ledger_service.record_escrow_deposit(db, order, payment_ref="DEMO")
            order.rider_id = item["rider"].id
            order.assigned_at = datetime.utcnow() - timedelta(hours=1)
            order.picked_up_at = datetime.utcnow() - timedelta(minutes=55)
            order.delivered_at = datetime.utcnow() - timedelta(minutes=45)
            order.approved_at = datetime.utcnow() - timedelta(minutes=44)
            order.status = OrderStatus.APPROVED
            ledger_service.release_escrow(db, order)
            order.status = OrderStatus.SETTLED
            order.settled_at = datetime.utcnow() - timedelta(minutes=44)

        created.append(order.short_code)

    db.commit()
    return {
        "ok": True,
        "seller": seller.business_name,
        "orders_created": created,
    }
