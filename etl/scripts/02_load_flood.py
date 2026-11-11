"""Step 2: clip EA flood layers to the demo LA boundaries and reproject to EPSG:27700.

Inputs:  data/raw/boundaries/lad_may2026_bgc_demo.geojson
         data/raw/flood/<layer>/<la_code>.geojson   (from scripts/00_fetch_raw.py)
Outputs: data/processed/boundaries.parquet          (GeoParquet, EPSG:27700)
         data/processed/flood/<layer>.parquet       (GeoParquet, EPSG:27700; columns la_code, band, geometry)

Idempotent: outputs are overwritten on each run.
"""

from __future__ import annotations

import logging
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely
import yaml
from shapely.geometry.base import BaseGeometry

from risklens_etl.flood import map_band

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "etl" / "config"
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
BNG = "EPSG:27700"

log = logging.getLogger("02_load_flood")


def load_boundaries(code_field: str, name_field: str) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(RAW / "boundaries" / "lad_may2026_bgc_demo.geojson")
    if gdf.crs is None or gdf.crs.to_epsg() != 27700:
        raise RuntimeError(f"boundaries: expected EPSG:27700, got {gdf.crs}; re-run 00_fetch_raw.py --force")
    gdf = gdf.rename(columns={code_field: "la_code", name_field: "la_name"})[["la_code", "la_name", "geometry"]]
    return gdf.to_crs(BNG)


def polygon_parts(geom: BaseGeometry) -> BaseGeometry:
    """Drop point and line parts from a GeometryCollection, keeping (Multi)Polygon parts."""
    if geom.geom_type != "GeometryCollection":
        return geom
    polys = [g for g in shapely.get_parts(geom) if g.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(polys) if polys else shapely.Polygon()


def clip_layer(
    path: Path, boundary: gpd.GeoDataFrame, band_field: str, band_map: dict[str, str]
) -> tuple[gpd.GeoDataFrame, int]:
    raw = gpd.read_file(path)
    if raw.crs is None or raw.crs.to_epsg() != 27700:
        # 00_fetch_raw.py requests EPSG:27700 natively; refuse anything else rather than reproject approximately.
        raise RuntimeError(f"{path.name}: expected EPSG:27700 raw data, got {raw.crs}; re-run 00_fetch_raw.py --force")
    invalid = ~raw.geometry.is_valid
    if invalid.any():
        log.info("%s: repairing %d invalid geometries with buffer(0)", path.name, invalid.sum())
        raw.loc[invalid, "geometry"] = raw.loc[invalid, "geometry"].buffer(0)
    raw["band"] = raw[band_field].map(lambda v: map_band(v, band_map))
    clipped = gpd.clip(raw[["band", "geometry"]], boundary)
    clipped = clipped[~clipped.geometry.is_empty & clipped.geom_type.isin(["Polygon", "MultiPolygon", "GeometryCollection"])]
    # Clipping can produce GeometryCollections that mix in line slivers; keep only the polygon parts.
    clipped["geometry"] = clipped.geometry.apply(polygon_parts)
    return clipped[~clipped.geometry.is_empty].reset_index(drop=True), len(raw)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    areas = yaml.safe_load((CONFIG / "areas.yaml").read_text(encoding="utf-8"))
    sources = yaml.safe_load((CONFIG / "sources.yaml").read_text(encoding="utf-8"))
    bsrc = areas["boundary_source"]

    boundaries = load_boundaries(bsrc["code_field"], bsrc["name_field"])
    PROCESSED.mkdir(parents=True, exist_ok=True)
    boundaries.to_parquet(PROCESSED / "boundaries.parquet")
    log.info("boundaries: %d LAs -> boundaries.parquet", len(boundaries))

    (PROCESSED / "flood").mkdir(exist_ok=True)
    rows: list[dict[str, object]] = []
    for layer, cfg in sources["flood_layers"].items():
        parts: list[gpd.GeoDataFrame] = []
        for area in areas["areas"]:
            code = area["la_code"]
            boundary = boundaries[boundaries["la_code"] == code]
            clipped, n_in = clip_layer(RAW / "flood" / layer / f"{code}.geojson", boundary,
                                       cfg["band_field"], sources["band_maps"][layer])
            clipped.insert(0, "la_code", code)
            parts.append(clipped)
            row: dict[str, object] = {"layer": layer, "la_code": code, "la_name": area["la_name"],
                                      "features_in": n_in, "features_out": len(clipped)}
            row.update(clipped["band"].value_counts().to_dict())
            rows.append(row)
            log.info("%s %s: %d in -> %d clipped", layer, code, n_in, len(clipped))
        out = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=BNG)
        out.to_parquet(PROCESSED / "flood" / f"{layer}.parquet")
        log.info("%s: wrote %d features", layer, len(out))

    print("\nFlood features per layer and LA (after clipping to the LA boundary):")
    print(pd.DataFrame(rows).fillna(0).to_string(index=False))


if __name__ == "__main__":
    main()
