import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePortfolio, parseRules } from './loadData';
import { portfolioSummary } from './summary';

const read = (rel: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')) as unknown;
const assets = parsePortfolio(read('../../public/data/portfolio_enriched.geojson'));
const rules = parseRules(read('../../public/config/rules.json'));

describe('portfolioSummary', () => {
  it('describes the demo portfolio with figures matching the KPIs', () => {
    expect(portfolioSummary(assets, rules)).toEqual([
      'This selection of 180 assets (150 residential, 30 commercial) across 4 local authorities was screened against current and upcoming EPC rules and Environment Agency flood data.',
      '72 assets (40%) are rated EPC D or below.',
      '14 assets need action now: 1 fails the minimum standard in force today and 13 are let without a valid EPC.',
      'On current certificates, 70 assets would be non-compliant by October 2030, rising to 72 by 2031 if the announced non-domestic requirement is legislated.',
      '42 assets (23%) are in Flood Zone 3, and 48 have a high flood risk from at least one source.',
      'The indicative upgrade budget is £973k across 65 assets, 9 of them at the government average cost because the EPC gives none; 7 more have no cost estimate.',
      '28 assets are in the Act now tier.',
    ]);
  });

  it('adapts to a small commercial-only selection', () => {
    const sel = assets.filter((a) => a.la_name === 'Great Yarmouth' && a.use === 'commercial');
    expect(portfolioSummary(sel, rules)).toEqual([
      'This selection of 5 assets (all commercial) across 1 local authority was screened against current and upcoming EPC rules and Environment Agency flood data.',
      '2 assets (40%) are rated EPC D or below.',
      'No assets fail the minimum EPC standard in force today.',
      'On current certificates, 1 asset would be non-compliant by 2031 if the announced non-domestic requirement is legislated.',
      'No assets are in Flood Zone 3 or at high flood risk from any source.',
      'The one non-compliant asset has no published cost estimate.',
      'No assets are in the Act now tier.',
    ]);
  });

  it('says "unchanged" when a later milestone adds no assets', () => {
    const york = portfolioSummary(assets.filter((a) => a.la_name === 'York'), rules);
    expect(york[3]).toBe(
      'On current certificates, 21 assets would be non-compliant by October 2030, unchanged at 21 by 2031 if the announced non-domestic requirement is legislated.',
    );
  });

  it('handles an empty selection', () => {
    expect(portfolioSummary([], rules)).toEqual(['No assets match the current filters.']);
  });
});
