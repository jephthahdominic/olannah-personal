"""Small pure helpers shared by the adapters. No I/O."""
import re
from datetime import date, datetime
from typing import Optional


def sentence_case(text: Optional[str]) -> Optional[str]:
    """Legacy systems shout (ALL CAPS). Convert only ALL-CAPS text to sentence case.

    Tokens containing a digit (V-221, ZR72) keep their original casing.
    Text that is already mixed case is returned unchanged.
    """
    if not text or not text.isupper():
        return text
    words = [w if any(c.isdigit() for c in w) else w.lower() for w in text.split(" ")]
    out = " ".join(words)
    out = re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), out)
    return re.sub(r"\b(pm|po|hvac)\b", lambda m: m.group(1).upper(), out)


def parse_yyyymmdd(value: Optional[str]) -> Optional[date]:
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except (ValueError, TypeError):
        return None


def parse_us_date(value: Optional[str]) -> Optional[date]:
    """Accepts MM/DD/YYYY (zero padding optional) and ISO YYYY-MM-DD. Anything else -> None."""
    if not value:
        return None
    value = value.strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def normalize_equipment_id(value: Optional[str]) -> str:
    """'E-2231', 'E2231' and 'e-2231' all become 'E2231'."""
    return re.sub(r"[^A-Za-z0-9]", "", value or "").upper()


def normalize_site(value: Optional[str]) -> str:
    """'Store 118', 'STORE 118' and 'STORE #118' all become '118'. Falls back to upper-cased text."""
    digits = re.findall(r"\d+", value or "")
    return digits[-1] if digits else (value or "").strip().upper()
