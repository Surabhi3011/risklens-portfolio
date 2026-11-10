import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildSummaryPdf } from './exportPdf';
import { parsePortfolio, parseRules } from './loadData';

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')) as unknown;

// 1x1 white PNG stands in for the ECharts image (no canvas in Node).
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

describe('buildSummaryPdf', () => {
  it('produces exactly one A4 page for the demo portfolio', () => {
    const doc = buildSummaryPdf({
      assets: parsePortfolio(read('../../public/data/portfolio_enriched.geojson')),
      rules: parseRules(read('../../public/config/rules.json')),
      sourceLabel: 'Demo portfolio',
      filterLabel: 'All assets',
      generated: new Date(2026, 10, 10),
      chartPng: PNG,
    });
    expect(doc.getNumberOfPages()).toBe(1);
    const out = process.env.PDF_OUT;
    if (out) writeFileSync(out, Buffer.from(doc.output('arraybuffer')));
  });
});
