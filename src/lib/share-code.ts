import type { Cart, Item } from './types';
import { MAX_AMOUNT } from './amount';
import { clampCart, indexItems } from './cart';
import { spendable } from './tax';

/**
 * Encodes a whole run into a short, URL-safe string so a result can be shared
 * as a link instead of only a downloaded image.
 *
 *   v1.<gross base36>.<taxFlag>.<pairs>
 *   pairs = <2-char item code><1-char qty base36> repeated
 *
 * A quantity above MAX_QTY doesn't fit one pair, so the pair repeats and the
 * decoder accumulates — large carts round-trip instead of being silently
 * clamped.
 *
 * The amount carried is the jackpot as entered, before tax, with the spendable
 * total re-derived from it and the tax flag. Storing the post-tax figure
 * instead would restore a taxed run whose "before tax" number was already net,
 * and taxing it again on the next edit.
 *
 * No backend and no database. Item codes are frozen in items.json and never
 * recycled, so old links keep resolving as the board changes; unknown codes are
 * dropped rather than throwing, so retiring an item degrades gracefully.
 *
 * The decoder treats the URL as untrusted input, but note what it does *not*
 * enforce: a cart worth more than the amount is legitimate — lowering your
 * winnings mid-run puts you in the red on purpose, and that has to survive
 * being shared. The bound is MAX_AMOUNT, the widest any real run could be,
 * which caps a crafted link to states the UI could have reached on its own.
 */

export const MAX_QTY = 35; // one base36 digit per pair
/* $1B ceiling ÷ the cheapest item is ~55k units, so this is far above any real
   cart; it exists so a multi-megabyte ?r= isn't walked to the end. */
const MAX_PAIRS = 2_000;
const VERSION = 'v1';

export interface DecodedRun {
  /** Jackpot before tax, as entered. */
  gross: number;
  taxed: boolean;
  /** Re-derived from gross and taxed — never read off the wire. */
  total: number;
  cart: Cart;
  order: string[];
}

export function encodeRun(gross: number, taxed: boolean, cart: Cart, order: string[], items: readonly Item[]): string {
  const codeById = new Map(items.map((i) => [i.id, i.code]));
  const pairs = order
    .map((id) => {
      const code = codeById.get(id);
      const qty = cart[id];
      if (!code || !qty) return '';
      let out = '';
      for (let left = qty; left > 0; left -= MAX_QTY) {
        out += code + Math.min(left, MAX_QTY).toString(36);
      }
      return out;
    })
    .join('');
  return [VERSION, Math.round(gross).toString(36), taxed ? '1' : '0', pairs].join('.');
}

export function decodeRun(code: string, items: readonly Item[]): DecodedRun | null {
  if (!code) return null;
  const parts = code.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  const parsed = parseInt(parts[1]!, 36);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const gross = Math.min(parsed, MAX_AMOUNT);

  const itemByCode = new Map(items.map((i) => [i.code, i]));
  const cart: Cart = {};
  const order: string[] = [];
  const pairs = parts[3]!;

  const end = Math.min(pairs.length, MAX_PAIRS * 3);
  for (let i = 0; i + 3 <= end; i += 3) {
    const item = itemByCode.get(pairs.slice(i, i + 2));
    const qty = parseInt(pairs[i + 2]!, 36);
    if (!item || !Number.isFinite(qty) || qty < 1) continue; // retired item — skip
    cart[item.id] = (cart[item.id] ?? 0) + qty;
    if (!order.includes(item.id)) order.push(item.id);
  }

  const taxed = parts[2] === '1';
  const fitted = clampCart(cart, order, indexItems(items), MAX_AMOUNT);
  return { gross, taxed, total: spendable(gross, taxed), cart: fitted.cart, order: fitted.order };
}
