"""Slug generation."""
import re


def slugify(name: str) -> str:
    """Turn a business name into a URL-safe slug."""
    s = (name or "").lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-") or "shop"


def initials(name: str, max_chars: int = 2) -> str:
    """Pull initials from a business name, e.g. 'Sarah's Closet' -> 'SC'."""
    parts = [p for p in (name or "").split() if p]
    if not parts:
        return "T"
    return "".join(p[0].upper() for p in parts[:max_chars]) or "T"


# Stable color picker — hash the slug to one of these tailwind-compatible hexes
PROFILE_COLORS = [
    "#0E6B6B",  # teal
    "#EF6018",  # coral
    "#0A4444",  # deep teal
    "#9A3806",  # deep coral
    "#1F6B5E",  # forest
    "#B7410E",  # rust
]


def pick_color(seed: str) -> str:
    if not seed:
        return PROFILE_COLORS[0]
    h = sum(ord(c) for c in seed) % len(PROFILE_COLORS)
    return PROFILE_COLORS[h]
