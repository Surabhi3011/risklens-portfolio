import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePortfolio, parseRules } from './loadData';

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')) as unknown;

describe('loadData parsers', () => {
  it('parses the published rules.json', () => {
    const rules = parseRules(read('../../public/config/rules.json'));
    expect(rules.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(rules.rules.length).toBeGreaterThan(0);
  });

  it('parses the published portfolio GeoJSON into 180 assets with positions', () => {
    const assets = parsePortfolio(read('../../public/data/portfolio_enriched.geojson'));
    expect(assets).toHaveLength(180);
    for (const a of assets) {
      expect(a.lon).toBeGreaterThan(-6);
      expect(a.lat).toBeGreaterThan(49);
    }
  });

  it('rejects a non-FeatureCollection', () => {
    expect(() => parsePortfolio({ type: 'Feature' })).toThrow();
  });
});
