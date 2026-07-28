import type { Cart, GameState, Item } from './types';

/**
 * Pure cart arithmetic. No DOM, no framework — every rule about what you can
 * and cannot buy lives here and is unit-tested without a browser.
 */

export type ItemIndex = Record<string, Item>;

export function indexItems(items: readonly Item[]): ItemIndex {
  const index: ItemIndex = {};
  for (const item of items) index[item.id] = item;
  return index;
}

export function spent(cart: Cart, index: ItemIndex): number {
  let total = 0;
  for (const id of Object.keys(cart)) {
    const item = index[id];
    if (item) total += item.price * cart[id]!;
  }
  return total;
}

export function remaining(state: GameState, index: ItemIndex): number {
  return state.total - spent(state.cart, index);
}

export function itemCount(cart: Cart): number {
  let n = 0;
  for (const id of Object.keys(cart)) n += cart[id]!;
  return n;
}

export function canAfford(state: GameState, index: ItemIndex, id: string): boolean {
  const item = index[id];
  if (!item) return false;
  return item.price <= remaining(state, index);
}

export interface AddResult {
  state: GameState;
  /** False when the item was rejected for being unaffordable. */
  added: boolean;
}

/**
 * Adding is refused rather than allowed-and-negative. The refusal is what the
 * UI turns into the shake/flash, so it has to be reported, not swallowed.
 */
export function addItem(state: GameState, index: ItemIndex, id: string): AddResult {
  if (!canAfford(state, index, id)) return { state, added: false };
  const cart: Cart = { ...state.cart, [id]: (state.cart[id] ?? 0) + 1 };
  const order = state.order.includes(id) ? state.order : [...state.order, id];
  return { state: { ...state, cart, order }, added: true };
}

export function removeItem(state: GameState, id: string, n = 1): GameState {
  const current = state.cart[id];
  if (!current) return state;
  const next = current - n;
  const cart: Cart = { ...state.cart };
  let order = state.order;
  if (next <= 0) {
    delete cart[id];
    order = state.order.filter((x) => x !== id);
  } else {
    cart[id] = next;
  }
  return { ...state, cart, order };
}

export function clearCart(state: GameState): GameState {
  return { ...state, cart: {}, order: [] };
}

/**
 * Trims a cart to what `budget` affords, earliest purchases first.
 *
 * Not used to enforce the game's own rules — going into the red is a legitimate
 * state you reach by lowering your winnings. This is the bound on carts that
 * arrive from outside the app (a share URL, localStorage someone edited), where
 * the budget is the widest a real run could ever have been rather than the
 * player's current total.
 */
export function clampCart(
  cart: Cart,
  order: string[],
  index: ItemIndex,
  budget: number
): { cart: Cart; order: string[] } {
  const kept: Cart = {};
  const keptOrder: string[] = [];
  let left = budget;
  for (const id of order) {
    const item = index[id];
    const want = cart[id];
    if (!item || !want) continue;
    const qty = Math.min(want, Math.floor(left / item.price));
    if (qty < 1) continue;
    kept[id] = qty;
    left -= qty * item.price;
    keptOrder.push(id);
  }
  return { cart: kept, order: keptOrder };
}

/** Cheapest item still on the board — used to detect "nothing left you can buy". */
export function minPrice(items: readonly Item[]): number {
  return items.reduce((m, i) => Math.min(m, i.price), Infinity);
}

/**
 * "Stuck" means money is left and none of it is enough — which is what the
 * nudge copy says. Being in the red is a different state with its own banner,
 * so a negative balance is deliberately not stuck.
 */
export function isStuck(state: GameState, index: ItemIndex, items: readonly Item[]): boolean {
  const left = remaining(state, index);
  return itemCount(state.cart) > 0 && left >= 0 && left < minPrice(items);
}

/** Purchases ranked by total spend, for the summary card. */
export function ranked(state: GameState, index: ItemIndex) {
  const rows: Array<{ item: Item; qty: number; subtotal: number }> = [];
  for (const id of state.order) {
    const item = index[id];
    const qty = state.cart[id];
    if (!item || !qty) continue;
    rows.push({ item, qty, subtotal: item.price * qty });
  }
  return rows.sort((a, b) => b.subtotal - a.subtotal);
}
