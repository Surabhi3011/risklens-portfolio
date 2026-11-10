import ReactEChartsCore from 'echarts-for-react/esm/core';
import { useMemo } from 'react';
import { complianceTimeline } from '../lib/aggregate';
import { CHART_TEXT, echarts } from '../lib/echarts';
import type { Asset, Rules } from '../types';
import styles from './Charts.module.css';

interface ComplianceTimelineProps {
  assets: readonly Asset[];
  rules: Rules;
}

const COLOUR = '#1f5f8b';
const COLOUR_ANNOUNCED = '#9bb6c9';

export function ComplianceTimeline({ assets, rules }: ComplianceTimelineProps) {
  const milestones = useMemo(() => complianceTimeline(assets, rules), [assets, rules]);
  const axisLabels = milestones.map((m) => (m.announced ? `${m.label}\n(announced)` : m.label));
  const summary = milestones
    .map((m) => `${m.label}${m.announced ? ' (announced, subject to legislation)' : ''}: ${String(m.count)}`)
    .join(', ');

  const option = useMemo(
    () => ({
      animation: false,
      textStyle: CHART_TEXT,
      grid: { left: 36, right: 12, top: 16, bottom: 40 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: axisLabels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#dde2e6' } },
        axisLabel: { lineHeight: 14 },
      },
      yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#eef1f3' } } },
      series: [
        {
          type: 'bar',
          name: 'Non-compliant assets',
          barMaxWidth: 48,
          data: milestones.map((m) => ({
            value: m.count,
            // Announced rules use a lighter, hatched-style tone and an explicit axis label (never colour alone).
            itemStyle: m.announced
              ? { color: COLOUR_ANNOUNCED, borderColor: COLOUR, borderType: 'dashed', borderWidth: 1 }
              : { color: COLOUR },
          })),
          label: { show: true, position: 'top', color: '#1d2329', fontSize: 11 },
        },
      ],
    }),
    [milestones, axisLabels],
  );

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>Non-compliant assets over time</span>
        <span className={styles.sub}>Based on current EPCs · 2031 non-domestic B rule announced, subject to legislation</span>
      </figcaption>
      <div role="img" aria-label={`Bar chart of non-compliant assets by milestone. ${summary}.`}>
        <ReactEChartsCore echarts={echarts} option={option} notMerge style={{ height: 200, width: '100%' }} />
      </div>
    </figure>
  );
}
