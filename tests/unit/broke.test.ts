import { describe, it, expect } from 'vitest';
import { brokeLine, BROKE_TIERS } from '../../src/lib/broke';

const LOTTERY = /Whittaker|Carroll|Adams/;
const CELEBRITY = /Cage|Tyson|Hammer/;
const allLines = BROKE_TIERS.flatMap((t) => t.lines);

describe('broke lines', () => {
  it('says nothing while the balance is fine', () => {
    expect(brokeLine(0, 1e6)).toBe('');
    expect(brokeLine(-500, 1e6)).toBe('');
  });

  it('always has something to say once you are under', () => {
    expect(brokeLine(1, 1e6)).toBeTruthy();
    expect(brokeLine(1e9, 1e6)).toBeTruthy();
  });

  /* The line feeds a $derived that re-runs on every cart change, and a shared
     link has to read the same for sender and receiver. Randomness fails both. */
  it('returns the same line for the same hole, every time', () => {
    const once = brokeLine(1_140_000, 12_400_000);
    for (let i = 0; i < 20; i++) {
      expect(brokeLine(1_140_000, 12_400_000)).toBe(once);
    }
  });

  /* Tiered on the ratio, not the dollars: the same hole means very different
     things against a small jackpot and a huge one. */
  it('picks by how deep the hole is relative to the winnings', () => {
    expect(brokeLine(1_000, 1e6)).toMatch(CELEBRITY);
    expect(brokeLine(5_000_000, 1e6)).toMatch(LOTTERY);
  });

  it('reaches for the lottery winners when the hole is catastrophic', () => {
    expect(brokeLine(50_000_000, 1e6)).toMatch(LOTTERY);
  });

  it('treats owing money against nothing as the deepest tier', () => {
    expect(brokeLine(5_000, 0)).toMatch(LOTTERY);
  });

  it('leans on lottery winners over celebrities', () => {
    const lottery = allLines.filter((l) => LOTTERY.test(l)).length;
    expect(lottery).toBeGreaterThan(allLines.length / 2);
  });

  it('has no blank or duplicated copy', () => {
    expect(allLines.every((l) => l.trim().length > 20)).toBe(true);
    expect(new Set(allLines).size).toBe(allLines.length);
  });

  /* The figure is already in the stat slot beside the banner; interpolating it
     into the copy too would double it up and make these tests brittle. */
  it('keeps money out of the copy', () => {
    expect(allLines.every((l) => !l.includes('${'))).toBe(true);
  });
});
