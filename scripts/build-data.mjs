/**
 * One-time extraction of the prototype's inline arrays into src/data/*.json,
 * which become the app's single source of truth. Not part of the build — run
 * once, then edit the JSON directly.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEMS, CATEGORIES } from './icon-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'src/data'), { recursive: true });

const SLUG = {
  'Cars & Wheels': 'cars',
  'Real Estate': 'real-estate',
  'Travel & Experiences': 'travel',
  'Everyday Splurges': 'splurges',
  'Grown-Up Moves': 'grown-up',
  'Giving Back': 'giving'
};

// Stable, never-recycled two-character share codes. Order is frozen here; new
// items append. Recycling a code silently corrupts previously shared URLs.
const code = (i) => i.toString(36).padStart(2, '0');

const items = ITEMS.map((it, i) => ({
  id: it.id,
  code: code(i),
  name: it.name,
  price: it.price,
  category: SLUG[it.category],
  blurb: it.blurb,
  image: `${it.id}.png`,
  imageCredit: null,
  priceVerified: '2026-07-27'
}));

const categories = CATEGORIES.map((c) => ({
  slug: SLUG[c.name],
  name: c.name,
  note: c.note
}));

writeFileSync(join(ROOT, 'src/data/items.json'), JSON.stringify(items, null, 2) + '\n');
writeFileSync(join(ROOT, 'src/data/categories.json'), JSON.stringify(categories, null, 2) + '\n');
console.log(`wrote ${items.length} items, ${categories.length} categories`);
