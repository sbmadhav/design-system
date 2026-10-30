import { test, expect, type Page } from './fixtures';

/* The shared site header (header.html + components.css + header.js), as the reference page and the template
   use it. Pages compose it at build time (compose.py), so the fixed parts must match header.html exactly. */

const FIXED = ['.md-brand svg', '#exploreBtn', '#themeBtn'];

async function partial(page: Page) {
  return page.evaluate(async () => {
    const src = await (await fetch('/design-system/header.html', { cache: 'no-store' })).text();
    const doc = new DOMParser().parseFromString(src, 'text/html');
    return Object.fromEntries(['.md-brand svg', '#exploreBtn', '#themeBtn'].map(s => [s, doc.querySelector(s)!.outerHTML]));
  });
}

for (const path of ['/design-system/', '/design-system/template.html']) {
  test(`${path} carries the shared header unchanged`, async ({ page }) => {
    await page.goto(path);
    const want = await partial(page);
    for (const sel of FIXED) {
      // explore.js adds aria-haspopup/aria-expanded and header.js sets the label and title at runtime
      const got = await page.locator(`.md-header ${sel}`).evaluate(e => {
        const c = e.cloneNode(true) as Element;
        for (const a of ['aria-haspopup', 'aria-expanded', 'aria-controls', 'aria-label', 'title']) c.removeAttribute(a);
        return c.outerHTML;
      });
      const clean = await page.evaluate(([html]) => {
        const t = document.createElement('template'); t.innerHTML = html;
        const c = t.content.firstElementChild!;
        for (const a of ['aria-haspopup', 'aria-expanded', 'aria-controls', 'aria-label', 'title']) c.removeAttribute(a);
        return c.outerHTML;
      }, [want[sel]]);
      expect(got, sel).toBe(clean);
    }
    await expect(page.locator('.md-header .md-brand')).toHaveAttribute('href', '/');
    await expect(page.locator('.md-header .md-brand')).toHaveAttribute('aria-label', 'Madhav, home');
  });
}

test('header layout matches the home page: sticky 66px bar, 40px round theme button, logo first', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/design-system/');
  const m = await page.evaluate(() => {
    const h = document.querySelector('.md-header')!, theme = document.getElementById('themeBtn')!;
    const cs = getComputedStyle(h), tcs = getComputedStyle(theme);
    return {
      position: cs.position, top: cs.top, height: document.querySelector('.md-header-in')!.getBoundingClientRect().height,
      z: cs.zIndex, border: cs.borderBottomWidth, theme: [theme.getBoundingClientRect().width, theme.getBoundingClientRect().height],
      radius: tcs.borderRadius, logo: document.querySelector('.md-brand svg')!.getBoundingClientRect().width,
      nav: getComputedStyle(document.querySelector('.md-header .md-nav')!).display,
    };
  });
  expect(m).toMatchObject({ position: 'sticky', top: '0px', height: 66, z: '50', border: '1px', theme: [40, 40], radius: '50%', logo: 34, nav: 'flex' });
  // Logo, then nav, then Explore, then the theme button, left to right
  const xs = await page.evaluate(() => ['.md-brand', '.md-nav', '#exploreBtn', '#themeBtn'].map(s => document.querySelector(s)!.getBoundingClientRect().left));
  expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  // Still sticky after scrolling
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.locator('.md-header').evaluate(e => e.getBoundingClientRect().top)).toBe(0);
});

test('section links hide below 1180px and the Explore button keeps the row', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/design-system/');
  await expect(page.locator('.md-header .md-nav')).toBeHidden();
  await expect(page.locator('#exploreBtn')).toBeVisible();
  await expect(page.locator('#themeBtn')).toBeVisible();
});

test('on phones the controls shrink: 36px theme button, icon-only Explore and Music, brand text hidden at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/design-system/');
  expect(await page.locator('#themeBtn').evaluate(e => e.getBoundingClientRect().width)).toBe(36);
  await expect(page.locator('#exploreBtn .xp-lbl')).toBeHidden();
  await expect(page.locator('#exploreBtn')).toHaveAccessibleName('Explore all pages');
  await expect(page.locator('.md-brand-t')).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.locator('.md-brand-t')).toBeHidden();
  await expect(page.locator('.md-brand')).toHaveAccessibleName('Madhav, home');
});

