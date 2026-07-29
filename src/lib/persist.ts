import type { Cart, GameState, Item } from './types';
import { clamp } from './money';
import { MAX_AMOUNT } from './amount';
import { spendable } from './tax';
import { clampCart, indexItems } from './cart';

/**
 * Keeps a run alive across a refresh, so reloading stops being the only way to
 * change your mind. Stored as plain JSON rather than a share code, because a
 * code throws the pre-tax figure away and the edit dialog needs it.
 *
 * localStorage is user-editable, so parseRun treats what it reads exactly like
 * the share decoder treats a URL — every field is re-derived or rejected, never
 * trusted. That includes the spendable total, which is why it isn't stored at
 * all: it is a function of gross and taxed, and the brackets it comes from are
 * a hardcoded tax year. Keeping a copy would mean a run saved under one year's
 * brackets restores with a total the rest of the app no longer agrees with —
 * the topbar and the winnings dialog showing two different numbers for the same
 * run until you touch the dialog.
 */

export const RUN_KEY = 'lottery.run.v1';

interface StoredRun {
  v: 1;
  gross: number;
  taxed: boolean;
  cart: Cart;
  order: string[];
}

export function serializeRun(state: GameState): string {
  const stored: StoredRun = {
    v: 1,
    gross: state.gross,
    taxed: state.taxed,
    cart: state.cart,
    order: state.order
  };
  return JSON.stringify(stored);
}

function amount(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return clamp(Math.round(v), 0, MAX_AMOUNT);
}

export function parseRun(raw: string | null, items: readonly Item[]): GameState | null {
  if (!raw) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;

  const run = data as Partial<StoredRun>;
  if (run.v !== 1) return null;

  const gross = amount(run.gross);
  // A zero jackpot is the blank pre-start state, not a run worth restoring.
  if (gross === null || gross < 1) return null;
  const taxed = run.taxed === true;

  const index = indexItems(items);
  const cart: Cart = {};
  if (typeof run.cart === 'object' && run.cart !== null && !Array.isArray(run.cart)) {
    for (const [id, qty] of Object.entries(run.cart)) {
      if (!index[id]) continue; // retired item — same graceful drop the decoder does
      if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) continue;
      cart[id] = qty;
    }
  }

  /* Rebuild the order from the cart rather than trusting it: a tampered order
     could hide a purchase from the drawer while it still drained the balance. */
  const seen = new Set<string>();
  const order: string[] = [];
  if (Array.isArray(run.order)) {
    for (const id of run.order) {
      if (typeof id !== 'string' || !cart[id] || seen.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
  }
  for (const id of Object.keys(cart)) {
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }

  const fitted = clampCart(cart, order, index, MAX_AMOUNT);
  return { gross, taxed, total: spendable(gross, taxed), cart: fitted.cart, order: fitted.order };
}

/* localStorage can be absent (SSR, node tests) or throw (Safari private mode,
   storage quotas). Either way the answer is "act like a fresh visit". */

export function loadRun(items: readonly Item[]): GameState | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return parseRun(localStorage.getItem(RUN_KEY), items);
  } catch {
    return null;
  }
}

export function saveRun(state: GameState): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(RUN_KEY, serializeRun(state));
  } catch {
    /* Private mode or quota: the run just won't survive a refresh. */
  }
}

export function clearRun(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(RUN_KEY);
  } catch {
    /* Nothing was stored anyway. */
  }
}
