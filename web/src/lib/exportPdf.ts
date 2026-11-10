// One-page A4 PDF summary (PLAN.md P3.3): KPIs, band chart image, top 10 act-now assets, disclaimer and attribution.
// Lazy-loaded with jsPDF only when the user exports.
import { jsPDF } from 'jspdf';
import { brand } from '../config/brand';
import { ATTRIBUTION, DISCLAIMER } from '../config/legal';
import type { Asset, Rules } from '../types';
import { bandDistribution, complianceTimeline, computeKpis } from './aggregate';
import { bandChartOption } from './chartOptions';
import { echarts } from './echarts';
import { formatGbp, formatGbpCompact, formatInt, formatPct } from './format';
import { deadlineText, FLOOD_SCORE_LABEL, STATUS_LABEL } from './labels';
import { TIER_LABEL } from './tiers';

export interface PdfContext {
  assets: readonly Asset[];
  rules: Rules;
  /** e.g. "Demo portfolio" or "Uploaded: my_file.csv" */
  sourceLabel: string;
  /** e.g. "All assets" or "Local authority: York · Risk tier: Act now" */
  filterLabel: string;
  generated?: Date;
  /** Pre-rendered band chart PNG (data URL). Rendered off screen with ECharts when omitted. */
  chartPng?: string;
}

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14; // margin, mm
const CONTENT_W = PAGE_W - 2 * M;
const ACCENT: [number, number, number] = [31, 95, 139];
const TEXT: [number, number, number] = [29, 35, 41];
const MUTED: [number, number, number] = [91, 102, 112];
const LINE: [number, number, number] = [221, 226, 230];

