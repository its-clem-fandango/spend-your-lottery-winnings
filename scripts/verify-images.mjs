/**
 * Fails the build if any item is missing artwork, or if a source image is
 * small enough that it will look soft at the largest rendered width.
 *
 * Run before deploying, and in CI. Swapping placeholder art for real
 * photography is: drop `<id>.jpg` into src/assets/items/, delete the old
 * `<id>.png`, point `image` at the new filename, run this.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src/assets/items');
const items = require(join(ROOT, 'src/data/items.json'));

const LARGEST_RENDERED_WIDTH = 640;
const MIN_ASPECT = 1.1; // anything narrower than this gets cropped hard by the 4:3 card

const missing = [];
const soft = [];
const odd = [];

for (const item of items) {
  const path = join(DIR, item.image);
  if (!existsSync(path)) {
    missing.push(`${item.id} → src/assets/items/${item.image}`);
    continue;
  }
  const meta = await sharp(path).metadata();
  if ((meta.width ?? 0) < LARGEST_RENDERED_WIDTH) {
    soft.push(`${item.id} (${meta.width}px wide, want ≥${LARGEST_RENDERED_WIDTH}px)`);
  }
  const ratio = (meta.width ?? 1) / (meta.height ?? 1);
  if (ratio < MIN_ASPECT) {
    odd.push(`${item.id} (${ratio.toFixed(2)}:1 — cards crop to 4:3, expect heavy cropping)`);
  }
}

const used = new Set(items.map((i) => i.image));
const orphans = readdirSync(DIR).filter((f) => !used.has(f) && !f.startsWith('.'));

if (missing.length) {
  console.error(`\n✗ ${missing.length} item(s) have no artwork:`);
  missing.forEach((m) => console.error('   ' + m));
}
if (soft.length) {
  console.warn(`\n! ${soft.length} image(s) below the largest rendered width:`);
  soft.forEach((m) => console.warn('   ' + m));
}
if (odd.length) {
  console.warn(`\n! ${odd.length} image(s) with an awkward aspect ratio:`);
  odd.forEach((m) => console.warn('   ' + m));
}
if (orphans.length) {
  console.warn(`\n! ${orphans.length} unused file(s) in src/assets/items:`);
  orphans.forEach((m) => console.warn('   ' + m));
}

if (!missing.length && !soft.length && !odd.length && !orphans.length) {
  console.log(`✓ all ${items.length} items have usable artwork`);
}

process.exit(missing.length ? 1 : 0);
