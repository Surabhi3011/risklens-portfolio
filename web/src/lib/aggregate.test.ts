import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { computeKpis } from './aggregate';

function asset(over: {
  band?: Asset['epc']['band_current'];
  zone?: Asset['flood']['zone'];
  status?: Asset['compliance']['status'];
  cost?: number | null;
  value?: number | null;
}): Asset {
  return {
    asset_id: 'RL-0000',
    uprn: '1',
    postcode: 'YO1 1AA',
    la_code: 'E06000014',
    la_name: 'York',
    use: 'residential',
    tenure: 'rented',
    match_level: 'uprn',
    epc: {
      band_current: over.band ?? 'C',
      band_potential: null,
      score_current: null,
      floor_area_m2: null,
      lodgement_date: '2024-01-01',
      expired: false,
    },
    flood: { rofrs: 'none', zone: over.zone ?? 'none', rofsw: 'none' },
    compliance: { failing_rule_id: null, deadline: null, status: over.status ?? 'compliant' },
    scores: { compliance: 0, flood: 0, data_quality: 0, total: 0 },
    tier: 'low',
    recommendations: [],
    upgrade_cost_mid_gbp: over.cost === undefined ? 0 : over.cost,
    value_gbp: over.value === undefined ? 100_000 : over.value,
    value_source: 'hpi',
  };
}

describe('computeKpis', () => {
  it('handles an empty list', () => {
    const k = computeKpis([]);
    expect(k.assets).toBe(0);
    expect(k.belowCPct).toBe(0);
    expect(k.zone3Pct).toBe(0);
  });

  it('counts bands, Zone 3, budget and exposed value over non-compliant assets only', () => {
    const k = computeKpis([
      asset({ band: 'C' }),
      asset({ band: 'D', zone: '3', status: 'fails_future', cost: 1500, value: 200_000 }),
      asset({ band: 'F', status: 'fails_current', cost: null, value: null }),
      asset({ band: null, status: 'no_epc', cost: null, value: 300_000 }),
    ]);
    expect(k.assets).toBe(4);
    expect(k.belowC).toBe(2);
    expect(k.belowCPct).toBe(50);
    expect(k.zone3).toBe(1);
    expect(k.nonCompliant).toBe(3);
    expect(k.upgradeBudget).toBe(1500);
    expect(k.upgradeCostUnknown).toBe(2);
    expect(k.valueExposed).toBe(500_000);
    expect(k.valueUnknown).toBe(1);
  });
});
