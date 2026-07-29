import { test, expect, type Page } from '@playwright/test';
import { encodeRun } from '../../src/lib/share-code';
import itemsJson from '../../src/data/items.json' with { type: 'json' };
import type { Item } from '../../src/lib/types';

const items = itemsJson as Item[];

/** Start the game as a genuine first-time visitor — no seen flag. */
async function startFresh(page: Page, amount = '12400000') {
  await page.goto('/');
  // Entry hydrates client-side; typing before data-ready lands on dead HTML.
  await expect(page.locator('.entry[data-ready]')).toBeAttached();
  const field = page.locator('#amount');
  await field.fill('');
  await field.pressSequentially(amount);
  await page.getByRole('button', { name: /start spending/i }).click();
  await expect(page.locator('.topbar')).toBeVisible();
}

/** Start the game as a returning visitor. */
async function startSeen(page: Page, amount = '12400000') {
  await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
  await startFresh(page, amount);
}

test.describe('how-to-play tour', () => {
  test('auto-runs on the first visit and spotlights the stats', async ({ page }) => {
    await startFresh(page);
    const tour = page.locator('.tour[role="dialog"]');
    await expect(tour).toBeVisible();
    await expect(tour).toContainText('Step 1 of 3');
    await expect(tour).toContainText("Here's your fortune");

    // The spotlight cutout sits over the stats block.
    const overlaps = await page.evaluate(() => {
      const spot = document.querySelector('.spotlight')!.getBoundingClientRect();
      const stats = document.querySelector('[data-tour="stats"]')!.getBoundingClientRect();
      return (
        spot.left <= stats.left && spot.top <= stats.top &&
        spot.right >= stats.right && spot.bottom >= stats.bottom
      );
    });
    expect(overlaps).toBe(true);
  });

  /* The entry screen advertises Enter, and that keystroke outlives the screen
     it was pressed on: it used to reach the tour it had just opened — once as
     a keydown on window, once as a click on the primary button focus had
     moved to — and open a first run on step 3 with the first two steps burnt.
     Both paths start the same run, so both must start the same tour. */
  test('starting with Enter opens on the first step, like clicking does', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.entry[data-ready]')).toBeAttached();
    const field = page.locator('#amount');
    await field.fill('');
    await field.pressSequentially('12400000');
    await field.press('Enter');

    const tour = page.locator('.tour[role="dialog"]');
    await expect(tour).toBeVisible();
    await expect(tour).toContainText('Step 1 of 3');
    // Focus parks on the dialog, not on a button the same keystroke can press.
    expect(await page.evaluate(() => document.activeElement?.classList.contains('tour'))).toBe(true);
  });

  test('stepping through to the end returns control to the game', async ({ page }) => {
    await startFresh(page);
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.locator('.tour')).toContainText('Step 2 of 3');
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.locator('.tour')).toContainText('Step 3 of 3');
    await page.getByRole('button', { name: /got it/i }).click();
    await expect(page.locator('.tour')).toHaveCount(0);

    const seen = await page.evaluate(() => localStorage.getItem('lottery.tourSeen'));
    expect(seen).toBe('1');

    // The board is no longer inert — a purchase goes through.
    await page.locator('.card[data-id="camry"] .hit').click();
    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$28,000');
  });

  test('back returns to the previous step', async ({ page }) => {
    await startFresh(page);
    await page.getByRole('button', { name: /^next$/i }).click();
    await expect(page.locator('.tour')).toContainText('Step 2 of 3');
    await page.getByRole('button', { name: /^back$/i }).click();
    await expect(page.locator('.tour')).toContainText('Step 1 of 3');
  });

  test('skipping dismisses it for good', async ({ page }) => {
    await startFresh(page);
    await page.getByRole('button', { name: /skip the tour/i }).click();
    await expect(page.locator('.tour')).toHaveCount(0);

    // Even skipped counts as seen: refresh back to the landing page, start
    // another run, and it stays away. The tour flag outlives the run.
    await page.reload();
    await expect(page.locator('.entry[data-ready]')).toBeAttached();
    const field = page.locator('#amount');
    await field.fill('');
    await field.pressSequentially('2000000');
    await page.getByRole('button', { name: /start spending/i }).click();
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.tour')).toHaveCount(0);
  });

  test('keyboard drives it: arrows advance, Escape dismisses', async ({ page }) => {
    await startFresh(page);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.tour')).toContainText('Step 2 of 3');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.tour')).toContainText('Step 1 of 3');
    await page.keyboard.press('Escape');
    await expect(page.locator('.tour')).toHaveCount(0);
  });

  test('the help button replays it for returning visitors', async ({ page }) => {
    await startSeen(page);
    await expect(page.locator('.tour')).toHaveCount(0);

    const help = page.getByRole('button', { name: /how to play/i });
    await help.click();
    await expect(page.locator('.tour')).toContainText('Step 1 of 3');

    // Escape closes and hands focus back to the trigger.
    await page.keyboard.press('Escape');
    await expect(page.locator('.tour')).toHaveCount(0);
    await expect(help).toBeFocused();
  });

  test('never runs on a shared ?r= link', async ({ page }) => {
    const code = encodeRun(12_400_000, false, { camry: 1 }, ['camry'], items);
    await page.goto(`/?r=${code}`);
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.tour')).toHaveCount(0);
  });
});
