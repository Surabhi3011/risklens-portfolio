// Portfolio filters, applied to the map, charts, KPIs and table together. 'all' means no filter on that field.
import type { Asset, Band, Tier, Use } from '../types';

export interface Filters {
  /** LA code, or 'all'. */
  la: string;
  use: Use | 'all';
  band: Band | 'none' | 'all';
  tier: Tier | 'all';
}

export const NO_FILTERS: Filters = { la: 'all', use: 'all', band: 'all', tier: 'all' };

export function isFiltered(f: Filters): boolean {
  return f.la !== 'all' || f.use !== 'all' || f.band !== 'all' || f.tier !== 'all';
}

export function filterAssets<T extends Asset>(assets: readonly T[], f: Filters): T[] {
  return assets.filter(
    (a) =>
      (f.la === 'all' || a.la_code === f.la) &&
      (f.use === 'all' || a.use === f.use) &&
      (f.band === 'all' || (a.epc.band_current ?? 'none') === f.band) &&
      (f.tier === 'all' || a.tier === f.tier),
  );
}

export type SortKey = 'asset_id' | 'la_name' | 'use' | 'band' | 'status' | 'flood' | 'tier' | 'cost' | 'value';
export type SortDir = 'asc' | 'desc';

const TIER_RANK: Record<Tier, number> = { act: 0, watch: 1, low: 2 };
const STATUS_RANK: Record<Asset['compliance']['status'], number> = {
  fails_current: 0,
  no_epc: 1,
  fails_future: 2,
  compliant: 3,
};

/** Sort value for a column. Nulls sort last in both directions. */
function sortValue(a: Asset, key: SortKey): string | number | null {
  switch (key) {
    case 'asset_id':
      return a.asset_id;
    case 'la_name':
      return a.la_name;
    case 'use':
      return a.use;
    case 'band':
      return a.epc.band_current;
    case 'status':
      return STATUS_RANK[a.compliance.status];
    case 'flood':
      return -a.scores.flood;
    case 'tier':
      return TIER_RANK[a.tier] * 1000 - a.scores.total;
    case 'cost':
      return a.upgrade_cost_mid_gbp;
    case 'value':
      return a.value_gbp;
  }
}

export function sortAssets<T extends Asset>(assets: readonly T[], key: SortKey, dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...assets].sort((x, y) => {
    const a = sortValue(x, key);
    const b = sortValue(y, key);
    if (a === null && b === null) return x.asset_id.localeCompare(y.asset_id);
    if (a === null) return 1;
    if (b === null) return -1;
    const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
    return c !== 0 ? sign * c : x.asset_id.localeCompare(y.asset_id);
  });
}
