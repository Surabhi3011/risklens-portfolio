"""Step 3: filter OS Open UPRN and the ONS Postcode Directory to the demo LAs.

Inputs:  OS Open UPRN zip, ONSPD zip (paths in etl/config/sources.yaml), data/processed/boundaries.parquet
Outputs: data/processed/uprn_locations.parquet  (uprn, x, y, lat, lon, la_code)
         data/processed/postcodes.parquet       (postcode, lat, lon, x, y, la_code, lsoa21, terminated)

OS Open UPRN has no LA field, so points are assigned to LAs by point-in-polygon on EPSG:27700
coordinates after a cheap bounding-box pre-filter. Idempotent: outputs are overwritten.
"""

from __future__ import annotations

import logging
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "etl" / "config"
PROCESSED = ROOT / "data" / "processed"
BNG = "EPSG:27700"
CHUNK = 2_000_000

log = logging.getLogger("03_load_locations")


def load_uprns(cfg: dict[str, str], boundaries: gpd.GeoDataFrame) -> pd.DataFrame:
    xmin, ymin, xmax, ymax = boundaries.total_bounds
    per_la_bounds = {r.la_code: r.geometry.bounds for r in boundaries.itertuples()}
    kept: list[pd.DataFrame] = []
    total = 0
    with zipfile.ZipFile(ROOT / cfg["zip_path"]) as zf, zf.open(cfg["member"]) as fh:
        reader = pd.read_csv(fh, dtype={"UPRN": str}, encoding="utf-8-sig", chunksize=CHUNK)
        for chunk in reader:
            total += len(chunk)
            x, y = chunk["X_COORDINATE"], chunk["Y_COORDINATE"]
            near = pd.Series(False, index=chunk.index)
            for bx0, by0, bx1, by1 in per_la_bounds.values():
                near |= x.between(bx0, bx1) & y.between(by0, by1)
            if near.any():
                kept.append(chunk[near])
    cand = pd.concat(kept, ignore_index=True)
    log.info("OS Open UPRN: %d rows read, %d inside LA bounding boxes (overall bbox %.0f,%.0f,%.0f,%.0f)",
             total, len(cand), xmin, ymin, xmax, ymax)

    pts = gpd.GeoDataFrame(cand, geometry=gpd.points_from_xy(cand["X_COORDINATE"], cand["Y_COORDINATE"]), crs=BNG)
    joined = gpd.sjoin(pts, boundaries[["la_code", "geometry"]], how="inner", predicate="within")
    out = pd.DataFrame({
        "uprn": joined["UPRN"].str.strip(),
        "x": joined["X_COORDINATE"], "y": joined["Y_COORDINATE"],
        "lat": joined["LATITUDE"], "lon": joined["LONGITUDE"],
        "la_code": joined["la_code"],
    }).drop_duplicates("uprn").reset_index(drop=True)
    log.info("OS Open UPRN: %d UPRNs inside the demo LA boundaries", len(out))
    return out


def load_postcodes(cfg: dict[str, object], demo: set[str]) -> pd.DataFrame:
    cols: dict[str, str] = cfg["columns"]  # type: ignore[assignment]
    with zipfile.ZipFile(ROOT / str(cfg["zip_path"])) as zf, zf.open(str(cfg["member"])) as fh:
        raw = pd.read_csv(fh, usecols=list(cols.values()), dtype=str, encoding="utf-8-sig")
    log.info("ONSPD: %d postcodes read", len(raw))
    df = raw.rename(columns={v: k for k, v in cols.items()})
    df = df[df["la_code"].isin(demo)].copy()
    for c in ("lat", "lon", "x", "y"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    # ONSPD uses lat 99.999999 for postcodes without a grid reference.
    no_coords = df["lat"].isna() | (df["lat"] > 90)
    log.info("ONSPD: %d postcodes in demo LAs, %d dropped for missing coordinates", len(df), no_coords.sum())
    df = df[~no_coords]
    df["terminated"] = df["terminated"].notna() & (df["terminated"].str.strip() != "")
    df["postcode"] = df["postcode"].str.strip().str.upper()
    return df[["postcode", "lat", "lon", "x", "y", "la_code", "lsoa21", "terminated"]].reset_index(drop=True)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    sources = yaml.safe_load((CONFIG / "sources.yaml").read_text(encoding="utf-8"))
    boundaries = gpd.read_parquet(PROCESSED / "boundaries.parquet").to_crs(BNG)
    demo = set(boundaries["la_code"])

    uprns = load_uprns(sources["os_open_uprn"], boundaries)
    uprns.to_parquet(PROCESSED / "uprn_locations.parquet", index=False)
    postcodes = load_postcodes(sources["onspd"], demo)
    postcodes.to_parquet(PROCESSED / "postcodes.parquet", index=False)

    names = dict(zip(boundaries["la_code"], boundaries["la_name"]))
    summary = pd.DataFrame({
        "la_name": pd.Series(names),
        "uprns": uprns["la_code"].value_counts(),
        "postcodes_live": postcodes[~postcodes["terminated"]]["la_code"].value_counts(),
        "postcodes_terminated": postcodes[postcodes["terminated"]]["la_code"].value_counts(),
    }).fillna(0)
    print("\nLocations per LA:")
    print(summary.to_string())


if __name__ == "__main__":
    main()
