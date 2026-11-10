"""Step 1: load EPC certificates and recommendations for the demo LAs.

Inputs:  data/raw/epc/domestic/*.csv, data/raw/epc/non_domestic/non-domestic-csv.zip
Outputs: data/processed/epc_latest.parquet  (latest certificate per (uprn, use), no address columns)
         data/processed/recs.parquet        (recommendations for those certificates, costs parsed)

Only mapped columns are read (etl/config/epc_columns.yaml), so address fields are never loaded.
The script is idempotent: it overwrites its outputs on each run.
"""

from __future__ import annotations

import json
import logging
import zipfile
from pathlib import Path
from typing import Any

import pandas as pd
import yaml

from risklens_etl.epc import (
    forbidden_columns,
    is_expired,
    latest_per_key,
    normalise_band,
    normalise_tenure,
    parse_cost,
)

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "etl" / "config"
PROCESSED = ROOT / "data" / "processed"
RULES = ROOT / "web" / "public" / "config" / "rules.json"

CERT_COLUMNS = [
    "lmk_key", "uprn", "postcode", "la_code", "use", "band_current", "score_current", "band_potential",
    "floor_area_m2", "property_type", "tenure", "lodgement_date", "epc_expired",
]
REC_COLUMNS = ["lmk_key", "improvement_item", "summary", "cost_low", "cost_high", "cost_mid", "payback_type"]

log = logging.getLogger("01_load_epc")


def read_mapped(source: Any, mapping: dict[str, str]) -> pd.DataFrame:
    """Read only the mapped raw columns from a CSV path or file object, then rename them to internal names."""
    df = pd.read_csv(source, usecols=list(mapping.values()), dtype=str, encoding="utf-8-sig")
    return df.rename(columns={raw: internal for internal, raw in mapping.items()})


def zip_members(zf: zipfile.ZipFile, prefix: str) -> list[str]:
    return sorted(n for n in zf.namelist() if n.startswith(prefix) and n.endswith(".csv"))


def load_certificates(cfg: dict[str, Any], demo: set[str]) -> pd.DataFrame:
    dom_cfg = cfg["domestic"]["certificates"]
    dom = read_mapped(ROOT / dom_cfg["path"], dom_cfg["columns"])
    log.info("domestic certificates read: %d rows", len(dom))
    dom["use"] = "residential"

    nd_cfg = cfg["non_domestic"]
    parts: list[pd.DataFrame] = []
    total = 0
    with zipfile.ZipFile(ROOT / nd_cfg["zip_path"]) as zf:
        for member in zip_members(zf, nd_cfg["certificates"]["member_prefix"]):
            with zf.open(member) as fh:
                part = read_mapped(fh, nd_cfg["certificates"]["columns"])
            total += len(part)
            parts.append(part[part["la_code"].isin(demo)])
    nondom = pd.concat(parts, ignore_index=True)
    log.info("non-domestic certificates read: %d rows nationally, %d in demo LAs", total, len(nondom))
    nondom["use"] = "commercial"
    nondom["band_potential"] = None
    nondom["tenure"] = None

    certs = pd.concat([dom, nondom], ignore_index=True)
    outside = ~certs["la_code"].isin(demo)
    if outside.any():
        log.info("dropping %d certificates with LA codes outside the demo set: %s",
                 outside.sum(), certs.loc[outside, "la_code"].value_counts().to_dict())
    return certs[~outside].copy()


def clean_certificates(certs: pd.DataFrame, aliases: dict[str, str], as_of: pd.Timestamp) -> pd.DataFrame:
    certs["uprn"] = certs["uprn"].str.strip().where(lambda s: s.str.fullmatch(r"\d+", na=False))
    certs["postcode"] = certs["postcode"].str.strip().str.upper()
    certs["band_current"] = certs["band_current"].map(lambda v: normalise_band(v, aliases))
    certs["band_potential"] = certs["band_potential"].map(lambda v: normalise_band(v, aliases))
    certs["tenure"] = certs["tenure"].map(normalise_tenure)
    certs["score_current"] = pd.to_numeric(certs["score_current"], errors="coerce")
    certs["floor_area_m2"] = pd.to_numeric(certs["floor_area_m2"], errors="coerce")
    certs["lodgement_date"] = pd.to_datetime(certs["lodgement_date"], errors="coerce")

    with_uprn = certs["uprn"].notna()
    log.info("certificates without a usable UPRN (excluded from per-UPRN table): %d", (~with_uprn).sum())
    latest = latest_per_key(certs[with_uprn], ["uprn", "use"])
    latest["epc_expired"] = is_expired(latest["lodgement_date"], as_of)
    return latest[CERT_COLUMNS]


