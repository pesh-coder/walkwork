"""
WhatsApp inbound webhook — LEGACY/BACKUP.

In the new dashboard-first flow, the seller creates orders from the dashboard,
not WhatsApp. This route stays alive so:
  - The Twilio webhook URL still resolves (no 404s in Twilio logs)
  - Power users could in theory still send orders via WhatsApp later
  - Existing inbound messages get a sensible reply pointing to the dashboard

If you want to re-enable WhatsApp ordering, the parser + state-machine logic
from before is still importable — just wire it back up here.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import Seller
from app.services.notifications import send_whatsapp

logger = logging.getLogger("tukole.whatsapp")

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _strip_whatsapp(addr: str) -> str:
    return addr.replace("whatsapp:", "").strip()


@router.post("/inbound")
async def inbound(request: Request, db: Session = Depends(get_db)):
    content_type = request.headers.get("content-type", "")
    if "json" in content_type:
        data = await request.json()
    else:
        form = await request.form()
        data = dict(form)

    from_addr = data.get("From", "")
    body = data.get("Body", "")
    seller_phone = _strip_whatsapp(from_addr)

    logger.info("INBOUND from=%r body=%r", from_addr, body)
    print(f"\n📥 [WhatsApp inbound] from={from_addr!r} body={body!r}")

    if not seller_phone:
        return PlainTextResponse("Missing From", status_code=400)

    # Look up seller
    seller = db.query(Seller).filter(Seller.phone == seller_phone).first()

    if not seller:
        reply = (
            "👋 Welcome to *Tukole*!\n\n"
            "We've moved order creation to your web dashboard for a smoother experience.\n\n"
            f"Sign up here:\n{settings.public_base_url}/seller/signup\n\n"
            "(WhatsApp ordering is being phased out — the dashboard is much faster.)"
        )
    else:
        reply = (
            f"👋 Hi {seller.business_name}!\n\n"
            f"Order creation is now in your dashboard:\n"
            f"{settings.public_base_url}/seller/{seller.id}\n\n"
            f"Open it on this phone — log in with your number, and you can create "
            f"orders, see all your bodas live on the map, and track every shilling."
        )

    send_whatsapp(seller_phone, reply)
    return PlainTextResponse(reply)
