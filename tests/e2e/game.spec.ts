import { test, expect, type Page } from '@playwright/test';
import { encodeRun } from '../../src/lib/share-code';
import itemsJson from '../../src/data/items.json' with { type: 'json' };
import type { Item } from '../../src/lib/types';

const items = itemsJson as Item[];

const isMobile = (p: Page) => p.viewportSize()!.width < 700;

/** The entry screen hydrates client-side; typing or clicking before
 *  data-ready appears lands on dead server-rendered HTML. */
async function openEntry(page: Page) {
  await page.goto('/');
  await expect(page.locator('.entry[data-ready]')).toBeAttached();
}

async function startGame(page: Page, amount = '12400000') {
  // Pretend the how-to-play tour was already seen — it has its own spec.
  await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
  await openEntry(page);
  const field = page.locator('#amount');
  await field.fill('');
  await field.pressSequentially(amount);
  await page.getByRole('button', { name: /start spending/i }).click();
  await expect(page.locator('.topbar')).toBeVisible();
}

test.describe('entry', () => {
  test('formats the amount as you type', async ({ page }) => {
    await openEntry(page);
    const field = page.locator('#amount');
    await field.fill('');
    await field.pressSequentially('7500000');
    await expect(field).toHaveValue('7,500,000');
  });

  test('letters never appear in the amount, typed or pasted', async ({ page, context, browserName }) => {
    await openEntry(page);
    const field = page.locator('#amount');
    await field.pressSequentially('12abc00');
    await expect(field).toHaveValue('1,200');
    await field.pressSequentially('x');
    await expect(field).toHaveValue('1,200');
    // Rejected keystrokes get visible guidance, not silence.
    await expect(page.locator('.entry [role="status"]')).toContainText(/numbers only/i);

    // Paste is sanitised rather than blocked.
    test.skip(browserName !== 'chromium', 'clipboard permission is chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => navigator.clipboard.writeText('$1,200,000 approx'));
    await field.fill('');
    await field.press('ControlOrMeta+v');
    await expect(field).toHaveValue('1,200,000');

    // Junk that parses to the number already in the field must not linger
    // in the DOM either — state doesn't change, so the input syncs by hand.
    await page.evaluate(() => navigator.clipboard.writeText('total: $1,200,000!!'));
    await field.press('ControlOrMeta+a');
    await field.press('ControlOrMeta+v');
    await expect(field).toHaveValue('1,200,000');
  });

  test('quick-select chips set the amount', async ({ page }) => {
    await openEntry(page);
    const chip = page.getByRole('button', { name: /\$2M/ });
    await chip.click();
    await expect(page.locator('#amount')).toHaveValue('2,000,000');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  test('after-tax line swaps between fantasy and honest numbers', async ({ page }) => {
    await openEntry(page);
    await expect(page.locator('#tax-detail')).toContainText('Type a number');
    await page.getByRole('button', { name: /\$2M/ }).click();
    await expect(page.locator('#tax-detail')).toContainText('after taxes');
    await page.getByRole('button', { name: /spend that instead/i }).click();
    await expect(page.locator('#tax-detail')).toContainText('Spending the honest');
    await expect(page.locator('#tax-detail')).toContainText('%');
    await page.getByRole('button', { name: /back to the fantasy/i }).click();
    await expect(page.locator('#tax-detail')).toContainText('after taxes');
  });

  test('after-tax mode reduces the spendable total', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    await openEntry(page);
    await page.getByRole('button', { name: /\$2M/ }).click();
    await page.getByRole('button', { name: /spend that instead/i }).click();
    await page.getByRole('button', { name: /start spending/i }).click();
    const total = await page.locator('.stat').first().locator('dd').textContent();
    const value = Number(total!.replace(/[^0-9]/g, ''));
    expect(value).toBeGreaterThan(1_000_000);
    expect(value).toBeLessThan(2_000_000);
  });

  test('start is disabled at zero', async ({ page }) => {
    await openEntry(page);
    await page.locator('#amount').fill('');
    await expect(page.getByRole('button', { name: /start spending/i })).toBeDisabled();
  });
});

test.describe('board', () => {
  test('renders every item with a real optimised image', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('.card')).toHaveCount(42);
    await expect(page.locator('[role="tab"]')).toHaveCount(6);

    // AVIF first, WebP fallback, responsive candidates on both.
    const avif = page.locator('.card source[type="image/avif"]').first();
    await expect(avif).toHaveAttribute('srcset', /\.avif.*\d+w/);
    const webp = page.locator('.card source[type="image/webp"]').first();
    await expect(webp).toHaveAttribute('srcset', /\.webp.*\d+w/);

    // Intrinsic size present on every img — this is what prevents layout shift.
    const missingDims = await page.locator('.card img').evaluateAll((imgs) =>
      imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length
    );
    expect(missingDims).toBe(0);
  });

  test('defers offscreen images and prioritises the first row', async ({ page }) => {
    await startGame(page);
    const loading = await page.locator('.card img').evaluateAll((imgs) =>
      imgs.map((i) => i.getAttribute('loading'))
    );
    expect(loading.slice(0, 4).every((v) => v === 'eager')).toBe(true);
    expect(loading.slice(4).every((v) => v === 'lazy')).toBe(true);
  });

  test('the first card image actually decodes', async ({ page }) => {
    await startGame(page);
    const ok = await page.locator('.card img').first().evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
    );
    expect(ok).toBe(true);
  });

  test('required items from the brief are present', async ({ page }) => {
    await startGame(page);
    for (const id of ['camry', 'lexus-rx', 'range-rover', 'manhattan-beach', 'tahoe-cabin', 'aspen-chalet']) {
      await expect(page.locator(`.card[data-id="${id}"]`)).toHaveCount(1);
    }
  });
});

