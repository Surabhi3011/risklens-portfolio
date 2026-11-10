// Display formatting (en-GB).

const gbpCompact = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const gbpFull = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** £924.4K style; used for headline figures. */
export const formatGbpCompact = (n: number): string => gbpCompact.format(n);
export const formatGbp = (n: number): string => gbpFull.format(n);
export const formatInt = (n: number): string => int.format(n);
export const formatPct = (n: number): string => `${n.toFixed(0)}%`;
