// Validate an uploaded portfolio CSV against ARCHITECTURE.md §3.2. Pure: takes parsed rows, returns clean rows + errors.
import type { Tenure, Use } from '../types';

/** One validated portfolio row (§3.2), ready for enrichment. */
export interface PortfolioRow {
  asset_id: string;
  uprn: string | null;
  postcode: string | null;
  use: Use;
  tenure: Tenure;
  floor_area_m2: number | null;
  value_gbp: number | null;
}

export interface RowIssue {
  /** Line number in the file (the header is line 1). 0 for file-level issues. */
  line: number;
  column: string | null;
  message: string;
}

export interface ValidationResult {
  rows: PortfolioRow[];
  errors: RowIssue[];
  warnings: RowIssue[];
  /** Data rows read (blank lines excluded). */
  totalRows: number;
}

export const KNOWN_COLUMNS = ['asset_id', 'uprn', 'postcode', 'use', 'tenure', 'floor_area_m2', 'value_gbp'] as const;
export const MAX_ROWS = 5000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const POSTCODE_RE = /^([A-Z]{1,2}[0-9][A-Z0-9]?)\s*([0-9][A-Z]{2})$/;

/** Normalise a UK postcode to ONSPD `pcds` form ("SW1A 1AA"), or null if it doesn't look like one. */
export function normalisePostcode(raw: string): string | null {
  const m = POSTCODE_RE.exec(raw.trim().toUpperCase().replace(/\s+/g, ' '));
  return m ? `${m[1] ?? ''} ${m[2] ?? ''}` : null;
}

function parseUse(v: string): Use | null {
  const s = v.trim().toLowerCase();
  return s === 'residential' || s === 'commercial' ? s : null;
}

function parseTenure(v: string): Tenure | null {
  const s = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return s === 'rented' || s === 'owner_occupied' ? s : null;
}

/** Positive number, allowing "£" and thousands separators. Returns undefined when blank, NaN when invalid. */
function parseAmount(v: string | undefined): number | undefined {
  const s = (v ?? '').trim().replace(/^£/, '').replace(/,/g, '');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

/**
 * @param header column names as they appear in the file
 * @param records data rows keyed by column name (from Papa Parse with header: true)
 */
export function validateUpload(header: readonly string[], records: readonly Record<string, string | undefined>[]): ValidationResult {
  const errors: RowIssue[] = [];
  const warnings: RowIssue[] = [];
  const cols = header.map((h) => h.trim().toLowerCase());

  const missing = (['asset_id', 'use', 'tenure'] as const).filter((c) => !cols.includes(c));
  for (const c of missing) errors.push({ line: 0, column: c, message: `Missing required column "${c}".` });
  if (!cols.includes('uprn') && !cols.includes('postcode')) {
    errors.push({ line: 0, column: null, message: 'The file needs a "uprn" column, a "postcode" column, or both.' });
  }
  const unknown = cols.filter((c) => c !== '' && !(KNOWN_COLUMNS as readonly string[]).includes(c));
  if (unknown.length > 0) {
    warnings.push({ line: 0, column: null, message: `Ignoring unknown columns: ${unknown.join(', ')}.` });
  }
  if (records.length > MAX_ROWS) {
    errors.push({ line: 0, column: null, message: `The file has ${String(records.length)} rows; the limit is ${String(MAX_ROWS)}.` });
  }
  if (errors.length > 0) return { rows: [], errors, warnings, totalRows: records.length };

  // Map normalised column names back to the file's own spelling.
  const key = (c: string): string => header[cols.indexOf(c)] ?? c;
  const get = (r: Record<string, string | undefined>, c: string): string => (r[key(c)] ?? '').trim();

  const rows: PortfolioRow[] = [];
  const seen = new Map<string, number>();
  records.forEach((r, i) => {
    const line = i + 2;
    const rowErrors: RowIssue[] = [];
    const err = (column: string | null, message: string): void => {
      rowErrors.push({ line, column, message });
    };

    const assetId = get(r, 'asset_id');
    if (assetId === '') err('asset_id', 'asset_id is empty.');
    else if (seen.has(assetId)) err('asset_id', `Duplicate asset_id "${assetId}" (first on line ${String(seen.get(assetId))}).`);
    else seen.set(assetId, line);

    const uprnRaw = get(r, 'uprn');
    const uprn = uprnRaw === '' ? null : /^\d{1,12}$/.test(uprnRaw) ? uprnRaw : undefined;
    if (uprn === undefined) err('uprn', `UPRN "${uprnRaw}" should be up to 12 digits.`);

    const pcRaw = get(r, 'postcode');
    const postcode = pcRaw === '' ? null : normalisePostcode(pcRaw);
    if (pcRaw !== '' && postcode === null) err('postcode', `"${pcRaw}" is not a valid UK postcode.`);
    if (uprnRaw === '' && pcRaw === '') err(null, 'Each row needs a UPRN or a postcode.');

    const useRaw = get(r, 'use');
    const use = parseUse(useRaw);
    if (use === null) err('use', `use must be "residential" or "commercial" (got "${useRaw}").`);

    const tenureRaw = get(r, 'tenure');
    const tenure = parseTenure(tenureRaw);
    if (tenure === null) err('tenure', `tenure must be "rented" or "owner_occupied" (got "${tenureRaw}").`);

    const area = parseAmount(get(r, 'floor_area_m2'));
    if (Number.isNaN(area)) err('floor_area_m2', `floor_area_m2 must be a positive number (got "${get(r, 'floor_area_m2')}").`);
    const value = parseAmount(get(r, 'value_gbp'));
    if (Number.isNaN(value)) err('value_gbp', `value_gbp must be a positive number (got "${get(r, 'value_gbp')}").`);

    if (rowErrors.length > 0 || use === null || tenure === null || uprn === undefined) {
      errors.push(...rowErrors);
      return;
    }
    rows.push({
      asset_id: assetId,
      uprn,
      postcode,
      use,
      tenure,
      floor_area_m2: area ?? null,
      value_gbp: value ?? null,
    });
  });

  return { rows, errors, warnings, totalRows: records.length };
}
