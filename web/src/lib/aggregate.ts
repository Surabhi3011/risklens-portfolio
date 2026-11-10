// KPI and chart aggregations over the (filtered) asset list.
import type { Asset, Band, Rules } from '../types';
import { bandFails, ruleApplies } from './scoring';

export const BANDS: readonly Band[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const BELOW_C: ReadonlySet<Band> = new Set<Band>(['D', 'E', 'F', 'G']);

export interface Kpis {
  assets: number;
  belowC: number;
  belowCPct: number;
  zone3: number;
  zone3Pct: number;
  /** Assets failing a current or upcoming rule, or rented without a valid EPC. */
  nonCompliant: number;
  /** Sum of indicative upgrade costs over non-compliant assets that have one. */
  upgradeBudget: number;
  /** Non-compliant assets with no cost (no costed recommendations and no configured fallback). */
  upgradeCostUnknown: number;
  /** Total value of non-compliant assets that have a value. */
  valueExposed: number;
  /** Non-compliant assets with no value (commercial, or no HPI match). */
  valueUnknown: number;
}

const pct = (n: number, d: number): number => (d === 0 ? 0 : (100 * n) / d);

export function isNonCompliant(a: Asset): boolean {
  return a.compliance.status !== 'compliant';
}

export function computeKpis(assets: readonly Asset[]): Kpis {
  let belowC = 0;
  let zone3 = 0;
  let nonCompliant = 0;
  let upgradeBudget = 0;
  let upgradeCostUnknown = 0;
  let valueExposed = 0;
  let valueUnknown = 0;
  for (const a of assets) {
    if (a.epc.band_current !== null && BELOW_C.has(a.epc.band_current)) belowC += 1;
    if (a.flood.zone === '3') zone3 += 1;
    if (isNonCompliant(a)) {
      nonCompliant += 1;
      if (a.upgrade_cost_mid_gbp === null) upgradeCostUnknown += 1;
      else upgradeBudget += a.upgrade_cost_mid_gbp;
      if (a.value_gbp === null) valueUnknown += 1;
      else valueExposed += a.value_gbp;
    }
  }
  return {
    assets: assets.length,
    belowC,
    belowCPct: pct(belowC, assets.length),
    zone3,
    zone3Pct: pct(zone3, assets.length),
    nonCompliant,
    upgradeBudget,
    upgradeCostUnknown,
    valueExposed,
    valueUnknown,
  };
}

export interface BandCount {
  band: Band | 'none';
  label: string;
  count: number;
  belowC: boolean;
}

/** Counts per EPC band A-G in order, plus "No EPC" (only when present). */
export function bandDistribution(assets: readonly Asset[]): BandCount[] {
  const counts = new Map<Band | 'none', number>();
  for (const a of assets) {
    const k = a.epc.band_current ?? 'none';
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rows: BandCount[] = BANDS.map((b) => ({ band: b, label: b, count: counts.get(b) ?? 0, belowC: BELOW_C.has(b) }));
  const none = counts.get('none') ?? 0;
  if (none > 0) rows.push({ band: 'none', label: 'No EPC', count: none, belowC: false });
  return rows;
}

export interface Milestone {
  /** Short axis label, e.g. "Today", "Oct 2030", "2031". */
  label: string;
  /** ISO date of the milestone, or null for today. */
  date: string | null;
  /** True when the milestone comes from a rule that is announced but not yet legislated. */
  announced: boolean;
  count: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Announced rules show the year only (the exact date is a placeholder); others show month and year. */
export function milestoneLabel(deadline: string, announced: boolean): string {
  const [y, m] = deadline.split('-');
  return announced ? (y ?? '') : `${MONTHS[Number(m) - 1] ?? ''} ${y ?? ''}`;
}

/**
 * Non-compliant counts today and at each rule deadline, based on current EPCs.
 * At a milestone an asset counts if it is non-compliant today, or fails any rule whose deadline has passed by then.
 */
export function complianceTimeline(assets: readonly Asset[], rules: Rules): Milestone[] {
  const deadlines = [...new Set(rules.rules.map((r) => r.deadline).filter((d): d is string => d !== null))].sort();
  const failsBy = (a: Asset, date: string): boolean => {
    const band = a.epc.band_current;
    if (band === null) return false;
    return rules.rules.some(
      (r) =>
        r.deadline !== null &&
        r.deadline <= date &&
        ruleApplies(r, { use: a.use, tenure: a.tenure, floor_area_m2: a.epc.floor_area_m2 }) &&
        bandFails(band, r.min_band),
    );
  };
  const nowFailing = (a: Asset): boolean =>
    a.compliance.status === 'fails_current' || a.compliance.status === 'no_epc';

  const today: Milestone = {
    label: 'Today',
    date: null,
    announced: false,
    count: assets.filter(nowFailing).length,
  };
  const later = deadlines.map((d): Milestone => {
    const announced = rules.rules.some((r) => r.deadline === d && r.status === 'announced');
    return {
      label: milestoneLabel(d, announced),
      date: d,
      announced,
      count: assets.filter((a) => nowFailing(a) || failsBy(a, d)).length,
    };
  });
  return [today, ...later];
}
