// Asset scoring (ARCHITECTURE.md §4). Mirror of etl/risklens_etl/scoring.py: keep them identical.
// Both are checked against etl/tests/fixtures/scoring_cases.json.
//  - Dates are compared as ISO 'YYYY-MM-DD' strings and year arithmetic shifts the year field, so there's no timezone drift.
//  - total uses integer half-up rounding, floor((sum(round(w*100) * score) + 50) / 100), matching Python.

import type {
  Asset,
  Band,
  ComplianceStatus,
  CostSource,
  FloodZone,
  Likelihood,
  MatchLevel,
  Rule,
  Rules,
  ScoreValue,
  Tenure,
  Tier,
  Use,
} from '../types';

const BANDS: readonly Band[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export interface ScoreInput {
  use: Use;
  tenure: Tenure;
  match_level: MatchLevel;
  band_current: Band | null;
  floor_area_m2: number | null;
  lodgement_date: string | null; // YYYY-MM-DD
  flood: { rofrs: Likelihood; zone: FloodZone; rofsw: Likelihood };
  rec_costs_mid: (number | null)[];
}

export interface ScoreResult {
  compliance: Asset['compliance'];
  scores: Asset['scores'];
  tier: Tier;
  upgrade_cost_mid_gbp: number | null;
  upgrade_cost_source: CostSource | null;
}

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

function isLeap(y: number): boolean {
  return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
}

/** Shift an ISO date by whole years, clamping 29 Feb to 28 Feb. */
export function shiftYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  const year = y + years;
  const day = m === 2 && d === 29 && !isLeap(year) ? 28 : d;
  return `${pad(year, 4)}-${pad(m, 2)}-${pad(day, 2)}`;
}

/** True if there is no date, or the certificate is more than validYears old at asOf. */
export function isExpired(lodgementDate: string | null, asOf: string, validYears: number): boolean {
  return lodgementDate === null || lodgementDate.slice(0, 10) < shiftYears(asOf, -validYears);
}

/** True when band is worse (later letter) than minBand. */
export function bandFails(band: Band, minBand: Band): boolean {
  return BANDS.indexOf(band) > BANDS.indexOf(minBand);
}

export function ruleApplies(rule: Rule, a: Pick<ScoreInput, 'use' | 'tenure' | 'floor_area_m2'>): boolean {
  if (rule.use !== a.use || rule.tenure !== a.tenure) return false;
  if (rule.min_floor_area_m2 !== undefined) {
    // Unknown floor area: we can't show the size threshold is met, so the rule doesn't apply.
    return a.floor_area_m2 !== null && a.floor_area_m2 >= rule.min_floor_area_m2;
  }
  return true;
}

function scoreCompliance(a: ScoreInput, rules: Rules): [ScoreValue, Asset['compliance']] {
  if (a.tenure === 'owner_occupied') {
    return [0, { failing_rule_id: null, deadline: null, status: 'compliant' }];
  }
  const band = a.band_current;
  if (band === null || isExpired(a.lodgement_date, rules.as_of, rules.data_quality.epc_valid_years)) {
    return [100, { failing_rule_id: null, deadline: null, status: 'no_epc' }];
  }
  const failing = rules.rules.filter((r) => ruleApplies(r, a) && bandFails(band, r.min_band));
  const current = failing.find((r) => r.deadline === null);
  if (current) {
    return [100, { failing_rule_id: current.id, deadline: null, status: 'fails_current' }];
  }
  const future = failing
    .filter((r): r is Rule & { deadline: string } => r.deadline !== null)
    .sort((x, y) => (x.deadline < y.deadline ? -1 : x.deadline > y.deadline ? 1 : 0));
  const first = future[0];
  if (first) {
    return [50, { failing_rule_id: first.id, deadline: first.deadline, status: 'fails_future' }];
  }
  return [0, { failing_rule_id: null, deadline: null, status: 'compliant' }];
}

export function scoreFlood(f: ScoreInput['flood']): ScoreValue {
  if (f.rofrs === 'high' || f.zone === '3' || f.rofsw === 'high') return 100;
  if (f.rofrs === 'medium' || f.rofrs === 'low' || f.zone === '2' || f.rofsw === 'medium') return 50;
  return 0;
}

function scoreDataQuality(a: ScoreInput, rules: Rules): ScoreValue {
  const dq = rules.data_quality;
  if (a.match_level === 'none' || a.band_current === null) return 100;
  if (a.lodgement_date === null || isExpired(a.lodgement_date, rules.as_of, dq.epc_valid_years)) return 100;
  const fresh = a.lodgement_date.slice(0, 10) > shiftYears(rules.as_of, -dq.epc_fresh_years);
  if (a.match_level === 'postcode' || !fresh) return 50;
  return 0;
}

export function totalScore(c: number, f: number, d: number, weights: Rules['weights']): number {
  const pc = Math.round(weights.compliance * 100);
  const pf = Math.round(weights.flood * 100);
  const pd = Math.round(weights.data_quality * 100);
  return Math.floor((pc * c + pf * f + pd * d + 50) / 100);
}

export function tierFor(total: number, tiers: Rules['tiers']): Tier {
  if (total >= tiers.act) return 'act';
  if (total >= tiers.watch) return 'watch';
  return 'low';
}

/** Indicative upgrade cost and its source: 0 when no rule is failed; else recommendation costs, the fallback, or null. */
function upgradeCost(a: ScoreInput, status: ComplianceStatus, rules: Rules): [number | null, CostSource | null] {
  if (status === 'compliant') return [0, 'not_required'];
  if (status === 'fails_current' || status === 'fails_future') {
    const costs = a.rec_costs_mid.filter((c): c is number => c !== null);
    if (costs.length > 0) return [costs.reduce((sum, c) => sum + c, 0), 'recommendations'];
  }
  const fallback = rules.fallback_upgrade_cost_gbp[a.use];
  return typeof fallback === 'number' ? [fallback, 'fallback'] : [null, null];
}

export function scoreAsset(a: ScoreInput, rules: Rules): ScoreResult {
  const [c, compliance] = scoreCompliance(a, rules);
  const f = scoreFlood(a.flood);
  const d = scoreDataQuality(a, rules);
  const total = totalScore(c, f, d, rules.weights);
  const [cost, costSource] = upgradeCost(a, compliance.status, rules);
  return {
    compliance,
    scores: { compliance: c, flood: f, data_quality: d, total },
    tier: tierFor(total, rules.tiers),
    upgrade_cost_mid_gbp: cost,
    upgrade_cost_source: costSource,
  };
}
