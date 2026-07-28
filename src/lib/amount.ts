import { clamp } from './money';

/**
 * The pure half of the jackpot input. The sequencing that makes typing feel
 * right — caret preservation, syncing the DOM when state didn't change — lives
 * in AmountField.svelte, but the parsing rules live here so they can be tested
 * without a browser.
 */

export const MIN_AMOUNT = 1_000;

/**
 * Not a limit on the fantasy — it's deliberately absurd, roughly five hundred
 * times the largest jackpot ever won, so nobody typing a real number ever meets
 * it. It exists because a share URL and localStorage are untrusted input and
 * something has to stop a crafted one claiming a number that breaks the
 * arithmetic. Everything downstream (the cart bound, the stored run) hangs off
 * this, so it lives with the field that enforces it rather than off in a module
 * about a control the entry screen no longer uses.
 */
export const MAX_AMOUNT = 1_000_000_000_000;

/** Paste is sanitised rather than blocked, so "$1,200" from anywhere still lands. */
export function parseAmount(raw: string): number {
  const parsed = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return clamp(Math.round(Number.isFinite(parsed) ? parsed : 0), 0, MAX_AMOUNT);
}

/** Empty rather than "0": the field asks a question and deserves a blank answer. */
export function formatAmount(n: number): string {
  return n ? n.toLocaleString('en-US') : '';
}

/** Whether sanitising had to throw anything away — drives the "Numbers only." nudge. */
export function hasJunk(raw: string): boolean {
  return /[^0-9,]/.test(raw);
}
