import { test, expect } from './fixtures';

/* The v2.1 components on the reference page: dialog, toast, raised tile, input, progress, kicker, sr-only. */

test('dialog opens modally over a scrim and closes with its button and Escape', async ({ page }) => {
  await page.goto('/design-system/');
  const dlg = page.locator('#demoDialog');
  await page.locator('#demoDialogBtn').click();
  await expect(dlg).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Sutra of the day' })).toBeVisible();
  const look = await dlg.evaluate(e => ({
    backdrop: getComputedStyle(e, '::backdrop').backgroundColor,
    scrim: getComputedStyle(document.documentElement).getPropertyValue('--scrim').trim(),
    shadow: getComputedStyle(e).boxShadow,
  }));
  const scrim = await page.evaluate(c => { const s = document.createElement('i'); s.style.color = c; document.body.append(s); const v = getComputedStyle(s).color; s.remove(); return v; }, look.scrim);
  expect(look.backdrop).toBe(scrim);
  expect(look.shadow).not.toBe('none');
  await page.locator('#demoDialogX').click();
  await expect(dlg).toBeHidden();
  await page.locator('#demoDialogBtn').click();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('toasts never block taps: the stack and the toast pass pointer events through', async ({ page }) => {
  await page.goto('/design-system/');
  await page.locator('#demoToastBtn').click();
  const toast = page.locator('#demoToasts .md-toast').first();
  await expect(toast).toBeVisible();
  await expect(page.locator('#demoToasts')).toHaveAttribute('aria-live', 'polite');
  const pe = await page.evaluate(() => [getComputedStyle(document.getElementById('demoToasts')!).pointerEvents, getComputedStyle(document.querySelector('.md-toast')!).pointerEvents]);
  expect(pe).toEqual(['none', 'none']);
  const hit = await toast.evaluate(t => { const r = t.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && !t.contains(el); });
  expect(hit).toBe(true);
  await expect(toast).toHaveCount(0, { timeout: 6000 });
});

test('raised tiles lift on hover and toggle aria-pressed in a group', async ({ page }) => {
  await page.goto('/design-system/#components');
  const tiles = page.locator('#demoTiles .md-tile[aria-pressed]');
  const second = tiles.nth(1);
  const rest = await second.evaluate(e => getComputedStyle(e).boxShadow);
  test.skip(await page.evaluate(() => matchMedia('(hover: none)').matches), 'needs a hover-capable pointer');
  await second.hover();
  await expect.poll(() => second.evaluate(e => getComputedStyle(e).boxShadow)).not.toBe(rest);
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(tiles.first()).toHaveAttribute('aria-pressed', 'false');
});

test('inputs are labelled, progress bars show their value, the kicker and sr-only text work on their own', async ({ page }) => {
  await page.goto('/design-system/');
  await expect(page.getByLabel('Nickname')).toBeVisible();
  await page.getByLabel('Nickname').fill('Swift Otter');
  await expect(page.getByLabel('Nickname')).toHaveValue('Swift Otter');
  await expect(page.getByLabel('Grade')).toBeVisible();
  const bar = page.getByRole('progressbar', { name: 'Quest progress' });
  const ratio = await bar.evaluate(e => (e.firstElementChild as HTMLElement).getBoundingClientRect().width / e.getBoundingClientRect().width);
  expect(ratio).toBeCloseTo(0.6, 2);
  const kicker = page.locator('#components .demo-col > .md-kicker');
  expect(await kicker.evaluate(e => [getComputedStyle(e).textTransform, getComputedStyle(e).fontSize])).toEqual(['uppercase', '12.5px']);
  const sr = page.locator('.md-sr-only').first();
  expect(await sr.evaluate(e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height])).toEqual([1, 1]);
  await expect(page.getByText('Screen-reader-only text sits here', { exact: false })).toHaveCount(1);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`a selected fill tile keeps its category fill, AA text and a visible ring (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/design-system/');
    const tile = page.locator('#demoFillPressed');
    await expect(tile).toHaveAttribute('aria-pressed', 'true');
    const got = await tile.evaluate(e => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--cat-purple)';
      document.body.append(probe);
      const fill = getComputedStyle(probe).color;
      probe.remove();
      const cs = getComputedStyle(e), sub = getComputedStyle(e.querySelector('.md-tile-s')!);
      return { bg: cs.backgroundColor, fill, text: cs.color, sub: sub.color, shadow: cs.boxShadow };
    });
    expect(got.bg).toBe(got.fill); // the selected state does not replace the category colour
    const rgb = (s: string) => s.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const contrast = (a: string, b: string) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    expect(contrast(got.text, got.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(got.sub, got.bg)).toBeGreaterThanOrEqual(4.5);
    // Selection shows as a ring (three shadows: ledge, gap, ring) and not only through colour
    expect(got.shadow.split(/,(?![^(]*\))/).length).toBe(3);
    // The plain fill tile next to it has no ring
    const plain = await page.locator('#demoTiles .md-tile--fill[aria-pressed="false"]').evaluate(e => getComputedStyle(e).boxShadow);
    expect(plain.split(/,(?![^(]*\))/).length).toBe(1);
  });
}
