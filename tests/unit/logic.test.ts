import { describe, it, expect } from 'vitest';
import itemsJson from '../../src/data/items.json';
import type { Item, GameState } from '../../src/lib/types';
import { money, shortMoney, niceRound, clamp } from '../../src/lib/money';
import { federalTax, afterTax, effectiveRate, STATE_RATE } from '../../src/lib/tax';
import { sliderToAmount, amountToSlider, MIN_AMOUNT, MAX_AMOUNT } from '../../src/lib/slider';
import {
  indexItems, spent, remaining, itemCount, addItem, removeItem,
  canAfford, isStuck, ranked, minPrice
} from '../../src/lib/cart';
import { encodeRun, decodeRun, MAX_QTY } from '../../src/lib/share-code';
import { verdict } from '../../src/lib/verdict';

const items = itemsJson as Item[];
const index = indexItems(items);
const fresh = (total: number): GameState => ({ gross: total, taxed: false, total, cart: {}, order: [] });

describe('money', () => {
  it('formats with separators', () => {
    expect(money(12400000)).toBe('$12,400,000');
    expect(money(0)).toBe('$0');
  });
  it('abbreviates', () => {
    expect(shortMoney(1_000_000)).toBe('$1M');
    expect(shortMoney(12_400_000)).toBe('$12.4M');
    expect(shortMoney(500_000)).toBe('$500K');
    expect(shortMoney(1_000_000_000)).toBe('$1B');
  });
  it('rounds to readable numbers', () => {
    expect(niceRound(1234)).toBe(1000);
    expect(niceRound(1_234_567)).toBe(1_200_000);
  });
  it('clamps', () => expect(clamp(5, 1, 3)).toBe(3));
});

describe('tax', () => {
  it('is progressive, not flat', () => {
    // The whole point of the toggle: the effective rate must climb with income.
    expect(effectiveRate(50_000)).toBeLessThan(effectiveRate(500_000));
    expect(effectiveRate(500_000)).toBeLessThan(effectiveRate(100_000_000));
  });
  it('keeps ~66% of $500K and ~58% of $100M', () => {
    expect(afterTax(500_000) / 500_000).toBeCloseTo(0.661, 2);
    expect(afterTax(1e8) / 1e8).toBeCloseTo(0.58, 2);
  });
  it('never exceeds the top marginal rate plus state', () => {
    expect(effectiveRate(1e12)).toBeLessThanOrEqual(Math.round((0.37 + STATE_RATE) * 100));
  });
  it('taxes the first bracket at 10%', () => {
    expect(federalTax(10_000)).toBeCloseTo(1_000, 5);
  });
  it('handles zero and negatives without going negative', () => {
    expect(afterTax(0)).toBe(0);
    expect(afterTax(-5)).toBe(0);
  });
});

describe('slider', () => {
  it('spans $1K to $1B', () => {
    expect(sliderToAmount(0)).toBe(MIN_AMOUNT);
    expect(sliderToAmount(1000)).toBe(MAX_AMOUNT);
  });
  it('puts the midpoint at $1M, not $500M', () => {
    expect(sliderToAmount(500)).toBe(1_000_000);
  });
  it('round-trips', () => {
    for (const amount of [500_000, 2_000_000, 50_000_000]) {
      expect(sliderToAmount(amountToSlider(amount))).toBe(amount);
    }
  });
  it('clamps out-of-range input', () => {
    expect(amountToSlider(1)).toBe(0);
    expect(amountToSlider(1e15)).toBe(1000);
  });
});

