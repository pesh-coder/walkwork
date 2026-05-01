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


@router.get("/stats")
def platform_stats(db: Session = Depends(get_db)):
    """
    Platform-wide metrics for the Tukole operator dashboard.

    Returns top-line numbers, money flow snapshots, and counts.
    Cheap to compute — should be called every 10s or so by the dashboard.
    """
    from datetime import timedelta
    from app.db.models import (
        EscrowStatus, OrderStatus, LedgerEntryType, Dispute,
    )

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    today = now - timedelta(hours=24)

    all_orders = db.query(Order).all()
    all_sellers = db.query(Seller).all()
    all_riders = db.query(Rider).all()
    all_customers = db.query(Customer).all()
    all_ledger = db.query(LedgerEntry).all()

    # Status buckets
    in_flight_statuses = {
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.PAID_INTO_ESCROW,
        OrderStatus.ASSIGNED,
        OrderStatus.PICKED_UP,
        OrderStatus.DELIVERING,
        OrderStatus.AT_CUSTOMER,
        OrderStatus.DELIVERED,
    }
    terminal_statuses = {
        OrderStatus.SETTLED,
        OrderStatus.REFUNDED,
        OrderStatus.FAILED,
    }

    in_flight = [o for o in all_orders if o.status in in_flight_statuses]
    settled = [o for o in all_orders if o.status == OrderStatus.SETTLED]
    failed = [o for o in all_orders if o.status in (OrderStatus.FAILED, OrderStatus.REFUNDED)]
    terminal = [o for o in all_orders if o.status in terminal_statuses]
    disputed = [o for o in all_orders if o.status == OrderStatus.DISPUTED]

    # Money in motion
    held_in_escrow = sum(
        (o.item_value_ugx + o.delivery_fee_ugx)
        for o in all_orders
        if o.escrow_status == EscrowStatus.HELD
    )

    # Platform revenue (commission + platform fee) — sum of platform-release entries
    platform_revenue_total = sum(
        e.amount_ugx for e in all_ledger
        if e.entry_type == LedgerEntryType.ESCROW_RELEASE_PLATFORM
    )
    platform_revenue_week = sum(
        e.amount_ugx for e in all_ledger
        if e.entry_type == LedgerEntryType.ESCROW_RELEASE_PLATFORM
        and e.created_at >= week_ago
    )
    platform_revenue_today = sum(
        e.amount_ugx for e in all_ledger
        if e.entry_type == LedgerEntryType.ESCROW_RELEASE_PLATFORM
        and e.created_at >= today
    )

    # GMV — total escrow deposits this week
    gmv_week = sum(
        e.amount_ugx for e in all_ledger
        if e.entry_type == LedgerEntryType.ESCROW_DEPOSIT
        and e.created_at >= week_ago
    )
    gmv_total = sum(
        e.amount_ugx for e in all_ledger
        if e.entry_type == LedgerEntryType.ESCROW_DEPOSIT
    )

    # Pending payouts — wallet balances we'd owe out
    pending_seller_payouts = sum(s.wallet_balance_ugx for s in all_sellers)
    pending_rider_payouts = sum(r.wallet_balance_ugx for r in all_riders)

    # Active counts (anyone created in last 7 days, or with movement in last 7 days)
    active_sellers = sum(
        1 for s in all_sellers
        if any(o.created_at >= week_ago for o in s.orders)
    )
    riders_online = sum(
        1 for r in all_riders
        if r.last_location_at and r.last_location_at >= now - timedelta(minutes=10)
    )

    # Settlement rate
    settlement_rate = (
        len(settled) / len(terminal) if terminal else 0
    )

    return {
        "generated_at": now.isoformat(),
        "headline": {
            "platform_revenue_total_ugx": platform_revenue_total,
            "platform_revenue_week_ugx": platform_revenue_week,
            "platform_revenue_today_ugx": platform_revenue_today,
            "gmv_total_ugx": gmv_total,
            "gmv_week_ugx": gmv_week,
            "held_in_escrow_ugx": held_in_escrow,
            "pending_seller_payouts_ugx": pending_seller_payouts,
            "pending_rider_payouts_ugx": pending_rider_payouts,
        },
        "counts": {
            "sellers_total": len(all_sellers),
            "sellers_active_week": active_sellers,
            "riders_total": len(all_riders),
            "riders_online_now": riders_online,
            "customers_total": len(all_customers),
            "orders_total": len(all_orders),
            "orders_in_flight": len(in_flight),
            "orders_settled": len(settled),
            "orders_failed": len(failed),
            "orders_disputed": len(disputed),
            "settlement_rate_pct": round(settlement_rate * 100, 1),
        },
    }


