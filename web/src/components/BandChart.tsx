import ReactEChartsCore from 'echarts-for-react/esm/core';
import { useMemo } from 'react';
import { bandDistribution } from '../lib/aggregate';
import { BAND_COLOUR_BELOW, BAND_COLOUR_OK, bandChartOption } from '../lib/chartOptions';
import { echarts } from '../lib/echarts';
import type { Asset } from '../types';
import styles from './Charts.module.css';

interface BandChartProps {
  assets: readonly Asset[];
}

export function BandChart({ assets }: BandChartProps) {
  const rows = useMemo(() => bandDistribution(assets), [assets]);
  const below = rows.filter((r) => r.belowC).reduce((s, r) => s + r.count, 0);
  const summary = rows.map((r) => `${r.label}: ${String(r.count)}`).join(', ');

  const option = useMemo(() => bandChartOption(rows), [rows]);

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>EPC band distribution</span>
        <span className={styles.sub}>
          {below} rated D–G <span className={styles.key} style={{ background: BAND_COLOUR_BELOW }} aria-hidden="true" /> ·
          A–C <span className={styles.key} style={{ background: BAND_COLOUR_OK }} aria-hidden="true" />
        </span>
      </figcaption>
      <div role="img" aria-label={`Bar chart of assets by EPC band. ${summary}.`}>
        <ReactEChartsCore echarts={echarts} option={option} notMerge style={{ height: 200, width: '100%' }} />
      </div>
    </figure>
  );
}
