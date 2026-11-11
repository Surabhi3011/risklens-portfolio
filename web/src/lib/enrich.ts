// Turn an uploaded row plus its joined lookup values into an enriched, scored asset.
// Mirror of etl/scripts/07_enrich_score.py (the per-asset loop): keep them identical.
import type { Band, FloodZone, Likelihood, PortfolioAsset, Recommendation, Rules } from '../types';
import { isExpired, scoreAsset, type ScoreInput } from './scoring';
import type { PortfolioRow } from './validateUpload';

/** One row of the DuckDB join (ARCHITECTURE.md §3.4). Every lookup column is null when there was no match. */
export interface JoinedRow {
  epc_band_current: string | null;
  epc_band_potential: string | null;
  epc_score_current: number | null;
  epc_floor_area_m2: number | null;
  epc_lodgement_date: string | null;
  epc_property_type: string | null;
  epc_top3_recs: string | null;
  epc_rec_costs_mid: string | null;
  epc_postcode: string | null;
  f_lat: number | null;
  f_lon: number | null;
  f_la_code: string | null;
  f_rofrs: string | null;
  f_zone: string | null;
  f_rofsw: string | null;
  p_lat: number | null;
  p_lon: number | null;
  p_la_code: string | null;
  p_rofrs: string | null;
  p_zone: string | null;
  p_rofsw: string | null;
  p_median_band_residential: string | null;
  p_median_lodgement_residential: string | null;
  p_median_band_commercial: string | null;
  p_median_lodgement_commercial: string | null;
}

/** HPI average price keyed by `${la_code}|${property_type}`. */
export type HpiLookup = ReadonlyMap<string, number>;

// EPC property_type -> HPI property type. Houses fall back to the LA average because built form isn't loaded.
const HPI_TYPE: Readonly<Record<string, string>> = { Flat: 'flat', Maisonette: 'flat' };

export interface EnrichContext {
  rules: Rules;
  hpi: HpiLookup;
  laNames: ReadonlyMap<string, string>;
}

export type EnrichOutcome = { covered: true; asset: PortfolioAsset } | { covered: false; asset_id: string };

const asBand = (v: string | null): Band | null => (v !== null && 'ABCDEFG'.includes(v) && v.length === 1 ? (v as Band) : null);
const asLikelihood = (v: string | null): Likelihood =>
  v === 'high' || v === 'medium' || v === 'low' || v === 'very_low' ? v : 'none';
