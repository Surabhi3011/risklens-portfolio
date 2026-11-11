// CSV export of the enriched assets in the current filter (PLAN.md P3.3). Pure builder + a small download helper.
import Papa from 'papaparse';
import type { Asset, Rules } from '../types';

/** Spreadsheet apps execute cells starting with these characters as formulas; prefix them so they stay text. */
const FORMULA_START = /^[=+\-@\t\r]/;

function safe(v: string | number | boolean | null): string | number | boolean | null {
  return typeof v === 'string' && FORMULA_START.test(v) ? `'${v}` : v;
}

export const CSV_COLUMNS = [
  'asset_id',
  'uprn',
  'postcode',
  'la_code',
  'la_name',
  'use',
  'tenure',
  'match_level',
  'epc_band_current',
  'epc_band_potential',
  'epc_score_current',
  'epc_floor_area_m2',
  'epc_lodgement_date',
  'epc_expired',
  'flood_rivers_sea',
  'flood_zone',
  'flood_surface_water',
  'compliance_status',
  'failing_rule_id',
  'rule_status',
  'deadline',
  'score_compliance',
  'score_flood',
  'score_data_quality',
  'score_total',
  'tier',
  'upgrade_cost_mid_gbp_indicative',
  'upgrade_cost_source',
  'value_gbp',
  'value_source',
  'recommendation_1',
  'recommendation_2',
  'recommendation_3',
] as const;

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string | number | boolean | null>;

export function assetToCsvRow(a: Asset, rules: Rules): CsvRow {
  const rule = rules.rules.find((r) => r.id === a.compliance.failing_rule_id) ?? null;
  // Announced rules carry a placeholder date: export the year only (CLAUDE.md rule 8).
  const deadline =
    a.compliance.deadline === null ? null : rule?.status === 'announced' ? a.compliance.deadline.slice(0, 4) : a.compliance.deadline;
  const rec = (i: number): string | null => a.recommendations[i]?.summary ?? null;
  const row: CsvRow = {
    asset_id: a.asset_id,
    uprn: a.uprn,
    postcode: a.postcode,
    la_code: a.la_code,
    la_name: a.la_name,
    use: a.use,
    tenure: a.tenure,
    match_level: a.match_level,
    epc_band_current: a.epc.band_current,
    epc_band_potential: a.epc.band_potential,
    epc_score_current: a.epc.score_current,
    epc_floor_area_m2: a.epc.floor_area_m2,
    epc_lodgement_date: a.epc.lodgement_date,
    epc_expired: a.epc.expired,
    flood_rivers_sea: a.flood.rofrs,
    flood_zone: a.flood.zone,
    flood_surface_water: a.flood.rofsw,
    compliance_status: a.compliance.status,
    failing_rule_id: a.compliance.failing_rule_id,
    rule_status: rule?.status ?? null,
    deadline,
    score_compliance: a.scores.compliance,
    score_flood: a.scores.flood,
    score_data_quality: a.scores.data_quality,
    score_total: a.scores.total,
    tier: a.tier,
    upgrade_cost_mid_gbp_indicative: a.upgrade_cost_mid_gbp,
    upgrade_cost_source: a.upgrade_cost_source,
    value_gbp: a.value_gbp,
    value_source: a.value_source,
    recommendation_1: rec(0),
    recommendation_2: rec(1),
    recommendation_3: rec(2),
  };
  for (const k of CSV_COLUMNS) row[k] = safe(row[k]);
  return row;
}

export function buildCsv(assets: readonly Asset[], rules: Rules): string {
  return Papa.unparse(
    {
      fields: [...CSV_COLUMNS],
      data: assets.map((a) => {
        const r = assetToCsvRow(a, rules);
        return CSV_COLUMNS.map((c) => r[c]);
      }),
    },
    { newline: '\r\n' },
  );
}

/** Trigger a browser download of text content. A UTF-8 BOM lets Excel show "£" and "²" correctly. */
export function downloadText(text: string, fileName: string, mime: string): void {
  const blob = new Blob(['﻿', text], { type: `${mime};charset=utf-8` });
  downloadBlob(blob, fileName);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/** File-name stamp from the rules date and today, e.g. "risklens_assets_2026-11-10.csv". */
export function exportFileName(kind: 'assets' | 'summary', ext: 'csv' | 'pdf', today = new Date()): string {
  const d = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return `risklens_${kind}_${d}.${ext}`;
}
