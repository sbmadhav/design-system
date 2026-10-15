import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

/* Shared fixtures for the sbmadhav.com end-to-end suite.
   - GoatCounter is answered locally (never reaches goatcounter.com) so test runs do not count as visits.
   - `issues` collects console errors, page errors and failed or 4xx/5xx requests for a page, so a
     test can assert that a page loaded cleanly. */

export const ANALYTICS = /(^https:\/\/[^/]*goatcounter\.com\/)|(^https:\/\/gc\.zgo\.at\/)/;

export async function blockAnalytics(ctx: BrowserContext | Page) {
  await ctx.route(ANALYTICS, route =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* analytics blocked in tests */' }));
}

export type Issues = { console: string[]; failed: string[] };

export const test = base.extend<{ issues: Issues }>({
  context: async ({ context }, use) => {
    await blockAnalytics(context);
    await use(context);
  },
  issues: async ({ page }, use) => {
    const issues: Issues = { console: [], failed: [] };
    page.on('console', m => { if (m.type() === 'error') issues.console.push(m.text()); });
    page.on('pageerror', e => issues.console.push(`pageerror: ${e.message}`));
    page.on('requestfailed', r => {
      const err = r.failure()?.errorText || '';
      // Navigations away and media cancelled by the browser are not failures
      if (ANALYTICS.test(r.url()) || /ERR_ABORTED|cancelled|NS_BINDING_ABORTED/i.test(err)) return;
      issues.failed.push(`${err} ${r.url()}`);
    });
    page.on('response', r => { if (r.status() >= 400 && !ANALYTICS.test(r.url())) issues.failed.push(`${r.status()} ${r.url()}`); });
    await use(issues);
  },
});

export { expect };

/** Opens the Explore menu and returns the dialog locator. */
export async function openExplore(page: Page) {
  await page.locator('#exploreBtn').click();
  const dlg = page.locator('dialog.xpm');
  await expect(dlg).toBeVisible();
  return dlg;
}

/** True when the run targets the live https site (service workers and analytics only run on https). */
export const isHttps = (baseURL?: string) => !!baseURL && baseURL.startsWith('https:');
