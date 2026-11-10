"""Pure helpers for loading EPC certificates and recommendations."""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping

import pandas as pd

VALID_BANDS = frozenset("ABCDEFG")
EPC_VALIDITY_YEARS = 10

# Numbers like 1,200 or 350.50. Currency symbols vary and are often mojibake (Â£, ?, ￡), so they're ignored.
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")


def parse_cost(text: object) -> tuple[float | None, float | None, float | None]:
    """Parse an EPC indicative cost string into (low, high, mid).

    "£100 - £350" -> (100, 350, 225); "£500" -> (500, 500, 500); blank or no number -> (None, None, None).
    """
    if not isinstance(text, str):
        return (None, None, None)
    nums = [float(m.replace(",", "")) for m in _NUMBER.findall(text)]
    if not nums:
        return (None, None, None)
    low, high = (nums[0], nums[0]) if len(nums) == 1 else (min(nums[:2]), max(nums[:2]))
    return (low, high, (low + high) / 2)


def normalise_band(value: object, aliases: Mapping[str, str]) -> str | None:
    """Return a band A-G, applying aliases such as A+ -> A. Anything else becomes None."""
    if not isinstance(value, str):
        return None
    band = aliases.get(value.strip().upper(), value.strip().upper())
    return band if band in VALID_BANDS else None


def normalise_tenure(value: object) -> str | None:
    """Lower-case the EPC tenure text. Blank and 'unknown' become None."""
    if not isinstance(value, str):
        return None
    t = value.strip().lower()
    return None if t in ("", "unknown", "not defined", "no data!") else t


def is_expired(lodgement: pd.Series, as_of: pd.Timestamp) -> pd.Series:
    """True when the certificate is more than 10 years old at as_of. A missing date counts as expired."""
    cutoff = as_of - pd.DateOffset(years=EPC_VALIDITY_YEARS)
    return lodgement.isna() | (lodgement < cutoff)


def latest_per_key(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """Keep the latest certificate per key by lodgement_date, ties broken by lmk_key. Rows with null keys are dropped."""
    out = df.dropna(subset=keys).sort_values(["lodgement_date", "lmk_key"])
    return out.drop_duplicates(subset=keys, keep="last").reset_index(drop=True)


def forbidden_columns(columns: Iterable[str], patterns: Iterable[str]) -> list[str]:
    """Return columns whose name contains any forbidden pattern (case-insensitive)."""
    pats = [p.lower() for p in patterns]
    return [c for c in columns if any(p in c.lower() for p in pats)]
