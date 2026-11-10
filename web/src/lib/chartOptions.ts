// ECharts option builders shared by the on-screen charts and the PDF export.
import type { BandCount } from './aggregate';

// One accent for A-C, a muted dark tone for D-G (below the 2030 threshold), grey for no EPC.
export const BAND_COLOUR_OK = '#1f5f8b';
export const BAND_COLOUR_BELOW = '#7a4a3a';
export const BAND_COLOUR_NONE = '#8a949c';

export const CHART_TEXT = {
  color: '#5b6670',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: 12,
} as const;

export function bandChartOption(rows: readonly BandCount[], opts: { tooltip?: boolean } = {}) {
  return {
    animation: false,
    textStyle: CHART_TEXT,
    grid: { left: 36, right: 12, top: 16, bottom: 28 },
    ...(opts.tooltip === false ? {} : { tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } } }),
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#dde2e6' } },
    },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#eef1f3' } } },
    series: [
      {
        type: 'bar',
        name: 'Assets',
        barMaxWidth: 36,
        data: rows.map((r) => ({
          value: r.count,
          itemStyle: { color: r.band === 'none' ? BAND_COLOUR_NONE : r.belowC ? BAND_COLOUR_BELOW : BAND_COLOUR_OK },
        })),
        label: { show: true, position: 'top', color: '#1d2329', fontSize: 11 },
      },
    ],
  };
}
