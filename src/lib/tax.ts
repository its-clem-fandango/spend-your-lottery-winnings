/**
 * Lottery winnings are taxed as ordinary income. The 24% withheld at payout is
 * only a down payment — the rest is settled at filing.
 *
 * These are real progressive brackets rather than a flat top rate, because a
 * flat 37% is simply wrong below ~$600K: at $500K you keep about 66%, at $100M
 * about 58%. That gap is the entire point of the after-tax toggle.
 */

/** 2025 single-filer brackets: [upper bound, marginal rate]. */
export const BRACKETS: ReadonlyArray<readonly [number, number]> = [
  [11_925, 0.10],
  [48_475, 0.12],
  [103_350, 0.22],
  [197_300, 0.24],
  [250_525, 0.32],
  [626_350, 0.35],
  [Infinity, 0.37]
];

/** Stand-in for state income tax. Real rates run 0% (TX, FL) to ~13% (CA). */
export const STATE_RATE = 0.05;

export function federalTax(income: number): number {
  let tax = 0;
  let prev = 0;
  for (const [cap, rate] of BRACKETS) {
    if (income > prev) tax += (Math.min(income, cap) - prev) * rate;
    prev = cap;
    if (income <= cap) break;
  }
  return tax;
}

export function afterTax(gross: number): number {
  return Math.max(0, gross - federalTax(gross) - gross * STATE_RATE);
}

/** Effective total rate as a percentage, for display. */
export function effectiveRate(gross: number): number {
  if (gross <= 0) return 0;
  return Math.round((1 - afterTax(gross) / gross) * 100);
}
