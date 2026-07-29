import { describe, it, expect } from 'vitest';
import itemsJson from '../../src/data/items.json';
import categoriesJson from '../../src/data/categories.json';
import type { Item, GameState } from '../../src/lib/types';
import { money, shortMoney, niceRound, clamp } from '../../src/lib/money';
import { federalTax, afterTax, effectiveRate, spendable, STATE_RATE } from '../../src/lib/tax';
import { sliderToAmount, amountToSlider, SLIDER_MIN, SLIDER_MAX } from '../../src/lib/slider';
import {
  indexItems, spent, remaining, itemCount, addItem, removeItem,
  canAfford, isStuck, ranked, minPrice, clearCart, clampCart
} from '../../src/lib/cart';
import { encodeRun, decodeRun, MAX_QTY } from '../../src/lib/share-code';
import { verdict } from '../../src/lib/verdict';
import { parseAmount, formatAmount, hasJunk, MAX_AMOUNT } from '../../src/lib/amount';

const items = itemsJson as Item[];
const categories = categoriesJson as Array<{ slug: string }>;
const index = indexItems(items);
const fresh = (total: number): GameState => ({ gross: total, taxed: false, total, cart: {}, order: [] });

describe('money', () => {
  it('formats with separators', () => {
    expect(money(12400000)).toBe('$12,400,000');
    expect(money(0)).toBe('$0');
  });
  /* Reachable by lowering your winnings below what you already spent. */
  it('puts the sign outside the dollar sign', () => {
    expect(money(-1_140_000)).toBe('-$1,140,000');
    expect(shortMoney(-1_140_000)).toBe('-$1.14M');
  });
  it('never renders a negative zero', () => {
    expect(money(-0.004)).toBe('$0');
  });
  /* One item on the board is $10.50; rounding it to $11 makes the cart
     disagree with the receipt. Whole amounts stay clean. */
  it('shows cents only when there are cents', () => {
    expect(money(10.5)).toBe('$10.50');
    expect(money(31.5)).toBe('$31.50');
    expect(money(28_000)).toBe('$28,000');
    expect(money(-10.5)).toBe('-$10.50');
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
    expect(sliderToAmount(0)).toBe(SLIDER_MIN);
    expect(sliderToAmount(1000)).toBe(SLIDER_MAX);
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
    // Leave less than the cheapest item, whatever that currently costs.
    let s = fresh(cheapest * 1.5);
    s = addItem(s, index, items.find((i) => i.price === cheapest)!.id).state;
    expect(isStuck(s, index, items)).toBe(true);
  });

  it('is not stuck on an empty cart', () => {
    expect(isStuck(fresh(10), index, items)).toBe(false);
  });

  /* Being in the red is its own state with its own banner. "Nothing left you
     can afford" is about leftover money, and there isn't any. */
  it('is not stuck when the balance has gone negative', () => {
    let s = fresh(1e6);
    s = addItem(s, index, 'camry').state;
    s = { ...s, total: 1_000 }; // winnings lowered under what's already spent
    expect(remaining(s, index)).toBeLessThan(0);
    expect(isStuck(s, index, items)).toBe(false);
  });

  it('canAfford is false for unknown ids', () => {
    expect(canAfford(fresh(1e9), index, 'nope')).toBe(false);
  });

  it('empties the cart and the order together', () => {
    let s = fresh(1e6);
    s = addItem(s, index, 'camry').state;
    const cleared = clearCart(s);
    expect(cleared.cart).toEqual({});
    expect(cleared.order).toEqual([]);
    expect(cleared.total).toBe(s.total); // the jackpot survives
  });

  describe('clampCart', () => {
    it('trims to the budget, earliest first', () => {
      const out = clampCart({ camry: 5 }, ['camry'], index, 60_000);
      expect(out.cart['camry']).toBe(2); // floor(60000 / 28000)
      expect(out.order).toEqual(['camry']);
    });
    it('drops what the budget cannot reach at all', () => {
      const out = clampCart({ camry: 1 }, ['camry'], index, 1_000);
      expect(out.cart).toEqual({});
      expect(out.order).toEqual([]);
    });
    it('ignores ids that are not on the board', () => {
      const out = clampCart({ ghost: 3 }, ['ghost'], index, 1e9);
      expect(out.cart).toEqual({});
    });
  });
});

