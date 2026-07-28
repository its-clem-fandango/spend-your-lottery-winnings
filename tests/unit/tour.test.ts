import { describe, it, expect } from 'vitest';
import { TOUR_STEPS, TOUR_KEY, hasSeenTour, markTourSeen, placeCard } from '../../src/lib/tour';

describe('tour steps', () => {
  it('has three steps with complete content', () => {
    expect(TOUR_STEPS).toHaveLength(3);
    for (const step of TOUR_STEPS) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.body).toBeTruthy();
      expect(step.selectors.length).toBeGreaterThan(0);
      for (const sel of step.selectors) expect(sel).toBeTruthy();
    }
  });
  it('has unique step ids', () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });
  it('prefers an affordable card for the buy step', () => {
    const buy = TOUR_STEPS.find((s) => s.id === 'buy')!;
    expect(buy.selectors[0]).toContain(':not(.unaffordable)');
    expect(buy.selectors.length).toBeGreaterThan(1);
  });
});

describe('tour persistence', () => {
  // Node has no localStorage — the helpers must degrade, not throw.
  it('treats a storage-less environment as a first visit', () => {
    expect(hasSeenTour()).toBe(false);
  });
  it('marking is a no-op without storage', () => {
    expect(() => markTourSeen()).not.toThrow();
    expect(hasSeenTour()).toBe(false);
  });
  it('exposes a stable storage key', () => {
    expect(TOUR_KEY).toBe('lottery.tourSeen');
  });
});

describe('placeCard', () => {
  const viewport = { width: 1200, height: 800 };
  const card = { width: 380, height: 220 };

  it('places below the target when there is room', () => {
    const p = placeCard({ top: 100, left: 400, width: 200, height: 60 }, card, viewport);
    expect(p.placement).toBe('below');
    expect(p.top).toBe(100 + 60 + 18);
  });
  it('flips above when the target hugs the bottom', () => {
    const p = placeCard({ top: 700, left: 400, width: 200, height: 60 }, card, viewport);
    expect(p.placement).toBe('above');
    expect(p.top).toBe(700 - 18 - 220);
  });
  it('clamps below when neither side fits', () => {
    const short = { width: 1200, height: 300 };
    const p = placeCard({ top: 120, left: 400, width: 200, height: 60 }, card, short);
    expect(p.placement).toBe('below');
    expect(p.top).toBe(300 - 16 - 220);
    expect(p.top).toBeGreaterThanOrEqual(16);
  });
  it('centers horizontally on the target', () => {
    const p = placeCard({ top: 100, left: 400, width: 200, height: 60 }, card, viewport);
    expect(p.left).toBe(400 + 100 - 190);
  });
  it('clamps to the left edge', () => {
    const p = placeCard({ top: 100, left: 0, width: 40, height: 60 }, card, viewport);
    expect(p.left).toBe(16);
  });
  it('clamps to the right edge', () => {
    const p = placeCard({ top: 100, left: 1150, width: 40, height: 60 }, card, viewport);
    expect(p.left).toBe(1200 - 380 - 16);
  });
});
