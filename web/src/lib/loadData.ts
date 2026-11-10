import type { AssetFeatureCollection, PortfolioAsset, Rules } from '../types';

const base = import.meta.env.BASE_URL;
export const DATA_URLS = {
  rules: `${base}config/rules.json`,
  portfolio: `${base}data/portfolio_enriched.geojson`,
} as const;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${String(res.status)} ${res.statusText}`);
  return res.json() as Promise<unknown>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Light structural check: catches a wrong file or a broken ETL export early, without a schema library. */
export function parseRules(raw: unknown): Rules {
  if (!isRecord(raw) || typeof raw.as_of !== 'string' || !Array.isArray(raw.rules) || !isRecord(raw.weights)) {
    throw new Error('rules.json is missing as_of, rules or weights');
  }
  return raw as unknown as Rules;
}

export function parsePortfolio(raw: unknown): PortfolioAsset[] {
  if (!isRecord(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    throw new Error('portfolio GeoJSON is not a FeatureCollection');
  }
  const fc = raw as unknown as AssetFeatureCollection;
  return fc.features.map((f) => {
    if (typeof f.properties.asset_id !== 'string') throw new Error('feature without asset_id');
    const [lon, lat] = f.geometry.coordinates;
    return { ...f.properties, lon, lat };
  });
}

export async function loadAll(): Promise<{ rules: Rules; assets: PortfolioAsset[] }> {
  const [rules, portfolio] = await Promise.all([fetchJson(DATA_URLS.rules), fetchJson(DATA_URLS.portfolio)]);
  return { rules: parseRules(rules), assets: parsePortfolio(portfolio) };
}
