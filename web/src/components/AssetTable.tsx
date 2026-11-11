import { useEffect, useRef, useState } from 'react';
import { type SortDir, type SortKey, sortAssets } from '../lib/filters';
import { formatGbpCompact } from '../lib/format';
import { deadlineText, FLOOD_SCORE_LABEL, STATUS_LABEL, ZONE_LABEL } from '../lib/labels';
import { TIER_COLOUR, TIER_LABEL } from '../lib/tiers';
import type { PortfolioAsset, Rules } from '../types';
import styles from './AssetTable.module.css';

interface AssetTableProps {
  assets: readonly PortfolioAsset[];
  rules: Rules;
  sort: { key: SortKey; dir: SortDir };
  selectedId: string | null;
  onSort: (key: SortKey) => void;
  onSelect: (assetId: string) => void;
}

interface Column {
  key: SortKey;
  label: string;
  /** Hidden on narrow screens to stay readable at 375 px. */
  wide?: boolean;
  /** Also hidden on mid-width screens (tablet). */
  mid?: boolean;
  numeric?: boolean;
}

const COLUMNS: readonly Column[] = [
  { key: 'asset_id', label: 'Asset' },
  { key: 'la_name', label: 'Local authority', wide: true },
  { key: 'use', label: 'Use', wide: true, mid: true },
  { key: 'band', label: 'EPC' },
  { key: 'status', label: 'Compliance' },
  { key: 'flood', label: 'Flood', wide: true },
  { key: 'tier', label: 'Tier' },
  { key: 'cost', label: 'Upgrade (indicative)', wide: true, numeric: true },
  { key: 'value', label: 'Value', wide: true, numeric: true },
];

/** Rows rendered at first; the rest on request. Keeps the first render light on phones. */
const INITIAL_ROWS = 60;

const ariaSort = (col: SortKey, sort: AssetTableProps['sort']): 'ascending' | 'descending' | 'none' =>
  sort.key !== col ? 'none' : sort.dir === 'asc' ? 'ascending' : 'descending';

export function AssetTable({ assets, rules, sort, selectedId, onSort, onSelect }: AssetTableProps) {
  const sorted = sortAssets(assets, sort.key, sort.dir);
  const [showAll, setShowAll] = useState(false);
  // Expand automatically when the selected asset (e.g. clicked on the map) is beyond the first rows.
  const selectedIndex = selectedId ? sorted.findIndex((a) => a.asset_id === selectedId) : -1;
  const expanded = showAll || selectedIndex >= INITIAL_ROWS;
  const rows = expanded ? sorted : sorted.slice(0, INITIAL_ROWS);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Bring the selected row into view when selection comes from the map. Scroll the table container vertically
  // only: scrollIntoView would also scroll it sideways (hiding the Asset column) and move the whole page.
  useEffect(() => {
    const c = scrollRef.current;
    const row = selectedId ? rowRefs.current.get(selectedId) : undefined;
    if (!c || !row) return;
    const headH = c.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const top = row.offsetTop - headH;
    const bottom = row.offsetTop + row.offsetHeight;
    if (top < c.scrollTop) c.scrollTop = top;
    else if (bottom > c.scrollTop + c.clientHeight) c.scrollTop = bottom - c.clientHeight;
  }, [selectedId]);

  const onRowKey = (e: React.KeyboardEvent<HTMLTableRowElement>, id: string): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const sib = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling;
      if (sib instanceof HTMLElement) sib.focus();
    }
  };

  return (
    <div className={styles.scroll} ref={scrollRef}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Portfolio assets. Select a row with Enter or Space to see details; use the arrow keys to move between rows.
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={ariaSort(c.key, sort)}
                className={`${c.wide ? styles.wide : ''} ${c.mid ? styles.mid : ''} ${c.numeric ? styles.num : ''}`}
              >
                <button
                  type="button"
                  className={styles.sortBtn}
                  onClick={() => {
                    onSort(c.key);
                  }}
                >
                  {c.label}
                  <span className={styles.arrow} aria-hidden="true">
                    {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const selected = a.asset_id === selectedId;
            return (
              <tr
                key={a.asset_id}
                ref={(el) => {
                  if (el) rowRefs.current.set(a.asset_id, el);
                  else rowRefs.current.delete(a.asset_id);
                }}
                tabIndex={0}
                aria-selected={selected}
                className={selected ? styles.selected : undefined}
                onClick={() => {
                  onSelect(a.asset_id);
                }}
                onKeyDown={(e) => {
                  onRowKey(e, a.asset_id);
                }}
              >
                <th scope="row" className={styles.id}>
                  {a.asset_id}
                </th>
                <td className={styles.wide}>{a.la_name}</td>
                <td className={`${styles.wide} ${styles.mid}`}>
                  {a.use === 'residential' ? 'Residential' : 'Commercial'}
                </td>
                <td>{a.epc.band_current ?? <span className={styles.muted}>None</span>}</td>
                <td>
                  <span>{STATUS_LABEL[a.compliance.status]}</span>
                  <span className={styles.sub}>{deadlineText(a, rules)}</span>
                </td>
                <td className={styles.wide}>
                  {FLOOD_SCORE_LABEL[a.scores.flood]}
                  {a.flood.zone !== 'none' && <span className={styles.sub}>{ZONE_LABEL[a.flood.zone]}</span>}
                </td>
                <td>
                  <span className={`${styles.tier} ${styles[`tier_${a.tier}`] ?? ''}`}>
                    <span className={styles.dot} style={{ background: TIER_COLOUR[a.tier] }} aria-hidden="true" />
                    {TIER_LABEL[a.tier]}
                  </span>
                  <span className={styles.sub}>Score {a.scores.total}</span>
                </td>
                <td className={`${styles.wide} ${styles.num}`}>
                  {a.upgrade_cost_mid_gbp === null ? (
                    <span className={styles.muted}>Cost unknown</span>
                  ) : (
                    <>
                      {formatGbpCompact(a.upgrade_cost_mid_gbp)}
                      {a.upgrade_cost_source === 'fallback' && <span className={styles.sub}>DESNZ avg</span>}
                    </>
                  )}
                </td>
                <td className={`${styles.wide} ${styles.num}`}>
                  {a.value_gbp === null ? <span className={styles.muted}>—</span> : formatGbpCompact(a.value_gbp)}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className={styles.empty}>
                No assets match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!expanded && sorted.length > INITIAL_ROWS && (
        <div className={styles.more}>
          <button
            type="button"
            className={styles.moreBtn}
            onClick={() => {
              setShowAll(true);
            }}
          >
            Show all {sorted.length} assets
          </button>
          <span className={styles.muted}>Showing the first {INITIAL_ROWS}, in the current sort order</span>
        </div>
      )}
    </div>
  );
}
