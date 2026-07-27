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
  'Cars & Wheels':        ['#12503d', '#0b331e'],
  'Real Estate':          ['#14563f', '#0c3323'],
  'Travel & Experiences': ['#11523f', '#0a3527'],
  'Everyday Splurges':    ['#155440', '#0b3226'],
  'Grown-Up Moves':       ['#12513e', '#0a3025'],
  'Giving Back':          ['#16583f', '#0c3626']
};

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
    .replace('<svg ', '<svg x="250" y="118" width="500" height="500" ')
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
      <radialGradient id="glow" cx="50%" cy="42%" r="52%">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.13"/>
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
    <rect width="${W}" height="${H}" fill="url(#dots)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <ellipse cx="500" cy="612" rx="215" ry="26" fill="#000000" fill-opacity="0.20"/>
    ${icon}
    <rect width="${W}" height="${H}" fill="url(#vig)"/>
  </svg>`;

  await sharp(Buffer.from(plate), { density: 200 })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `${item.id}.png`));
  made++;
}

console.log(`item art: ${made} generated, ${skipped} left alone (real artwork already present)`);
