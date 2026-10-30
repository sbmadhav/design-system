import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for the design system at sbmadhav.com/design-system/. They run against the LIVE
// site and its real dependencies (fonts and the Explore menu come from the sbmadhav.github.io repo)
// by default. Point them elsewhere with BASE_URL, for example a staging host that serves the same paths:
//   BASE_URL=http://127.0.0.1:8123 npx playwright test
export const BASE_URL = (process.env.BASE_URL || 'https://sbmadhav.com').replace(/\/$/, '');

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 3 : 6,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
