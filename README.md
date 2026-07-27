# Spend Your Lottery Winnings

Enter a jackpot, spend it, get a shareable summary. Astro 7 + one Svelte island,
static output, no backend.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm test           # unit
npm run test:e2e   # end-to-end against the production build
```

## Deploy

**Vercel** — import the repo, accept the detected Astro preset. `vercel.json` already
sets immutable caching on hashed assets. No adapter and no runtime: the build emits a
plain directory.

**Anywhere else** — `npm run build` and serve `dist/`. For GitHub Pages set
`base: '/<repo>'` in `astro.config.mjs`.

Set `site` in `astro.config.mjs` to your real domain before shipping — canonical and
Open Graph URLs are derived from it, and X/Facebook need absolute image URLs.

## Structure

```
src/
├── data/items.json        34 items — the single source of truth
├── data/categories.json
├── assets/items/          source artwork, optimised at build time
├── lib/                   pure logic, no DOM, unit-tested
│   ├── money.ts           formatting
│   ├── tax.ts             progressive federal brackets + state estimate
│   ├── slider.ts          log-scaled jackpot slider
│   ├── cart.ts            add/remove/totals reducer
│   ├── share-code.ts      run ⇄ URL encoding
│   ├── share-card.ts      canvas summary card
│   └── verdict.ts
├── components/            Svelte — Game (island root), Entry, Topbar, Board,
│                          ItemCard, CartDrawer, Summary
├── layouts/Base.astro     document shell, meta, fonts
├── pages/index.astro      image pipeline + island mount
└── styles/tokens.css      palette, type, shared button/utility classes
```

`src/lib` is deliberately DOM-free. Tax brackets, cart arithmetic and share encoding are
plain functions covered by 37 unit tests that run in milliseconds without a browser.

## Adding or editing items

Edit `src/data/items.json`. One object per item:

```json
{
  "id": "yacht-charter",
  "code": "1a",
  "name": "Month-long yacht charter",
  "price": 1200000,
  "category": "travel",
  "blurb": "The crew will be noticeably more competent than you.",
  "image": "yacht-charter.png",
  "imageCredit": null,
  "priceVerified": "2026-07-27"
}
```

`code` is a permanent two-character share-URL identifier. **Never reuse one** — a
recycled code silently corrupts previously shared links. New items take the next unused
code; retired items just leave a gap, and old links referencing them degrade gracefully
instead of breaking.

`category` must match a `slug` in `categories.json`.

## Images

The artwork currently in `src/assets/items/` is **generated placeholder art** — see
`scripts/build-item-art.mjs`. The pipeline around it is real and is what you'd keep.

**To use real photography:** drop `<id>.jpg` into `src/assets/items/`, delete the old
`<id>.png`, point the item's `image` at the new filename, then:

```bash
npm run verify:images
```

That reports missing files, images too small for the largest rendered width (640px),
awkward aspect ratios given the 4:3 card crop, and orphaned files. It runs in CI and
fails the build on anything missing.

Nothing else changes. Source images are never served directly.

### How the optimisation works

Astro's `getImage()` runs at build time in `src/pages/index.astro`, producing AVIF and
WebP at four widths each. The island receives only the resulting URLs and renders a
`<picture>` with both formats, a `sizes` hint, intrinsic dimensions, and `loading="lazy"`
on everything below the first row.

**The indirection is required, not stylistic:** `<Image />` is an Astro component and
cannot be used inside a Svelte component, and the entire board lives inside one.
`getImage()` gives the same sharp pipeline with a serialisable result that can cross the
island boundary.

Two Astro defaults are off and their absence is silent — both are set in
`astro.config.mjs`. Without `image.layout` there is no srcset at all; without
`image.responsiveStyles` the generated srcset never resizes anything.

Current build: ~9.5KB gzipped HTML, ~26KB gzipped JS, largest card image ~5KB AVIF.

## Sharing

A finished run encodes into the URL as `?r=v1.<amount>.<tax>.<pairs>` — no backend, no
database. Opening that link replays the exact cart. `Copy share link` in the summary
gives you one; the summary card also renders it so it survives being screenshotted.

The Open Graph image is currently static (`public/og.png`). Per-result preview images
would need on-demand rendering — add `@astrojs/vercel`, a `/og/[code].png` endpoint with
`prerender = false`, and reuse the `share-card.ts` layout.

## Testing

- `npm test` — 37 unit tests over the pure logic.
- `npm run test:e2e` — 26 end-to-end tests across desktop and mobile viewports, run
  against the real production build (image formats and hydration differ from dev).

E2E covers the entry flow, tax toggle, image formats and lazy-loading attributes, cart
arithmetic, the overspend refusal and recovery, share-link round-trip, junk-code
fallback, keyboard operation, and sticky-header alignment.

In a sandbox without downloadable browsers, set `CHROMIUM_PATH` to an existing Chromium
binary.

## Notes

- Prices are ballpark 2026 figures. `priceVerified` tracks when each was last checked.
- Tax estimates use 2025 single-filer brackets plus a flat 5% state stand-in. Real state
  rates run from 0% to about 13%.
- Fonts load from Google Fonts. Self-host them before this becomes a real site — it's a
  render-blocking third-party request.
- No analytics, no cookies, no storage. Nothing leaves the browser.
