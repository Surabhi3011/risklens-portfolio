"""Publish-time checks: no address data and size budgets (CLAUDE.md rule 2, ARCHITECTURE.md §3.4 and §9)."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd

FORBIDDEN_COLUMN_PATTERNS = ("address", "posttown", "street", "thoroughfare")
STREET_SUFFIXES = ("Road|Street|Lane|Avenue|Close|Way|Drive|Court|Place|Square|Gardens|Terrace|Crescent|Grove|"
                   "Mews|Row|Walk|Hill|Parade|Rise|Park|Green|View")
# A house number followed by a capitalised street name ending in a common suffix, e.g. "5, Ackland Close".
ADDRESS_RE = re.compile(rf"\b\d+[A-Za-z]?,?\s+(?:[A-Z][a-z']+\s+){{1,4}}(?:{STREET_SUFFIXES})\b")


def address_like(text: str) -> list[str]:
    return [m.group(0) for m in ADDRESS_RE.finditer(text)]


def check_file(path: Path) -> list[str]:
    """Return problems found in one published file."""
    problems: list[str] = []
    if path.suffix == ".parquet":
        df = pd.read_parquet(path)
        bad_cols = [c for c in df.columns if any(p in c.lower() for p in FORBIDDEN_COLUMN_PATTERNS)]
        problems += [f"{path.name}: forbidden column {c}" for c in bad_cols]
        for col in df.select_dtypes(include=["object", "string"]).columns:
            values = df[col].dropna().astype(str).unique()
            hits = [h for v in values for h in address_like(v)]
            problems += [f"{path.name}:{col}: address-like text {h!r}" for h in hits[:5]]
    elif path.suffix in (".geojson", ".csv", ".json"):
        text = path.read_text(encoding="utf-8")
        problems += [f"{path.name}: address-like text {h!r}" for h in address_like(text)[:5]]
        if path.suffix == ".geojson":
            keys = {k.lower() for f in json.loads(text)["features"] for k in f["properties"]}
            problems += [f"{path.name}: forbidden property {k}" for k in keys
                         if any(p in k for p in FORBIDDEN_COLUMN_PATTERNS)]
    return problems


def check_outputs(out_dir: Path, geojson_max_bytes: int, parquet_max_bytes: int) -> tuple[list[str], dict[str, int]]:
    sizes = {p.name: p.stat().st_size for p in sorted(out_dir.iterdir()) if p.is_file()}
    problems = [prob for p in sorted(out_dir.iterdir()) if p.is_file() for prob in check_file(p)]
    geo = sizes.get("portfolio_enriched.geojson", 0)
    pq = sum(v for k, v in sizes.items() if k.endswith(".parquet"))
    if geo >= geojson_max_bytes:
        problems.append(f"GeoJSON is {geo} bytes, budget {geojson_max_bytes}")
    if pq >= parquet_max_bytes:
        problems.append(f"Parquet total is {pq} bytes, budget {parquet_max_bytes}")
    return problems, sizes
