import { describe, it, expect } from 'vitest';
import itemsJson from '../../src/data/items.json';
import type { Item, GameState } from '../../src/lib/types';
import { parseRun, serializeRun, loadRun, saveRun, clearRun } from '../../src/lib/persist';
import { MAX_AMOUNT } from '../../src/lib/amount';
import { indexItems, spent } from '../../src/lib/cart';

const items = itemsJson as Item[];
const index = indexItems(items);

const run = (over: Partial<GameState> = {}): GameState => ({
  gross: 12_400_000,
  taxed: false,
  total: 12_400_000,
  cart: { camry: 2 },
  order: ['camry'],
  ...over
});

const stored = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, ...run(), ...over });

describe('run persistence', () => {
  it('round-trips a run unchanged', () => {
    const back = parseRun(serializeRun(run()), items)!;
    expect(back).toEqual(run());
  });

  /* Unlike a share code, storage keeps the pre-tax figure — the edit dialog
     needs it, and re-deriving gross from a net total double-taxes. */
  it('keeps gross and total apart for a taxed run', () => {
    const taxed = run({ taxed: true, gross: 12_400_000, total: 7_500_000 });
    const back = parseRun(serializeRun(taxed), items)!;
    expect(back.gross).toBe(12_400_000);
    expect(back.total).toBe(7_500_000);
    expect(back.taxed).toBe(true);
  });

  it('restores a run that has gone into the red', () => {
    const debt = run({ total: 1_000, cart: { camry: 2 }, order: ['camry'] });
    const back = parseRun(serializeRun(debt), items)!;
    expect(spent(back.cart, index)).toBeGreaterThan(back.total);
  });

  describe('rejects what it cannot trust', () => {
    it('returns null for nothing at all', () => {
      expect(parseRun(null, items)).toBeNull();
      expect(parseRun('', items)).toBeNull();
    });
    it('returns null for malformed JSON', () => {
      expect(parseRun('{{{', items)).toBeNull();
      expect(parseRun('not json', items)).toBeNull();
    });
    it('returns null for the wrong shape', () => {
      expect(parseRun('[]', items)).toBeNull();
      expect(parseRun('null', items)).toBeNull();
      expect(parseRun('42', items)).toBeNull();
    });
    it('returns null for an unknown version', () => {
      expect(parseRun(stored({ v: 9 }), items)).toBeNull();
      expect(parseRun(JSON.stringify(run()), items)).toBeNull(); // no v at all
    });
    /* A zero jackpot is the blank pre-start state, not a run worth resuming. */
    it('returns null for a jackpot of zero', () => {
      expect(parseRun(stored({ gross: 0 }), items)).toBeNull();
    });
    it('returns null when the amounts are not numbers', () => {
      expect(parseRun(stored({ gross: 'lots' }), items)).toBeNull();
      expect(parseRun(stored({ total: NaN }), items)).toBeNull();
      expect(parseRun(stored({ gross: Infinity }), items)).toBeNull();
    });
  });

  describe('repairs what it can', () => {
    it('clamps amounts to the entry maximum', () => {
      const back = parseRun(stored({ gross: 1e15, total: 1e15 }), items)!;
      expect(back.gross).toBe(MAX_AMOUNT);
      expect(back.total).toBe(MAX_AMOUNT);
    });
    it('drops items that are no longer on the board', () => {
      const back = parseRun(stored({ cart: { camry: 1, ghost: 4 }, order: ['camry', 'ghost'] }), items)!;
      expect(back.cart).toEqual({ camry: 1 });
      expect(back.order).toEqual(['camry']);
    });
    it('drops quantities that are not whole positive numbers', () => {
      const back = parseRun(
        stored({ cart: { camry: 0, rolex: -1, mustang: 1.5, porsche: 'x', 'nyc-penthouse': 1 } }),
        items
      )!;
      expect(back.cart).toEqual({ 'nyc-penthouse': 1 });
    });
    /* A tampered order could hide a purchase from the drawer while it still
       drained the balance, so the order is rebuilt from the cart. */
    it('rebuilds an order that does not match the cart', () => {
      const back = parseRun(stored({ cart: { camry: 1, rolex: 1 }, order: ['rolex', 'rolex', 'ghost'] }), items)!;
      expect(back.order).toHaveLength(2);
      expect(new Set(back.order)).toEqual(new Set(['camry', 'rolex']));
    });
    it('recovers a cart with no order at all', () => {
      const back = parseRun(stored({ cart: { camry: 1 }, order: undefined }), items)!;
      expect(back.order).toEqual(['camry']);
    });
    it('survives a cart that is not an object', () => {
      const back = parseRun(stored({ cart: 'nope', order: 'nope' }), items)!;
      expect(back.cart).toEqual({});
      expect(back.order).toEqual([]);
    });
    it('bounds a cart far past anything the game could reach', () => {
      const huge = Object.fromEntries(items.map((i) => [i.id, 999_999]));
      const back = parseRun(stored({ cart: huge, order: items.map((i) => i.id) }), items)!;
      expect(spent(back.cart, index)).toBeLessThanOrEqual(MAX_AMOUNT);
    });
  });

  /* Mirrors tour.test.ts: node has no localStorage, and Safari private mode
     throws on write. Either way the answer is "act like a fresh visit". */
  describe('without localStorage', () => {
    it('degrades instead of throwing', () => {
      expect(() => saveRun(run())).not.toThrow();
      expect(() => clearRun()).not.toThrow();
      expect(loadRun(items)).toBeNull();
    });
  });
});
