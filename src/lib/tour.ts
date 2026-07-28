/**
 * The how-to-play tour: step content, first-visit persistence, and the
 * step-card placement math. No DOM, no framework — selector *resolution*
 * happens in Tour.svelte so this stays unit-testable in node.
 */

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Tried in order; the first selector that matches becomes the spotlight target. */
  selectors: string[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'stats',
    title: "Here's your fortune",
    body: "Winnings is what you won. Spent is what you've blown. Remaining is what's left — watch it shrink.",
    selectors: ['[data-tour="stats"]'],
  },
  {
    id: 'buy',
    title: 'Tap anything to buy it',
    body: "See something you like? Tap it once — it's yours. Tap it again to buy two. Nobody's judging.",
    selectors: ['.card:not(.unaffordable)', '.card'],
  },
  {
    id: 'cart',
    title: 'The cart keeps score',
    body: "Everything you buy lands here. When the money's gone — or you're bored — open the cart and hit 'I'm done spending' to see the damage.",
    selectors: ['[data-tour="cart"]'],
  },
];

export const TOUR_KEY = 'lottery.tourSeen';

/* localStorage can be absent (SSR, node tests) or throw (Safari private
   mode, storage quotas). Either way the answer is "act like a first visit"
   rather than crash. */

export function hasSeenTour(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* Private mode: the tour just re-offers itself next visit. */
  }
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CardPlacement {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

/**
 * Places the desktop step card next to the spotlight: below the target when
 * there's room, above when there isn't, clamped below as a last resort so it
 * never leaves the viewport entirely. Horizontally centered on the target,
 * clamped to the viewport edges.
 */
export function placeCard(
  target: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 18,
  edge = 16
): CardPlacement {
  const below = target.top + target.height + gap;
  const above = target.top - gap - card.height;

  let placement: 'above' | 'below' = 'below';
  let top = below;
  if (below + card.height > viewport.height - edge && above >= edge) {
    placement = 'above';
    top = above;
  } else if (below + card.height > viewport.height - edge) {
    top = Math.max(edge, viewport.height - edge - card.height);
  }

  const centered = target.left + target.width / 2 - card.width / 2;
  const left = Math.max(edge, Math.min(centered, viewport.width - card.width - edge));

  return { top, left, placement };
}
