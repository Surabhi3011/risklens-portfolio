"""Step 7: enrich and score the portfolio, and build the static lookups for the upload path.

Inputs:  data/processed/{portfolio_sample.csv, epc_latest, recs, uprn_flood, uprn_locations, postcodes, hpi}.parquet
Outputs: data/processed/portfolio_enriched.geojson  (ARCHITECTURE.md §3.3, EPSG:4326 points)
         data/processed/uprn_epc.parquet            (§3.4)
         data/processed/postcode_lookup.parquet     (§3.4)

Matching: an asset matches by UPRN when epc_latest has a certificate for that UPRN and use. Otherwise it falls
back to the postcode's median EPC for that use. Otherwise there is no match.
Idempotent: outputs are overwritten.
"""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
import yaml

from risklens_etl.flood import LIKELIHOOD_ORDER, ZONE_ORDER
from risklens_etl.scoring import BANDS, ScoreInput, is_expired, load_rules, score_asset

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "etl" / "config"
PROCESSED = ROOT / "data" / "processed"
BNG = "EPSG:27700"
USES = ("residential", "commercial")
# EPC property_type -> HPI property type. Houses fall back to the LA average: built form isn't loaded.
HPI_TYPE = {"Flat": "flat", "Maisonette": "flat"}

log = logging.getLogger("07_enrich_score")


def none_if_nan(v: Any) -> Any:
    if v is None or v is pd.NA or v is pd.NaT:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def to_builtin(o: Any) -> Any:
    """JSON fallback for NumPy scalars."""
    if hasattr(o, "item"):
        return o.item()
    raise TypeError(f"not JSON serialisable: {type(o).__name__}")


def iso(v: Any) -> str | None:
    v = none_if_nan(v)
    return None if v is None else pd.Timestamp(v).strftime("%Y-%m-%d")


