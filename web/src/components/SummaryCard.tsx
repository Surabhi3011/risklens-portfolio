import { FileText } from 'lucide-react';
import { portfolioSummary } from '../lib/summary';
import type { Asset, Rules } from '../types';
import styles from './SummaryCard.module.css';

interface SummaryCardProps {
  assets: readonly Asset[];
  rules: Rules;
}

export function SummaryCard({ assets, rules }: SummaryCardProps) {
  const sentences = portfolioSummary(assets, rules);
  return (
    <section className={styles.card} aria-labelledby="summary-title">
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          <FileText size={16} strokeWidth={2} />
        </span>
        <h2 id="summary-title" className={styles.title}>
          Portfolio summary
        </h2>
      </div>
      <p className={styles.text}>{sentences.join(' ')}</p>
      <p className={styles.note}>Generated from the figures on this page. Indicative screening only.</p>
    </section>
  );
}
