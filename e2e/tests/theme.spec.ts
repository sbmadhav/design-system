import { test, expect, type Page } from './fixtures';

/* Color schemes: Daybreak (light) and Deep Space (dark). The page follows the system setting by default.
   The round sun/moon button in the shared header (header.js) is the one theme control on the site: a click
   switches scheme; a choice that differs from the system is saved in localStorage "theme" and set as
   <html data-theme>; switching back to match the system clears both. */

const vars = (page: Page) => page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  return {
    coral: cs.getPropertyValue('--coral').trim().toUpperCase(),
    bg: cs.getPropertyValue('--bg').trim().toUpperCase(),
    body: getComputedStyle(document.body).backgroundColor,
    bodyImage: getComputedStyle(document.body).backgroundImage,
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content')?.toUpperCase(),
  };
});
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('theme'));
const btn = (page: Page) => page.locator('#themeBtn');

test('tokens apply and differ between the two schemes (system setting)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/');
  const light = await vars(page);
  expect(light.coral).toBe('#EE7A63');
  expect(light.bg).toBe('#F6F7F9');
  expect(light.meta).toBe('#F6F7F9');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Switch to Deep Space (dark) scheme');
  await expect(btn(page)).toHaveAttribute('title', /following your system/);
  await expect(btn(page).locator('.md-theme-sun')).toBeVisible();
  await expect(btn(page).locator('.md-theme-moon')).toBeHidden();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await vars(page)).coral).toBe('#F08C77');
  // theme-color and the button label follow the system through header.js's matchMedia listener
  await expect.poll(async () => (await vars(page)).meta).toBe('#0F1218');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Switch to Daybreak (light) scheme');
  await expect(btn(page).locator('.md-theme-moon')).toBeVisible();
  const dark = await vars(page);
  expect(dark.bg).toBe('#0F1218');
  expect([dark.body, dark.bodyImage]).not.toEqual([light.body, light.bodyImage]);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});

test('the sun/moon button saves a choice that differs from the system and clears it when it matches again', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/');
  const html = page.locator('html');

  await btn(page).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await saved(page)).toBe('dark');
  expect((await vars(page)).coral).toBe('#F08C77');
  expect((await vars(page)).meta).toBe('#0F1218');
  await expect(btn(page)).toHaveAttribute('aria-label', 'Switch to Daybreak (light) scheme');
  await expect(btn(page)).not.toHaveAttribute('title', /following your system/);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect((await vars(page)).coral).toBe('#F08C77');

  // Back to light, which is what the system says: follow the system again
  await btn(page).click();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  expect(await saved(page)).toBe('');
  expect((await vars(page)).bg).toBe('#F6F7F9');
  await expect(btn(page)).toHaveAttribute('title', /following your system/);

  // With a dark system: one click saves light, the next clears it
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await vars(page)).bg).toBe('#0F1218');
  await btn(page).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect(await saved(page)).toBe('light');
  await page.reload();
  expect((await vars(page)).bg).toBe('#F6F7F9');
  await btn(page).click();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  expect(await saved(page)).toBe('');
  await page.reload();
  expect((await vars(page)).bg).toBe('#0F1218'); // device is dark
});

test('a switch fires the sitetheme event and records it with siteTrack', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/');
  await page.evaluate(() => {
    const w = window as unknown as { __events: unknown[]; __tracked: string[]; siteTrack: (a: string) => void };
    w.__events = []; w.__tracked = [];
    w.siteTrack = (a: string) => { w.__tracked.push(a); };
    document.addEventListener('sitetheme', ev => w.__events.push((ev as CustomEvent).detail));
  });
  await btn(page).click();
  await btn(page).click();
  const got = await page.evaluate(() => {
    const w = window as unknown as { __events: unknown[]; __tracked: string[] };
    return { events: w.__events, tracked: w.__tracked };
  });
  expect(got.events).toEqual([{ theme: 'dark', following: false }, { theme: 'light', following: true }]);
  expect(got.tracked).toEqual(['theme/dark', 'theme/light']);
});

test('the side-by-side previews keep their own scheme whatever the page is set to', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/');
  const chip = (cls: string) => page.locator(`${cls} .sw .chip-c`).first().evaluate(e => getComputedStyle(e).backgroundColor);
  for (const want of ['dark', 'light']) {
    await btn(page).click();
    if (want === 'dark') await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    else await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    expect(await chip('.mode-daybreak')).toBe('rgb(246, 247, 249)');
    expect(await chip('.mode-deep-space')).toBe('rgb(15, 18, 24)');
  }
});

test('the template uses the same theme button and storage key', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/template.html');
  await btn(page).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await saved(page)).toBe('dark');
  await page.goto('/design-system/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.md-modes button[data-mode]')).toHaveCount(0); // no 3-way picker any more
});

test('the reference page has no kid mode switch, and an existing kid mode setting still swaps .pro/.kid', async ({ page }) => {
  // The design system page does not render a kid mode switch (template.html does; see assets.spec.ts),
  // but copy written twice (the Explore button and menu) must follow body.kidmode.
  await page.goto('/design-system/');
  await expect(page.locator('#kidBtn')).toHaveCount(0);
  await page.locator('#exploreBtn').click();
  const pro = page.locator('#xpTitle .pro'), kid = page.locator('#xpTitle .kid');
  await expect(pro).toHaveText('Explore');
  await expect(pro).toBeVisible();
  await expect(kid).toBeHidden();
  await page.evaluate(() => document.body.classList.add('kidmode'));
  await expect(kid).toHaveText('Star map');
  await expect(kid).toBeVisible();
  await expect(pro).toBeHidden();
});
