import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures';

/* Published files: other pages across sbmadhav.com link these paths, so they must stay served.
   Pure HTTP checks, so they run once (chromium project). */

const REPO = path.resolve(__dirname, '..', '..');
const ICONS = readdirSync(path.join(REPO, 'icons')).filter(f => f.endsWith('.svg')).sort();

test.describe('published files', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium', 'HTTP-only checks run once, in the chromium project'));

  for (const f of ['tokens.css', 'components.css']) {
    test(`${f} is served as CSS`, async ({ request }) => {
      const r = await request.get(`/design-system/${f}`);
      expect(r.status()).toBe(200);
      expect(r.headers()['content-type']).toMatch(/^text\/css/);
      const body = await r.text();
      expect(body.length).toBeGreaterThan(500);
      if (f === 'tokens.css') {
        expect(body).toContain('--coral');
        expect(body).toMatch(/prefers-color-scheme:\s*dark/);
        expect(body).toContain('[data-theme="dark"]');
      }
    });
  }

  test('tokens.json is published and parses (the main site color check reads it)', async ({ request }) => {
    const r = await request.get('/design-system/tokens.json');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.color.themes.map((t: { id: string }) => t.id)).toEqual(['daybreak', 'deep-space']);
    expect(j.color.tokens.length).toBeGreaterThan(10);
    // Each value is a hex color, an rgba() color or a {reference} to another token
    const names = j.color.tokens.map((t: { name: string }) => t.name);
    for (const t of j.color.tokens) {
      for (const scheme of ['daybreak', 'deep-space']) {
        const v: string = t.value[scheme];
        if (v.startsWith('{')) expect(names, `${t.name} ${scheme} -> ${v}`).toContain(v.slice(1, -1));
        else expect(v, `${t.name} ${scheme}`).toMatch(/^(#[0-9A-Fa-f]{6}|rgba\([\d.,\s]+\))$/);
      }
    }
    // The live file is the committed one
    expect(j).toEqual(JSON.parse(readFileSync(path.join(REPO, 'tokens.json'), 'utf8')));
  });

  test(`every icon in icons/ is served (${ICONS.length} files)`, async ({ request }) => {
    expect(ICONS.length).toBeGreaterThan(0);
    const results = await Promise.all(ICONS.map(async f => {
      const r = await request.get(`/design-system/icons/${f}`);
      return { f, status: r.status(), type: r.headers()['content-type'] || '', body: await r.text() };
    }));
    for (const x of results) {
      expect(x.status, x.f).toBe(200);
      expect(x.type, x.f).toMatch(/^image\/svg\+xml/);
      expect(x.body, x.f).toContain('<svg');
    }
  });

  test('icons referenced by index.html and README.md exist in icons/', async () => {
    const src = readFileSync(path.join(REPO, 'index.html'), 'utf8') + readFileSync(path.join(REPO, 'README.md'), 'utf8');
    const refs = [...new Set([...src.matchAll(/icons\/([\w-]+\.svg)/g)].map(m => m[1]))];
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(ICONS, `icons/${r}`).toContain(r);
  });

  test('every font face in tokens.css is served from the main site', async ({ request }) => {
    const css = await (await request.get('/design-system/tokens.css')).text();
    const fonts = [...new Set([...css.matchAll(/url\((\/assets\/fonts\/[^)]+)\)/g)].map(m => m[1]))];
    expect(fonts.length).toBeGreaterThanOrEqual(4);
    for (const f of fonts) {
      const r = await request.get(f);
      expect(r.status(), f).toBe(200);
      expect(r.headers()['content-type'], f).toMatch(/font\/woff2|application\/(font-woff2|octet-stream)/);
    }
  });

  test('repo-only files are not published (_config.yml exclude)', async ({ request }) => {
    for (const f of ['README.md', 'CLAUDE.md', 'build.py', 'e2e/package.json', 'e2e/playwright.config.ts']) {
      expect((await request.get(`/design-system/${f}`)).status(), f).toBe(404);
    }
  });
});

test('template.html renders and its kid mode switch swaps copy and persists', async ({ page, issues }) => {
  await page.goto('/design-system/template.html');
  await expect(page.locator('.md-heading')).toBeVisible();
  const pro = page.locator('.md-heading .pro'), kid = page.locator('.md-heading .kid');
  const btn = page.locator('#kidBtn');
  await expect(pro).toBeVisible();
  await expect(kid).toBeHidden();
  await expect(btn).toHaveAttribute('aria-checked', 'false');
  await btn.click();
  await expect(page.locator('body')).toHaveClass(/kidmode/);
  await expect(btn).toHaveAttribute('aria-checked', 'true');
  await expect(kid).toBeVisible();
  await expect(pro).toBeHidden();
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/kidmode/);
  await expect(kid).toBeVisible();
  await page.locator('#kidBtn').click();
  await expect(page.locator('body')).not.toHaveClass(/kidmode/);
  await page.reload();
  await expect(pro).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(issues.console, 'console errors').toEqual([]);
  expect(issues.failed, 'failed requests').toEqual([]);
});

test('fonts and the Explore script load on the reference page', async ({ page }) => {
  const seen = new Map<string, number>();
  page.on('response', r => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/assets/fonts/') || u.pathname === '/assets/explore.js') seen.set(u.pathname, r.status());
  });
  await page.goto('/design-system/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  expect(seen.get('/assets/explore.js')).toBe(200);
  for (const f of ['/assets/fonts/fredoka-latin-600-normal.woff2', '/assets/fonts/nunito-sans-latin-wght-normal.woff2']) {
    expect(seen.get(f), f).toBe(200);
  }
  // check() alone is true when no face matches, so also require a loaded FontFace per family
  const loaded = await page.evaluate(() => {
    const ok = (fam: string) => [...document.fonts].some(f => f.family.replace(/"/g, '') === fam && f.status === 'loaded');
    return { fredoka: ok('Fredoka'), nunito: ok('Nunito Sans') };
  });
  expect(loaded).toEqual({ fredoka: true, nunito: true });
});
