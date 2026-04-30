"""
WhatsApp webhook.

This is the endpoint Twilio's WhatsApp sandbox calls when a seller sends
a message to your bot number.

Flow:
1. Twilio POSTs form-encoded data with From / Body / MessageSid.
2. We extract the seller's phone, look them up (with format-tolerant matching).
3. Parse the body. If it matches an order template, create the order.
4. Reply via WhatsApp with confirmation + tracking link, or a helpful error.

For local testing without Twilio, you can also POST to this endpoint
directly with JSON of the form {"From": "whatsapp:+256...", "Body": "..."}.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import Order, OrderStatus, PaymentMode, Seller
from app.services import assignment, ledger as ledger_service
from app.services.notifications import send_whatsapp
from app.services.short_code import generate_short_code
from app.services.whatsapp_parser import HELP_TEXT, parse_seller_message

logger = logging.getLogger("tukole.whatsapp")
logger.setLevel(logging.INFO)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _strip_whatsapp(addr: str) -> str:
    """Twilio sends 'whatsapp:+256...' — strip the prefix to get +256..."""
    return addr.replace("whatsapp:", "").strip()


def _phone_variants(phone: str) -> list[str]:
    """
    Generate every plausible format for a UG phone number.
    Used to look up sellers tolerantly.

    For input '+256772123456' we try:
      - '+256772123456'
      - '256772123456'
      - '0772123456'
      - '772123456'
    """
    p = re.sub(r"[\s\-()]+", "", phone)

    variants = {p}

    # E.164 -> all forms
    if p.startswith("+256") and len(p) == 13:
        suffix = p[4:]  # 9 digits
        variants.update({"+256" + suffix, "256" + suffix, "0" + suffix, suffix})
    elif p.startswith("256") and len(p) == 12:
        suffix = p[3:]
        variants.update({"+256" + suffix, "256" + suffix, "0" + suffix, suffix})
    elif p.startswith("0") and len(p) == 10:
        suffix = p[1:]
        variants.update({"+256" + suffix, "256" + suffix, "0" + suffix, suffix})
    elif len(p) == 9 and p.isdigit():
        variants.update({"+256" + p, "256" + p, "0" + p, p})

    return list(variants)


def _find_seller(db: Session, raw_phone: str) -> Seller | None:
    """Look up seller by any phone format variation."""
    for v in _phone_variants(raw_phone):
        s = db.query(Seller).filter(Seller.phone == v).first()
        if s:
            return s
    return None


@router.post("/inbound")
async def inbound(request: Request, db: Session = Depends(get_db)):
    """
    Accept either Twilio form-urlencoded payload OR JSON for local testing.
    Always reply with a plain text message Twilio can return to the sender.
    """
    content_type = request.headers.get("content-type", "")
    if "json" in content_type:
        data = await request.json()
    else:
        form = await request.form()
        data = dict(form)

    from_addr = data.get("From", "")
    body = data.get("Body", "")
    seller_phone = _strip_whatsapp(from_addr)

    # Always log inbound messages so we can diagnose issues
    logger.info("INBOUND from=%r body=%r", from_addr, body)
    print(f"\n📥 [WhatsApp inbound] from={from_addr!r} body={body!r}")

    if not seller_phone or not body:
        return PlainTextResponse("Missing From/Body", status_code=400)

    # Look up seller, tolerating phone format variations
    seller = _find_seller(db, seller_phone)
    if not seller:
        logger.info("Unknown seller phone %r — variants tried: %r", seller_phone, _phone_variants(seller_phone))
        reply = (
            "👋 Welcome to *Tukole*!\n\n"
            "Your number isn't registered yet. "
            "Sign up in 30 seconds at " + settings.public_base_url + "/seller/signup "
            "— you'll get UGX 10,000 in starter credit (good for ~6 deliveries)."
        )
        send_whatsapp(seller_phone, reply)
        return PlainTextResponse(reply)

    logger.info("Matched seller %s (%s)", seller.business_name, seller.phone)

    # Parse the message
    parsed = parse_seller_message(body)
    if not parsed.ok:
        # Use the helpful extracted_hint if available
        if parsed.extracted_hint:
            reply = f"⚠️ {parsed.extracted_hint}\n\nReply HELP for the full format."
        else:
            reply = HELP_TEXT
        send_whatsapp(seller_phone, reply)
        return PlainTextResponse(reply)

    p = parsed.order

    # Wallet check
    if seller.wallet_balance_ugx < settings.platform_fee_ugx:
        reply = (
            f"⚠️ Your wallet balance is UGX {seller.wallet_balance_ugx:,}. "
            f"You need at least UGX {settings.platform_fee_ugx:,} per delivery. "
            f"Top up from your dashboard: {settings.public_base_url}/seller/{seller.id}"
        )
        send_whatsapp(seller_phone, reply)
        return PlainTextResponse(reply)

    # Create order
    short_code = generate_short_code(db)
    order = Order(
        short_code=short_code,
        seller_id=seller.id,
        customer_name=p.customer_name,
        customer_phone=p.phone,
        customer_area=p.area,
        item_description=p.item_description,
        item_value_ugx=p.amount_ugx,
        payment_mode=p.payment_mode,
        status=OrderStatus.PENDING,
        pickup_area=seller.location_area,
    )
    db.add(order)
    db.flush()

    ledger_service.charge_platform_fee(db, order)

    rider = assignment.find_best_rider(db, order)
    rider_line = ""
    if rider:
        order.rider_id = rider.id
        order.status = OrderStatus.ASSIGNED
        order.assigned_at = datetime.utcnow()
        rider.is_available = False
        rider_line = (
            f"\n🏍️ Rider: {rider.full_name}"
            + (f" ({rider.plate_number})" if rider.plate_number else "")
        )
    else:
        rider_line = "\n⏳ Looking for a rider..."

    db.commit()
    db.refresh(order)

    track_url = f"{settings.public_base_url}/track/{order.short_code}"
    reply = (
        f"✅ Order *{order.short_code}* created.{rider_line}\n"
        f"📦 {p.item_description}\n"
        f"💰 UGX {p.amount_ugx:,} ({p.payment_mode.value.upper()})\n"
        f"📍 {p.area}\n\n"
        f"Send this link to {p.customer_name}:\n{track_url}"
    )
    send_whatsapp(seller_phone, reply)
    logger.info("Order %s created for %s", order.short_code, seller.business_name)
    return PlainTextResponse(reply)