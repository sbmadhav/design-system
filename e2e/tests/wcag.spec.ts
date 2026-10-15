import type { Page } from '@playwright/test';
import { test, expect, openExplore } from './fixtures';

/* WCAG 2.1 AA checks axe cannot make: Pause motion (2.2.2), skip link (2.4.1), reflow at 320px
   (1.4.10), text spacing (1.4.12) and names that survive narrow layouts (4.1.2). */

const SPACING = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const looping = (page: Page) => page.evaluate(() => document.getAnimations()
  .filter(a => a.playState === 'running')
  .filter(a => { const t = a.effect!.getTiming(); return t.iterations === Infinity || Number(t.duration) * Number(t.iterations) > 5000; })
  .length);

test.describe('Pause motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the Explore menu switch stops the blob and Bolt, and is remembered', async ({ page }) => {
    await page.goto('/design-system/', { waitUntil: 'load' });
    await expect.poll(() => looping(page)).toBeGreaterThan(0);
    const dlg = await openExplore(page);
    await dlg.getByRole('button', { name: 'Pause motion' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveClass(/motion-paused/);
    expect(await looping(page)).toBe(0);
    await page.goto('/design-system/template.html', { waitUntil: 'load' });
    await expect(page.locator('html')).toHaveClass(/motion-paused/);
    await page.reload({ waitUntil: 'load' });
    expect(await looping(page)).toBe(0);
  });
});

test('skip link is the first stop and moves focus to the main content', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Safari does not move focus to links with Tab by default');
  await page.goto('/design-system/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#main')).toBeFocused();
});

for (const path of ['/design-system/', '/design-system/template.html']) {
  test(`${path} has no horizontal scroll at 320px, with or without text spacing`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(path, { waitUntil: 'load' });
    expect(await sideways(page)).toBe(0);
    await page.addStyleTag({ content: SPACING });
    expect(await sideways(page)).toBe(0);
    const box = await page.locator('.md-modes').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  });
}

test('the template kid mode switch keeps its name when its label is hidden on phones', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto('/design-system/template.html');
  await expect(page.getByRole('switch', { name: 'Kid mode' })).toBeVisible();
});
