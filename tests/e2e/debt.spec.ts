import { test, expect, type Page } from '@playwright/test';
import { encodeRun } from '../../src/lib/share-code';
import itemsJson from '../../src/data/items.json' with { type: 'json' };
import type { Item } from '../../src/lib/types';

const items = itemsJson as Item[];

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

/** Open the winnings dialog and commit a new jackpot. */
async function setWinnings(page: Page, amount: string) {
  await page.locator('.stat').first().getByRole('button').click();
  const field = page.locator('#winnings-amount');
  await expect(field).toBeVisible();
  await field.fill('');
  await field.pressSequentially(amount);
  await page.getByRole('button', { name: /update winnings/i }).click();
}

const remaining = (page: Page) => page.locator('.stat.remaining dd');
const banner = (page: Page) => page.locator('.topbar .debt');
const NAMES = /Whittaker|Carroll|Adams|Tyson|Hammer|Cage/;

test.describe('editing the winnings', () => {
  test('changing the amount leaves the cart alone', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();

    await setWinnings(page, '80000000');

    await expect(page.locator('.stat').first().locator('dd')).toHaveText('$80,000,000');
    await expect(page.locator('.card[data-id="camry"] .qty')).toHaveText('1');
    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$28,000');
  });

  test('cancelling changes nothing', async ({ page }) => {
    await startGame(page);
    await page.locator('.stat').first().getByRole('button').click();
    await page.locator('#winnings-amount').fill('');
    await page.locator('#winnings-amount').pressSequentially('999');
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('.stat').first().locator('dd')).toHaveText('$12,400,000');
  });

  test('escape closes the dialog', async ({ page }) => {
    await startGame(page);
    await page.locator('.stat').first().getByRole('button').click();
    await expect(page.locator('#winnings-amount')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#winnings-amount')).toHaveCount(0);
  });

  test('the dialog can start the whole thing over', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.locator('.stat').first().getByRole('button').click();
    await page.getByRole('button', { name: /start over from scratch/i }).click();
    await expect(page.locator('#amount')).toBeVisible();
  });
});

test.describe('going into the red', () => {
  test('lowering the winnings past what you spent puts you under', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();

    await setWinnings(page, '100000');

    await expect(remaining(page)).toHaveText(/^-\$/);
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toContainText(NAMES);
    await expect(banner(page)).toContainText(/in the hole/i);
  });

  /* The banner is a live region, so it has to already be in the accessibility
     tree when the deficit arrives — a region inserted along with its first
     content is routinely missed by NVDA and JAWS, and this is the one thing
     the app most wants announced. Empty it collapses to nothing. */
  test('the live region is mounted before there is anything to announce', async ({ page }) => {
    await startGame(page);
    await expect(banner(page)).toBeAttached();
    await expect(banner(page)).toHaveAttribute('role', 'status');
    await expect(banner(page)).toBeEmpty();
    await expect(banner(page)).not.toBeVisible(); // no padding, no children, no height

    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');

    await expect(banner(page)).toBeVisible();
  });

  /* "-$1,140,000 in the hole" is a double negative, and the winnings dialog
     already words the same figure positively. */
  test('states the deficit without a minus sign', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');

    await expect(banner(page).locator('strong')).toHaveText(/^\$[\d,]+ in the hole\.$/);
  });

  /* In the red every add is refused, so the transient "you're broke" swap would
     blank the deficit almost constantly — hiding the number being joked about. */
  test('a refused tap never hides the deficit', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');

    await page.locator('.card[data-id="camry"] .hit').click();
    await expect(page.locator('.game')).toHaveClass(/shake/);
    await expect(remaining(page)).toHaveText(/^-\$/);
    await expect(remaining(page)).not.toContainText(/broke/i);
  });

  /* "Nothing left you can afford" is about leftover money, and there is none. */
  test('the stuck nudge stays out of the way', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');
    await expect(page.locator('.nudge')).not.toHaveClass(/on/);
  });

  test('removing what you cannot afford climbs back out', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');
    await expect(banner(page)).toBeVisible();

    await page.locator('.card[data-id="aspen-chalet"] .rm').click();

    await expect(banner(page)).toBeEmpty(); // the region stays, the text goes
    await expect(remaining(page)).toHaveText('$100,000');
  });

  test('raising the winnings again also fixes it', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');
    await expect(banner(page)).toBeVisible();

    await setWinnings(page, '50000000');
    await expect(banner(page)).toBeEmpty(); // the region stays, the text goes
  });

  test('a deficit survives being shared', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lottery.tourSeen', '1'));
    const code = encodeRun(100_000, false, { 'aspen-chalet': 1 }, ['aspen-chalet'], items);
    await page.goto(`/?r=${code}`);

    await expect(page.locator('.topbar')).toBeVisible();
    await expect(remaining(page)).toHaveText(/^-\$/);
    await expect(banner(page)).toContainText(NAMES);
    await expect(page.locator('.card[data-id="aspen-chalet"] .qty')).toHaveText('1');
  });

  test('a deficit survives a refresh', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');
    const line = await banner(page).textContent();

    await page.reload();

    await expect(remaining(page)).toHaveText(/^-\$/);
    await expect(banner(page)).toHaveText(line!);
  });

  test('the tab rail still sits flush under the banner', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');
    await expect(banner(page)).toBeVisible();
    await page.waitForTimeout(400); // let the ResizeObserver republish --topbar-h

    const gap = await page.evaluate(() => {
      const bar = document.querySelector('.topbar')!.getBoundingClientRect();
      const rail = document.querySelector('.tabs-wrap')!.getBoundingClientRect();
      return rail.top - bar.bottom;
    });
    expect(Math.abs(gap)).toBeLessThanOrEqual(2);
  });
});

