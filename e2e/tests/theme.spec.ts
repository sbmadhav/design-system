import { test, expect, type Page } from './fixtures';

/* Color schemes: Daybreak (light) and Deep Space (dark). The page follows the system setting by default;
   the System / Daybreak / Deep Space switch overrides it, writes localStorage "theme" and survives a reload. */

const vars = (page: Page) => page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  return {
    coral: cs.getPropertyValue('--coral').trim().toUpperCase(),
    bg: cs.getPropertyValue('--bg').trim().toUpperCase(),
    body: getComputedStyle(document.body).backgroundColor,
    bodyImage: getComputedStyle(document.body).backgroundImage,
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  };
});

const pressed = (page: Page) => page.locator('.md-modes button[aria-pressed="true"]');

test('tokens apply and differ between the two schemes (system setting)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/');
  const light = await vars(page);
  expect(light.coral).toBe('#FF6B5B');
  expect(light.bg).toBe('#FFF8EE');
  expect(light.meta).toBe('#FFF8EE');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await vars(page)).coral).toBe('#FF8F87');
  // theme-color is updated by the page's matchMedia change listener, a moment after the CSS
  await expect.poll(async () => (await vars(page)).meta).toBe('#0A0B18');
  const dark = await vars(page);
  expect(dark.bg).toBe('#0A0B18');
  expect([dark.body, dark.bodyImage]).not.toEqual([light.body, light.bodyImage]);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await expect(pressed(page)).toHaveAttribute('data-mode', 'system');
});

test('mode switch sets data-theme, persists across reload, and System goes back to the device', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/');
  const html = page.locator('html');

  await page.locator('.md-modes button[data-mode="dark"]').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(pressed(page)).toHaveText('Deep Space');
  expect((await vars(page)).coral).toBe('#FF8F87');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(pressed(page)).toHaveAttribute('data-mode', 'dark');
  expect((await vars(page)).coral).toBe('#FF8F87');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.locator('.md-modes button[data-mode="light"]').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect((await vars(page)).coral).toBe('#FF6B5B');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  expect((await vars(page)).bg).toBe('#FFF8EE');

  await page.locator('.md-modes button[data-mode="system"]').click();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('');
  await page.reload();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  expect((await vars(page)).bg).toBe('#0A0B18'); // device is dark
});

test('the side-by-side previews keep their own scheme whatever the page is set to', async ({ page }) => {
  await page.goto('/design-system/');
  const chip = (cls: string) => page.locator(`${cls} .sw .chip-c`).first().evaluate(e => getComputedStyle(e).backgroundColor);
  for (const mode of ['light', 'dark']) {
    await page.locator(`.md-modes button[data-mode="${mode}"]`).click();
    expect(await chip('.mode-daybreak')).toBe('rgb(255, 248, 238)');
    expect(await chip('.mode-deep-space')).toBe('rgb(10, 11, 24)');
  }
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
