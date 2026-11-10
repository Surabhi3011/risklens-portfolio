"""Step 4: spatially join demo UPRN points to each flood layer, keeping the worst band per layer.

Inputs:  data/processed/uprn_locations.parquet, data/processed/flood/{rofrs,flood_zones,rofsw}.parquet
Output:  data/processed/uprn_flood.parquet  (uprn, lat, lon, la_code, rofrs, zone, rofsw)

A point on a polygon edge counts as inside (predicate "intersects"). A UPRN in no polygon of a layer gets "none".
Idempotent: the output is overwritten.
"""

from __future__ import annotations

import logging
from pathlib import Path

import geopandas as gpd
import pandas as pd

from risklens_etl.flood import LIKELIHOOD_ORDER, ZONE_ORDER

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
BNG = "EPSG:27700"

# output column -> (layer file, band order, worst first)
LAYERS: dict[str, tuple[str, tuple[str, ...]]] = {
    "rofrs": ("rofrs", LIKELIHOOD_ORDER),
    "zone": ("flood_zones", ZONE_ORDER),
    "rofsw": ("rofsw", LIKELIHOOD_ORDER),
}

log = logging.getLogger("04_flood_join")


def worst_per_point(points: gpd.GeoDataFrame, polys: gpd.GeoDataFrame, order: tuple[str, ...]) -> pd.Series:
    """Return the worst band per point index; points outside every polygon get 'none'."""
    hits = gpd.sjoin(points[["geometry"]], polys[["band", "geometry"]], how="inner", predicate="intersects")
    rank = {b: i for i, b in enumerate(order)}
    ranked = hits["band"].map(rank)
    worst_rank = ranked.groupby(level=0).min()
    return worst_rank.map(dict(enumerate(order))).reindex(points.index, fill_value="none")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    loc = pd.read_parquet(PROCESSED / "uprn_locations.parquet")
    log.info("UPRN points in: %d", len(loc))
    points = gpd.GeoDataFrame(loc, geometry=gpd.points_from_xy(loc["x"], loc["y"]), crs=BNG)

    out = loc[["uprn", "lat", "lon", "la_code"]].copy()
    for col, (layer, order) in LAYERS.items():
        polys = gpd.read_parquet(PROCESSED / "flood" / f"{layer}.parquet").to_crs(BNG)
        out[col] = worst_per_point(points, polys, order).to_numpy()
        log.info("%s: joined against %d polygons", col, len(polys))

    out.to_parquet(PROCESSED / "uprn_flood.parquet", index=False, compression="zstd")
    log.info("uprn_flood.parquet: %d rows out", len(out))

    print("\nBand distribution (UPRNs) per layer:")
    for col, (_, order) in LAYERS.items():
        counts = out[col].value_counts().reindex(order, fill_value=0)
        pct = (100 * counts / len(out)).round(1)
        print(f"  {col:6s} " + "  ".join(f"{b}={n} ({p}%)" for b, n, p in zip(order, counts, pct)))
    print("\nShare of UPRNs in any flood band, by LA:")
    any_flood = (out["rofrs"] != "none") | (out["zone"] != "none") | (out["rofsw"] != "none")
    print((100 * any_flood.groupby(out["la_code"]).mean()).round(1).to_string())


if __name__ == "__main__":
    main()