test.describe('clearing the cart', () => {
  test('takes two presses and then empties everything', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.locator('.card[data-id="rolex"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();

    // Scoped: the end of the board offers a "Clear cart" too.
    const drawer = page.locator('.drawer');
    await drawer.getByRole('button', { name: /^clear cart$/i }).click();
    await expect(drawer.getByRole('button', { name: /^press again$/i })).toBeVisible();
    await drawer.getByRole('button', { name: /^press again$/i }).click();

    await expect(page.locator('.drawer .empty')).toBeVisible();
    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$0');
    // The badge is always in the DOM, just scaled away — so check the count.
    await expect(page.locator('.card[data-id="camry"] .qty')).toHaveText('0');
    await expect(page.locator('.card[data-id="camry"]')).not.toHaveClass(/owned/);
  });

  test('disarms itself if you walk away', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.getByRole('button', { name: /^Cart/ }).click();

    const drawer = page.locator('.drawer');
    await drawer.getByRole('button', { name: /^clear cart$/i }).click();
    await expect(drawer.getByRole('button', { name: /^press again$/i })).toBeVisible();
    await expect(drawer.getByRole('button', { name: /^clear cart$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('is not offered anywhere when there is nothing to clear', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('.end').getByRole('button', { name: /clear/i })).toHaveCount(0);
    await expect(page.locator('.end')).toContainText(/picked none of them/i);
    await page.getByRole('button', { name: /^Cart/ }).click();
    await expect(page.locator('.drawer').getByRole('button', { name: /clear/i })).toHaveCount(0);
  });

  /* The third place it's offered: the bottom of the board, where you land after
     scrolling past everything. */
  test('the end of the board can clear the cart', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.locator('.card[data-id="rolex"] .hit').click();

    const end = page.locator('.end');
    await end.scrollIntoViewIfNeeded();
    await expect(end).toContainText(/2 things in the cart/i);

    await end.getByRole('button', { name: /^clear cart$/i }).click();
    await end.getByRole('button', { name: /press again to clear 2/i }).click();

    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$0');
    await expect(page.locator('.stat').first().locator('dd')).toHaveText('$12,400,000');
    await expect(end).toContainText(/picked none of them/i);
  });

  test('the end of the board also opens the summary', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.locator('.end').getByRole('button', { name: /see the damage/i }).click();
    await expect(page.locator('canvas')).toBeVisible();
  });

  /* The other place you'd look for it: the winnings dialog, where it sits
     between "change the amount" and "start over" as the middle rung. */
  test('the winnings dialog can empty the cart without touching the money', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="camry"] .hit').click();
    await page.locator('.card[data-id="rolex"] .hit').click();

    await page.locator('.stat').first().getByRole('button').click();
    await page.getByRole('button', { name: /clear the cart, keep the winnings/i }).click();
    await expect(page.getByRole('button', { name: /press again to clear 2 items/i })).toBeVisible();
    await page.getByRole('button', { name: /press again to clear 2 items/i }).click();

    await expect(page.locator('#winnings-amount')).toHaveCount(0);
    await expect(page.locator('.stat').first().locator('dd')).toHaveText('$12,400,000');
    await expect(page.locator('.stat').nth(1).locator('dd')).toHaveText('$0');
    await expect(page.locator('.stat.remaining dd')).toHaveText('$12,400,000');
  });

  test('the dialog offers nothing to clear on an empty cart', async ({ page }) => {
    await startGame(page);
    await page.locator('.stat').first().getByRole('button').click();
    await expect(page.getByRole('button', { name: /clear the cart/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /start over from scratch/i })).toBeVisible();
  });

  test('clearing from the dialog gets you out of the red', async ({ page }) => {
    await startGame(page);
    await page.locator('.card[data-id="aspen-chalet"] .hit').click();
    await setWinnings(page, '100000');
    await expect(banner(page)).toBeVisible();

    await page.locator('.stat').first().getByRole('button').click();
    await page.getByRole('button', { name: /clear the cart, keep the winnings/i }).click();
    await page.getByRole('button', { name: /press again to clear 1 item/i }).click();

    await expect(banner(page)).toBeEmpty(); // the region stays, the text goes
    await expect(page.locator('.stat.remaining dd')).toHaveText('$100,000');
  });
});
