export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function shortMoney(n: number): string {
  n = Math.round(n);
  if (n >= 1e9) return '$' + trim(n / 1e9) + 'B';
  if (n >= 1e6) return '$' + trim(n / 1e6) + 'M';
  if (n >= 1e3) return '$' + trim(n / 1e3) + 'K';
  return '$' + n;
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
