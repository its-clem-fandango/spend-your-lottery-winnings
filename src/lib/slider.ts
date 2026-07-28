import { clamp, niceRound } from './money';

/* The entry screen asks for a typed number now, so nothing renders this — it's
   kept against the day a rail comes back. Its top is its own: the field's
   ceiling is a safety bound in the trillions, which would make every realistic
   jackpot unreachable on a thousand-step track. */
export const SLIDER_MIN = 1_000;
export const SLIDER_MAX = 1_000_000_000;
export const SLIDER_STEPS = 1000;

/**
 * Log scale, deliberately. On a linear track every realistic jackpot
 * ($500K–$50M) is crushed into the first 5% of the rail and the control is
 * useless. Log puts the midpoint at $1M.
 */
export function sliderToAmount(pos: number): number {
  const t = clamp(pos, 0, SLIDER_STEPS) / SLIDER_STEPS;
  const lo = Math.log10(SLIDER_MIN);
  const hi = Math.log10(SLIDER_MAX);
  return niceRound(Math.pow(10, lo + t * (hi - lo)));
}

export function amountToSlider(amount: number): number {
  const a = clamp(amount, SLIDER_MIN, SLIDER_MAX);
  const lo = Math.log10(SLIDER_MIN);
  const hi = Math.log10(SLIDER_MAX);
  return Math.round(((Math.log10(a) - lo) / (hi - lo)) * SLIDER_STEPS);
}
