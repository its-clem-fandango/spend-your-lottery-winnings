import { test, expect, type Page } from '@playwright/test';
import { encodeRun } from '../../src/lib/share-code';
import itemsJson from '../../src/data/items.json' with { type: 'json' };
import type { Item } from '../../src/lib/types';

const items = itemsJson as Item[];

/* addInitScript re-runs on every navigation including reload, so the tour stays
   suppressed across the refreshes these tests are all about. */
async function startGame(page: Page, amount = '12400000') {
  await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
  await page.goto('/');
  await expect(page.locator('.entry[data-ready]')).toBeAttached();
  const field = page.locator('#amount');
  await field.fill('');
  await field.pressSequentially(amount);
  await page.getByRole('button', { name: /start spending/i }).click();
  await expect(page.locator('.topbar')).toBeVisible();
}

const winnings = (page: Page) => page.locator('.stat').first().locator('dd');
const spent = (page: Page) => page.locator('.stat').nth(1).locator('dd');

/**
 * Reload is the reset. Nothing about a run outlives the page, which is what
 * makes the first paint trustworthy: the entry screen is what the server
 * renders and what stays, so there is no state read after hydration that can
 * swap the screen out from under you.
 */
test.describe('refreshing starts over', () => {
  test('reloading returns to the landing page, cart and all', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await expect(spent(page)).toHaveText('$28,000');

    await page.reload();

    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('.topbar')).toHaveCount(0);
    // Empty, not merely hidden — the next run starts from nothing.
    await expect(page.locator('#amount')).toHaveValue('');
  });

  test('the landing page is the first paint, not a swap', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    /* Sampled every frame from navigation start: the board must never appear,
       which is the regression that made reloading show the entry screen for a
       beat and then replace it. */
    await page.addInitScript(() => {
      (window as unknown as { __sawBoard: boolean }).__sawBoard = false;
      const tick = () => {
        if (document.querySelector('.topbar')) {
          (window as unknown as { __sawBoard: boolean }).__sawBoard = true;
        }
        if (performance.now() < 3000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.goto('/');
    await expect(page.locator('.entry[data-ready]')).toBeAttached();
    await page.waitForTimeout(1200);

    const flashed = await page.evaluate(
      () => (window as unknown as { __sawBoard: boolean }).__sawBoard
    );
    expect(flashed).toBe(false);
  });

  test('a run saved by an older build is ignored, not restored', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lottery.tourSeen', '1');
      localStorage.setItem(
        'lottery.run.v1',
        JSON.stringify({
          v: 1,
          gross: 5_000_000,
          taxed: false,
          cart: { camry: 1 },
          order: ['camry']
        })
      );
    });
    await page.goto('/');
    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('.topbar')).toHaveCount(0);
  });

  test('storage someone has tampered with is still just a fresh visit', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lottery.tourSeen', '1');
      localStorage.setItem('lottery.run.v1', '{{{');
    });
    await page.goto('/');
    await expect(page.locator('#amount')).toBeVisible();
  });

  /* A share link is the one thing that still opens straight into a run — that
     is the whole point of sending one. */
  test('a share link opens into its run and hands it over', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    const code = encodeRun(2_000_000, false, { rolex: 1 }, ['rolex'], items);
    await page.goto(`/?r=${code}`);

    await expect(winnings(page)).toHaveText('$2,000,000');
    await expect(page.locator('.card[data-id="rolex"] .qty')).toHaveText('1');
    // The query is spent on arrival, so the run is yours to change.
    expect(new URL(page.url()).search).toBe('');
  });

  test('reloading a shared run returns to the landing page too', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    const code = encodeRun(12_400_000, false, { rolex: 1 }, ['rolex'], items);
    await page.goto(`/?r=${code}`);
    await expect(page.locator('.topbar')).toBeVisible();

    await page.reload();

    await expect(page.locator('#amount')).toBeVisible();
    await expect(page.locator('.topbar')).toHaveCount(0);
  });

  test('the tax choice is gone with everything else', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    await page.goto('/');
    await expect(page.locator('.entry[data-ready]')).toBeAttached();
    await page.locator('#amount').pressSequentially('12400000');
    await page.getByRole('button', { name: /spend that instead/i }).click();
    await page.getByRole('button', { name: /start spending/i }).click();

    const taxed = await winnings(page).textContent();
    expect(taxed).not.toBe('$12,400,000'); // the after-tax figure, whatever it is

    await page.reload();
    await expect(page.locator('#amount')).toBeVisible();
  });
});
