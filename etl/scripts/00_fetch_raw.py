"""Fetch the LA boundaries and EA flood layers for the demo areas into data/raw/.

Run this once before the numbered ETL steps. It is not part of run_all.py, because raw
downloads are a manual, recorded step (see data/raw/MANIFEST.md).

Outputs (all requested natively in British National Grid, EPSG:27700, so the pipeline never applies an
approximate WGS84 -> OSGB36 datum shift; pyproj has no OSTN15 grid here, which would add ~2-3 m error):
  data/raw/boundaries/lad_may2026_bgc_demo.geojson   (EPSG:27700, one feature per demo LA)
  data/raw/flood/<layer>/<la_code>.geojson           (EPSG:27700, features intersecting the LA boundary's bbox)

The script is idempotent: it skips files that already exist unless --force is given.
"""

from __future__ import annotations

import argparse
import json
import logging
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "etl" / "config"
RAW = ROOT / "data" / "raw"
USER_AGENT = "risklens-etl/0.1 (open-data demo pipeline)"
BNG_URI = "http://www.opengis.net/def/crs/EPSG/0/27700"
BBOX_PAD_M = 100  # pad each LA bbox slightly so edge polygons are included

log = logging.getLogger("fetch_raw")


def http_json(url: str, retries: int = 4, timeout: int = 180) -> dict[str, Any]:
    """GET a URL and parse JSON, retrying transient failures with backoff."""
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as exc:  # network or parse error; retry
            last = exc
            wait = 2 ** attempt
            log.warning("attempt %d failed for %s (%s); retrying in %ds", attempt + 1, url[:120], exc, wait)
            time.sleep(wait)
    raise RuntimeError(f"giving up on {url}") from last


def fetch_ogc_bbox(base: str, collection: str, bbox: list[float], page_size: int) -> list[dict[str, Any]]:
    """Fetch every feature intersecting an EPSG:27700 bbox, in EPSG:27700, following `next` links."""
    params = {"f": "application/geo+json", "bbox": ",".join(str(round(v)) for v in bbox), "bbox-crs": BNG_URI,
              "crs": BNG_URI, "limit": str(page_size)}
    url: str | None = f"{base}/collections/{collection}/items?{urllib.parse.urlencode(params)}"
    features: list[dict[str, Any]] = []
    expected: int | None = None
    while url:
        page = http_json(url)
        if expected is None:
            expected = page.get("numberMatched")
        features.extend(page.get("features", []))
        url = next((link["href"] for link in page.get("links", []) if link.get("rel") == "next"), None)
        time.sleep(0.2)  # be polite to the public service
    if expected is not None and expected != len(features):
        log.warning("%s: numberMatched=%s but fetched %d", collection, expected, len(features))
    return features


def write_fc(path: Path, features: list[dict[str, Any]], meta: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # The legacy GeoJSON "crs" member makes GDAL/GeoPandas read the coordinates as EPSG:27700.
    fc = {"type": "FeatureCollection", "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::27700"}},
          "metadata": meta, "features": features}
    path.write_text(json.dumps(fc), encoding="utf-8")


def fetch_boundaries(areas: dict[str, Any], force: bool) -> None:
    out = RAW / "boundaries" / "lad_may2026_bgc_demo.geojson"
    if out.exists() and not force:
        log.info("skip %s (exists)", out.relative_to(ROOT))
        return
    src = areas["boundary_source"]
    codes = [a["la_code"] for a in areas["areas"]]
    where = f"{src['code_field']} IN ({','.join(repr(c) for c in codes)})"
    params = {"where": where, "outFields": f"{src['code_field']},{src['name_field']}", "outSR": "27700", "f": "geojson"}
    data = http_json(f"{src['feature_service']}/query?{urllib.parse.urlencode(params)}")
    feats = data.get("features", [])
    got = sorted(f["properties"][src["code_field"]] for f in feats)
    if got != sorted(codes):
        raise RuntimeError(f"boundary fetch returned {got}, expected {sorted(codes)}")
    write_fc(out, feats, {"source": src["name"], "url": src["feature_service"], "crs": "EPSG:27700",
                          "fetched": time.strftime("%Y-%m-%d")})
    log.info("boundaries: %d features -> %s", len(feats), out.relative_to(ROOT))


def boundary_bboxes() -> dict[str, list[float]]:
    """EPSG:27700 bbox per LA from the fetched boundary file, padded by BBOX_PAD_M."""
    fc = json.loads((RAW / "boundaries" / "lad_may2026_bgc_demo.geojson").read_text(encoding="utf-8"))
    out: dict[str, list[float]] = {}
    for f in fc["features"]:
        xs: list[float] = []
        ys: list[float] = []
        def walk(c: Any) -> None:
            if isinstance(c[0], (int, float)):
                xs.append(float(c[0]))
                ys.append(float(c[1]))
            else:
                for cc in c:
                    walk(cc)
        walk(f["geometry"]["coordinates"])
        if max(xs) < 1000:  # guard: coordinates must be metres, not degrees
            raise RuntimeError("boundary file is not in EPSG:27700; re-run with --force")
        code = next(v for k, v in f["properties"].items() if k.upper().startswith("LAD") and k.upper().endswith("CD"))
        out[code] = [min(xs) - BBOX_PAD_M, min(ys) - BBOX_PAD_M, max(xs) + BBOX_PAD_M, max(ys) + BBOX_PAD_M]
    return out


def fetch_flood(areas: dict[str, Any], sources: dict[str, Any], force: bool) -> None:
    bboxes = boundary_bboxes()
    for layer, cfg in sources["flood_layers"].items():
        for area in areas["areas"]:
            out = RAW / "flood" / layer / f"{area['la_code']}.geojson"
            if out.exists() and not force:
                log.info("skip %s (exists)", out.relative_to(ROOT))
                continue
            bbox = bboxes[area["la_code"]]
            feats = fetch_ogc_bbox(cfg["ogc_features"], cfg["collection"], bbox, sources["page_size"])
            bands: dict[str, int] = {}
            for f in feats:
                key = str(f.get("properties", {}).get(cfg["band_field"]))
                bands[key] = bands.get(key, 0) + 1
            meta = {"source": cfg["title"], "collection": cfg["collection"], "crs": "EPSG:27700",
                    "bbox_27700": [round(v) for v in bbox], "fetched": time.strftime("%Y-%m-%d")}
            write_fc(out, feats, meta)
            log.info("%s %s (%s): %d features %s", layer, area["la_code"], area["la_name"], len(feats), bands)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="re-download files that already exist")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    areas = yaml.safe_load((CONFIG / "areas.yaml").read_text(encoding="utf-8"))
    sources = yaml.safe_load((CONFIG / "sources.yaml").read_text(encoding="utf-8"))
    fetch_boundaries(areas, args.force)
    fetch_flood(areas, sources, args.force)


if __name__ == "__main__":
    main()