test('app tabs (.md-header--tabs) stay on screen: below 1180px they wrap onto their own rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/design-system/template.html');
  await page.evaluate(() => {
    const h = document.querySelector('.md-header')!;
    h.classList.add('md-header--tabs');
    const nav = document.createElement('nav');
    nav.className = 'md-nav'; nav.setAttribute('aria-label', 'App');
    nav.innerHTML = ['Home', 'Learn', 'Dojo', 'Arena', 'Games', 'Sutras', 'Watch', 'Guide'].map((t, i) => `<a href="#${t}"${i === 0 ? ' aria-current="page"' : ''}>${t}</a>`).join('');
    h.querySelector('.md-brand')!.after(nav);
  });
  const links = page.locator('.md-nav a');
  await expect(links).toHaveCount(8);
  for (const l of await links.all()) await expect(l).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  // The current tab is filled with ink
  const cur = await page.locator('.md-nav a[aria-current="page"]').evaluate(e => [getComputedStyle(e).backgroundColor, getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()]);
  const probe = await page.evaluate(c => { const s = document.createElement('i'); s.style.color = c; document.body.append(s); const v = getComputedStyle(s).color; s.remove(); return v; }, cur[1]);
  expect(cur[0]).toBe(probe);
});

test.describe('Music pill', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('shows a note, "Music" and an equalizer that moves while playing; the pill fills with ink', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/design-system/#components');
    const pill = page.locator('#demoMusic .md-music').first(), play = page.locator('#demoMusicBtn');
    await expect(pill.locator('svg').first()).toBeVisible();
    await expect(pill.locator('.md-music-lbl')).toHaveText('Music');
    await expect(pill.locator('.md-eq i')).toHaveCount(3);
    const bg = () => pill.evaluate(e => getComputedStyle(e).backgroundColor);
    const idle = await bg();
    const running = () => pill.evaluate(e => e.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
    expect(await running()).toBe(0);
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(bg).not.toBe(idle);
    await expect.poll(running).toBe(3);
    // The panel style (is-on on the pill) looks the same while playing
    const panel = page.locator('#demoMusic .md-music.is-on');
    expect(await panel.evaluate(e => getComputedStyle(e).backgroundColor)).toBe(await bg());
  });

  test('on phones only the note shows, and the button keeps its name', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/design-system/#components');
    await expect(page.locator('#demoMusicBtn .md-music-lbl')).toBeHidden();
    await expect(page.locator('#demoMusicBtn .md-eq')).toBeHidden();
    await expect(page.locator('#demoMusicBtn')).toHaveAccessibleName('Play music');
  });
});

test('in a tabs header on phones the Explore, theme and end controls stay together at the right', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/design-system/template.html');
  await page.evaluate(() => {
    const h = document.querySelector('.md-header')!;
    h.classList.add('md-header--tabs');
    const nav = document.createElement('nav');
    nav.className = 'md-nav'; nav.setAttribute('aria-label', 'App');
    nav.innerHTML = ['Home', 'Learn', 'Dojo', 'Arena'].map(t => `<a href="#${t}">${t}</a>`).join('');
    h.querySelector('.md-brand')!.after(nav);
  });
  const r = await page.evaluate(() => ['#exploreBtn', '#themeBtn', '.md-header-end'].map(s => { const b = document.querySelector(s)!.getBoundingClientRect(); return { left: b.left, right: b.right, mid: b.top + b.height / 2 }; }));
  // One 8px gap between each, on one row: no auto margin splits them
  expect(r[1].left - r[0].right).toBeCloseTo(8, 0);
  expect(r[2].left - r[1].right).toBeCloseTo(8, 0);
  expect(r[1].mid).toBeCloseTo(r[0].mid, 0);
  expect(r[2].mid).toBeCloseTo(r[1].mid, 0);
  expect(r[2].right).toBeLessThanOrEqual(390);
});
