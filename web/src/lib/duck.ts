// DuckDB-Wasm: join an uploaded portfolio against the static Parquet lookups, entirely in the browser.
// This module is lazy-loaded (import('./lib/duck')) when the upload dialog opens, so DuckDB never weighs on first load.
import {
  AsyncDuckDB,
  type AsyncDuckDBConnection,
  DuckDBDataProtocol,
  type DuckDBBundles,
  selectBundle,
  VoidLogger,
} from '@duckdb/duckdb-wasm';
// Self-host the wasm and worker files (no CDN): Vite emits them as hashed assets alongside the site.
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import type { PortfolioAsset, Rules } from '../types';
import { enrichRow, type EnrichSummary, type HpiLookup, type JoinedRow, summarise } from './enrich';
import type { PortfolioRow } from './validateUpload';

const BUNDLES: DuckDBBundles = {
  mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
};

const PARQUET_FILES = ['uprn_epc.parquet', 'uprn_flood.parquet', 'postcode_lookup.parquet', 'hpi.parquet'] as const;

let dbPromise: Promise<AsyncDuckDB> | null = null;

async function init(): Promise<AsyncDuckDB> {
  const bundle = await selectBundle(BUNDLES);
  const worker = new Worker(bundle.mainWorker ?? mvpWorker);
  const db = new AsyncDuckDB(new VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const base = new URL(`${import.meta.env.BASE_URL}data/`, window.location.href);
  for (const f of PARQUET_FILES) {
    // HTTP protocol: DuckDB uses range requests where the host supports them, else fetches the whole file.
    await db.registerFileURL(f, new URL(f, base).href, DuckDBDataProtocol.HTTP, false);
  }
  return db;
}

/** Start loading DuckDB in the background (called when the upload dialog opens). */
export function warmUp(): Promise<AsyncDuckDB> {
  dbPromise ??= init().catch((err: unknown) => {
    dbPromise = null; // allow a retry
    throw err;
  });
  return dbPromise;
}

const toNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : typeof v === 'bigint' ? Number(v) : typeof v === 'number' ? v : Number(v);
const toStr = (v: unknown): string | null =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'bigint' ? String(v) : null;

const JOIN_SQL = `
SELECT u.idx,
  e.band_current AS epc_band_current, e.band_potential AS epc_band_potential, e.score_current AS epc_score_current,
  e.floor_area_m2 AS epc_floor_area_m2, e.lodgement_date AS epc_lodgement_date, e.property_type AS epc_property_type,
  e.top3_recs AS epc_top3_recs, e.rec_costs_mid AS epc_rec_costs_mid, e.postcode AS epc_postcode,
  f.lat AS f_lat, f.lon AS f_lon, f.la_code AS f_la_code, f.rofrs AS f_rofrs, f.zone AS f_zone, f.rofsw AS f_rofsw,
  p.lat AS p_lat, p.lon AS p_lon, p.la_code AS p_la_code, p.rofrs AS p_rofrs, p.zone AS p_zone, p.rofsw AS p_rofsw,
  p.median_band_residential AS p_median_band_residential, p.median_lodgement_residential AS p_median_lodgement_residential,
  p.median_band_commercial AS p_median_band_commercial, p.median_lodgement_commercial AS p_median_lodgement_commercial
FROM upload u
LEFT JOIN read_parquet('uprn_epc.parquet') e ON e.uprn = u.uprn AND e.use = u.use
LEFT JOIN read_parquet('uprn_flood.parquet') f ON f.uprn = u.uprn
LEFT JOIN read_parquet('postcode_lookup.parquet') p ON p.postcode = u.postcode
ORDER BY u.idx`;

async function rows(conn: AsyncDuckDBConnection, sql: string): Promise<Record<string, unknown>[]> {
  const table = await conn.query(sql);
  return table.toArray().map((r: { toJSON: () => Record<string, unknown> }) => r.toJSON());
}

export interface EnrichResult {
  assets: PortfolioAsset[];
  summary: EnrichSummary;
  ms: number;
}

export async function enrichUpload(
  input: readonly PortfolioRow[],
  rules: Rules,
  laNames: ReadonlyMap<string, string>,
): Promise<EnrichResult> {
  const t0 = performance.now();
  const db = await warmUp();
  const conn = await db.connect();
  try {
    const keys = input.map((r, idx) => ({ idx, uprn: r.uprn, postcode: r.postcode, use: r.use }));
    await db.registerFileText('upload.json', JSON.stringify(keys));
    await conn.query(`CREATE OR REPLACE TABLE upload AS
      SELECT * FROM read_json('upload.json', format = 'array',
        columns = {idx: 'INTEGER', uprn: 'VARCHAR', postcode: 'VARCHAR', use: 'VARCHAR'})`);

    const hpi: HpiLookup = new Map(
      (await rows(conn, `SELECT la_code, property_type, avg_price FROM read_parquet('hpi.parquet')`)).map((r) => [
        `${toStr(r.la_code) ?? ''}|${toStr(r.property_type) ?? ''}`,
        toNum(r.avg_price) ?? 0,
      ]),
    );

    const joined = await rows(conn, JOIN_SQL);
    const outcomes = joined.map((r) => {
      const j: JoinedRow = {
        epc_band_current: toStr(r.epc_band_current),
        epc_band_potential: toStr(r.epc_band_potential),
        epc_score_current: toNum(r.epc_score_current),
        epc_floor_area_m2: toNum(r.epc_floor_area_m2),
        epc_lodgement_date: toStr(r.epc_lodgement_date),
        epc_property_type: toStr(r.epc_property_type),
        epc_top3_recs: toStr(r.epc_top3_recs),
        epc_rec_costs_mid: toStr(r.epc_rec_costs_mid),
        epc_postcode: toStr(r.epc_postcode),
        f_lat: toNum(r.f_lat),
        f_lon: toNum(r.f_lon),
        f_la_code: toStr(r.f_la_code),
        f_rofrs: toStr(r.f_rofrs),
        f_zone: toStr(r.f_zone),
        f_rofsw: toStr(r.f_rofsw),
        p_lat: toNum(r.p_lat),
        p_lon: toNum(r.p_lon),
        p_la_code: toStr(r.p_la_code),
        p_rofrs: toStr(r.p_rofrs),
        p_zone: toStr(r.p_zone),
        p_rofsw: toStr(r.p_rofsw),
        p_median_band_residential: toStr(r.p_median_band_residential),
        p_median_lodgement_residential: toStr(r.p_median_lodgement_residential),
        p_median_band_commercial: toStr(r.p_median_band_commercial),
        p_median_lodgement_commercial: toStr(r.p_median_lodgement_commercial),
      };
      const row = input[toNum(r.idx) ?? -1];
      if (!row) throw new Error('join returned an unknown row index');
      return enrichRow(row, j, { rules, hpi, laNames });
    });

    const assets = outcomes.flatMap((o) => (o.covered ? [o.asset] : []));
    return { assets, summary: summarise(outcomes), ms: Math.round(performance.now() - t0) };
  } finally {
    await conn.close();
  }
}
