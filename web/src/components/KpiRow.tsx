import { Building2, Gauge, type LucideIcon, PoundSterling, Waves, Wrench } from 'lucide-react';
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
  icon: LucideIcon;
}

export function KpiRow({ assets }: KpiRowProps) {
  const k = computeKpis(assets);
  const fallbackCost = k.upgradeCostFallback > 0 ? ` · ${formatInt(k.upgradeCostFallback)} at DESNZ average` : '';
  const unknownCost = k.upgradeCostUnknown > 0 ? ` · ${formatInt(k.upgradeCostUnknown)} cost unknown` : '';
  const unknownValue = k.valueUnknown > 0 ? ` · ${formatInt(k.valueUnknown)} not valued` : '';

  const cards: Card[] = [
    {
      label: 'Assets',
      value: formatInt(k.assets),
      note: `${formatInt(k.nonCompliant)} non-compliant now or by deadline`,
      icon: Building2,
    },
    { label: 'Below EPC C', value: formatPct(k.belowCPct), note: `${formatInt(k.belowC)} assets rated D–G`, icon: Gauge },
    {
      label: 'In Flood Zone 3',
      value: formatPct(k.zone3Pct),
      note: `${formatInt(k.zone3)} assets · rivers and sea`,
      icon: Waves,
    },
    {
      label: 'Upgrade budget',
      value: formatGbpCompact(k.upgradeBudget),
      note: `Indicative, from EPC recommendations${fallbackCost}${unknownCost}`,
      icon: Wrench,
    },
    {
      label: 'Value exposed',
      value: formatGbpCompact(k.valueExposed),
      note: `Non-compliant assets, HPI estimate${unknownValue}`,
      icon: PoundSterling,
    },
  ];

  return (
    <section className={styles.row} aria-label="Portfolio key figures">
      {cards.map(({ label, value, note, icon: Icon }) => (
        <div key={label} className={styles.card}>
          <div className={styles.top}>
            <p className={styles.label}>{label}</p>
            <span className={styles.icon} aria-hidden="true">
              <Icon size={18} strokeWidth={2} />
            </span>
          </div>
          <p className={styles.value}>{value}</p>
          <p className={styles.note}>{note}</p>
        </div>
      ))}
    </section>
  );
}