describe('share codes', () => {
  it('round-trips a run', () => {
    let s = fresh(12_400_000);
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'camry').state;
    s = addItem(s, index, 'rolex').state;
    const code = encodeRun(s.gross, false, s.cart, s.order, items);
    const back = decodeRun(code, items)!;
    expect(back.gross).toBe(12_400_000);
    expect(back.total).toBe(12_400_000);
    expect(back.taxed).toBe(false);
    expect(back.cart).toEqual({ camry: 2, rolex: 1 });
    expect(back.order).toEqual(['camry', 'rolex']);
  });

  it('preserves the tax flag', () => {
    const code = encodeRun(1e6, true, {}, [], items);
    expect(decodeRun(code, items)!.taxed).toBe(true);
  });

  /* The code carries the pre-tax jackpot and re-derives what's spendable. If it
     stored the net figure instead, reopening a taxed run would treat an
     already-taxed number as gross and tax it a second time. */
  it('carries the pre-tax jackpot and re-derives the spendable total', () => {
    const back = decodeRun(encodeRun(1e6, true, {}, [], items), items)!;
    expect(back.gross).toBe(1e6);
    expect(back.total).toBe(spendable(1e6, true));
    expect(back.total).toBeLessThan(back.gross);
  });

  /* Three characters per item plus the header, so this tracks the board size —
     bump it when items are added, and worry if it grows faster than that. */
  it('stays short', () => {
    let s = fresh(1e10);
    for (const item of items) s = addItem(s, index, item.id).state;
    const code = encodeRun(s.gross, false, s.cart, s.order, items);
    expect(code.length).toBeLessThan(items.length * 3 + 30);
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

  it('round-trips quantities above one pair without losing purchases', () => {
    // 40 Camrys is $1.12M — perfectly affordable, and 40 > MAX_QTY.
    expect(40).toBeGreaterThan(MAX_QTY);
    const code = encodeRun(5_000_000, false, { camry: 40 }, ['camry'], items);
    const back = decodeRun(code, items)!;
    expect(back.cart['camry']).toBe(40);
    expect(back.order).toEqual(['camry']);
  });

  /* A cart worth more than the jackpot is a real state, not tampering — you get
     there by lowering your winnings mid-run — so the link has to carry it. */
  it('keeps an overspent cart so the debt survives the link', () => {
    const code = encodeRun(60_000, false, { camry: 5 }, ['camry'], items);
    const back = decodeRun(code, items)!;
    expect(back.cart['camry']).toBe(5);
    expect(spent(back.cart, index)).toBeGreaterThan(back.total);
  });

  it('keeps a purchase the amount can no longer afford', () => {
    const code = encodeRun(1_000, false, { camry: 1 }, ['camry'], items);
    const back = decodeRun(code, items)!;
    expect(back.cart).toEqual({ camry: 1 });
    expect(back.order).toEqual(['camry']);
  });

  it('clamps absurd amounts to the entry maximum', () => {
    const back = decodeRun('v1.zzzzzzzzzz.0.', items)!;
    expect(back.gross).toBe(MAX_AMOUNT);
  });

  /* Dropping the affordability trim removes one bound on a crafted URL, so the
     replacement bound is the widest any real run could have been. */
  it('bounds a hostile cart to the widest run the game allows', () => {
    const cheapest = [...items].sort((a, b) => a.price - b.price)[0]!;
    const pairs = (cheapest.code + 'z').repeat(6_000);
    const back = decodeRun(`v1.${(1).toString(36)}.0.${pairs}`, items)!;
    expect(spent(back.cart, index)).toBeLessThanOrEqual(MAX_AMOUNT);
    expect(Object.keys(back.cart).length).toBeLessThanOrEqual(items.length);
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
  /* A deficit is also <= 0, and congratulating someone for it reads as a bug. */
  it('does not call a deficit magnificent', () => {
    expect(verdict(-1e6, 1e7)).not.toMatch(/Magnificent/);
    expect(verdict(-1e6, 1e7)).toMatch(/did not have/);
  });
});

describe('amount field', () => {
  it('sanitises whatever gets pasted in', () => {
    expect(parseAmount('$1,200,000 approx')).toBe(1_200_000);
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('nonsense')).toBe(0);
  });
  it('clamps to the entry maximum', () => {
    expect(parseAmount('99999999999999999')).toBe(MAX_AMOUNT);
  });
  it('shows nothing rather than a zero', () => {
    expect(formatAmount(0)).toBe('');
    expect(formatAmount(1_200_000)).toBe('1,200,000');
  });
  it('flags input that had to be cleaned up', () => {
    expect(hasJunk('1,200')).toBe(false);
    expect(hasJunk('$1200')).toBe(true);
  });
});

describe('data integrity', () => {
  it('has 46 items', () => expect(items).toHaveLength(46));

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

  /* Prices are whole dollars everywhere except the burrito, which is the joke.
     Anything else with a fraction is likelier a typo than a decision. */
  it('prices in whole dollars, apart from the deliberate exception', () => {
    const fractional = items.filter((i) => !Number.isInteger(i.price)).map((i) => i.id);
    expect(fractional).toEqual(['baja-burrito']);
  });

  it('keeps the cheap end genuinely cheap', () => {
    const price = (id: string) => items.find((i) => i.id === id)!.price;
    expect(price('baja-burrito')).toBe(10.5);
    expect(price('phillips-bbq')).toBe(25);
    expect(minPrice(items)).toBe(10.5);
  });

  /* CC BY and CC BY-SA oblige us to name the photographer, so a credited item
     needs every field the footer renders. */
  it('has complete attribution wherever a credit exists', () => {
    for (const item of items) {
      if (!item.imageCredit) continue;
      const c = item.imageCredit;
      expect(c.author.length).toBeGreaterThan(0);
      expect(c.license.length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.source.length).toBeGreaterThan(0);
    }
  });

  /* Photos whose photographer we don't know. Listed rather than left to slip
     through, so an uncredited image is always a deliberate entry here and never
     an oversight — and so anyone auditing the licensing knows exactly which
     files have no provenance. A guessed credit would be worse than none: it
     misattributes a real named person. */
  const UNKNOWN_PROVENANCE = ['raiders-suite'];

  it('credits every photograph except the generated plates and the known-unknowns', () => {
    const plates = items.filter((i) => i.image.endsWith('.png')).map((i) => i.id);
    const uncredited = items.filter((i) => !i.imageCredit).map((i) => i.id);
    expect([...uncredited].sort()).toEqual([...plates, ...UNKNOWN_PROVENANCE].sort());
  });

  /* Every category listed has to have something in it, or the board renders a
     heading over an empty grid. */
  it('has no empty categories', () => {
    const used = new Set(items.map((i) => i.category));
    for (const c of categories) expect(used.has(c.slug)).toBe(true);
    for (const slug of used) expect(categories.some((c) => c.slug === slug)).toBe(true);
  });

  /* The board renders items.json in file order — it filters by category and
     never sorts — so array position is the display order. An item appended to
     the end of the file lands at the bottom of its category no matter what it
     costs, which is how a $25 rib tip dinner ended up below a $145k kitchen.
     New items go in their price slot, not at the end. Share codes are frozen
     independently of position, so reordering is safe. */
  it('lists each category cheapest first', () => {
    for (const c of categories) {
      const prices = items.filter((i) => i.category === c.slug).map((i) => i.price);
      expect({ [c.slug]: prices }).toEqual({ [c.slug]: [...prices].sort((a, b) => a - b) });
    }
  });

  /* Categories are rendered in categories.json order, so the file only stays
     readable if its blocks run in that order too — and a stray item marooned
     in another category's block is the bug above waiting to happen again. */
  it('groups the file by category, in the order the board renders them', () => {
    const blocks = items.map((i) => i.category).filter((c, i, a) => c !== a[i - 1]);
    expect(blocks).toEqual(categories.map((c) => c.slug));
  });

  it('has a positive price, a blurb and an image for every item', () => {
    for (const item of items) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.blurb.length).toBeGreaterThan(3);
      expect(item.image).toMatch(/\.(png|jpg|jpeg|webp|avif)$/);
    }
  });
});
