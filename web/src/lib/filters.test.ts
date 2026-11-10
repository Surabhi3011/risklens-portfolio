import { describe, expect, it } from 'vitest';
import type { Asset } from '../types';
import { describeFilters, filterAssets, isFiltered, NO_FILTERS, sortAssets } from './filters';

function mk(id: string, over: Partial<Pick<Asset, 'la_code' | 'use' | 'tier' | 'value_gbp'>> & { band?: Asset['epc']['band_current'] }): Asset {
  return {
    asset_id: id,
    uprn: null,
    postcode: null,
    la_code: over.la_code ?? 'E06000014',
    la_name: 'York',
    use: over.use ?? 'residential',
    tenure: 'rented',
    match_level: 'uprn',
    epc: {
      band_current: over.band === undefined ? 'C' : over.band,
      band_potential: null,
      score_current: null,
      floor_area_m2: null,
      lodgement_date: null,
      expired: false,
    },
    flood: { rofrs: 'none', zone: 'none', rofsw: 'none' },
    compliance: { failing_rule_id: null, deadline: null, status: 'compliant' },
    scores: { compliance: 0, flood: 0, data_quality: 0, total: 0 },
    tier: over.tier ?? 'low',
    recommendations: [],
    upgrade_cost_mid_gbp: 0,
    value_gbp: over.value_gbp === undefined ? 100 : over.value_gbp,
    value_source: null,
  };
}

const assets = [
  mk('RL-0001', { band: 'D', tier: 'act' }),
  mk('RL-0002', { la_code: 'E09000033', use: 'commercial', band: 'B', value_gbp: null }),
  mk('RL-0003', { band: null, tier: 'watch', value_gbp: 300 }),
];

describe('filterAssets', () => {
  it('returns everything with no filters', () => {
    expect(filterAssets(assets, NO_FILTERS)).toHaveLength(3);
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  it('combines filters with AND', () => {
    expect(filterAssets(assets, { ...NO_FILTERS, la: 'E06000014', tier: 'act' }).map((a) => a.asset_id)).toEqual([
      'RL-0001',
    ]);
    expect(filterAssets(assets, { ...NO_FILTERS, use: 'commercial' }).map((a) => a.asset_id)).toEqual(['RL-0002']);
  });

  it('filters "No EPC" via band none', () => {
    expect(filterAssets(assets, { ...NO_FILTERS, band: 'none' }).map((a) => a.asset_id)).toEqual(['RL-0003']);
  });
});

describe('sortAssets', () => {
  it('sorts by value with nulls last in both directions', () => {
    expect(sortAssets(assets, 'value', 'asc').map((a) => a.asset_id)).toEqual(['RL-0001', 'RL-0003', 'RL-0002']);
    expect(sortAssets(assets, 'value', 'desc').map((a) => a.asset_id)).toEqual(['RL-0003', 'RL-0001', 'RL-0002']);
  });

  it('sorts tier with act first ascending', () => {
    expect(sortAssets(assets, 'tier', 'asc').map((a) => a.tier)).toEqual(['act', 'watch', 'low']);
  });

  it('sorts bands A-G with missing bands last', () => {
    expect(sortAssets(assets, 'band', 'asc').map((a) => a.epc.band_current)).toEqual(['B', 'D', null]);
  });
});

describe('describeFilters', () => {
  const labels = { act: 'Act now', watch: 'Watch', low: 'Low' } as const;
  it('summarises active filters', () => {
    expect(describeFilters(NO_FILTERS, new Map(), labels)).toBe('All assets');
    expect(describeFilters({ ...NO_FILTERS, la: 'E06000014', tier: 'act', band: 'none' }, new Map([['E06000014', 'York']]), labels)).toBe(
      'Local authority: York · EPC band: No EPC · Risk tier: Act now',
    );
  });
});
