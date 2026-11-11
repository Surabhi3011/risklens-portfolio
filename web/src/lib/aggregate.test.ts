import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { bandDistribution, complianceTimeline, computeKpis } from './aggregate';
import { parseRules } from './loadData';

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
      band_current: over.band === undefined ? 'C' : over.band,
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
    upgrade_cost_source: over.cost === null ? null : (over.status ?? 'compliant') === 'compliant' ? 'not_required' : 'recommendations',
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

describe('bandDistribution', () => {
  it('returns A-G in order and appends No EPC only when present', () => {
    const rows = bandDistribution([asset({ band: 'D' }), asset({ band: 'D' }), asset({ band: 'A' })]);
    expect(rows.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(rows.find((r) => r.band === 'D')?.count).toBe(2);
    expect(rows.find((r) => r.band === 'D')?.belowC).toBe(true);
    const withNone = bandDistribution([asset({ band: null })]);
    expect(withNone.at(-1)).toMatchObject({ label: 'No EPC', count: 1 });
  });
});

describe('complianceTimeline', () => {
  const rules = parseRules(
    JSON.parse(readFileSync(fileURLToPath(new URL('../../public/config/rules.json', import.meta.url)), 'utf-8')),
  );

  it('labels milestones from rules.json, with the announced 2031 rule as year only', () => {
    const ms = complianceTimeline([], rules);
    expect(ms.map((m) => [m.label, m.announced])).toEqual([
      ['Today', false],
      ['Oct 2030', false],
      ['2031', true],
    ]);
  });

  it('accumulates current failures and rule deadlines', () => {
    const res = (band: Asset['epc']['band_current'], status: Asset['compliance']['status']): Asset =>
      asset({ band, status });
    const big = (band: Asset['epc']['band_current']): Asset => {
      const a = asset({ band, status: 'fails_future' });
      return { ...a, use: 'commercial', epc: { ...a.epc, floor_area_m2: 1500 } };
    };
    const ms = complianceTimeline(
      [
        res('F', 'fails_current'), // failing today
        res(null, 'no_epc'), // failing today
        res('D', 'fails_future'), // fails the 2030 residential C rule
        res('C', 'compliant'), // never fails
        big('C'), // fails the 2031 commercial B rule (>= 1000 m2)
      ],
      rules,
    );
    expect(ms.map((m) => m.count)).toEqual([2, 3, 4]);
  });
});
