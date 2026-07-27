import { clamp, niceRound } from './money';

export const MIN_AMOUNT = 1_000;
export const MAX_AMOUNT = 1_000_000_000;
export const SLIDER_STEPS = 1000;

/**
 * Log scale, deliberately. On a linear track every realistic jackpot
 * ($500K–$50M) is crushed into the first 5% of the rail and the control is
 * useless. Log puts the midpoint at $1M.
 */
export function sliderToAmount(pos: number): number {
  const t = clamp(pos, 0, SLIDER_STEPS) / SLIDER_STEPS;
  const lo = Math.log10(MIN_AMOUNT);
  const hi = Math.log10(MAX_AMOUNT);
  return niceRound(Math.pow(10, lo + t * (hi - lo)));
}

export function amountToSlider(amount: number): number {
  const a = clamp(amount, MIN_AMOUNT, MAX_AMOUNT);
  const lo = Math.log10(MIN_AMOUNT);
  const hi = Math.log10(MAX_AMOUNT);
  return Math.round(((Math.log10(a) - lo) / (hi - lo)) * SLIDER_STEPS);
}
