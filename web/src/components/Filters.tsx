import { useMemo } from 'react';
import { BANDS } from '../lib/aggregate';
import { type Filters as FilterState, isFiltered } from '../lib/filters';
import { TIER_LABEL, TIER_ORDER } from '../lib/tiers';
import type { Asset } from '../types';
import styles from './Filters.module.css';

interface FiltersProps {
  assets: readonly Asset[];
  filters: FilterState;
  shown: number;
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onReset: () => void;
}

export function Filters({ assets, filters, shown, onChange, onReset }: FiltersProps) {
  const las = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assets) m.set(a.la_code, a.la_name);
    return [...m.entries()].sort((x, y) => x[1].localeCompare(y[1]));
  }, [assets]);

  return (
    <section className={styles.bar} aria-label="Filters">
      <label className={styles.field}>
        <span>Local authority</span>
        <select
          value={filters.la}
          onChange={(e) => {
            onChange('la', e.target.value);
          }}
        >
          <option value="all">All</option>
          {las.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Use</span>
        <select
          value={filters.use}
          onChange={(e) => {
            onChange('use', e.target.value as FilterState['use']);
          }}
        >
          <option value="all">All</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>EPC band</span>
        <select
          value={filters.band}
          onChange={(e) => {
            onChange('band', e.target.value as FilterState['band']);
          }}
        >
          <option value="all">All</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
          <option value="none">No EPC</option>
        </select>
      </label>
      <label className={styles.field}>
        <span>Risk tier</span>
        <select
          value={filters.tier}
          onChange={(e) => {
            onChange('tier', e.target.value as FilterState['tier']);
          }}
        >
          <option value="all">All</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.status}>
        <span aria-live="polite">
          Showing <strong>{shown}</strong> of {assets.length} assets
        </span>
        {isFiltered(filters) && (
          <button type="button" className={styles.reset} onClick={onReset}>
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
