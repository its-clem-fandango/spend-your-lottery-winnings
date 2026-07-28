/**
 * Generates the raster source art for every item into src/assets/items/.
 *
 * These are PLACEHOLDERS. The app is wired for real photography — drop a
 * `<id>.jpg` or `<id>.png` into src/assets/items/ and it replaces the generated
 * plate with no code change (see scripts/verify-images.mjs). Anything already
 * present is left alone, so re-running this never clobbers real artwork.
 *
 * Output is intentionally raster (not SVG) so the astro:assets pipeline has real
 * photographic-style input to compress: gradients and soft shadows are exactly
 * where AVIF earns its keep over PNG.
 */
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ITEMS } from './icon-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/assets/items');
mkdirSync(OUT, { recursive: true });

const W = 1000, H = 750;

// Per-category plate tints. Same family, enough separation that the board reads
// as grouped when you scan it.
const TINT = {
  'Cars & Wheels':        ['#186349', '#082a1a'],
  'Real Estate':          ['#1a6a4c', '#092b1d'],
  'Travel & Experiences': ['#15644b', '#072d20'],
  'Everyday Splurges':    ['#1b684e', '#082a1f'],
  'Grown-Up Moves':       ['#176349', '#07281e'],
  'Giving Back':          ['#1c6d4c', '#092e20']
};

// Sunburst rays behind the icon — the plate should feel like a jackpot burst,
// not a flat swatch. Every other ray is slightly stronger to add sparkle.
function rays(cx, cy) {
  let out = '';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = cx + Math.cos(a) * 900;
    const y = cy + Math.sin(a) * 900;
    const o = i % 2 ? 0.05 : 0.09;
    out += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(0)}" y2="${y.toFixed(0)}" stroke="#e8b73c" stroke-opacity="${o}" stroke-width="30"/>`;
  }
  return out;
}

const existing = new Set(
  existsSync(OUT) ? readdirSync(OUT).map(f => f.replace(/\.[^.]+$/, '')) : []
);

let made = 0, skipped = 0;

for (const item of ITEMS) {
  if (existing.has(item.id)) { skipped++; continue; }

  const [a, b] = TINT[item.category] || TINT['Cars & Wheels'];

  // The icon markup is authored on a 100x100 grid; scale and centre it on the plate.
  // CSS custom properties don't resolve outside the app, so bind the palette
  // to literals here. --cream-2 is used as a knock-out fill (wheel hubs), so it
  // has to become the plate colour rather than a light one.
  const icon = item.svg
    .replace('<svg ', '<svg x="190" y="141" width="620" height="620" ')
    .replace('stroke="currentColor"', 'stroke="#f6efdf"')
    .replaceAll('var(--gold)', '#e8b73c')
    .replaceAll('var(--cream-2)', b)
    .replaceAll('var(--green-800)', '#0e3b2e')
    .replaceAll('var(--red)', '#e2685f');

  const plate = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="44%" r="56%">
        <stop offset="0" stop-color="#ffe9a3" stop-opacity="0.20"/>
        <stop offset="0.6" stop-color="#ffffff" stop-opacity="0.06"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="2" fill="#e8b73c" fill-opacity="0.10"/>
      </pattern>
      <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${rays(500, 375)}
    <rect width="${W}" height="${H}" fill="url(#dots)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <ellipse cx="500" cy="618" rx="268" ry="28" fill="#000000" fill-opacity="0.22"/>
    ${icon}
    <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`;

  await sharp(Buffer.from(plate), { density: 200 })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `${item.id}.png`));
  made++;
}

console.log(`item art: ${made} generated, ${skipped} left alone (real artwork already present)`);
