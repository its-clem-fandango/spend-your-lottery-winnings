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

test.describe('surviving a refresh', () => {
  test('reloading keeps the run instead of dumping you on the landing page', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await expect(spent(page)).toHaveText('$28,000');

    await page.reload();

    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('#amount')).toHaveCount(0);
    await expect(winnings(page)).toHaveText('$12,400,000');
    await expect(spent(page)).toHaveText('$28,000');
    await expect(page.locator('.card[data-id="camry"] .qty')).toHaveText('1');
  });

  test('the tax choice survives too', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    await page.goto('/');
    await expect(page.locator('.entry[data-ready]')).toBeAttached();
    await page.locator('#amount').pressSequentially('12400000');
    await page.getByRole('button', { name: /spend that instead/i }).click();
    await page.getByRole('button', { name: /start spending/i }).click();

    const taxed = await winnings(page).textContent();
    expect(taxed).not.toBe('$12,400,000'); // the after-tax figure, whatever it is

    await page.reload();
    await expect(winnings(page)).toHaveText(taxed!);
  });

  test('a share link wins over whatever was saved', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await expect(spent(page)).toHaveText('$28,000');

    const code = encodeRun(2_000_000, false, { rolex: 1 }, ['rolex'], items);
    await page.goto(`/?r=${code}`);

    await expect(winnings(page)).toHaveText('$2,000,000');
    await expect(page.locator('.card[data-id="rolex"] .qty')).toHaveText('1');
    // The badge is always in the DOM, just scaled away — so check the count.
    await expect(page.locator('.card[data-id="camry"] .qty')).toHaveText('0');
  });

  /* Without stripping the query, ?r= would keep winning on every later refresh
     and silently discard anything bought after opening the link. */
  test('a shared run becomes yours once you add to it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    const code = encodeRun(12_400_000, false, { rolex: 1 }, ['rolex'], items);
    await page.goto(`/?r=${code}`);
    await expect(page.locator('.topbar')).toBeVisible();
    expect(new URL(page.url()).search).toBe('');

    await page.locator('.card[data-id="camry"] .hit').click();
    await page.reload();

    await expect(page.locator('.card[data-id="camry"] .qty')).toHaveText('1');
    await expect(page.locator('.card[data-id="rolex"] .qty')).toHaveText('1');
  });

  test('starting over wipes the saved run for good', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();
    await page.getByRole('button', { name: /done spending/i }).click();
    await page.locator('.actions').getByRole('button', { name: /start over/i }).click();

    await expect(page.locator('#amount')).toBeVisible();
    await page.reload();
    await expect(page.locator('#amount')).toBeVisible();
  });

  test('storage someone has tampered with degrades to a fresh visit', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lottery.tourSeen', '1');
      localStorage.setItem('lottery.run.v1', '{{{');
    });
    await page.goto('/');
    await expect(page.locator('#amount')).toBeVisible();
  });

  test('a stored run naming items that no longer exist still opens', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lottery.tourSeen', '1');
      localStorage.setItem(
        'lottery.run.v1',
        JSON.stringify({
          v: 1,
          gross: 5_000_000,
          taxed: false,
          total: 5_000_000,
          cart: { camry: 1, unicorn: 3 },
          order: ['camry', 'unicorn']
        })
      );
    });
    await page.goto('/');
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(spent(page)).toHaveText('$28,000');
  });
});
