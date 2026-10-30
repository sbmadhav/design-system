import { test, expect } from './fixtures';

/* The v2.1 components on the reference page: dialog, toast, raised tile, input, progress, kicker, sr-only.
   The v2.2 ones: the button scale and the large button, actions row, popover, prose, table, footer, highlight,
   bare links and md-fill. */

const phone = (page: import('@playwright/test').Page, q: string) => page.evaluate(q => matchMedia(q).matches, q);

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

/* ---------- 2.2 ---------- */

test('buttons sit on the control scale: 40px by default (44px on phones), 32px small, 56px large', async ({ page }) => {
  await page.goto('/design-system/#components');
  const small = await phone(page, '(max-width: 600px)');
  const h = await page.evaluate(() => ['#demoBtn', '#demoBtnSm', '#demoLarge'].map(s => document.querySelector(s)!.getBoundingClientRect().height));
  expect(h[0]).toBe(small ? 44 : 40);
  expect(h[1]).toBe(32);
  expect(h[2]).toBeGreaterThanOrEqual(56);
  const lg = await page.locator('#demoLarge').evaluate(e => ({ weight: getComputedStyle(e).fontWeight, size: parseFloat(getComputedStyle(e).fontSize), icon: e.querySelector('svg')!.getBoundingClientRect().width }));
  expect(lg.weight).toBe('800');
  expect(lg.size).toBeGreaterThanOrEqual(19.2);
  expect(lg.size).toBeLessThanOrEqual(22.4);
  expect(lg.icon).toBeCloseTo(lg.size * 1.1, 0);
});

test('the large button keeps its pill shape under the focus ring', async ({ page, browserName }) => {
  await page.goto('/design-system/#components');
  const big = page.locator('#demoLarge');
  const before = await big.evaluate(e => getComputedStyle(e).borderRadius);
  expect(before).toBe('999px');
  // Keyboard focus: focus the control before it, then Tab (Option+Tab in WebKit, which skips buttons otherwise)
  await big.evaluate(e => (e.previousElementSibling as HTMLElement).focus());
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(big).toBeFocused();
  const after = await big.evaluate(e => { const cs = getComputedStyle(e); return { radius: cs.borderRadius, style: cs.outlineStyle, width: cs.outlineWidth, offset: cs.outlineOffset, visible: e.matches(':focus-visible') }; });
  expect(after).toEqual({ radius: '999px', style: 'solid', width: '3px', offset: '3px', visible: true });
});

test('the actions row wraps with 12px gaps on desktop and stacks full width on phones', async ({ page }) => {
  await page.goto('/design-system/#components');
  const stacked = await phone(page, '(max-width: 560px)');
  const m = await page.locator('#demoActions').evaluate(e => {
    const cs = getComputedStyle(e), b = [...e.querySelectorAll('.md-btn')].map(x => x.getBoundingClientRect());
    return { dir: cs.flexDirection, gap: cs.gap, widths: b.map(x => x.width), tops: b.map(x => x.top), box: e.getBoundingClientRect().width };
  });
  expect(m.gap).toBe('12px');
  if (stacked) { expect(m.dir).toBe('column'); for (const w of m.widths) expect(w).toBeCloseTo(m.box, 0); }
  else { expect(m.dir).toBe('row'); expect(new Set(m.tops).size).toBe(1); }
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the popover is a solid, named surface (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/design-system/#components');
    await expect(page.getByRole('dialog', { name: 'This is your belt' })).toBeVisible();
    const got = await page.locator('#demoPopover').evaluate(e => { const cs = getComputedStyle(e); return { bg: cs.backgroundColor, img: cs.backgroundImage, shadow: cs.boxShadow, overflow: cs.overflowY }; });
    const alpha = got.bg.match(/[\d.]+/g)!.map(Number)[3] ?? 1;
    expect(alpha, got.bg).toBe(1);
    expect(got.img).toContain('linear-gradient');
    expect(got.shadow).not.toBe('none');
    expect(got.overflow).toBe('auto');
  });
}