@router.get("/activity")
def recent_activity(db: Session = Depends(get_db), limit: int = 30):
    """
    A live activity feed across the whole platform.

    Combines:
      - new orders created
      - escrow deposits (customer payments)
      - escrow releases (settlements)
      - disputes
      - signups (sellers + riders)

    Sorted newest first.
    """
    from app.db.models import LedgerEntryType, Dispute as DisputeModel

    items: list[dict] = []

    # Orders created
    for o in (
        db.query(Order)
        .order_by(Order.created_at.desc())
        .limit(limit)
        .all()
    ):
        seller_name = o.seller.business_name if o.seller else "—"
        items.append({
            "kind": "order_created",
            "at": o.created_at.isoformat(),
            "title": f"New order {o.short_code}",
            "subtitle": f"{seller_name} → {o.customer_name} ({o.customer_area})",
            "amount_ugx": o.item_value_ugx + o.delivery_fee_ugx,
            "order_short_code": o.short_code,
            "status": o.status.value,
        })

    # Money events
    for e in (
        db.query(LedgerEntry)
        .order_by(LedgerEntry.created_at.desc())
        .limit(limit)
        .all()
    ):
        if e.entry_type == LedgerEntryType.ESCROW_DEPOSIT:
            order = e.order
            items.append({
                "kind": "escrow_deposit",
                "at": e.created_at.isoformat(),
                "title": f"Escrow secured · {order.short_code if order else '—'}",
                "subtitle": (
                    f"Customer paid {order.customer_name}" if order else e.description
                ),
                "amount_ugx": e.amount_ugx,
                "order_short_code": order.short_code if order else None,
            })
        elif e.entry_type == LedgerEntryType.ESCROW_RELEASE_SELLER:
            order = e.order
            items.append({
                "kind": "settled",
                "at": e.created_at.isoformat(),
                "title": f"Settled · {order.short_code if order else '—'}",
                "subtitle": (
                    f"{order.seller.business_name if order and order.seller else '—'} earned"
                ),
                "amount_ugx": e.amount_ugx,
                "order_short_code": order.short_code if order else None,
            })

    # Disputes
    for d in (
        db.query(DisputeModel)
        .order_by(DisputeModel.created_at.desc())
        .limit(limit)
        .all()
    ):
        order = d.order
        items.append({
            "kind": "dispute_opened",
            "at": d.created_at.isoformat(),
            "title": f"Dispute opened · {order.short_code if order else '—'}",
            "subtitle": (
                f"{d.reason.value.replace('_', ' ').title()}: "
                f"{(d.customer_message or '(no message)')[:80]}"
            ),
            "order_short_code": order.short_code if order else None,
        })

    # Signups
    for s in (
        db.query(Seller)
        .order_by(Seller.created_at.desc())
        .limit(10)
        .all()
    ):
        items.append({
            "kind": "seller_signup",
            "at": s.created_at.isoformat(),
            "title": f"New seller · {s.business_name}",
            "subtitle": f"{s.owner_name} ({s.location_area or '—'})",
        })
    for r in (
        db.query(Rider)
        .order_by(Rider.created_at.desc())
        .limit(10)
        .all()
    ):
        items.append({
            "kind": "rider_signup",
            "at": r.created_at.isoformat(),
            "title": f"New rider · {r.full_name}",
            "subtitle": f"{r.plate_number or '—'} · {r.stage or '—'}",
        })

    # Sort newest first, dedupe-ish, slice
    items.sort(key=lambda x: x["at"], reverse=True)
    return items[: limit * 2]


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


