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
      <h2 id="summary-title" className={styles.title}>
        Summary
      </h2>
      <p className={styles.text}>{sentences.join(' ')}</p>
      <p className={styles.note}>Generated from the figures on this page. Indicative screening only.</p>
    </section>
  );
}
