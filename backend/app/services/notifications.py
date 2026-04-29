"""
Notification dispatcher for SMS and WhatsApp.

Three modes, controlled independently via env vars:
- MOCK_NOTIFICATIONS=true        -> both SMS and WhatsApp are mocked (default for dev)
- MOCK_SMS=true                  -> only SMS is mocked, WhatsApp is real
- MOCK_WHATSAPP=true             -> only WhatsApp is mocked, SMS is real
- All three false                -> both real

This lets you ship WhatsApp live while keeping SMS mocked (useful with Twilio
trial accounts that require recipient verification for SMS).

Twilio failures NEVER crash the order flow — we log the error and return a
mock-shaped result so the calling code is unaffected. The customer might miss
a notification, but the order data stays consistent.
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


def _sms_is_mocked() -> bool:
    return settings.mock_notifications or settings.mock_sms


def _whatsapp_is_mocked() -> bool:
    return settings.mock_notifications or settings.mock_whatsapp


def _record_mock(channel: str, to: str, body: str) -> SentMessage:
    msg = SentMessage(channel=channel, to=to, body=body, sid="MOCK")
    MOCK_OUTBOX.append(msg)
    icon = "📱" if channel == "sms" else "💬"
    print(f"\n{icon} [MOCK {channel.upper()} to {to}]\n{body}\n")
    return msg


def send_sms(to: str, body: str) -> SentMessage:
    to = _normalize_phone(to)

    if _sms_is_mocked():
        return _record_mock("sms", to, body)

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message = client.messages.create(
            body=body, from_=settings.twilio_sms_from, to=to
        )
        logger.info("Sent SMS to %s (sid=%s)", to, message.sid)
        return SentMessage(channel="sms", to=to, body=body, sid=message.sid)
    except Exception as e:
        # Don't crash the order flow if Twilio fails. Log and fall back to mock.
        logger.warning("SMS send failed for %s: %s — falling back to mock", to, e)
        return _record_mock("sms", to, f"[SEND FAILED] {body}")


def send_whatsapp(to: str, body: str) -> SentMessage:
    to = _normalize_phone(to)
    wa_to = f"whatsapp:{to}"

    if _whatsapp_is_mocked():
        return _record_mock("whatsapp", wa_to, body)

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message = client.messages.create(
            body=body, from_=settings.twilio_whatsapp_from, to=wa_to
        )
        logger.info("Sent WhatsApp to %s (sid=%s)", wa_to, message.sid)
        return SentMessage(channel="whatsapp", to=wa_to, body=body, sid=message.sid)
    except Exception as e:
        logger.warning("WhatsApp send failed for %s: %s — falling back to mock", wa_to, e)
        return _record_mock("whatsapp", wa_to, f"[SEND FAILED] {body}")