describe('cart', () => {
  it('adds and totals', () => {
    const { state, added } = addItem(fresh(1e6), index, 'camry');
    expect(added).toBe(true);
    expect(spent(state.cart, index)).toBe(28_000);
    expect(remaining(state, index)).toBe(972_000);
  });

  it('accumulates quantity', () => {
    let s = fresh(1e6);
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'camry').state;
    expect(s.cart['camry']).toBe(2);
    expect(itemCount(s.cart)).toBe(2);
    expect(spent(s.cart, index)).toBe(56_000);
  });

  it('refuses what it cannot afford and reports the refusal', () => {
    const s = fresh(10_000);
    const { state, added } = addItem(s, index, 'camry');
    expect(added).toBe(false);
    expect(state).toBe(s); // untouched
    expect(spent(state.cart, index)).toBe(0);
  });

  it('never lets the balance go negative across a long random run', () => {
    let s = fresh(5_000_000);
    for (let i = 0; i < 500; i++) {
      s = addItem(s, index, items[i % items.length]!.id).state;
      expect(remaining(s, index)).toBeGreaterThanOrEqual(0);
    }
  });

  it('removes, and drops the item at zero', () => {
    let s = fresh(1e6);
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'camry').state;
    s = removeItem(s, 'camry');
    expect(s.cart['camry']).toBe(1);
    s = removeItem(s, 'camry');
    expect(s.cart['camry']).toBeUndefined();
    expect(s.order).not.toContain('camry');
  });

  it('ignores removing something not in the cart', () => {
    const s = fresh(1e6);
    expect(removeItem(s, 'camry')).toBe(s);
  });

  it('preserves insertion order so the drawer does not reshuffle', () => {
    let s = fresh(1e8);
    s = addItem(s, index, 'rolex').state;
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'rolex').state;
    expect(s.order).toEqual(['rolex', 'camry']);
  });

  it('ranks the summary by spend, not insertion', () => {
    let s = fresh(1e8);
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'nyc-penthouse').state;
    expect(ranked(s, index)[0]!.item.id).toBe('nyc-penthouse');
  });

  it('detects being stuck with money too small to spend', () => {
    const cheapest = minPrice(items);
    let s = fresh(cheapest + 100);
    s = addItem(s, index, items.find((i) => i.price === cheapest)!.id).state;
    expect(isStuck(s, index, items)).toBe(true);
  });

  it('is not stuck on an empty cart', () => {
    expect(isStuck(fresh(10), index, items)).toBe(false);
  });

  it('canAfford is false for unknown ids', () => {
    expect(canAfford(fresh(1e9), index, 'nope')).toBe(false);
  });
});

describe('share codes', () => {
  it('round-trips a run', () => {
    let s = fresh(12_400_000);
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'rolex').state;
    const code = encodeRun(s.total, false, s.cart, s.order, items);
    const back = decodeRun(code, items)!;
    expect(back.amount).toBe(12_400_000);
    expect(back.taxed).toBe(false);
    expect(back.cart).toEqual({ camry: 2, rolex: 1 });
    expect(back.order).toEqual(['camry', 'rolex']);
  });

  it('preserves the tax flag', () => {
    const code = encodeRun(1e6, true, {}, [], items);
    expect(decodeRun(code, items)!.taxed).toBe(true);
  });

  it('stays short', () => {
    let s = fresh(1e9);
    for (const item of items) s = addItem(s, index, item.id).state;
    const code = encodeRun(s.total, false, s.cart, s.order, items);
    expect(code.length).toBeLessThan(150);
  });

  it('drops retired items instead of throwing', () => {
    const code = encodeRun(1e6, false, { camry: 1 }, ['camry'], items);
    const withoutCamry = items.filter((i) => i.id !== 'camry');
    const back = decodeRun(code, withoutCamry)!;
    expect(back).not.toBeNull();
    expect(back.cart).toEqual({});
  });

  it('rejects junk', () => {
    expect(decodeRun('', items)).toBeNull();
    expect(decodeRun('garbage', items)).toBeNull();
    expect(decodeRun('v9.abc.0.', items)).toBeNull();
    expect(decodeRun('v1.zzz', items)).toBeNull();
  });

  it('clamps absurd quantities', () => {
    const code = encodeRun(1e9, false, { camry: 9999 }, ['camry'], items);
    expect(decodeRun(code, items)!.cart['camry']).toBeLessThanOrEqual(MAX_QTY);
  });
});

describe('verdict', () => {
  it('scales with how much is left', () => {
    expect(verdict(0, 1e6)).toMatch(/Not a dollar/);
    expect(verdict(1e6, 1e6)).toMatch(/almost nothing/);
    expect(verdict(1e5, 1e6)).toMatch(/Thorough/);
  });
  it('survives a zero jackpot', () => {
    expect(verdict(0, 0)).toBeTruthy();
  });
});

describe('data integrity', () => {
  it('has 42 items', () => expect(items).toHaveLength(42));

  it('has unique ids and share codes', () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.code)).size).toBe(items.length);
  });

  it('uses two-character share codes', () => {
    for (const item of items) expect(item.code).toHaveLength(2);
  });

  it('keeps the four required items from the brief', () => {
    for (const id of ['camry', 'lexus-rx', 'range-rover']) {
      expect(items.some((i) => i.id === id)).toBe(true);
    }
    const homes = items.filter((i) => /tahoe-cabin|aspen-chalet|manhattan-beach/.test(i.id));
    expect(homes).toHaveLength(3);
  });

  it('has a positive price, a blurb and an image for every item', () => {
    for (const item of items) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.blurb.length).toBeGreaterThan(3);
      expect(item.image).toMatch(/\.(png|jpg|jpeg|webp|avif)$/);
    }
  });
});