test.describe('cart', () => {
  test('adds, accumulates and removes with correct arithmetic', async ({ page }) => {
    await startGame(page);
    const camry = page.locator('.card[data-id="camry"]');
    const spent = page.locator('.stat').nth(1).locator('dd');
    const remaining = page.locator('.stat.remaining dd');

    await camry.locator('.hit').click();
    await expect(spent).toHaveText('$28,000');
    await expect(remaining).toHaveText('$12,372,000');

    await camry.locator('.hit').click();
    await expect(camry.locator('.qty')).toHaveText('2');
    await expect(spent).toHaveText('$56,000');

    await camry.locator('.rm').click();
    await expect(spent).toHaveText('$28,000');
  });

  test('drawer stepper stays in sync with the board', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();

    const drawer = page.locator('.drawer');
    await expect(drawer).toHaveClass(/on/);
    await expect(drawer.locator('.total strong')).toHaveText('$28,000');

    await drawer.getByRole('button', { name: /Add another Toyota Camry/ }).click();
    await expect(drawer.locator('.total strong')).toHaveText('$56,000');
    await expect(page.locator('.card[data-id="camry"] .qty')).toHaveText('2');

    await page.keyboard.press('Escape');
    await expect(drawer).not.toHaveClass(/on/);
  });

  test('cart thumbnails are lazy and sized', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="rolex"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();
    const thumb = page.locator('.drawer .thumb img').first();
    await expect(thumb).toHaveAttribute('loading', 'lazy');
    await expect(thumb).toHaveAttribute('width', '48');
  });
});

test.describe('overspending', () => {
  test('refuses the purchase and says so, then recovers', async ({ page }) => {
    await startGame(page, '100000');
    const remaining = page.locator('.stat.remaining dd');

    await page.locator('.card[data-id="private-island"] .hit').click();
    await expect(remaining).toContainText('broke');
    await expect(page.locator('.game')).toHaveClass(/shake/);
    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$0');

    await expect(remaining).toHaveText('$100,000', { timeout: 3000 });
    await expect(page.locator('.game')).not.toHaveClass(/shake/);
  });

  test('dims what you cannot afford without disabling it', async ({ page }) => {
    await startGame(page, '100000');
    const island = page.locator('.card[data-id="private-island"]');
    await expect(island).toHaveClass(/unaffordable/);
    await expect(island.locator('.hit')).toBeEnabled();
  });

  test('offers the summary once nothing is affordable', async ({ page }) => {
    await startGame(page, '30000');
    await page.locator('.card[data-id="camry"] .hit').click();
    await expect(page.locator('.nudge')).toHaveClass(/on/);
  });
});

