"""
WhatsApp message parser.

The seller sends messages in a flexible but structured format. We accept:

    Order: <area>, <phone>, <name>, <item> UGX <amount> <COD|MOMO>

Examples that should parse:
    Order: Bukoto, 0772123456, Jane, dress UGX 85,000 COD
    Order: Ntinda, +256701234567, Mark Ssekandi, kitenge fabric UGX 120000 MOMO
    order : kabalagala, 0782 999 111, Aisha, perfume bottle UGX 45,000 cod

If parse fails, we return a friendly help message instead of an order.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from app.db.models import PaymentMode


HELP_TEXT = (
    "👋 *Hi from Tukole!*\n\n"
    "To create an order, send a message like this:\n\n"
    "*Order: Bukoto, 0772123456, Jane, dress UGX 85,000 COD*\n\n"
    "Format:\n"
    "Order: <area>, <customer phone>, <customer name>, "
    "<item> UGX <amount> <COD or MOMO>\n\n"
    "Need help? Reply HELP."
)


@dataclass
class ParsedOrder:
    area: str
    phone: str
    customer_name: str
    item_description: str
    amount_ugx: int
    payment_mode: PaymentMode


@dataclass
class ParseResult:
    ok: bool
    order: Optional[ParsedOrder] = None
    error: Optional[str] = None


# Pattern breakdown:
#   Order: <area> , <phone> , <name> , <item with UGX amount> <COD|MOMO>
_PATTERN = re.compile(
    r"""
    ^\s*order\s*:\s*
    (?P<area>[^,]+?)\s*,\s*
    (?P<phone>[+\d\s\-]+?)\s*,\s*
    (?P<name>[^,]+?)\s*,\s*
    (?P<item>.+?)\s+
    ugx\s*(?P<amount>[\d,]+)\s+
    (?P<mode>cod|momo)\s*$
    """,
    re.IGNORECASE | re.VERBOSE | re.DOTALL,
)


def parse_seller_message(text: str) -> ParseResult:
    if not text or not text.strip():
        return ParseResult(ok=False, error="empty message")

    cleaned = text.strip()

    if cleaned.lower() in {"help", "hi", "hello", "start"}:
        return ParseResult(ok=False, error="help")

    m = _PATTERN.match(cleaned)
    if not m:
        return ParseResult(ok=False, error="format")

    try:
        amount = int(m.group("amount").replace(",", ""))
    except ValueError:
        return ParseResult(ok=False, error="amount")

    mode_str = m.group("mode").lower()
    mode = PaymentMode.COD if mode_str == "cod" else PaymentMode.MOMO

    phone = re.sub(r"[\s\-]", "", m.group("phone"))

    return ParseResult(
        ok=True,
        order=ParsedOrder(
            area=m.group("area").strip(),
            phone=phone,
            customer_name=m.group("name").strip(),
            item_description=m.group("item").strip(),
            amount_ugx=amount,
            payment_mode=mode,
        ),
    )
