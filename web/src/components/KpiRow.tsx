import { computeKpis } from '../lib/aggregate';
import { formatGbpCompact, formatInt, formatPct } from '../lib/format';
import type { Asset } from '../types';
import styles from './KpiRow.module.css';

interface KpiRowProps {
  assets: readonly Asset[];
}

interface Card {
  label: string;
  value: string;
  note: string;
}

export function KpiRow({ assets }: KpiRowProps) {
  const k = computeKpis(assets);
  const fallbackCost = k.upgradeCostFallback > 0 ? ` · ${formatInt(k.upgradeCostFallback)} at DESNZ average` : '';
  const unknownCost = k.upgradeCostUnknown > 0 ? ` · ${formatInt(k.upgradeCostUnknown)} cost unknown` : '';
  const unknownValue = k.valueUnknown > 0 ? ` · ${formatInt(k.valueUnknown)} not valued` : '';

  const cards: Card[] = [
    { label: 'Assets', value: formatInt(k.assets), note: `${formatInt(k.nonCompliant)} non-compliant now or by deadline` },
    { label: 'Below EPC C', value: formatPct(k.belowCPct), note: `${formatInt(k.belowC)} assets rated D–G` },
    { label: 'In Flood Zone 3', value: formatPct(k.zone3Pct), note: `${formatInt(k.zone3)} assets · rivers and sea` },
    {
      label: 'Upgrade budget',
      value: formatGbpCompact(k.upgradeBudget),
      note: `Indicative, from EPC recommendations${fallbackCost}${unknownCost}`,
    },
    {
      label: 'Value exposed',
      value: formatGbpCompact(k.valueExposed),
      note: `Non-compliant assets, HPI estimate${unknownValue}`,
    },
  ];

  return (
    <section className={styles.row} aria-label="Portfolio key figures">
      {cards.map((c) => (
        <div key={c.label} className={styles.card}>
          <p className={styles.label}>{c.label}</p>
          <p className={styles.value}>{c.value}</p>
          <p className={styles.note}>{c.note}</p>
        </div>
      ))}
    </section>
  );
}
