/* Negatives are reachable: lowering your winnings below what you've already
   spent puts the balance in the red rather than trimming the cart. The sign
   belongs outside the dollar sign — "$-1,140,000" reads as a typo. */

/**
 * Cents show only when there are cents. Almost everything on the board is a
 * whole number of dollars and "$28,000.00" is noise, but a $10.50 burrito is
 * $10.50 and rounding it to $11 makes the cart disagree with the receipt.
 */
export function money(n: number): string {
  // Round to the cent first, so float drift can't surface as a stray fraction.
  const cents = Math.round(n * 100);
  // Math.abs before the sign test: -0 is not < 0, so there is no "-$0".
  const abs = Math.abs(cents) / 100;
  const digits = Number.isInteger(abs) ? 0 : 2;
  return (
    (cents < 0 ? '-$' : '$') +
    abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  );
}

export function shortMoney(n: number): string {
  n = Math.round(n);
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return sign + '$' + trim(a / 1e9) + 'B';
  if (a >= 1e6) return sign + '$' + trim(a / 1e6) + 'M';
  if (a >= 1e3) return sign + '$' + trim(a / 1e3) + 'K';
  return sign + '$' + a;
}

function trim(x: number): string {
  const s = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  return s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Snap to roughly two significant figures so slider values read as real numbers. */
export function niceRound(v: number): number {
  if (v < 10000) return Math.round(v / 500) * 500;
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}
