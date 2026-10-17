# Madhav design system

Tokens, components, the shared site header, a page template and the reference page for sbmadhav.com. GitHub Pages publishes this repo as a project site at https://sbmadhav.com/design-system/ (branch `main`), so a push to `main` changes the styles of every page on the site. Read `README.md` first: it is both the guidelines and the source of the reference page.

## Design rules

- Use tokens, never raw hex: `var(--coral)`, `var(--space-6)`, `var(--radius-lg)`, `font: var(--text-title)`. Text on accent fills uses `var(--on-accent)`, not white. Raw colours live only in `tokens.json`.
- Support both color schemes: Daybreak (light) and Deep Space (dark). System setting by default, with a saved override (`<html data-theme="light|dark">`). The one theme control is the round sun/moon button in the shared header (`header.js`); there is no System / Daybreak / Deep Space picker.
- Support kid mode: every piece of copy is written twice, `<span class="pro">` and `<span class="kid">`, swapped by `body.kidmode`. The layout never changes between them.
- Never use em dashes in copy. Use a period, comma or colon.
- Every pairing must meet WCAG 2.1 AA in both schemes (see Color in the README).

## Editing

- `tokens.json` and `README.md` are the sources. `tokens.css`, `index.html`, the header block of `template.html`, `v/<version>/` and `versions.json` are generated: never edit them by hand. After changing a source, run `python3 build.py` (needs `pip install markdown`) and commit the generated files with it.
- `components.css`, `header.html`, `music.html`, `header.js`, `compose.py` and the rest of `template.html` are hand-written. Keep them on tokens only.
- Versions (docs/adr/0001): every release is also published at `/design-system/v/<version>/` and never changes after it reaches `main`. Any change to a published file (`tokens.css`, `tokens.json`, `components.css`, `header.html`, `music.html`, `header.js`, `compose.py`) needs a new `version` in `tokens.json` (semver). Existing token names and classes keep working within a major version.
- The shared header is `header.html` with slots (brand, nav, music, end). Pages, this repo's included, compose it with `compose.py` at build time; never hand-edit a composed header outside its slots. No Shadow DOM.
- `README.md` becomes the reference page, except the repo docs after the `<!-- repo-only -->` marker (about the repo, contributing, license, thanks), which `build.py` leaves out. Keep design guidance above the marker.
- Paths are absolute and must not change: pages across sbmadhav.com (and other repos served under it) link `/design-system/tokens.css` and `/design-system/components.css`, and new pages pin `/design-system/v/<version>/...`.
- Fonts, the Explore menu (`/assets/explore.js`), analytics and the profile photo come from the sbmadhav.github.io repo. To add a font weight, add the file there and the face to `FONT_FACES` in `build.py` here.
- When a color changes, the home page of sbmadhav.github.io has inline copies of the colors: update `index.html` there and refresh its pinned tokens with `python3 scripts/check-tokens.py --refresh`.

## Checks

- `build.py` itself fails if a category colour misses AA (or two get too alike) in either scheme, if a token is missing from a scheme block of `tokens.css`, or if a hand-written file has a raw colour.
- Pre-commit hook in `.githooks/pre-commit`; enable it with `git config core.hooksPath .githooks`. It runs `build.py` and fails if that changed a file (stage the regenerated files and commit again).
- `.github/workflows/build.yml` runs the same check on pushes and pull requests to `main`, plus `build.py --check-immutable <base>` so a published version cannot change.
- `_config.yml` keeps `README.md`, `CLAUDE.md`, `build.py`, `e2e/`, `docs/`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE` and `LICENSE-CONTENT.md` out of the published site.

## End-to-end tests

- Every change that affects behavior updates or adds the matching Playwright test in `e2e/` in the same commit; run `cd e2e && npx playwright test` before pushing.
- Run them with `cd e2e && npm ci && npx playwright test` (first time: `npx playwright install chromium webkit`). They test the live site, https://sbmadhav.com/design-system/, by default; set `BASE_URL` to test another host. `node e2e/local-server.mjs` serves this checkout at http://localhost:8123/design-system/ (the rest from the live site) for `BASE_URL=http://localhost:8123`. A push to `main` lands before Pages deploys, so the workflow `.github/workflows/e2e.yml` waits for the deploy, then runs them; it also runs daily.
- Known live accessibility issues are `test.fixme` entries in `e2e/tests/a11y.spec.ts` (`KNOWN`); remove the entry when fixing one.