const asZone = (v: string | null): FloodZone => (v === '3' || v === '2' ? v : 'none');

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function enrichRow(row: PortfolioRow, j: JoinedRow, ctx: EnrichContext): EnrichOutcome {
  const { rules } = ctx;

  // Match level: UPRN (EPC for this UPRN and use), else the postcode's median EPC for this use, else none.
  let match: PortfolioAsset['match_level'] = 'none';
  let band: Band | null = null;
  let bandPotential: Band | null = null;
  let score: number | null = null;
  let area: number | null = null;
  let lodged: string | null = null;
  let ptype: string | null = null;
  let top3: Recommendation[] = [];
  let costs: (number | null)[] = [];
  const medianBand = row.use === 'residential' ? j.p_median_band_residential : j.p_median_band_commercial;
  const medianLodged = row.use === 'residential' ? j.p_median_lodgement_residential : j.p_median_lodgement_commercial;

  if (j.epc_band_current !== null) {
    match = 'uprn';
    band = asBand(j.epc_band_current);
    bandPotential = asBand(j.epc_band_potential);
    score = j.epc_score_current;
    area = j.epc_floor_area_m2;
    lodged = j.epc_lodgement_date;
    ptype = j.epc_property_type;
    top3 = parseJson<Recommendation[]>(j.epc_top3_recs, []);
    costs = parseJson<(number | null)[]>(j.epc_rec_costs_mid, []);
  } else if (asBand(medianBand) !== null) {
    match = 'postcode';
    band = asBand(medianBand);
    lodged = medianLodged;
  }

  // Location, LA and flood: from the UPRN when known, else the postcode; otherwise not covered by the demo areas.
  let lat: number;
  let lon: number;
  let laCode: string;
  let flood: PortfolioAsset['flood'];
  if (j.f_lat !== null && j.f_lon !== null && j.f_la_code !== null) {
    lat = j.f_lat;
    lon = j.f_lon;
    laCode = j.f_la_code;
    flood = { rofrs: asLikelihood(j.f_rofrs), zone: asZone(j.f_zone), rofsw: asLikelihood(j.f_rofsw) };
  } else if (j.p_lat !== null && j.p_lon !== null && j.p_la_code !== null) {
    lat = j.p_lat;
    lon = j.p_lon;
    laCode = j.p_la_code;
    flood = { rofrs: asLikelihood(j.p_rofrs), zone: asZone(j.p_zone), rofsw: asLikelihood(j.p_rofsw) };
  } else {
    return { covered: false, asset_id: row.asset_id };
  }

  const floorArea = row.floor_area_m2 ?? area;

  let value: number | null = null;
  let valueSource: PortfolioAsset['value_source'] = null;
  if (row.value_gbp !== null) {
    value = row.value_gbp;
    valueSource = 'client';
  } else if (row.use === 'residential') {
    const v = ctx.hpi.get(`${laCode}|${HPI_TYPE[ptype ?? ''] ?? 'all'}`);
    if (v !== undefined) {
      value = v;
      valueSource = 'hpi';
    }
  } // Commercial: no open data source for values (HPI is residential only).

  const input: ScoreInput = {
    use: row.use,
    tenure: row.tenure,
    match_level: match,
    band_current: band,
    floor_area_m2: floorArea,
    lodgement_date: lodged ? lodged.slice(0, 10) : null,
    flood,
    rec_costs_mid: costs,
  };
  const s = scoreAsset(input, rules);
  const expired = band !== null && isExpired(input.lodgement_date, rules.as_of, rules.data_quality.epc_valid_years);

  return {
    covered: true,
    asset: {
      asset_id: row.asset_id,
      uprn: row.uprn,
      postcode: row.postcode ?? j.epc_postcode,
      la_code: laCode,
      la_name: ctx.laNames.get(laCode) ?? laCode,
      use: row.use,
      tenure: row.tenure,
      match_level: match,
      epc: {
        band_current: band,
        band_potential: bandPotential,
        score_current: score,
        floor_area_m2: floorArea,
        lodgement_date: input.lodgement_date,
        expired,
      },
      flood,
      compliance: s.compliance,
      scores: s.scores,
      tier: s.tier,
      recommendations: top3,
      upgrade_cost_mid_gbp: s.upgrade_cost_mid_gbp,
      upgrade_cost_source: s.upgrade_cost_source,
      value_gbp: value,
      value_source: valueSource,
      lon: Math.round(lon * 1e6) / 1e6,
      lat: Math.round(lat * 1e6) / 1e6,
    },
  };
}

export interface EnrichSummary {
  total: number;
  byUprn: number;
  byPostcode: number;
  /** Covered (located) but no EPC match. */
  noEpc: number;
  notCovered: number;
  notCoveredIds: string[];
}

export function summarise(outcomes: readonly EnrichOutcome[]): EnrichSummary {
  const s: EnrichSummary = { total: outcomes.length, byUprn: 0, byPostcode: 0, noEpc: 0, notCovered: 0, notCoveredIds: [] };
  for (const o of outcomes) {
    if (!o.covered) {
      s.notCovered += 1;
      s.notCoveredIds.push(o.asset_id);
    } else if (o.asset.match_level === 'uprn') s.byUprn += 1;
    else if (o.asset.match_level === 'postcode') s.byPostcode += 1;
    else s.noEpc += 1;
  }
  return s;
}
