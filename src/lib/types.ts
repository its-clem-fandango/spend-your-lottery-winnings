export interface Item {
  id: string;
  /** Stable short code used in share URLs. Never recycled. */
  code: string;
  name: string;
  price: number;
  category: string;
  blurb: string;
  image: string;
  imageCredit: ImageCredit | null;
  priceVerified: string;
}

export interface ImageCredit {
  author: string;
  source: string;
  license: string;
  url: string;
}

export interface Category {
  slug: string;
  name: string;
  note: string;
}

/**
 * Everything the island needs to render one optimised image.
 * astro:assets does the encoding at build time; only these URLs cross into
 * the Svelte island, because <Image /> cannot be used inside a framework
 * component.
 */
export interface ItemImage {
  /** Fallback src for the <img> element (WebP, 420w — never the original). */
  src: string;
  /** Small square WebP for cart thumbnails, cheap to decode. */
  thumb: string;
  /** AVIF candidates — smallest, tried first. */
  avif: string;
  /** WebP candidates — universally supported fallback. */
  webp: string;
  width: number;
  height: number;
}

export type Cart = Record<string, number>;

export interface GameState {
  /** Jackpot as entered, before tax. */
  gross: number;
  taxed: boolean;
  /** What is actually spendable — gross, or the after-tax estimate. */
  total: number;
  cart: Cart;
  /** Insertion order, so the drawer doesn't reshuffle on every change. */
  order: string[];
}
