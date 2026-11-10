"""Flood band helpers shared by the flood loader and the flood join."""

from __future__ import annotations

from collections.abc import Iterable, Mapping

# Worst first. "none" means the point falls in no polygon of that layer.
LIKELIHOOD_ORDER: tuple[str, ...] = ("high", "medium", "low", "very_low", "none")
ZONE_ORDER: tuple[str, ...] = ("3", "2", "none")


def map_band(raw: object, band_map: Mapping[str, str]) -> str:
    """Map a raw EA band value to its internal value. Unknown values raise, so we never silently guess."""
    if not isinstance(raw, str) or raw.strip() not in band_map:
        raise ValueError(f"unexpected flood band value: {raw!r}")
    return band_map[raw.strip()]


def worst_band(bands: Iterable[str], order: tuple[str, ...]) -> str:
    """Return the worst band by `order` (index 0 is worst). An empty input gives 'none'."""
    rank = {b: i for i, b in enumerate(order)}
    present = [b for b in bands if b in rank]
    return min(present, key=rank.__getitem__) if present else "none"
