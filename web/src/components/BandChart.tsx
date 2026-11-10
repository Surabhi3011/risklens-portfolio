import ReactEChartsCore from 'echarts-for-react/esm/core';
import { useMemo } from 'react';
import { bandDistribution } from '../lib/aggregate';
import { CHART_TEXT, echarts } from '../lib/echarts';
import type { Asset } from '../types';
import styles from './Charts.module.css';

interface BandChartProps {
  assets: readonly Asset[];
}

// One accent for A-C, a muted dark tone for D-G (below the 2030 threshold), grey for no EPC.
const COLOUR_OK = '#1f5f8b';
const COLOUR_BELOW = '#7a4a3a';
const COLOUR_NONE = '#8a949c';

export function BandChart({ assets }: BandChartProps) {
  const rows = useMemo(() => bandDistribution(assets), [assets]);
  const below = rows.filter((r) => r.belowC).reduce((s, r) => s + r.count, 0);
  const summary = rows.map((r) => `${r.label}: ${String(r.count)}`).join(', ');

  const option = useMemo(
    () => ({
      animation: false,
      textStyle: CHART_TEXT,
      grid: { left: 36, right: 12, top: 16, bottom: 28 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dde2e6' } },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#eef1f3' } },
      },
      series: [
        {
          type: 'bar',
          name: 'Assets',
          barMaxWidth: 36,
          data: rows.map((r) => ({
            value: r.count,
            itemStyle: { color: r.band === 'none' ? COLOUR_NONE : r.belowC ? COLOUR_BELOW : COLOUR_OK },
          })),
          label: { show: true, position: 'top', color: '#1d2329', fontSize: 11 },
        },
      ],
    }),
    [rows],
  );

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>EPC band distribution</span>
        <span className={styles.sub}>
          {below} rated D–G <span className={styles.key} style={{ background: COLOUR_BELOW }} aria-hidden="true" /> ·
          A–C <span className={styles.key} style={{ background: COLOUR_OK }} aria-hidden="true" />
        </span>
      </figcaption>
      <div role="img" aria-label={`Bar chart of assets by EPC band. ${summary}.`}>
        <ReactEChartsCore echarts={echarts} option={option} notMerge style={{ height: 200, width: '100%' }} />
      </div>
    </figure>
  );
}
