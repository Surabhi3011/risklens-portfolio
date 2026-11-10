// Human-readable labels shared by the table, drawer and exports.
import type { Asset, ComplianceStatus, FloodZone, Likelihood, Rule, Rules } from '../types';
import { milestoneLabel } from './aggregate';

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  fails_current: 'Fails now',
  no_epc: 'No valid EPC',
  fails_future: 'Fails by deadline',
  compliant: 'Compliant',
};

export const LIKELIHOOD_LABEL: Record<Likelihood, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  very_low: 'Very low',
  none: 'None',
};

export const ZONE_LABEL: Record<FloodZone, string> = { '3': 'Zone 3', '2': 'Zone 2', none: 'Outside zones' };

export const FLOOD_SCORE_LABEL: Record<0 | 50 | 100, string> = { 100: 'High', 50: 'Medium', 0: 'Low' };

/** Deadline text for an asset's failing rule. Announced rules show the year only, with "(announced)". */
export function deadlineText(a: Asset, rules: Rules): string {
  const id = a.compliance.failing_rule_id;
  if (a.compliance.status === 'fails_current') return 'In force now';
  if (a.compliance.status === 'no_epc') return a.tenure === 'rented' ? 'EPC needed now' : '—';
  if (!id || !a.compliance.deadline) return '—';
  const rule = rules.rules.find((r) => r.id === id);
  const announced = rule?.status === 'announced';
  return `${milestoneLabel(a.compliance.deadline, announced)}${announced ? ' (announced)' : ''}`;
}

export const RULE_STATUS_LABEL: Record<Rule['status'], string> = {
  in_force: 'In force',
  confirmed_policy: 'Confirmed policy',
  announced: 'Announced, subject to legislation',
};

/** Plain-English description of a rule from rules.json, e.g. "Domestic rented: minimum EPC C". */
export function ruleDescription(rule: Rule): string {
  const scope = rule.use === 'residential' ? 'Domestic' : 'Non-domestic';
  const area = rule.min_floor_area_m2 !== undefined ? ` (${String(rule.min_floor_area_m2)} m² and over)` : '';
  return `${scope} rented${area}: minimum EPC ${rule.min_band}`;
}

export const MATCH_LABEL: Record<Asset['match_level'], string> = {
  uprn: 'Matched by UPRN',
  postcode: 'Postcode-level estimate',
  none: 'Not matched to an EPC',
};

/** Whole years plus months between an ISO lodgement date and as_of, e.g. "3 years 2 months". */
export function epcAge(lodgementDate: string | null, asOf: string): string | null {
  if (!lodgementDate) return null;
  const [ly, lm, ld] = lodgementDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  const [ay, am, ad] = asOf.slice(0, 10).split('-').map(Number) as [number, number, number];
  let months = (ay - ly) * 12 + (am - lm) - (ad < ld ? 1 : 0);
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y === 1 ? '1 year' : `${String(y)} years`;
  const ms = m === 1 ? '1 month' : `${String(m)} months`;
  if (y === 0) return ms;
  return m === 0 ? ys : `${ys} ${ms}`;
}
