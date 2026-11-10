// KPI and chart aggregations over the (filtered) asset list.
import type { Asset, Band } from '../types';

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
