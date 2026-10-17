import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from './fixtures';

/* Tokens: every token in tokens.json is emitted by tokens.css (themed ones in each of the five scheme blocks),
   resolves in the browser in both schemes, and the category colours meet AA and stay distinct in both. */

const REPO = path.resolve(__dirname, '..', '..');
const T = JSON.parse(readFileSync(path.join(REPO, 'tokens.json'), 'utf8'));
const CSS = readFileSync(path.join(REPO, 'tokens.css'), 'utf8');
type Tok = { name: string; value: string | Record<string, string> };
const THEMED: string[] = [...T.color.tokens, ...T.shadow.tokens, ...T.theme.tokens, ...T.effect.tokens].map((t: Tok) => t.name);
const STATIC: string[] = ['spacing', 'radius', 'size', 'z', 'motion'].flatMap(g => T[g].tokens.map((t: Tok) => t.name));
type Style = { name: string };
const STYLES: { family: string; styles: Style[] }[] = T.type.groups;
const TYPE_STATIC = STYLES.flatMap(g => g.styles.flatMap(s => [`text-${s.name}-size`, `text-${s.name}-weight`, `text-${s.name}-leading`]));
const TYPE_THEMED = STYLES.filter(g => g.family === 'display').flatMap(g => g.styles.flatMap(s => [`text-${s.name}`, `text-${s.name}-tracking`]));
const TYPE_PLAIN = STYLES.filter(g => g.family !== 'display').flatMap(g => g.styles.flatMap(s => [`text-${s.name}`, `text-${s.name}-tracking`]));
const CATS: string[] = T.color.tokens.map((t: Tok) => t.name).filter((n: string) => /^cat-[a-z]+$/.test(n));

function block(re: RegExp) {
  const m = CSS.match(re);
  expect(m, String(re)).toBeTruthy();
  return new Set([...m![1].matchAll(/--([\w-]+):/g)].map(x => x[1]));
}

test.describe('tokens.css from this checkout', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium', 'file checks run once, in the chromium project'));

  test('every themed token is declared in all five scheme blocks, every static one in the static block', () => {
    const roots = [...CSS.matchAll(/^:root \{\n([\s\S]*?)^\}/gm)].map(m => new Set([...m[1].matchAll(/--([\w-]+):/g)].map(x => x[1])));
    expect(roots).toHaveLength(2);
    const [stat, daybreak] = roots;
    const blocks = {
      daybreak,
      'deep-space (system)': block(/:root:not\(\[data-theme="light"\]\) \{\n([\s\S]*?)^ {2}\}/m),
      'deep-space (data-theme)': block(/^:root\[data-theme="dark"\] \{\n([\s\S]*?)^\}/m),
      '.mode-daybreak': block(/^\.mode-daybreak \{\n([\s\S]*?)^\}/m),
      '.mode-deep-space': block(/^\.mode-deep-space \{\n([\s\S]*?)^\}/m),
    };
    for (const [label, names] of Object.entries(blocks)) {
      for (const n of [...THEMED, ...TYPE_THEMED, 'tracking-heading']) expect(names.has(n), `--${n} in ${label}`).toBe(true);
    }
    for (const n of [...STATIC, ...TYPE_STATIC, ...TYPE_PLAIN]) expect(stat.has(n), `--${n} in the static :root`).toBe(true);
    // v2.1 additions, named explicitly so a rename cannot slip through
    for (const n of ['space-1-5', 'space-2-5', 'space-3-5', 'space-4-5', 'radius-2xs', 'radius-xs', 'radius-bubble', 'z-header', 'z-popover', 'z-toast', 'z-overlay', 'z-skip', 'duration-fast', 'duration-medium', 'duration-slow', 'ease-spring', 'text-display-l-size', 'text-kicker', 'text-label', 'text-body'])
      expect(stat.has(n), `--${n}`).toBe(true);
    for (const n of ['scrim', 'media-black', 'shadow-ledge-hover', 'shadow-ledge-press', 'shadow-modal', 'shadow-glow', 'bolt-eye', 'bolt-glow', 'text-heading', 'text-h1', 'text-display'])
      expect(daybreak.has(n), `--${n}`).toBe(true);
    expect(CATS).toEqual(['cat-red', 'cat-orange', 'cat-yellow', 'cat-green', 'cat-blue', 'cat-purple']);
  });

  test('tokens.css carries the version from tokens.json', () => {
    expect(CSS).toContain(`version ${T.version}`);
  });
});

