import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Use the same host as the local Next dev server so client hydration and its
    // development websocket are accepted during interactive workflow tests.
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Local development uses the installed desktop Chromium. CI can run headless
    // after `npx playwright install chromium` has provisioned its browser runtime.
    headless: process.env.CI === 'true',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
