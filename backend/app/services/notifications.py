"""
Notification dispatcher for SMS and WhatsApp.

In MOCK_NOTIFICATIONS mode (default for dev), messages are logged to the
notifications table in memory and printed to console. This means we can
build and demo without spending Twilio credits.

Switch MOCK_NOTIFICATIONS=false in production to actually send.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.config import settings

logger = logging.getLogger("tukole.notifications")
logger.setLevel(logging.INFO)


@dataclass
class SentMessage:
    channel: str           # "sms" or "whatsapp"
    to: str
    body: str
    sent_at: datetime = field(default_factory=datetime.utcnow)
    sid: Optional[str] = None


# In-memory log of mocked messages — the admin/debug UI can read this
MOCK_OUTBOX: list[SentMessage] = []


def _normalize_phone(phone: str) -> str:
    """Light normalization. UG numbers: ensure +256 prefix."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("0"):
        p = "+256" + p[1:]
    elif not p.startswith("+"):
        p = "+" + p
    return p


def send_sms(to: str, body: str) -> SentMessage:
    to = _normalize_phone(to)
    if settings.mock_notifications:
        msg = SentMessage(channel="sms", to=to, body=body, sid="MOCK")
        MOCK_OUTBOX.append(msg)
        logger.info("[MOCK SMS -> %s] %s", to, body)
        print(f"\n📱 [MOCK SMS to {to}]\n{body}\n")
        return msg

    # Real Twilio path
    from twilio.rest import Client  # noqa: WPS433 — local import to keep mock-mode lightweight

    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    message = client.messages.create(
        body=body, from_=settings.twilio_sms_from, to=to
    )
    return SentMessage(channel="sms", to=to, body=body, sid=message.sid)


def send_whatsapp(to: str, body: str) -> SentMessage:
    to = _normalize_phone(to)
    wa_to = f"whatsapp:{to}"

    if settings.mock_notifications:
        msg = SentMessage(channel="whatsapp", to=wa_to, body=body, sid="MOCK")
        MOCK_OUTBOX.append(msg)
        logger.info("[MOCK WHATSAPP -> %s] %s", wa_to, body)
        print(f"\n💬 [MOCK WhatsApp to {wa_to}]\n{body}\n")
        return msg

    from twilio.rest import Client  # noqa: WPS433

    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    message = client.messages.create(
        body=body, from_=settings.twilio_whatsapp_from, to=wa_to
    )
    return SentMessage(channel="whatsapp", to=wa_to, body=body, sid=message.sid)