@router.post("/showtime/{seller_id}")
def make_showtime(seller_id: str, db: Session = Depends(get_db)):
    """
    Seed a vibrant demo state for the given seller:
    - 5 orders in different stages, scattered across Kampala
    - Riders with realistic positions
    - One delivered+approved (so the wallet has a real number)
    - One disputed (to show that surface)

    Idempotent-ish — just adds more orders. Run /admin/reset first if you
    want a fresh slate.
    """
    from datetime import timedelta
    from app.db.models import (
        EscrowStatus, OrderStatus, PaymentMethod,
    )
    from app.services import (
        customers as customer_service,
        ledger as ledger_service,
        otp as otp_service,
    )
    from app.services.short_code import generate_short_code

    seller = db.query(Seller).filter(Seller.id == seller_id).first()
    if not seller:
        return {"ok": False, "error": "seller not found"}

    # Make sure we have riders & give them positions around Kampala
    all_riders = db.query(Rider).filter(Rider.is_active.is_(True)).all()
    rider_positions = [
        (0.3293, 32.5713),  # Bukoto
        (0.3580, 32.6100),  # Ntinda
        (0.3115, 32.6147),  # Bugolobi
        (0.3346, 32.5916),  # Kololo
        (0.2958, 32.6046),  # Kabalagala
    ]
    for r, (lat, lng) in zip(all_riders, rider_positions):
        r.current_lat = lat
        r.current_lng = lng
        r.last_location_at = datetime.utcnow()

    # Showtime should respect the seller's fleet — that's the differentiator.
    from app.db.models import FleetStatus, SellerRider
    fleet_riders = [
        a.rider for a in db.query(SellerRider).filter(
            SellerRider.seller_id == seller.id,
            SellerRider.status == FleetStatus.APPROVED,
        ).all()
        if a.rider and a.rider.is_active
    ]
    riders = fleet_riders or all_riders  # fallback to all if no fleet

    if seller.pickup_lat is None or seller.pickup_lng is None:
        seller.pickup_lat = 0.3500
        seller.pickup_lng = 32.5950

    # Demo customers spread across Kampala
    demo_customers = [
        ("Cotrida Akello",  "+256750366664", "Bugolobi", 0.3140, 32.6175,
         "Yellow gate next to MTN kiosk", "Black leather shoes",  60_000),
        ("Mariam Nakayima", "+256759111222", "Ntinda",   0.3601, 32.6125,
         "Behind the petrol station", "Beaded handbag", 35_000),
        ("Joel Tumusiime",  "+256775333444", "Kololo",   0.3338, 32.5942,
         "Apartment 4B, gold building", "Floral dress", 85_000),
        ("Esther Mugisha",  "+256770555666", "Kansanga", 0.2961, 32.6068,
         "Gate with the orange flag", "Earrings set",  25_000),
        ("Patrick Sserwadda","+256703777888","Naguru",   0.3357, 32.6144,
         "Last gate on the right", "Linen shirt",      55_000),
    ]

    created = []
    stages = [
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.ASSIGNED,
        OrderStatus.DELIVERING,
        OrderStatus.AT_CUSTOMER,
        OrderStatus.SETTLED,
    ]

    for i, (name, phone, area, lat, lng, notes, item, value) in enumerate(demo_customers):
        target_status = stages[i]
        order = Order(
            short_code=generate_short_code(db),
            seller_id=seller.id,
            customer_name=name,
            customer_phone=phone,
            customer_area=area,
            customer_address_notes=notes,
            customer_lat=lat,
            customer_lng=lng,
            customer_pin_confirmed_at=datetime.utcnow() - timedelta(minutes=20),
            pickup_area=seller.location_area,
            pickup_lat=seller.pickup_lat,
            pickup_lng=seller.pickup_lng,
            item_description=item,
            item_value_ugx=value,
            delivery_fee_ugx=settings.delivery_price_ugx,
            commission_rate_bps=500,
            platform_fee_ugx=settings.platform_fee_ugx,
            status=OrderStatus.PENDING,
        )
        db.add(order)
        db.flush()
        customer_service.attach_customer_to_order(db, order)

        # Pull the order through the pipeline up to its target state
        order.status = OrderStatus.AWAITING_PAYMENT
        if target_status == OrderStatus.AWAITING_PAYMENT:
            created.append(order.short_code)
            continue

        # Pay into escrow + assign rider
        order.otp_code = otp_service.generate_otp()
        order.otp_sent_at = datetime.utcnow()
        order.payment_method = PaymentMethod.MOCK
        order.payment_external_ref = f"MOCK-DEMO-{i}"
        ledger_service.record_escrow_deposit(db, order, payment_ref=order.payment_external_ref)
        order.status = OrderStatus.PAID_INTO_ESCROW

        if riders:
            rider = riders[i % len(riders)]
            order.rider_id = rider.id
            order.assigned_at = datetime.utcnow() - timedelta(minutes=15)
            order.status = OrderStatus.ASSIGNED

        if target_status in (OrderStatus.DELIVERING, OrderStatus.AT_CUSTOMER, OrderStatus.SETTLED):
            order.status = OrderStatus.PICKED_UP
            order.picked_up_at = datetime.utcnow() - timedelta(minutes=10)
            order.status = OrderStatus.DELIVERING

        if target_status in (OrderStatus.AT_CUSTOMER, OrderStatus.SETTLED):
            order.status = OrderStatus.AT_CUSTOMER
            order.arrived_at = datetime.utcnow() - timedelta(minutes=2)

        if target_status == OrderStatus.SETTLED:
            order.delivered_at = datetime.utcnow() - timedelta(minutes=1)
            order.status = OrderStatus.DELIVERED
            order.approved_at = datetime.utcnow()
            order.status = OrderStatus.APPROVED
            ledger_service.release_escrow(db, order)
            order.status = OrderStatus.SETTLED
            order.settled_at = datetime.utcnow()

        created.append(order.short_code)

    db.commit()
    return {
        "ok": True,
        "created_orders": created,
        "rider_count": len(riders),
        "message": "Showtime is on. Open the seller dashboard.",
    }


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
