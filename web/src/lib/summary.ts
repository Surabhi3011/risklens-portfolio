// Template-generated portfolio summary (PLAN.md P3.4). Plain string templates over portfolio stats: no AI service.
import type { Asset, Rules } from '../types';
import { complianceTimeline, computeKpis } from './aggregate';
import { formatGbpCompact, formatInt } from './format';
import { ruleApplies } from './scoring';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pct = (n: number, d: number): string => `${d === 0 ? '0' : Math.round((100 * n) / d).toString()}%`;
const assets = (n: number): string => `${formatInt(n)} ${n === 1 ? 'asset' : 'assets'}`;
const isAre = (n: number): string => (n === 1 ? 'is' : 'are');

/** "October 2030" for confirmed deadlines; the year only for announced ones (the exact date is a placeholder). */
function milestoneText(date: string, announced: boolean): string {
  const [y, m] = date.split('-');
  return announced ? (y ?? date) : `${MONTHS[Number(m) - 1] ?? ''} ${y ?? ''}`.trim();
}

/** Build the summary as a list of sentences (render them as one paragraph). */
export function portfolioSummary(list: readonly Asset[], rules: Rules): string[] {
  const n = list.length;
  if (n === 0) return ['No assets match the current filters.'];

  const k = computeKpis(list);
  const residential = list.filter((a) => a.use === 'residential').length;
  const commercial = n - residential;
  const las = new Set(list.map((a) => a.la_name)).size;
  const failsNow = list.filter((a) => a.compliance.status === 'fails_current').length;
  const noEpc = list.filter((a) => a.compliance.status === 'no_epc' && a.tenure === 'rented').length;
  const highFlood = list.filter((a) => a.scores.flood === 100).length;
  const act = list.filter((a) => a.tier === 'act').length;
  const costed = list.filter((a) => a.compliance.status !== 'compliant' && a.upgrade_cost_mid_gbp !== null).length;

  const out: string[] = [];

  const mix =
    residential > 0 && commercial > 0
      ? ` (${formatInt(residential)} residential, ${formatInt(commercial)} commercial)`
      : residential > 0
        ? ' (all residential)'
        : ' (all commercial)';
  out.push(
    `This selection of ${assets(n)}${mix} across ${formatInt(las)} local ${las === 1 ? 'authority' : 'authorities'} was screened against current and upcoming EPC rules and Environment Agency flood data.`,
  );

  out.push(`${assets(k.belowC)} (${pct(k.belowC, n)}) ${isAre(k.belowC)} rated EPC D or below.`);

  if (failsNow + noEpc > 0) {
    const parts: string[] = [];
    if (failsNow > 0) parts.push(`${formatInt(failsNow)} ${failsNow === 1 ? 'fails' : 'fail'} the minimum standard in force today`);
    if (noEpc > 0) parts.push(`${formatInt(noEpc)} ${noEpc === 1 ? 'is' : 'are'} let without a valid EPC`);
    out.push(`${assets(failsNow + noEpc)} need action now: ${parts.join(' and ')}.`);
  } else {
    out.push('No assets fail the minimum EPC standard in force today.');
  }

  // Only mention deadlines whose rules apply to something in this selection (e.g. skip Oct 2030 for commercial-only).
  const relevant = (date: string): boolean =>
    rules.rules.some(
      (r) =>
        r.deadline === date &&
        list.some((a) => ruleApplies(r, { use: a.use, tenure: a.tenure, floor_area_m2: a.epc.floor_area_m2 })),
    );
  const scopeOf = (date: string): string => {
    const uses = new Set(rules.rules.filter((r) => r.deadline === date).map((r) => r.use));
    return uses.size === 1 && uses.has('commercial') ? 'non-domestic ' : uses.size === 1 ? 'domestic ' : '';
  };
  const future = complianceTimeline(list, rules).filter((m) => m.date !== null && relevant(m.date));
  if (future.length > 0) {
    const phrases = future.map((m, i) => {
      const when = milestoneText(m.date ?? '', m.announced);
      const tail = m.announced ? ` if the announced ${scopeOf(m.date ?? '')}requirement is legislated` : '';
      if (i === 0) return `${assets(m.count)} would be non-compliant by ${when}${tail}`;
      const prev = future[i - 1]?.count ?? 0;
      return `${m.count > prev ? 'rising to' : 'unchanged at'} ${formatInt(m.count)} by ${when}${tail}`;
    });
    out.push(`On current certificates, ${phrases.join(', ')}.`);
  }

  out.push(
    k.zone3 === 0 && highFlood === 0
      ? 'No assets are in Flood Zone 3 or at high flood risk from any source.'
      : `${assets(k.zone3)} (${pct(k.zone3, n)}) ${isAre(k.zone3)} in Flood Zone 3, and ${formatInt(highFlood)} ${highFlood === 1 ? 'has' : 'have'} a high flood risk from at least one source.`,
  );

  if (k.nonCompliant > 0) {
    const fallback =
      k.upgradeCostFallback > 0
        ? `, ${formatInt(k.upgradeCostFallback)} of them at the government average cost because the EPC gives none`
        : '';
    const unknown = k.upgradeCostUnknown > 0 ? `; ${formatInt(k.upgradeCostUnknown)} more have no cost estimate` : '';
    out.push(
      costed > 0
        ? `The indicative upgrade budget is ${formatGbpCompact(k.upgradeBudget)} across ${assets(costed)}${fallback}${unknown}.`
        : k.nonCompliant === 1
          ? 'The one non-compliant asset has no published cost estimate.'
          : `None of the ${formatInt(k.nonCompliant)} non-compliant assets has a published cost estimate.`,
    );
  }

  out.push(act > 0 ? `${assets(act)} ${isAre(act)} in the Act now tier.` : 'No assets are in the Act now tier.');
  return out;
}
