import type { Asset, Rules } from '../types';
import { BandChart } from './BandChart';
import styles from './Charts.module.css';
import { ComplianceTimeline } from './ComplianceTimeline';

interface ChartsPanelProps {
  assets: readonly Asset[];
  rules: Rules;
}

export function ChartsPanel({ assets, rules }: ChartsPanelProps) {
  return (
    <div className={styles.panel}>
      <BandChart assets={assets} />
      <ComplianceTimeline assets={assets} rules={rules} />
    </div>
  );
}
