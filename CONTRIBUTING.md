# Contributing to the Madhav design system

Thanks for taking the time to help. This repo holds the tokens, components and page template behind every page on https://sbmadhav.com. A push to `main` restyles the whole site, so changes here are reviewed with care.

## What is welcome

- Accessibility fixes: contrast that misses WCAG 2.1 AA in either scheme, focus styles, reduced motion.
- Bug fixes in `components.css` and `template.html`, in either color scheme or in kid mode.
- Clearer guidelines in `README.md` (it is also the source of the reference page).
- Fixes to `build.py`.

## What is not

- A new look, new colors or new fonts without an issue first. The two schemes, Daybreak and Deep Space, are a deliberate design.
- Fonts or scripts from other hosts. Fonts are self-hosted by sbmadhav.github.io.
- Renaming or moving the published files. Every page links `/design-system/tokens.css` and `/design-system/components.css`.

## How a change gets merged

1. Fork the repo and create a branch from `main`.
2. Make the change and run the check below.
3. Open a pull request against `main` and fill in the checklist.

Every pull request needs:

- an approving review from the owner (@sbmadhav, the code owner of every file),
- passing checks (the `check` job in `.github/workflows/build.yml`),
- every review conversation resolved.

Nothing merges without the owner's approval. `main` deploys straight to the live site, so the branch is protected: no direct pushes from contributors, no force pushes. Workflows from forks wait for the owner's approval before they run.

## Local setup

You need Python 3 and the `markdown` package.

```sh
pip3 install markdown
git clone https://github.com/<you>/design-system.git
cd design-system
git config core.hooksPath .githooks   # turn on the pre-commit hook
python3 build.py
```

To preview with fonts and the site chrome, run `node e2e/local-server.mjs` and open http://localhost:8123/design-system/. It serves this checkout and takes everything else (fonts, the Explore menu) from the live site.

## Checks

| Check | Command |
|---|---|
| Generated files are current, contrast, token coverage, no raw colours | `python3 build.py && git diff --exit-code` |
| Published versions are unchanged | `python3 build.py --check-immutable origin/main` |
| End-to-end tests | `cd e2e && npm ci && npx playwright test` |

`tokens.json` and `README.md` are the sources; `tokens.css`, `index.html`, the header block in `template.html`, `v/<version>/` and `versions.json` are generated. Never edit the generated files by hand. Run `python3 build.py` and commit what it changes with your change. The pre-commit hook and CI both run this check.

Every release is also published at `/design-system/v/<version>/`, and a published version never changes. If your change touches a published file (`tokens.css`, `tokens.json`, `components.css`, `header.html`, `music.html`, `header.js`, `compose.py`), bump `version` in `tokens.json`: a patch for a fix, a minor version for anything new, a major version for a rename or removal. See `docs/adr/0001-versioned-releases-and-shared-header.md`.

If you change a color, say so in the pull request: the home page in sbmadhav.github.io keeps inline copies of the colors, and the owner updates them there.

## Tests

Every change that affects behavior updates or adds the matching Playwright test in `e2e/` in the same commit. Run `cd e2e && npx playwright test` before pushing (first time: `npm ci && npx playwright install chromium webkit`).

The tests run against the live https://sbmadhav.com/design-system/ by default. Set `BASE_URL` to test another host, such as the local server: `node e2e/local-server.mjs &` then `BASE_URL=http://localhost:8123 npx playwright test`.

## Style rules

- Use tokens, never raw hex, in `components.css`, `template.html`, `header.html` and `header.js`: `var(--coral)`, `var(--space-6)`, `var(--radius-lg)`, `font: var(--text-label)`. Text on accent fills uses `var(--on-accent)`. `build.py` fails on raw colours there.
- Support both color schemes: Daybreak (light) and Deep Space (dark).
- Support kid mode: copy is written twice, `<span class="pro">` and `<span class="kid">`, and the layout never changes between them.
- Every color pairing meets WCAG 2.1 AA in both schemes.
- Never use em dashes in copy. Use a period, comma or colon.

## Repo-only files

GitHub Pages publishes every file it is not told to skip. If you add a file that is not part of the published design system, add it to `exclude` in `_config.yml`.

## Security problems

Do not open a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE), the same license as the rest of this repo.
