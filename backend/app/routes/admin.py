"""
Admin/debug routes.

These exist to make development and demos easier:
- /admin/seed: load demo data (Sarah the seller, 2 riders, sample orders)
- /admin/outbox: see all SMS/WhatsApp messages sent in mock mode
- /admin/orders: list all orders (no filtering)
- /admin/reset: wipe everything (dev only)
"""
from __future__ import annotations

from datetime import datetime, timedelta
import random

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import (
    LedgerEntry,
    LedgerEntryType,
    Order,
    OrderStatus,
    PaymentMode,
    Rider,
    Seller,
)
from app.services import ledger as ledger_service
from app.services.notifications import MOCK_OUTBOX
from app.services.short_code import generate_short_code

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/outbox")
def view_outbox():
    """Return all mocked SMS/WhatsApp messages in chronological order."""
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
    """Quick view of all orders — admin dashboard."""
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(200).all()
    return [
        {
            "id": o.id,
            "short_code": o.short_code,
            "status": o.status.value,
            "payment_mode": o.payment_mode.value,
            "customer_name": o.customer_name,
            "customer_area": o.customer_area,
            "item": o.item_description,
            "amount_ugx": o.item_value_ugx,
            "rider": o.rider.full_name if o.rider else None,
            "seller": o.seller.business_name if o.seller else None,
            "created_at": o.created_at.isoformat(),
        }
        for o in orders
    ]


@router.post("/seed")
def seed_demo_data(db: Session = Depends(get_db)):
    """
    Load Sarah's Closet + 2 riders + 5 historical orders telling a story:
    "Last week she had 3 failed deliveries; this week with Tukole, all delivered."

    Idempotent — won't duplicate if run twice.
    """
    # ---- Seller: Sarah's Closet ----
    sarah = db.query(Seller).filter(Seller.phone == "+256772123456").first()
    if not sarah:
        sarah = Seller(
            business_name="Sarah's Closet",
            owner_name="Sarah Namugga",
            phone="+256772123456",
            email="sarah@example.com",
            location_area="Bukoto",
            wallet_balance_ugx=50_000,
        )
        db.add(sarah)
        db.flush()
        # initial top-up entry for narrative
        ledger_service._add_entry(
            db,
            entry_type=LedgerEntryType.SELLER_WALLET_TOPUP,
            amount_ugx=50_000,
            description="Initial wallet top-up: UGX 50,000",
            seller=sarah,
            external_ref="MOCK-MOMO-INIT",
        )

    # ---- Riders ----
    moses = db.query(Rider).filter(Rider.phone == "+256701111111").first()
    if not moses:
        moses = Rider(
            full_name="Moses Kato",
            phone="+256701111111",
            nin="CM00012345",
            plate_number="UBE 123A",
            stage="Bukoto Stage",
            chairman_reference="Chairman David",
            current_lat=0.3500,
            current_lng=32.5950,
        )
        db.add(moses)

    grace = db.query(Rider).filter(Rider.phone == "+256702222222").first()
    if not grace:
        grace = Rider(
            full_name="Grace Nansubuga",
            phone="+256702222222",
            nin="CM00067890",
            plate_number="UBF 456B",
            stage="Ntinda Stage",
            chairman_reference="Chairman Peter",
            current_lat=0.3580,
            current_lng=32.6100,
        )
        db.add(grace)

    db.flush()

    # ---- Historical orders (only seed once) ----
    existing = db.query(Order).filter(Order.seller_id == sarah.id).count()
    if existing == 0:
        sample_orders = [
            ("Bukoto", "+256777222111", "Jane Akello", "African print dress", 85_000, PaymentMode.COD, 2),
            ("Ntinda", "+256777333222", "Mark Ssekandi", "Kitenge fabric (3m)", 120_000, PaymentMode.MOMO, 1),
            ("Kabalagala", "+256777444333", "Aisha Nakato", "Perfume bottle", 45_000, PaymentMode.COD, 3),
            ("Kololo", "+256777555444", "David Mukasa", "Silk scarf", 60_000, PaymentMode.MOMO, 1),
        ]
        for area, phone, name, item, value, mode, days_ago in sample_orders:
            o = Order(
                short_code=generate_short_code(db),
                seller_id=sarah.id,
                rider_id=moses.id if random.random() > 0.5 else grace.id,
                customer_name=name,
                customer_phone=phone,
                customer_area=area,
                item_description=item,
                item_value_ugx=value,
                payment_mode=mode,
                status=OrderStatus.SETTLED,
                created_at=datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(1, 8)),
                assigned_at=datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(1, 8)),
                picked_up_at=datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(1, 7)),
                delivered_at=datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 6)),
                settled_at=datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 6)),
            )
            db.add(o)
            db.flush()
            ledger_service.charge_platform_fee(db, o)
            ledger_service.settle_order(db, o, momo_ref="MOCK-MOMO-HIST")

    db.commit()

    return {
        "ok": True,
        "seller_id": sarah.id,
        "seller_phone": sarah.phone,
        "rider_ids": {"moses": moses.id, "grace": grace.id},
        "next_steps": [
            f"Open seller dashboard: {settings.public_base_url}/seller/{sarah.id}",
            f"Open Moses's rider app: {settings.public_base_url}/rider/{moses.id}",
            "POST /whatsapp/inbound with {From: 'whatsapp:+256772123456', "
            "Body: 'Order: Bukoto, 0772999888, Test Customer, "
            "test item UGX 50000 COD'} to create a live demo order",
        ],
    }