test('prose keeps to the measure, its headings come from the scale, and a bare link is ink with an underline', async ({ page }) => {
  await page.goto('/design-system/#components');
  const prose = page.locator('#demoProse');
  const kids = await prose.evaluate(e => [...e.children].map(c => { const cs = getComputedStyle(c); return { tag: c.tagName, max: parseFloat(cs.maxWidth), size: parseFloat(cs.fontSize), width: c.getBoundingClientRect().width }; }));
  expect(kids.map(k => k.tag)).toEqual(['H2', 'P', 'H3', 'UL', 'BLOCKQUOTE', 'HR', 'P']);
  for (const k of kids) {
    expect(k.max, `${k.tag} max-width is 40em`).toBeCloseTo(40 * k.size, 0);
    expect(k.width, `${k.tag} width`).toBeLessThanOrEqual(k.max + 1);
  }
  expect(kids[0].size).toBe(24); // h2 in prose is the title style
  expect(kids[2].size).toBe(20); // h3 is card-title
  const link = await prose.locator('a').first().evaluate(e => { const cs = getComputedStyle(e); return { color: cs.color, ink: getComputedStyle(document.body).color, line: cs.textDecorationLine, weight: cs.fontWeight }; });
  expect(link.color).not.toBe('rgb(0, 0, 238)');
  expect(link.color).toBe(link.ink);
  expect(link.line).toContain('underline');
  expect(link.weight).toBe('700');
});

test('the table is in the Tab order as a named region, and stacks with labels on phones', async ({ page }) => {
  await page.goto('/design-system/#components');
  const table = page.locator('#demoTable');
  await expect(table).toHaveAttribute('tabindex', '0');
  await expect(page.getByRole('region', { name: 'Belts, table' })).toBeVisible();
  await table.evaluate(t => {
    const all = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, [tabindex="0"]')].filter(e => e.offsetParent !== null);
    all[all.indexOf(t as HTMLElement) - 1].focus();
  });
  await page.keyboard.press('Tab');
  await expect(table).toBeFocused();
  const stacked = await phone(page, '(max-width: 560px)');
  const td = await table.locator('tbody td').first().evaluate(e => ({ display: getComputedStyle(e).display, before: getComputedStyle(e, '::before').content }));
  if (stacked) { expect(td.display).toBe('grid'); expect(td.before).toMatch(/Belt|attr\(data-label\)/); }
  else expect(td.display).toBe('table-cell');
});

test('footer links are bold ink, at least 36px tall, and underline only on hover', async ({ page }) => {
  await page.goto('/design-system/#components');
  const links = page.locator('#demoFoot a');
  expect(await links.count()).toBeGreaterThanOrEqual(3);
  for (const l of await links.all()) {
    const m = await l.evaluate(e => ({ h: e.getBoundingClientRect().height, line: getComputedStyle(e).textDecorationLine, weight: getComputedStyle(e).fontWeight }));
    expect(m.h).toBeGreaterThanOrEqual(36);
    expect(m.line).toBe('none');
    expect(m.weight).toBe('700');
  }
  await expect(page.locator('#demoFoot nav')).toHaveAttribute('aria-label', 'Site');
});

test('the highlight is one sun band in both schemes, and md-fill makes the page a column', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/#components');
  const band = () => page.locator('#demoHl .md-hl').evaluate(e => getComputedStyle(e).backgroundImage);
  const light = await band();
  expect(light).toContain('linear-gradient');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(band).not.toBe(light);
  expect(await band()).toContain('linear-gradient');
  await page.evaluate(() => document.body.classList.add('md-fill'));
  const fill = await page.evaluate(() => ({ display: getComputedStyle(document.body).display, dir: getComputedStyle(document.body).flexDirection, grow: getComputedStyle(document.querySelector('main')!).flexGrow }));
  expect(fill).toEqual({ display: 'flex', dir: 'column', grow: '1' });
});