test.describe('summary and sharing', () => {
  test('renders a painted share card', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await page.locator('.card[data-id="rolex"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();
    await page.getByRole('button', { name: /done spending/i }).click();

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const painted = await canvas.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let gold = 0, lit = 0;
      for (let i = 0; i < d.length; i += 4 * 97) {
        if (d[i]! > 200 && d[i + 1]! > 150 && d[i + 2]! < 120) gold++;
        if (d[i]! + d[i + 1]! + d[i + 2]! > 200) lit++;
      }
      return { gold, lit };
    });
    expect(painted.lit).toBeGreaterThan(200);
    expect(painted.gold).toBeGreaterThan(10);
  });

  test('a shared run replays exactly from the URL', async ({ page }) => {
    // Build the code with the same function the app uses, then cold-load it.
    const code = encodeRun(
      12_400_000,
      false,
      { camry: 2, rolex: 1 },
      ['camry', 'rolex'],
      items
    );

    await page.goto(`/?r=${code}`);
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.stat').first().locator('dd')).toHaveText('$12,400,000');
    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$94,000');
    await expect(page.locator('.card[data-id="camry"] .qty')).toHaveText('2');
    await expect(page.locator('.card[data-id="rolex"] .qty')).toHaveText('1');
  });

  test('a junk share code falls back to the entry screen', async ({ page }) => {
    await page.goto('/?r=obviously-not-a-run');
    await expect(page.locator('#amount')).toBeVisible();
  });

  test('the copy-link button reports success', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission is chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();
    await page.getByRole('button', { name: /done spending/i }).click();
    await page.getByRole('button', { name: /copy share link/i }).click();
    await expect(page.getByRole('button', { name: /link copied/i })).toBeVisible();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('?r=v1.');
  });

  test('start over returns to the entry screen', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();
    await page.getByRole('button', { name: /done spending/i }).click();
    await page.getByRole('button', { name: /start over/i }).click();
    await expect(page.locator('#amount')).toBeVisible();
  });
});

test.describe('accessibility and layout', () => {
  test('cards are keyboard operable and labelled', async ({ page }) => {
    await startGame(page);
    const hit = page.locator('.card[data-id="rolex"] .hit');
    await expect(hit).toHaveAttribute('aria-label', /Rolex Daytona.*\$38,000/);
    await hit.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$38,000');
  });

  test('images are decorative, so they carry empty alt', async ({ page }) => {
    await startGame(page);
    const bad = await page.locator('.card img').evaluateAll((imgs) =>
      imgs.filter((i) => i.getAttribute('alt') === null).length
    );
    expect(bad).toBe(0);
  });

  test('no horizontal overflow', async ({ page }) => {
    await startGame(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    );
    expect(overflow).toBe(true);
  });

  test('grid collapses to two columns on phones', async ({ page }) => {
    test.skip(!isMobile(page), 'mobile only');
    await startGame(page);
    const columns = await page.locator('.grid').first().evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length
    );
    expect(columns).toBe(2);
  });

  test('sticky tab rail sits flush under the topbar', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(300);
    const gap = await page.evaluate(() => {
      const bar = document.querySelector('.topbar')!.getBoundingClientRect();
      const tabs = document.querySelector('.tabs-wrap')!.getBoundingClientRect();
      return Math.abs(tabs.top - bar.bottom);
    });
    expect(gap).toBeLessThanOrEqual(2);
  });

  test('loads with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // The sandbox blocks Google Fonts; the message itself carries no URL, so
      // check where the failing request came from.
      const from = `${m.text()} ${m.location()?.url ?? ''}`;
      if (/fonts\.(googleapis|gstatic)/.test(from)) return;
      errors.push(from);
    });
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});
