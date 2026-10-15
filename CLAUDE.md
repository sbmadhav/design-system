# Madhav design system

Tokens, components, a page template and the reference page for sbmadhav.com. GitHub Pages publishes this repo as a project site at https://sbmadhav.com/design-system/ (branch `main`), so a push to `main` changes the styles of every page on the site. Read `README.md` first: it is both the guidelines and the source of the reference page.

## Design rules

- Use tokens, never raw hex: `var(--coral)`, `var(--space-6)`, `var(--radius-lg)`. Text on accent fills uses `var(--on-accent)`, not white.
- Support both color schemes: Daybreak (light) and Deep Space (dark). System setting by default, with a saved override (`<html data-theme="light|dark">`).
- Support kid mode: every piece of copy is written twice, `<span class="pro">` and `<span class="kid">`, swapped by `body.kidmode`. The layout never changes between them.
- Never use em dashes in copy. Use a period, comma or colon.
- Every pairing must meet WCAG 2.1 AA in both schemes (see Color in the README).

## Editing

- `tokens.json` and `README.md` are the sources. `tokens.css` and `index.html` are generated: never edit them by hand. After changing a source, run `python3 build.py` (needs `pip install markdown`) and commit the generated files with it.
- `components.css` and `template.html` are hand-written. Keep them on tokens only.
- Paths are absolute and must not change: pages across sbmadhav.com (and other repos served under it) link `/design-system/tokens.css` and `/design-system/components.css`.
- Fonts, the Explore menu (`/assets/explore.js`), analytics and the profile photo come from the sbmadhav.github.io repo. To add a font weight, add the file there and the face to `FONT_FACES` in `build.py` here.
- When a color changes, the home page of sbmadhav.github.io has inline copies of the colors: update `index.html` there and refresh its pinned tokens with `python3 scripts/check-tokens.py --refresh`.

## Checks

- Pre-commit hook in `.githooks/pre-commit`; enable it with `git config core.hooksPath .githooks`. It runs `build.py` and fails if that changed a file (stage the regenerated files and commit again).
- `.github/workflows/build.yml` runs the same check on pushes and pull requests to `main`.
- `_config.yml` keeps `README.md`, `CLAUDE.md`, `build.py` and `e2e/` out of the published site.

## End-to-end tests

- Every change that affects behavior updates or adds the matching Playwright test in `e2e/` in the same commit; run `cd e2e && npx playwright test` before pushing.
- Run them with `cd e2e && npm ci && npx playwright test` (first time: `npx playwright install chromium webkit`). They test the live site, https://sbmadhav.com/design-system/, by default; set `BASE_URL` to test another host. A push to `main` lands before Pages deploys, so the workflow `.github/workflows/e2e.yml` waits for the deploy, then runs them; it also runs daily.
- Known live accessibility issues are `test.fixme` entries in `e2e/tests/a11y.spec.ts` (`KNOWN`); remove the entry when fixing one.
