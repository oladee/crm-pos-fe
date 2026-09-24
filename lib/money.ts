/** Money helpers - integers (kobo) internally, formatted only at the edge. */

export const NAIRA = '\u20A6';

export const toKobo = (naira: number) => Math.round(naira * 100);
export const toNaira = (kobo: number) => kobo / 100;

/** N12,500.00 (naira sign via unicode escape so source encoding cannot rot). */
export const fmt = (kobo: number) =>
  NAIRA + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compact: N1.2M / N12k / N950 - for dashboards, not receipts. */
export const fmtShort = (kobo: number) => {
  const n = kobo / 100;
  if (Math.abs(n) >= 1_000_000) return NAIRA + (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1000) return NAIRA + (n / 1000).toFixed(0) + 'k';
  return NAIRA + Math.round(n).toLocaleString();
};