def load_recommendations(cfg: dict[str, Any], keep: set[str]) -> pd.DataFrame:
    dom_cfg = cfg["domestic"]["recommendations"]
    dom = read_mapped(ROOT / dom_cfg["path"], dom_cfg["columns"])
    log.info("domestic recommendations read: %d rows", len(dom))
    dom = dom[dom["lmk_key"].isin(keep)].copy()
    costs = dom["indicative_cost"].map(parse_cost)
    dom["cost_low"] = [c[0] for c in costs]
    dom["cost_high"] = [c[1] for c in costs]
    dom["cost_mid"] = [c[2] for c in costs]
    dom["payback_type"] = None

    nd_cfg = cfg["non_domestic"]
    parts: list[pd.DataFrame] = []
    total = 0
    with zipfile.ZipFile(ROOT / nd_cfg["zip_path"]) as zf:
        for member in zip_members(zf, nd_cfg["recommendations"]["member_prefix"]):
            with zf.open(member) as fh:
                part = read_mapped(fh, nd_cfg["recommendations"]["columns"])
            total += len(part)
            parts.append(part[part["lmk_key"].isin(keep)])
    nondom = pd.concat(parts, ignore_index=True)
    log.info("non-domestic recommendations read: %d rows nationally", total)
    for col in ("cost_low", "cost_high", "cost_mid"):
        nondom[col] = None  # the non-domestic register publishes no indicative cost

    recs = pd.concat([dom, nondom], ignore_index=True)
    recs["improvement_item"] = pd.to_numeric(recs["improvement_item"], errors="coerce").astype("Int64")
    recs["summary"] = recs["summary"].str.strip()
    for col in ("cost_low", "cost_high", "cost_mid"):
        recs[col] = pd.to_numeric(recs[col], errors="coerce")
    return recs[REC_COLUMNS].sort_values(["lmk_key", "improvement_item"]).reset_index(drop=True)


def check_no_address(df: pd.DataFrame, name: str, patterns: list[str]) -> None:
    bad = forbidden_columns(df.columns, patterns)
    if bad:
        raise RuntimeError(f"{name} contains forbidden address columns: {bad}")
    log.info("%s columns: %s (no address columns)", name, list(df.columns))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = yaml.safe_load((CONFIG / "epc_columns.yaml").read_text(encoding="utf-8"))
    areas = yaml.safe_load((CONFIG / "areas.yaml").read_text(encoding="utf-8"))
    rules = json.loads(RULES.read_text(encoding="utf-8"))
    as_of = pd.Timestamp(rules["as_of"])
    demo = {a["la_code"] for a in areas["areas"]}
    names = {a["la_code"]: a["la_name"] for a in areas["areas"]}

    certs = load_certificates(cfg, demo)
    log.info("certificates in demo LAs: %d", len(certs))
    latest = clean_certificates(certs, cfg["band_aliases"], as_of)
    check_no_address(latest, "epc_latest", cfg["forbidden_column_patterns"])

    recs = load_recommendations(cfg, set(latest["lmk_key"]))
    check_no_address(recs, "recs", cfg["forbidden_column_patterns"])

    PROCESSED.mkdir(parents=True, exist_ok=True)
    latest.to_parquet(PROCESSED / "epc_latest.parquet", index=False)
    recs.to_parquet(PROCESSED / "recs.parquet", index=False)
    log.info("wrote epc_latest.parquet: %d rows; recs.parquet: %d rows", len(latest), len(recs))

    summary = (
        latest.assign(la_name=latest["la_code"].map(names))
        .groupby(["la_code", "la_name", "use"])
        .agg(certs=("lmk_key", "size"), expired=("epc_expired", "sum"),
             below_c=("band_current", lambda b: b.isin(list("DEFG")).sum()))
        .reset_index()
    )
    print("\nLatest certificate per UPRN, by LA and use:")
    print(summary.to_string(index=False))
    print(f"\nTotal: {len(latest)} certificates, {len(recs)} recommendations "
          f"({recs['cost_mid'].notna().sum()} with parsed cost)")


if __name__ == "__main__":
    main()
