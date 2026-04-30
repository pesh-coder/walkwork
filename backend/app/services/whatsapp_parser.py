"""
WhatsApp message parser — field-realistic version.

Real sellers don't follow strict formats. This parser is forgiving:

What works:
    Order: Bukoto, 0772123456, Jane, dress UGX 85000 COD
    Bukoto, 0772123456, Jane, dress UGX 85000 COD          (no "Order:")
    Bukoto, 0772123456, Jane, dress 85000 COD              (no "UGX")
    Bukoto, 0772123456, Jane, dress 85k COD                (k for thousands)
    Bukoto, 0772123456, Jane, dress 85000                  (no payment mode → defaults COD)
    Bugolobi, 0750366664, Cotrida, shoe UGX 60,000         (the field-test message!)

Strategy: pull individual signals out of the text rather than match a single
rigid pattern.
- Phone: any string of 7+ digits (with optional +/spaces/dashes)
- Amount: digits optionally followed by 'k' or with comma separators
- Mode: COD or MOMO keyword anywhere; defaults to COD if not specified
- Area: typically the first non-numeric word group at the start
- Name: typically a Title Case word group (1-3 words)
- Item: whatever's left
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
    "Tip: Cash on Delivery is the default if you don't say.\n"
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
    # Show the seller what we extracted so they can correct in one message
    extracted_hint: Optional[str] = None


# --- Patterns ---

# Phone: 7+ digits, optionally with +/spaces/dashes/parens
_PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{6,}\d)")

# Payment mode keywords
_COD_RE = re.compile(r"\b(cod|cash|c\.o\.d|cash\s*on\s*delivery)\b", re.IGNORECASE)
_MOMO_RE = re.compile(r"\b(momo|mtn|airtel|mobile\s*money|\bmm\b)\b", re.IGNORECASE)


def _normalize_phone(phone: str) -> str:
    """Strip spaces, dashes, parens. Convert UG local (07xx) to +2567xx."""
    p = re.sub(r"[\s\-()]+", "", phone)
    if p.startswith("0") and len(p) >= 9:
        p = "+256" + p[1:]
    elif p.startswith("256") and len(p) >= 11:
        p = "+" + p
    elif not p.startswith("+") and p.isdigit() and len(p) >= 9:
        p = "+256" + p.lstrip("0")
    return p


def _extract_amount(text: str) -> Optional[int]:
    """
    Find the price amount in the text.
    Tries (in order of specificity):
      1. UGX 85,000 / UGX 85000 / UGX 85k
      2. 85,000 (with comma)
      3. 85k or 85K
      4. plain 4+ digit number that's not a phone (phones already removed)
    """
    # 1. UGX-prefixed amounts (most reliable)
    for m in re.finditer(
        r"(?:UGX|ugx|UGx|Ugx)\s*(\d{1,3}(?:,\d{3})+|\d+)\s*(k|K)?",
        text,
    ):
        digits = m.group(1).replace(",", "")
        if digits.isdigit():
            val = int(digits)
            if m.group(2):
                val *= 1000
            return val

    # 2. Comma-grouped amounts (60,000)
    for m in re.finditer(r"\b(\d{1,3}(?:,\d{3})+)\b", text):
        val = int(m.group(1).replace(",", ""))
        if 1000 <= val <= 100_000_000:
            return val

    # 3. k-suffixed amounts (60k, 85K)
    for m in re.finditer(r"\b(\d{1,4})\s*[kK]\b", text):
        return int(m.group(1)) * 1000

    # 4. Plain 4-7 digit numbers (likely a price, since phones were stripped earlier)
    candidates = []
    for m in re.finditer(r"\b(\d{4,7})\b", text):
        val = int(m.group(1))
        if 100 <= val <= 100_000_000:
            candidates.append(val)
    if candidates:
        # The price is most often the LARGEST plain number
        return max(candidates)

    return None


def parse_seller_message(text: str) -> ParseResult:
    if not text or not text.strip():
        return ParseResult(ok=False, error="empty message")

    raw = text.strip()
    lower = raw.lower()

    if lower in {"help", "hi", "hello", "start", "join", "?", "menu"}:
        return ParseResult(ok=False, error="help")

    # Strip optional "Order:" or "order to" or "Order -" prefix
    cleaned = re.sub(r"^\s*(order\s*[:\-]?\s*|order\s+to\s+)", "", raw, flags=re.IGNORECASE)

    # 1. Extract phone (FIRST since we strip it before looking for amount)
    phone_match = _PHONE_RE.search(cleaned)
    if not phone_match:
        return ParseResult(
            ok=False,
            error="missing_phone",
            extracted_hint="I couldn't find a customer phone number in your message.",
        )
    phone_raw = phone_match.group(1)
    phone = _normalize_phone(phone_raw)

    # Remove the phone from the working text so it doesn't confuse amount extraction
    text_no_phone = cleaned.replace(phone_raw, " ⌜PHONE⌝ ")

    # 2. Extract amount
    amount = _extract_amount(text_no_phone)
    if amount is None or amount <= 0:
        return ParseResult(
            ok=False,
            error="missing_amount",
            extracted_hint=(
                f"I got the phone ({phone}) but couldn't find a price. "
                f"Try adding 'UGX 60,000' or '60k'."
            ),
        )

    # 3. Determine payment mode (default to COD — most common in Kampala)
    if _MOMO_RE.search(cleaned):
        mode = PaymentMode.MOMO
    else:
        mode = PaymentMode.COD

    # 4. Extract area, name, and item from the remaining text
    # Remove phone, amount-related tokens, and payment mode keywords
    remainder = text_no_phone
    remainder = re.sub(r"(?:UGX|ugx)\s*\d{1,3}(?:,\d{3})+\s*(?:k|K|/=)?", " ⌜AMT⌝ ", remainder)
    remainder = re.sub(r"(?:UGX|ugx)\s*\d+\s*(?:k|K|/=)?", " ⌜AMT⌝ ", remainder)
    remainder = re.sub(r"\b\d{1,3}(?:,\d{3})+\b", " ⌜AMT⌝ ", remainder)
    remainder = re.sub(r"\b\d{1,4}\s*[kK]\b", " ⌜AMT⌝ ", remainder)
    remainder = re.sub(r"\b\d{4,7}\b", " ⌜AMT⌝ ", remainder)
    remainder = _COD_RE.sub(" ⌜MODE⌝ ", remainder)
    remainder = _MOMO_RE.sub(" ⌜MODE⌝ ", remainder)

    # Split on commas, placeholders, and "and"
    fragments = re.split(r"[,⌜⌝]|\s+for\s+|\s+to\s+|\s+at\s+", remainder)
    fragments = [
        f.strip(" .-—:|").replace("PHONE", "").replace("AMT", "").replace("MODE", "").strip()
        for f in fragments
    ]
    fragments = [f for f in fragments if f and len(f) > 1]

    area = ""
    name = ""
    item_parts: list[str] = []

    # First non-empty fragment is most likely the area
    if fragments:
        area = fragments[0]
        fragments = fragments[1:]

    # Among remaining fragments, the shortest 1-3 word fragment with no digits
    # is most likely the customer's name
    if fragments:
        name_candidates = [
            f for f in fragments
            if not any(c.isdigit() for c in f) and 1 <= len(f.split()) <= 4
        ]
        if name_candidates:
            name = min(name_candidates, key=lambda f: len(f.split()))
            fragments.remove(name)

    item_parts = fragments
    item = " ".join(item_parts).strip(" -.,:|")

    # Validation
    if not area:
        return ParseResult(
            ok=False,
            error="missing_area",
            extracted_hint=(
                f"I got the phone ({phone}) and amount (UGX {amount:,}) "
                f"but couldn't find the customer's area. "
                f"Please include it (e.g. Bukoto, Ntinda, Kabalagala)."
            ),
        )
    if not name:
        return ParseResult(
            ok=False,
            error="missing_name",
            extracted_hint=(
                f"I got: area={area}, phone={phone}, amount=UGX {amount:,}. "
                f"What's the customer's name?"
            ),
        )
    if not item:
        item = "package"

    return ParseResult(
        ok=True,
        order=ParsedOrder(
            area=area,
            phone=phone,
            customer_name=name,
            item_description=item,
            amount_ugx=amount,
            payment_mode=mode,
        ),
    )