def median_band(bands: pd.Series) -> str | None:
    """Median band by rank. With an even count it takes the worse of the two middle values (conservative)."""
    ranks = sorted(BANDS.index(b) for b in bands.dropna())
    return BANDS[ranks[len(ranks) // 2]] if ranks else None


def worst(values: pd.Series, order: tuple[str, ...]) -> str:
    rank = {b: i for i, b in enumerate(order)}
    present = [v for v in values if v in rank]
    return min(present, key=rank.__getitem__) if present else "none"


def top3_and_costs(recs: pd.DataFrame) -> pd.DataFrame:
    """Per lmk_key: JSON list of the top 3 recommendations, plus the sum of cost_mid over all recommendations."""
    def per_cert(g: pd.DataFrame) -> pd.Series:
        top = [{"summary": r.summary, "cost_low": none_if_nan(r.cost_low), "cost_high": none_if_nan(r.cost_high)}
               for r in g.head(3).itertuples()]
        mids = g["cost_mid"].dropna()
        return pd.Series({"top3_recs": json.dumps(top, ensure_ascii=False),
                          "upgrade_cost_mid": float(mids.sum()) if len(mids) else None,
                          "rec_costs_mid": json.dumps([none_if_nan(c) for c in g["cost_mid"]])})
    return recs.sort_values(["lmk_key", "improvement_item"]).groupby("lmk_key").apply(per_cert, include_groups=False)


def build_uprn_epc(epc: pd.DataFrame, rec_agg: pd.DataFrame) -> pd.DataFrame:
    out = epc.merge(rec_agg, left_on="lmk_key", right_index=True, how="left")
    out["top3_recs"] = out["top3_recs"].fillna("[]")
    out["rec_costs_mid"] = out["rec_costs_mid"].fillna("[]")
    out["lodgement_date"] = out["lodgement_date"].dt.strftime("%Y-%m-%d")
    return out[["uprn", "postcode", "la_code", "use", "band_current", "band_potential", "score_current",
                "floor_area_m2", "lodgement_date", "property_type", "top3_recs", "upgrade_cost_mid", "rec_costs_mid"]]


def build_postcode_lookup(postcodes: pd.DataFrame, epc: pd.DataFrame, uprn_flood: pd.DataFrame) -> pd.DataFrame:
    """Postcode fallback. Flood = worst over EPC-located UPRNs in the postcode plus the postcode centroid."""
    pc = postcodes.copy()
    # ONSPD's own grid references (east1m/north1m): no WGS84 -> OSGB36 datum shift.
    pts = gpd.GeoDataFrame(pc, geometry=gpd.points_from_xy(pc["x"], pc["y"]), crs=BNG)
    for col, layer in (("rofrs", "rofrs"), ("zone", "flood_zones"), ("rofsw", "rofsw")):
        polys = gpd.read_parquet(PROCESSED / "flood" / f"{layer}.parquet").to_crs(BNG)
        order = ZONE_ORDER if col == "zone" else LIKELIHOOD_ORDER
        hits = gpd.sjoin(pts[["geometry"]], polys[["band", "geometry"]], predicate="intersects")
        pc[f"{col}_centroid"] = hits.groupby(level=0)["band"].agg(lambda s: worst(s, order)).reindex(pc.index, fill_value="none")

    epc_fl = epc[["uprn", "postcode"]].drop_duplicates().merge(uprn_flood[["uprn", "rofrs", "zone", "rofsw"]], on="uprn")
    long = pd.concat([
        epc_fl[["postcode", "rofrs", "zone", "rofsw"]],
        pc[["postcode", "rofrs_centroid", "zone_centroid", "rofsw_centroid"]].rename(columns=lambda c: c.replace("_centroid", "")),
    ])
    agg = long.groupby("postcode").agg(
        rofrs=("rofrs", lambda s: worst(s, LIKELIHOOD_ORDER)),
        zone=("zone", lambda s: worst(s, ZONE_ORDER)),
        rofsw=("rofsw", lambda s: worst(s, LIKELIHOOD_ORDER)),
    )
    out = pc[["postcode", "lat", "lon", "la_code"]].merge(agg, left_on="postcode", right_index=True, how="left")
    for use in USES:
        sub = epc[epc["use"] == use]
        g = sub.groupby("postcode")
        stats = pd.DataFrame({
            f"median_band_{use}": g["band_current"].agg(median_band),
            f"median_lodgement_{use}": g["lodgement_date"].median().dt.strftime("%Y-%m-%d"),
        })
        out = out.merge(stats, left_on="postcode", right_index=True, how="left")
    return out.reset_index(drop=True)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    rules = load_rules()
    areas = yaml.safe_load((CONFIG / "areas.yaml").read_text(encoding="utf-8"))
    la_names = {a["la_code"]: a["la_name"] for a in areas["areas"]}

    epc = pd.read_parquet(PROCESSED / "epc_latest.parquet")
    recs = pd.read_parquet(PROCESSED / "recs.parquet")
    uprn_flood = pd.read_parquet(PROCESSED / "uprn_flood.parquet")
    postcodes = pd.read_parquet(PROCESSED / "postcodes.parquet")
    hpi = pd.read_parquet(PROCESSED / "hpi.parquet")
    port = pd.read_csv(PROCESSED / "portfolio_sample.csv", dtype={"uprn": str, "postcode": str})
    log.info("portfolio rows in: %d", len(port))

    rec_agg = top3_and_costs(recs)
    uprn_epc = build_uprn_epc(epc, rec_agg)
    uprn_epc.to_parquet(PROCESSED / "uprn_epc.parquet", index=False, compression="zstd")
    log.info("uprn_epc.parquet: %d rows", len(uprn_epc))
    pc_lookup = build_postcode_lookup(postcodes, epc, uprn_flood)
    pc_lookup.to_parquet(PROCESSED / "postcode_lookup.parquet", index=False, compression="zstd")
    log.info("postcode_lookup.parquet: %d rows", len(pc_lookup))

    epc_by = uprn_epc.set_index(["uprn", "use"])
    flood_by = uprn_flood.set_index("uprn")
    pc_by = pc_lookup.set_index("postcode")
    hpi_by = hpi.set_index(["la_code", "property_type"])["avg_price"]

    features: list[dict[str, Any]] = []
    for row in port.itertuples(index=False):
        uprn = none_if_nan(row.uprn)
        postcode = none_if_nan(row.postcode)
        postcode = postcode.strip().upper() if postcode else None
        pc = pc_by.loc[postcode] if postcode in pc_by.index else None

        e = epc_by.loc[(uprn, row.use)] if uprn and (uprn, row.use) in epc_by.index else None
        if e is not None:
            match = "uprn"
            band, band_pot, score = e.band_current, none_if_nan(e.band_potential), none_if_nan(e.score_current)
            area, lodged, ptype = none_if_nan(e.floor_area_m2), e.lodgement_date, e.property_type
            top3, costs = json.loads(e.top3_recs), json.loads(e.rec_costs_mid)
        elif pc is not None and none_if_nan(pc[f"median_band_{row.use}"]):
            match = "postcode"
            band, band_pot, score, area, ptype = pc[f"median_band_{row.use}"], None, None, None, None
            lodged, top3, costs = pc[f"median_lodgement_{row.use}"], [], []
        else:
            match, band, band_pot, score, area, lodged, ptype, top3, costs = "none", None, None, None, None, None, None, [], []

        if uprn and uprn in flood_by.index:
            f = flood_by.loc[uprn]
            lat, lon, la_code = float(f.lat), float(f.lon), f.la_code
            flood = {"rofrs": f.rofrs, "zone": f.zone, "rofsw": f.rofsw}
        elif pc is not None:
            lat, lon, la_code = float(pc.lat), float(pc.lon), pc.la_code
            flood = {"rofrs": pc.rofrs, "zone": pc.zone, "rofsw": pc.rofsw}
        else:
            raise RuntimeError(f"{row.asset_id}: no location from UPRN or postcode")

        client_area = none_if_nan(row.floor_area_m2)
        floor_area = float(client_area) if client_area is not None else area
        client_value = none_if_nan(row.value_gbp)
        if client_value is not None:
            value, value_source = float(client_value), "client"
        elif row.use == "residential":
            key = (la_code, HPI_TYPE.get(ptype or "", "all"))
            value, value_source = (float(hpi_by[key]), "hpi") if key in hpi_by.index else (None, None)
        else:
            value, value_source = None, None  # HPI is residential only: no open source for commercial values

        inp: ScoreInput = {"use": row.use, "tenure": row.tenure, "match_level": match, "band_current": band,
                           "floor_area_m2": floor_area, "lodgement_date": iso(lodged), "flood": flood,
                           "rec_costs_mid": costs}
        s = score_asset(inp, rules)
        expired = band is not None and is_expired(iso(lodged), rules["as_of"], rules["data_quality"]["epc_valid_years"])

        props = {
            "asset_id": row.asset_id, "uprn": uprn, "postcode": postcode,
            "la_code": la_code, "la_name": la_names[la_code],
            "use": row.use, "tenure": row.tenure, "match_level": match,
            "epc": {"band_current": band, "band_potential": band_pot, "score_current": score,
                    "floor_area_m2": floor_area, "lodgement_date": iso(lodged), "expired": bool(expired)},
            "flood": flood,
            "compliance": s["compliance"], "scores": s["scores"], "tier": s["tier"],
            "recommendations": top3,
            "upgrade_cost_mid_gbp": s["upgrade_cost_mid_gbp"],
            "value_gbp": value, "value_source": value_source,
        }
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                         "properties": props})

    fc = {"type": "FeatureCollection", "features": features}
    (PROCESSED / "portfolio_enriched.geojson").write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":"), default=to_builtin),
                                                          encoding="utf-8")
    log.info("portfolio_enriched.geojson: %d features out", len(features))

    df = pd.DataFrame([f["properties"] for f in features])
    print("\nTier by use:")
    print(pd.crosstab(df["use"], df["tier"], margins=True).to_string())
    print("\nCompliance status:", df["compliance"].map(lambda c: c["status"]).value_counts().to_dict())
    print("Match level:", df["match_level"].value_counts().to_dict())
    costs = df["upgrade_cost_mid_gbp"]
    failing = df["compliance"].map(lambda c: c["status"] != "compliant")
    print(f"Upgrade cost: {costs[failing].notna().sum()} of {failing.sum()} non-compliant assets costed, "
          f"total £{costs.fillna(0).sum():,.0f} (indicative); the rest show 'cost unknown'")
    print(f"Value: {df['value_gbp'].notna().sum()} assets valued by HPI, total £{df['value_gbp'].fillna(0).sum():,.0f}")


if __name__ == "__main__":
    main()
