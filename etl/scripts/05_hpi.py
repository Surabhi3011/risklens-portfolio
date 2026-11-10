"""Step 5: latest-month UK HPI average price per demo LA and property type.

Input:  UK HPI full file (path in etl/config/sources.yaml)
Output: data/processed/hpi.parquet  (la_code, property_type, avg_price, month)

"Latest month" is the most recent month with an AveragePrice for that LA, because HPI publishes
LA-level figures with a lag. Idempotent: the output is overwritten.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "etl" / "config"
PROCESSED = ROOT / "data" / "processed"

log = logging.getLogger("05_hpi")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = yaml.safe_load((CONFIG / "sources.yaml").read_text(encoding="utf-8"))["hpi"]
    areas = yaml.safe_load((CONFIG / "areas.yaml").read_text(encoding="utf-8"))
    demo = [a["la_code"] for a in areas["areas"]]

    price_cols: dict[str, str] = cfg["price_columns"]
    raw = pd.read_csv(ROOT / cfg["path"], usecols=["Date", cfg["area_code"], *price_cols.values()], dtype=str)
    log.info("HPI rows in: %d", len(raw))
    df = raw[raw[cfg["area_code"]].isin(demo)].copy()
    df["month"] = pd.to_datetime(df["Date"], format=cfg["date_format"])
    for col in price_cols.values():
        df[col] = pd.to_numeric(df[col], errors="coerce")

    latest = (df.dropna(subset=[price_cols["all"]]).sort_values("month")
                .groupby(cfg["area_code"]).tail(1))
    missing = set(demo) - set(latest[cfg["area_code"]])
    if missing:
        raise RuntimeError(f"no HPI prices for demo LAs: {sorted(missing)}")

    long = latest.melt(id_vars=[cfg["area_code"], "month"], value_vars=list(price_cols.values()),
                       var_name="raw_col", value_name="avg_price")
    long["property_type"] = long["raw_col"].map({v: k for k, v in price_cols.items()})
    out = (long.rename(columns={cfg["area_code"]: "la_code"})
               .dropna(subset=["avg_price"])
               [["la_code", "property_type", "avg_price", "month"]]
               .sort_values(["la_code", "property_type"]).reset_index(drop=True))
    out["month"] = out["month"].dt.strftime("%Y-%m")
    PROCESSED.mkdir(parents=True, exist_ok=True)
    out.to_parquet(PROCESSED / "hpi.parquet", index=False, compression="zstd")
    log.info("hpi.parquet: %d rows out", len(out))
    print(out.pivot(index=["la_code", "month"], columns="property_type", values="avg_price").round(0).to_string())


if __name__ == "__main__":
    main()
