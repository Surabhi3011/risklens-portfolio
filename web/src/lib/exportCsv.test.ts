import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { buildCsv, CSV_COLUMNS, exportFileName } from './exportCsv';
import { parsePortfolio, parseRules } from './loadData';

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')) as unknown;
const rules = parseRules(read('../../public/config/rules.json'));
const assets = parsePortfolio(read('../../public/data/portfolio_enriched.geojson'));

describe('buildCsv', () => {
  const parsed = Papa.parse<Record<string, string>>(buildCsv(assets, rules), { header: true, skipEmptyLines: true });

  it('writes one row per asset with the documented columns', () => {
    expect(parsed.meta.fields).toEqual([...CSV_COLUMNS]);
    expect(parsed.data).toHaveLength(180);
  });

  it('exports the announced 2031 deadline as a year only, with its rule status', () => {
    const row = parsed.data.find((r) => r.failing_rule_id === 'nondom_mees_2031');
    expect(row?.deadline).toBe('2031');
    expect(row?.rule_status).toBe('announced');
    const dom = parsed.data.find((r) => r.failing_rule_id === 'dom_mees_2030');
    expect(dom?.deadline).toBe('2030-10-01');
  });

  it('leaves unknown costs blank rather than zero', () => {
    const unknown = assets.find((a) => a.upgrade_cost_mid_gbp === null);
    const row = parsed.data.find((r) => r.asset_id === unknown?.asset_id);
    expect(row?.upgrade_cost_mid_gbp_indicative).toBe('');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    const first = assets[0];
    if (!first) throw new Error('no assets');
    const csv = buildCsv([{ ...first, asset_id: '=HYPERLINK("http://x")' }], rules);
    const row = Papa.parse<Record<string, string>>(csv, { header: true }).data[0];
    expect(row?.asset_id).toBe('\'=HYPERLINK("http://x")');
  });

  it('builds dated file names', () => {
    expect(exportFileName('assets', 'csv', new Date(2026, 10, 10))).toBe('risklens_assets_2026-11-10.csv');
  });
});
