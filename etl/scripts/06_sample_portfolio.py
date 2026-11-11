"""Step 6: build the synthetic demo portfolio from real EPC records.

Inputs:  data/processed/epc_latest.parquet, data/processed/uprn_flood.parquet, etl/config/portfolio.yaml
Output:  data/processed/portfolio_sample.csv  (ARCHITECTURE.md §3.2 columns; addresses never included)

Stable by default: if the published sample (web/public/data/portfolio_sample.csv) exists, it is reused and
validated, so asset IDs keep pointing at the same properties when upstream data is refreshed. Pass --resample to
draw a new sample (fixed seed, sorted inputs: deterministic for given inputs).
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "etl" / "config"
PROCESSED = ROOT / "data" / "processed"
PUBLISHED_SAMPLE = ROOT / "web" / "public" / "data" / "portfolio_sample.csv"
BELOW_C = ["D", "E", "F", "G"]
COLUMNS = ["asset_id", "uprn", "postcode", "use", "tenure", "floor_area_m2", "value_gbp"]

log = logging.getLogger("06_sample_portfolio")


def take(pool: pd.DataFrame, n: int, rng: np.random.Generator, label: str) -> pd.DataFrame:
    if n <= 0:
        return pool.iloc[0:0]
    if len(pool) < n:
        raise RuntimeError(f"{label}: need {n}, only {len(pool)} candidates")
    idx = rng.choice(len(pool), size=n, replace=False)
    return pool.iloc[np.sort(idx)]


def reuse_published(cand: pd.DataFrame) -> pd.DataFrame:
    """Load the published sample and attach current EPC and flood fields; fail if any asset no longer resolves."""
    sample = pd.read_csv(PUBLISHED_SAMPLE, dtype={"uprn": str, "postcode": str})
    port = sample[COLUMNS].merge(cand.drop(columns=["postcode", "tenure", "floor_area_m2"]), on=["uprn", "use"], how="left")
    port["floor_area_m2"] = sample["floor_area_m2"]
    missing = port[port["band_current"].isna()]["asset_id"].tolist()
    if missing:
        raise RuntimeError(f"published sample no longer resolves for {missing[:10]}; re-run with --resample")
    port["epc_floor_area_m2"] = port["floor_area_m2"].fillna(
        sample[["uprn", "use"]].merge(cand[["uprn", "use", "floor_area_m2"]], on=["uprn", "use"], how="left")["floor_area_m2"]
    )
    log.info("reusing published sample: %d assets (pass --resample to draw a new one)", len(port))
    return port


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--resample", action="store_true", help="draw a new sample instead of reusing the published one")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = yaml.safe_load((CONFIG / "portfolio.yaml").read_text(encoding="utf-8"))
    rng = np.random.default_rng(cfg["seed"])

    epc = pd.read_parquet(PROCESSED / "epc_latest.parquet")
    flood = pd.read_parquet(PROCESSED / "uprn_flood.parquet")[["uprn", "rofrs", "zone", "rofsw"]]
    log.info("EPC certificates in: %d", len(epc))
    cand = epc.merge(flood, on="uprn", how="inner").sort_values(["use", "la_code", "uprn"]).reset_index(drop=True)
    log.info("certificates with a located UPRN: %d", len(cand))

    if PUBLISHED_SAMPLE.exists() and not args.resample:
        port = reuse_published(cand)
        port[COLUMNS].to_csv(PROCESSED / "portfolio_sample.csv", index=False)
        report(port, cfg)
        return
    res = cand[(cand["use"] == "residential") & cand["tenure"].isin(cfg["domestic_tenures"])]
    com = cand[cand["use"] == "commercial"]

    picks: list[pd.DataFrame] = []
    for use, pool_all in (("residential", res), ("commercial", com)):
        for la, quota in cfg["quotas"][use].items():
            pool = pool_all[pool_all["la_code"] == la]
            n_large = cfg["large_commercial"].get(la, 0) if use == "commercial" else 0
            large = pool["floor_area_m2"] > cfg["large_floor_area_m2"]
            chosen = take(pool[large], n_large, rng, f"{use} {la} large")
            pool = pool[~pool.index.isin(chosen.index) & ~large] if n_large else pool
            remaining = quota - len(chosen)
            n_below = round(quota * cfg["below_c_share"]) - chosen["band_current"].isin(BELOW_C).sum()
            n_below = max(0, min(remaining, n_below))
            below = take(pool[pool["band_current"].isin(BELOW_C)], n_below, rng, f"{use} {la} D-G")
            above = take(pool[~pool["band_current"].isin(BELOW_C)], remaining - n_below, rng, f"{use} {la} A-C")
            picks.extend([chosen, below, above])

    port = pd.concat(picks).sort_values(["use", "la_code", "uprn"], ascending=[False, True, True]).reset_index(drop=True)
    port["asset_id"] = [f"RL-{i:04d}" for i in range(1, len(port) + 1)]
    port["tenure"] = "rented"
    port["epc_floor_area_m2"] = port["floor_area_m2"]
    port["floor_area_m2"] = pd.NA  # left blank so the ETL falls back to the EPC value
    port["value_gbp"] = pd.NA      # left blank so the HPI estimate is used

    port[COLUMNS].to_csv(PROCESSED / "portfolio_sample.csv", index=False)
    log.info("portfolio_sample.csv: %d rows out", len(port))
    report(port, cfg)


def report(port: pd.DataFrame, cfg: dict) -> None:
    in_flood = (port["rofrs"] != "none") | (port["zone"] != "none") | (port["rofsw"] != "none")
    if in_flood.mean() < cfg["min_flood_share"]:
        raise RuntimeError(f"only {in_flood.mean():.1%} of assets in a flood band; change the seed or quotas")

    print("\nBand mix by use:")
    print(pd.crosstab(port["use"], port["band_current"], margins=True).to_string())
    print(f"\nRated D or below: {port['band_current'].isin(BELOW_C).mean():.1%}")
    print(f"Commercial over {cfg['large_floor_area_m2']} m2: {(port.query('use==\"commercial\"')['epc_floor_area_m2'] > cfg['large_floor_area_m2']).sum()}")
    print(f"Expired EPCs: {port['epc_expired'].sum()}")
    print("\nFlood mix:")
    print(f"  in any flood band: {in_flood.sum()} ({in_flood.mean():.1%})")
    for col in ("rofrs", "zone", "rofsw"):
        print(f"  {col}: {port[col].value_counts().to_dict()}")
    print("\nAssets by LA and use:")
    print(pd.crosstab(port["la_code"], port["use"]).to_string())


if __name__ == "__main__":
    main()
