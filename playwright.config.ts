import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against the real production build, not the dev server — image formats,
 * hashed asset URLs and hydration all differ there, and those are exactly the
 * things worth testing.
 */
/**
 * CHROMIUM_PATH lets a sandboxed or air-gapped environment reuse a
 * pre-installed browser instead of `npx playwright install`. Unset in CI.
 */
const executablePath = process.env.CHROMIUM_PATH || undefined;
const launchOptions = executablePath ? { executablePath } : {};

/** E2E_PORT dodges a clash when another dev server already owns 4321 —
 *  `reuseExistingServer` would otherwise silently test the wrong app. */
const port = Number(process.env.E2E_PORT) || 4321;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions } }
  ],
  webServer: {
    command: `npm run build && npx astro preview --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000
  }
});