/* ---------- colour maths in the page ---------- */

const readColors = (page: Page, names: string[]) => page.evaluate(ns => {
  const probe = document.createElement('i');
  document.body.append(probe);
  const out: Record<string, number[]> = {};
  for (const n of ns) {
    probe.style.color = `var(--${n})`;
    const m = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
    out[n] = [m[0], m[1], m[2], m[3] ?? 1];
  }
  probe.remove();
  return out;
}, names);

const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const over = (fg: number[], bg: number[]) => [0, 1, 2].map(i => fg[3] * fg[i] + (1 - fg[3]) * bg[i]);
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function lab(c: number[]) {
  const [r, g, b] = c.map(lin);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dist = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

for (const scheme of ['light', 'dark'] as const) {
  test(`category colours meet AA and stay distinct (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/design-system/');
    const names = ['bg', 'bg-alt', 'card', 'on-accent', 'ink', ...CATS, ...CATS.map(c => `${c}-strong`)];
    const c = await readColors(page, names);
    const grounds = { bg: c.bg, 'bg-alt': over(c['bg-alt'], c.bg), card: over(c.card, c.bg) };
    for (const cat of CATS) {
      expect(contrast(c['on-accent'], c[cat]), `on-accent on ${cat}`).toBeGreaterThanOrEqual(4.5);
      for (const [g, gc] of Object.entries(grounds))
        expect(contrast(c[`${cat}-strong`], gc), `${cat}-strong on ${g}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const kind of ['', '-strong'])
      for (let i = 0; i < CATS.length; i++)
        for (let j = i + 1; j < CATS.length; j++)
          expect(dist(lab(c[CATS[i] + kind]), lab(c[CATS[j] + kind])), `${CATS[i]}${kind} vs ${CATS[j]}${kind}`).toBeGreaterThanOrEqual(20);
    // The labels on the reference page are real text on real fills
    const panel = scheme === 'light' ? '.mode-daybreak' : '.mode-deep-space';
    const pairs = await page.locator(`${panel} .cat-fill`).evaluateAll(els => els.map(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]));
    expect(pairs).toHaveLength(6);
    const rgb = (s: string) => s.match(/[\d.]+/g)!.map(Number);
    for (const [fg, bg] of pairs) expect(contrast(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5);
  });

  test(`every token resolves in the browser (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/design-system/');
    const all = [...THEMED, ...STATIC, ...TYPE_STATIC, ...TYPE_THEMED, ...TYPE_PLAIN, 'tracking-heading'];
    const empty = await page.evaluate(ns => ns.filter(n => !getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim()), all);
    expect(empty).toEqual([]);
    // A type token works as a font shorthand
    const title = await page.evaluate(() => {
      const el = document.createElement('p'); el.className = 'md-text-title'; el.textContent = 'x'; document.body.append(el);
      const cs = getComputedStyle(el); const r = [cs.fontSize, cs.fontWeight, cs.fontFamily]; el.remove(); return r;
    });
    expect(title[0]).toBe('24px');
    expect(title[1]).toBe('600');
    expect(title[2]).toMatch(scheme === 'light' ? /Fredoka/ : /Space Grotesk/);
  });
}

test('Bolt colours are the same in both schemes; scrim, shadows and heading tracking follow the scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system/');
  const pick = () => page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement), g = (n: string) => cs.getPropertyValue(`--${n}`).trim();
    const h = document.querySelector('.md-heading')!;
    return {
      bolt: ['bolt-body', 'bolt-screen', 'bolt-accent', 'bolt-belly', 'bolt-eye', 'bolt-line', 'media-black', 'media-ink'].map(g),
      themed: ['scrim', 'shadow-modal', 'shadow-glow', 'bolt-glow', 'tracking-heading', 'text-heading'].map(g),
      tracking: parseFloat(getComputedStyle(h).letterSpacing) / parseFloat(getComputedStyle(h).fontSize),
    };
  });
  const light = await pick();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(async () => (await pick()).themed[0]).not.toBe(light.themed[0]);
  const dark = await pick();
  expect(dark.bolt).toEqual(light.bolt);
  expect(light.bolt[4].toUpperCase()).toBe('#FFFFFF');
  dark.themed.forEach((v, i) => expect(v, `themed ${i}`).not.toBe(light.themed[i]));
  expect(light.tracking).toBeCloseTo(-0.01, 3);
  expect(dark.tracking).toBeCloseTo(-0.025, 3);
});