/** Render the band chart off screen to a PNG data URL. */
function bandChartPng(assets: readonly Asset[]): string {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:640px;height:300px;';
  document.body.appendChild(el);
  const chart = echarts.init(el, undefined, { renderer: 'canvas', width: 640, height: 300 });
  try {
    chart.setOption(bandChartOption(bandDistribution(assets), { tooltip: false }));
    return chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
  } finally {
    chart.dispose();
    el.remove();
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildSummaryPdf(ctx: PdfContext): jsPDF {
  const { assets, rules } = ctx;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: `${brand.name} - portfolio screening summary`, creator: brand.name });
  const k = computeKpis(assets);
  let y = M;

  // Header
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE_W, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...ACCENT);
  doc.text(brand.name, M, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text('Portfolio screening summary: EPC compliance and flood risk', M, y + 10);
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const meta = `Generated ${formatDate(ctx.generated ?? new Date())} · Rules as of ${rules.as_of} · ${ctx.sourceLabel} · ${ctx.filterLabel}`;
  doc.text(doc.splitTextToSize(meta, CONTENT_W) as string[], M, y + 15);
  y += 22;

  // KPI boxes
  const cards: [string, string, string][] = [
    ['ASSETS', formatInt(k.assets), `${formatInt(k.nonCompliant)} non-compliant now or by deadline`],
    ['BELOW EPC C', formatPct(k.belowCPct), `${formatInt(k.belowC)} assets rated D to G`],
    ['IN FLOOD ZONE 3', formatPct(k.zone3Pct), `${formatInt(k.zone3)} assets, rivers and sea`],
    [
      'UPGRADE BUDGET',
      formatGbpCompact(k.upgradeBudget),
      `Indicative${k.upgradeCostUnknown > 0 ? `; ${formatInt(k.upgradeCostUnknown)} cost unknown` : ''}`,
    ],
    [
      'VALUE EXPOSED',
      formatGbpCompact(k.valueExposed),
      `Non-compliant, HPI estimate${k.valueUnknown > 0 ? `; ${formatInt(k.valueUnknown)} not valued` : ''}`,
    ],
  ];
  const gap = 3;
  const cw = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const ch = 24;
  cards.forEach(([label, value, note], i) => {
    const x = M + i * (cw + gap);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, cw, ch, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(label, x + 2.5, y + 5);
    doc.setFontSize(14);
    doc.setTextColor(...TEXT);
    doc.text(value, x + 2.5, y + 12.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(note, cw - 5) as string[], x + 2.5, y + 17);
  });
  y += ch + 8;

  // Band chart image + compliance timeline
  const sectionTitle = (title: string, x: number, yy: number): void => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(title, x, yy);
  };
  const chartW = 110;
  const chartH = chartW * (300 / 640);
  sectionTitle('EPC band distribution', M, y);
  doc.addImage(ctx.chartPng ?? bandChartPng(assets), 'PNG', M, y + 2, chartW, chartH, undefined, 'FAST');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('Dark bars: rated D to G (below the 2030 domestic threshold). Blue bars: A to C.', M, y + chartH + 5);

  const tx = M + chartW + 8;
  sectionTitle('Non-compliant assets over time', tx, y);
  let ty = y + 7;
  doc.setFontSize(8.5);
  for (const m of complianceTimeline(assets, rules)) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT);
    doc.text(m.label, tx, ty);
    doc.setFont('helvetica', 'bold');
    doc.text(formatInt(m.count), tx + 50, ty, { align: 'right' });
    if (m.announced) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text('Announced, subject to legislation', tx, ty + 3.5);
      doc.setFontSize(8.5);
      ty += 3.5;
    }
    ty += 6;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize('Based on current EPCs. Counts include assets that already fail.', CONTENT_W - chartW - 8) as string[], tx, ty + 1);
  y += chartH + 12;

  // Top 10 act-now assets
  const act = assets
    .filter((a) => a.tier === 'act')
    .sort((a, b) => b.scores.total - a.scores.total || a.asset_id.localeCompare(b.asset_id))
    .slice(0, 10);
  sectionTitle(`Top ${String(act.length || 10)} assets to act on now`, M, y);
  y += 3;
  const cols: { label: string; w: number; right?: boolean; get: (a: Asset) => string }[] = [
    { label: 'Asset', w: 18, get: (a) => a.asset_id },
    { label: 'Local authority', w: 32, get: (a) => a.la_name },
    { label: 'Use', w: 18, get: (a) => (a.use === 'residential' ? 'Residential' : 'Commercial') },
    { label: 'EPC', w: 9, get: (a) => a.epc.band_current ?? '-' },
    { label: 'Compliance', w: 34, get: (a) => `${STATUS_LABEL[a.compliance.status]}, ${deadlineText(a, rules)}` },
    { label: 'Flood', w: 14, get: (a) => FLOOD_SCORE_LABEL[a.scores.flood] },
    { label: 'Score', w: 13, right: true, get: (a) => String(a.scores.total) },
    {
      label: 'Upgrade (indicative)',
      w: CONTENT_W - 138,
      right: true,
      get: (a) => (a.upgrade_cost_mid_gbp === null ? 'Cost unknown' : formatGbp(a.upgrade_cost_mid_gbp)),
    },
  ];
  const rowH = 6.2;
  doc.setFillColor(246, 247, 248);
  doc.rect(M, y, CONTENT_W, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  let cx = M;
  for (const c of cols) {
    doc.text(c.label, c.right ? cx + c.w - 1.5 : cx + 1.5, y + 4.2, c.right ? { align: 'right' } : undefined);
    cx += c.w;
  }
  y += rowH;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  if (act.length === 0) {
    doc.text('No assets are in the Act now tier for this selection.', M + 1.5, y + 4.2);
    y += rowH;
  }
  const cellLineH = 3.4;
  for (const a of act) {
    // Wrap each cell and size the row to its tallest cell, so nothing is cut off.
    const cells = cols.map((c) => doc.splitTextToSize(c.get(a), c.w - 3) as string[]);
    const h = Math.max(rowH, Math.max(...cells.map((l) => l.length)) * cellLineH + 2.8);
    cx = M;
    cols.forEach((c, i) => {
      doc.text(cells[i] ?? [], c.right ? cx + c.w - 1.5 : cx + 1.5, y + 4.2, {
        ...(c.right ? { align: 'right' as const } : {}),
        lineHeightFactor: cellLineH / (8 * 0.3528),
      });
      cx += c.w;
    });
    doc.setDrawColor(...LINE);
    doc.line(M, y + h, M + CONTENT_W, y + h);
    y += h;
  }
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text(
    `Tier "${TIER_LABEL.act}" = weighted score of ${String(rules.tiers.act)} or more (compliance, flood and data quality).`,
    M,
    y + 4,
  );

  // Footer: disclaimer and attribution, anchored to the bottom of the page.
  // Measure each block in the font it is drawn in (bold is wider than regular).
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const disc = doc.splitTextToSize(DISCLAIMER, CONTENT_W) as string[];
  doc.setFont('helvetica', 'normal');
  const attr = doc.splitTextToSize(ATTRIBUTION, CONTENT_W) as string[];
  const lineH = 3.2;
  let fy = PAGE_H - M - (disc.length + attr.length) * lineH - 3;
  doc.setDrawColor(...LINE);
  doc.line(M, fy - 3, M + CONTENT_W, fy - 3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT);
  doc.text(disc, M, fy);
  fy += disc.length * lineH + 2;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text(attr, M, fy);

  return doc;
}
