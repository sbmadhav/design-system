import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures';

/* The reference page at /design-system/: it is generated from README.md and tokens.json by build.py,
   so these checks read tokens.json from this checkout and compare the live page against it. */

const REPO = path.resolve(__dirname, '..', '..');
const tokens = JSON.parse(readFileSync(path.join(REPO, 'tokens.json'), 'utf8'));
const COLORS: { name: string; value: { daybreak: string; 'deep-space': string } }[] = tokens.color.tokens;

test('reference page renders cleanly: headings, swatches and components', async ({ page, issues }) => {
  await page.goto('/design-system/');
  await expect(page).toHaveTitle(/design system/i);
  await expect(page.locator('h1')).toHaveText('Madhav');
  for (const h of ['Two modes, one system', 'Type scale', 'Components', 'Icons and mascot', 'How to use it']) {
    await expect(page.getByRole('heading', { level: 2, name: h }).first()).toBeVisible();
  }
  // One swatch per color token in each scheme
  await expect(page.locator('.mode-daybreak .sw')).toHaveCount(COLORS.length);
  await expect(page.locator('.mode-deep-space .sw')).toHaveCount(COLORS.length);
  // Component demos
  await expect(page.locator('#components .md-btn--primary').first()).toBeVisible();
  for (const sel of ['.md-chip', '.md-tag', '.md-switch', '.md-stat', '.md-card']) {
    await expect(page.locator(sel).first()).toBeAttached();
  }
  await expect(page.locator('#components .md-btn').first()).toBeVisible();
  // Every icon image on the page loaded (naturalWidth > 0)
  const broken = await page.locator('img').evaluateAll(imgs =>
    (imgs as HTMLImageElement[]).filter(i => i.complete && i.naturalWidth === 0).map(i => i.src));
  expect(broken).toEqual([]);
  await page.waitForLoadState('networkidle');
  expect(issues.console, 'console errors').toEqual([]);
  expect(issues.failed, 'failed requests').toEqual([]);
});

test('swatches show the tokens.json hex values and paint in that color in both schemes', async ({ page }) => {
  await page.goto('/design-system/');
  for (const [scheme, cls] of [['daybreak', '.mode-daybreak'], ['deep-space', '.mode-deep-space']] as const) {
    const shown = await page.locator(`${cls} .sw`).evaluateAll(sws => sws.map(sw => ({
      name: sw.querySelector('b')!.textContent!.trim(),
      hex: sw.querySelector('.md-mono')!.textContent!.trim().toUpperCase(),
      paint: getComputedStyle(sw.querySelector('.chip-c')!).backgroundColor,
    })));
    // Values are hex, rgba(...) or a reference to another token ("{sky-strong}", labelled "= sky-strong")
    const resolve = (v: string): string => v.startsWith('{') ? resolve(COLORS.find(c => c.name === v.slice(1, -1))!.value[scheme]) : v;
    const css = (v: string) => {
      if (v.startsWith('#')) {
        const h = v.slice(1);
        return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
      }
      const m = v.match(/rgba?\(([^)]+)\)/)!;
      const [r, g, b, a] = m[1].split(',').map(x => +x.trim());
      return a === undefined || a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
    };
    for (const t of COLORS) {
      const s = shown.find(x => x.name === t.name);
      expect(s, `${scheme} swatch for ${t.name}`).toBeTruthy();
      const v = t.value[scheme];
      const label = v.startsWith('{') ? `= ${v.slice(1, -1)}` : v;
      expect(s!.hex, `${scheme} ${t.name} label`).toBe(label.toUpperCase());
      expect(s!.paint, `${scheme} ${t.name} paint`).toBe(css(resolve(v)));
    }
  }
});

test('in-page navigation anchors have targets', async ({ page }) => {
  await page.goto('/design-system/');
  const hrefs = await page.locator('a[href^="#"]').evaluateAll(as => as.map(a => a.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of new Set(hrefs)) {
    if (h === '#') continue;
    await expect(page.locator(h), `target for ${h}`).toHaveCount(1);
  }
  // The header nav collapses below 1000px wide; use it where it is shown
  const navLink = page.locator('header nav a[href="#components"]');
  if (await navLink.isVisible()) await navLink.click();
  else await page.goto('/design-system/#components');
  await expect(page).toHaveURL(/#components$/);
  await expect(page.locator('#components')).toBeInViewport();
});

test('demo switch toggles aria-checked', async ({ page }) => {
  await page.goto('/design-system/');
  const sw = page.locator('#demoSwitch');
  const before = await sw.getAttribute('aria-checked');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', before ?? 'false');
});
