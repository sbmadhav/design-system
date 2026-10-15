import { test, expect, openExplore } from './fixtures';

/* The site-wide Explore menu, loaded from /assets/explore.js (sbmadhav.github.io repo).
   The "Install app" button is out of scope here. */

const REPO_URL = 'https://github.com/sbmadhav/design-system';

test('Explore opens with the button and closes with the close button, Esc and the backdrop', async ({ page }) => {
  await page.goto('/design-system/');
  const btn = page.locator('#exploreBtn');
  await expect(btn).toHaveAttribute('aria-haspopup', 'dialog');

  let dlg = await openExplore(page);
  await dlg.getByRole('button', { name: 'Close menu' }).click();
  await expect(dlg).toBeHidden();

  dlg = await openExplore(page);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();

  dlg = await openExplore(page);
  // The backdrop: top-left corner is outside the panel on desktop (right drawer) and phones (bottom sheet)
  await page.mouse.click(5, 5);
  await expect(dlg).toBeHidden();
  await expect(btn).toBeVisible();
});

test('Explore marks Design system as "You are here" and links every page', async ({ page }) => {
  await page.goto('/design-system/');
  const dlg = await openExplore(page);
  const here = dlg.locator('a.xp-page[aria-current="page"]');
  await expect(here).toHaveCount(1);
  await expect(here).toHaveAttribute('href', '/design-system/');
  await expect(here).toContainText('Design system');
  const label = await here.evaluate(e => getComputedStyle(e, '::after').content);
  expect(label).toBe('"You are here"');
  for (const href of ['/', '/state-of-voice-agents/', '/vedic-math/', '/design-system/']) {
    await expect(dlg.locator(`a.xp-page[href="${href}"]`)).toHaveCount(1);
  }
});

test('repo mark is hidden until hover and links to the design-system repo', async ({ page }) => {
  await page.goto('/design-system/');
  const dlg = await openExplore(page);
  const row = dlg.locator('.xp-row', { has: page.locator('a.xp-page[href="/design-system/"]') });
  const mark = row.locator('a.xp-repo');
  await expect(mark).toHaveAttribute('href', REPO_URL);
  await expect(mark).toHaveAttribute('target', '_blank');
  await expect(mark).toHaveAttribute('rel', /noopener/);
  // The home page lives in the main repo, so it has no mark
  await expect(dlg.locator('.xp-row', { has: page.locator('a.xp-page[href="/"]') }).locator('a.xp-repo')).toHaveCount(0);

  const opacity = () => mark.evaluate(e => +getComputedStyle(e).opacity);
  const noHover = await page.evaluate(() => matchMedia('(hover: none)').matches);
  if (noHover) {
    // Touch devices cannot hover, so the mark stays faintly visible
    await expect.poll(opacity).toBeCloseTo(0.18, 2);
    return;
  }
  await page.mouse.move(2, 2);
  await expect.poll(opacity).toBe(0);
  await row.locator('a.xp-page').hover();
  await expect.poll(opacity).toBeCloseTo(0.5, 2);
});

test('repo mark goes fully opaque and coral when hovered itself', async ({ page }) => {
  // explore.js intends `.xp-repo:hover{opacity:1;color:var(--coral)}`, but `.xp-row:hover .xp-repo`
  // (opacity .5) is more specific and the row is hovered too, so the mark stays at 0.5.
  await page.goto('/design-system/');
  test.skip(await page.evaluate(() => matchMedia('(hover: none)').matches), 'needs a hover-capable pointer');
  const dlg = await openExplore(page);
  const mark = dlg.locator('.xp-row', { has: page.locator('a.xp-page[href="/design-system/"]') }).locator('a.xp-repo');
  await mark.hover();
  const coral = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--coral').trim());
  await expect.poll(() => mark.evaluate(e => getComputedStyle(e).color)).not.toBe('');
  const color = await mark.evaluate((e, c) => {
    const probe = document.createElement('span'); probe.style.color = c; document.body.appendChild(probe);
    const want = getComputedStyle(probe).color; probe.remove();
    return { got: getComputedStyle(e).color, want };
  }, coral);
  expect(color.got).toBe(color.want);
  await expect.poll(() => mark.evaluate(e => +getComputedStyle(e).opacity)).toBe(1);
});
