import type { Cart, Item } from './types';
import { clamp } from './money';

/**
 * Encodes a whole run into a short, URL-safe string so a result can be shared
 * as a link instead of only a downloaded image.
 *
 *   v1.<amount base36>.<taxFlag>.<pairs>
 *   pairs = <2-char item code><1-char qty base36> repeated
 *
 * No backend and no database. Item codes are frozen in items.json and never
 * recycled, so old links keep resolving as the board changes; unknown codes are
 * dropped rather than throwing, so retiring an item degrades gracefully.
 */

export const MAX_QTY = 35; // one base36 digit
const VERSION = 'v1';

export interface DecodedRun {
  amount: number;
  taxed: boolean;
  cart: Cart;
  order: string[];
}

export function encodeRun(amount: number, taxed: boolean, cart: Cart, order: string[], items: readonly Item[]): string {
  const codeById = new Map(items.map((i) => [i.id, i.code]));
  const pairs = order
    .map((id) => {
      const code = codeById.get(id);
      const qty = cart[id];
      if (!code || !qty) return '';
      return code + clamp(qty, 1, MAX_QTY).toString(36);
    })
    .join('');
  return [VERSION, Math.round(amount).toString(36), taxed ? '1' : '0', pairs].join('.');
}

export function decodeRun(code: string, items: readonly Item[]): DecodedRun | null {
  if (!code) return null;
  const parts = code.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;

  const amount = parseInt(parts[1]!, 36);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const itemByCode = new Map(items.map((i) => [i.code, i]));
  const cart: Cart = {};
  const order: string[] = [];
  const pairs = parts[3]!;

  for (let i = 0; i + 2 < pairs.length + 1; i += 3) {
    const chunk = pairs.slice(i, i + 3);
    if (chunk.length < 3) break;
    const item = itemByCode.get(chunk.slice(0, 2));
    const qty = parseInt(chunk[2]!, 36);
    if (!item || !Number.isFinite(qty) || qty < 1) continue; // retired item — skip
    cart[item.id] = clamp(qty, 1, MAX_QTY);
    if (!order.includes(item.id)) order.push(item.id);
  }

  return { amount, taxed: parts[2] === '1', cart, order };
}
