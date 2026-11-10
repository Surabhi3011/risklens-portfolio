// Scoring parity with Python (PLAN.md P2.2): the same hand-checked fixture runs in pytest and here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Rules } from '../types';
import { parsePortfolio, parseRules } from './loadData';
import { type ScoreInput, type ScoreResult, scoreAsset, shiftYears } from './scoring';

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')) as unknown;

interface FixtureCase {
  name: string;
  why: string;
  input: ScoreInput;
  expected: ScoreResult;
}
interface Fixture {
  rules_as_of: string;
  cases: FixtureCase[];
}

const fixture = read('../../../etl/tests/fixtures/scoring_cases.json') as Fixture;
const rules = parseRules(read('../../public/config/rules.json'));

describe('scoring parity with scoring_cases.json', () => {
  it('fixture was written for the current rules.json as_of', () => {
    expect(fixture.rules_as_of).toBe(rules.as_of);
    expect(fixture.cases.length).toBeGreaterThanOrEqual(12);
  });

  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    expect(scoreAsset(c.input, rules)).toEqual(c.expected);
  });

  it('uses a numeric fallback cost when configured', () => {
    const withFallback: Rules = { ...rules, fallback_upgrade_cost_gbp: { residential: 1234, commercial: 5678 } };
    const c = fixture.cases.find((x) => x.name === 'commercial_C_1500m2_fails_2031');
    if (!c) throw new Error('fixture case missing');
    expect(scoreAsset(c.input, withFallback).upgrade_cost_mid_gbp).toBe(5678);
  });

  it('shiftYears clamps leap days', () => {
    expect(shiftYears('2024-02-29', -1)).toBe('2023-02-28');
    expect(shiftYears('2026-11-09', -10)).toBe('2016-11-09');
  });
});

describe('scoring parity with the Python-scored portfolio', () => {
  const assets = parsePortfolio(read('../../public/data/portfolio_enriched.geojson'));

  it('re-scores all 180 assets to the same compliance, scores and tier', () => {
    const mismatches = assets.filter((a) => {
      const input: ScoreInput = {
        use: a.use,
        tenure: a.tenure,
        match_level: a.match_level,
        band_current: a.epc.band_current,
        floor_area_m2: a.epc.floor_area_m2,
        lodgement_date: a.epc.lodgement_date,
        flood: a.flood,
        rec_costs_mid: [],
      };
      const r = scoreAsset(input, rules);
      return (
        JSON.stringify([r.compliance, r.scores, r.tier]) !== JSON.stringify([a.compliance, a.scores, a.tier])
      );
    });
    expect(mismatches.map((a) => a.asset_id)).toEqual([]);
    expect(assets).toHaveLength(180);
  });
});
