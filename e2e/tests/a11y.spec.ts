import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/* Accessibility: axe-core WCAG 2.x A/AA rules, failing on serious or critical issues.
   Runs in chromium only (axe results do not depend on the engine and the pass is slow).
   Known live violations are listed in KNOWN and tracked as test.fixme below, so they stay visible
   without hiding new regressions: the main tests fail on anything not in KNOWN. */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

type Known = { rule: string; target: string; note: string };
const KNOWN: Known[] = [];

const isKnown = (rule: string, target: string) => KNOWN.some(k => k.rule === rule && k.target === target);

async function serious(page: Page, include?: string) {
  let b = new AxeBuilder({ page }).withTags(TAGS);
  if (include) b = b.include(include);
  const r = await b.analyze();
  return r.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .flatMap(v => v.nodes.map(n => ({ rule: v.id, impact: v.impact, target: n.target.join(' '), summary: n.failureSummary })));
}

test.describe('accessibility', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium', 'axe runs once, in the chromium project'));

  for (const scheme of ['light', 'dark'] as const) {
    for (const url of ['/design-system/', '/design-system/template.html']) {
      test(`${url} has no serious or critical axe violations (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        const found = (await serious(page)).filter(v => !isKnown(v.rule, v.target));
        expect(found, JSON.stringify(found, null, 2)).toEqual([]);
      });
    }

    test(`Explore menu has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/design-system/');
      await page.locator('#exploreBtn').click();
      await expect(page.locator('dialog.xpm')).toBeVisible();
      const found = await serious(page, 'dialog.xpm');
      expect(found, JSON.stringify(found, null, 2)).toEqual([]);
    });

    test(`kid mode on template.html has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/design-system/template.html?kid');
      await expect(page.locator('body')).toHaveClass(/kidmode/);
      const found = await serious(page);
      expect(found, JSON.stringify(found, null, 2)).toEqual([]);
    });
  }

  test('code samples that scroll sideways can be reached and named from the keyboard', async ({ page }) => {
    await page.goto('/design-system/');
    const pres = page.locator('.guide pre');
    expect(await pres.count()).toBeGreaterThan(0);
    for (const pre of await pres.all()) {
      await expect(pre).toHaveAttribute('tabindex', '0');
      await expect(pre).toHaveAttribute('role', 'region');
      await expect(pre).toHaveAttribute('aria-label', /^Code sample: \S/);
    }
    await expect(page.getByRole('region', { name: 'Code sample: Typography' })).toBeVisible();
    await pres.first().focus();
    await expect(pres.first()).toBeFocused();
  });

  // Known live violations: each is a fixme naming the rule and element. Remove the entry from KNOWN
  // and this fixme once fixed; the test then runs and guards it.
  for (const k of KNOWN) {
    test(`known: ${k.rule} on ${k.target} (/design-system/)`, async ({ page }) => {
      test.fixme(true, `${k.rule} on "${k.target}": ${k.note}`);
      await page.goto('/design-system/');
      const found = (await serious(page)).filter(v => v.rule === k.rule && v.target === k.target);
      expect(found).toEqual([]);
    });
  }
});
