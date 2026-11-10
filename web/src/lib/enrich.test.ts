import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { type EnrichContext, enrichRow, type JoinedRow, summarise } from './enrich';
import { parseRules } from './loadData';
import type { PortfolioRow } from './validateUpload';

const rules = parseRules(
  JSON.parse(readFileSync(fileURLToPath(new URL('../../public/config/rules.json', import.meta.url)), 'utf-8')),
);
const ctx: EnrichContext = {
  rules,
  hpi: new Map([
    ['E06000014|all', 311865],
    ['E06000014|flat', 180669],
  ]),
  laNames: new Map([['E06000014', 'York']]),
};

const EMPTY: JoinedRow = {
  epc_band_current: null,
  epc_band_potential: null,
  epc_score_current: null,
  epc_floor_area_m2: null,
  epc_lodgement_date: null,
  epc_property_type: null,
  epc_top3_recs: null,
  epc_rec_costs_mid: null,
  epc_postcode: null,
  f_lat: null,
  f_lon: null,
  f_la_code: null,
  f_rofrs: null,
  f_zone: null,
  f_rofsw: null,
  p_lat: null,
  p_lon: null,
  p_la_code: null,
  p_rofrs: null,
  p_zone: null,
  p_rofsw: null,
  p_median_band_residential: null,
  p_median_lodgement_residential: null,
  p_median_band_commercial: null,
  p_median_lodgement_commercial: null,
};
const ROW: PortfolioRow = {
  asset_id: 'A1',
  uprn: '100',
  postcode: 'YO1 7HH',
  use: 'residential',
  tenure: 'rented',
  floor_area_m2: null,
  value_gbp: null,
};
const LOCATED: Partial<JoinedRow> = { f_lat: 53.96, f_lon: -1.08, f_la_code: 'E06000014', f_rofrs: 'high', f_zone: '3', f_rofsw: 'none' };

describe('enrichRow', () => {
  it('matches by UPRN and scores like the Python pipeline', () => {
    const out = enrichRow(
      ROW,
      {
        ...EMPTY,
        ...LOCATED,
        epc_band_current: 'D',
        epc_band_potential: 'B',
        epc_score_current: 60,
        epc_floor_area_m2: 55,
        epc_lodgement_date: '2024-03-01',
        epc_property_type: 'Flat',
        epc_top3_recs: JSON.stringify([{ summary: 'Loft insulation', cost_low: 100, cost_high: 350 }]),
        epc_rec_costs_mid: JSON.stringify([225, null, 800]),
      },
      ctx,
    );
    expect(out.covered).toBe(true);
    if (!out.covered) return;
    expect(out.asset).toMatchObject({
      match_level: 'uprn',
      la_name: 'York',
      epc: { band_current: 'D', band_potential: 'B', expired: false },
      compliance: { status: 'fails_future', failing_rule_id: 'dom_mees_2030', deadline: '2030-10-01' },
      scores: { compliance: 50, flood: 100, data_quality: 0, total: 60 },
      tier: 'act',
      upgrade_cost_mid_gbp: 1025,
      value_gbp: 180669,
      value_source: 'hpi',
    });
  });

  it('falls back to the postcode median EPC and location', () => {
    const out = enrichRow(
      { ...ROW, uprn: null },
      {
        ...EMPTY,
        p_lat: 53.95,
        p_lon: -1.09,
        p_la_code: 'E06000014',
        p_rofrs: 'none',
        p_zone: '2',
        p_rofsw: 'none',
        p_median_band_residential: 'C',
        p_median_lodgement_residential: '2019-06-01',
      },
      ctx,
    );
    expect(out.covered && out.asset).toMatchObject({
      match_level: 'postcode',
      epc: { band_current: 'C' },
      scores: { compliance: 0, flood: 50, data_quality: 50 },
      value_gbp: 311865,
    });
  });

  it('uses client floor area and value, and leaves commercial values empty otherwise', () => {
    const client = enrichRow({ ...ROW, floor_area_m2: 99, value_gbp: 500000 }, { ...EMPTY, ...LOCATED }, ctx);
    expect(client.covered && client.asset).toMatchObject({
      match_level: 'none',
      epc: { floor_area_m2: 99 },
      value_gbp: 500000,
      value_source: 'client',
      compliance: { status: 'no_epc' },
    });
    const commercial = enrichRow({ ...ROW, use: 'commercial' }, { ...EMPTY, ...LOCATED }, ctx);
    expect(commercial.covered && commercial.asset.value_gbp).toBeNull();
  });

  it('flags rows with no location as not covered, and summarises', () => {
    const out = enrichRow({ ...ROW, asset_id: 'FAR' }, EMPTY, ctx);
    expect(out).toEqual({ covered: false, asset_id: 'FAR' });
    const ok = enrichRow(ROW, { ...EMPTY, ...LOCATED, epc_band_current: 'C', epc_lodgement_date: '2024-01-01' }, ctx);
    expect(summarise([out, ok])).toEqual({
      total: 2,
      byUprn: 1,
      byPostcode: 0,
      noEpc: 0,
      notCovered: 1,
      notCoveredIds: ['FAR'],
    });
  });
});
