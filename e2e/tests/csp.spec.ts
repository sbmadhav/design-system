import { test, expect, type Page } from './fixtures';

/* Content-Security-Policy. build.py writes a <meta http-equiv="Content-Security-Policy"> into index.html, with
   the sha256 of each inline script. These tests use the reference page the way a reader does and fail on any
   securitypolicyviolation event. (template.html is a starting point copied into other repos, whose builds add
   their own policy, so it carries none.) */

async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e: SecurityPolicyViolationEvent) => {
      w.__csp.push(`${e.effectiveDirective || e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`);
    });
  });
  const console: string[] = [];
  page.on('console', m => { if (/Content.Security.Policy|Refused to/i.test(m.text())) console.push(m.text()); });
  return { console, list: () => page.evaluate(() => (window as any).__csp as string[]) };
}

test('the reference page carries the policy and runs with no violations', async ({ page }) => {
  const v = await watchViolations(page);
  await page.goto('/design-system/', { waitUntil: 'load' });
  const meta = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(meta).toHaveCount(1);
  const csp = (await meta.getAttribute('content'))!;
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toMatch(/'unsafe-eval'|gc\.zgo\.at/);
  expect(csp.split(';').find(d => d.trim().startsWith('script-src'))).not.toContain("'unsafe-inline'");
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin');

  // Both inline scripts ran: the mode buttons and the demo switch work
  await page.locator('.md-modes [data-mode="dark"]').first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#demoSwitch').click();
  await expect(page.locator('#demoSwitch')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#exploreBtn').click();
  await expect(page.locator('dialog.xpm')).toBeVisible();
  await page.keyboard.press('Escape');

  // GoatCounter as the shared analytics.js uses it (analytics is off on localhost): the main site's count.js,
  // then one request of each kind its beacon uses. The fixtures answer them locally, so nothing is counted.
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/assets/count.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('count.js did not load'));
    document.head.appendChild(s);
  }));
  await page.evaluate(() => {
    navigator.sendBeacon('https://sbmadhav.goatcounter.com/count?e2e=csp');
    new Image().src = 'https://sbmadhav.goatcounter.com/count?e2e=csp-img';
  });
  await page.waitForTimeout(2000);
  expect(await v.list(), 'securitypolicyviolation events').toEqual([]);
  expect(v.console, 'CSP console messages').toEqual([]);
});

test('the probe catches a violation (negative control)', async ({ page }) => {
  const v = await watchViolations(page);
  await page.goto('/design-system/', { waitUntil: 'load' });
  await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.__inline = 1'; document.body.appendChild(s); });
  await expect.poll(async () => (await v.list()).join(' ')).toMatch(/script-src/);
  expect(await page.evaluate(() => (window as any).__inline)).toBeUndefined();
});
