## What and why

<!-- One or two sentences. Link the issue if there is one. -->

## Checklist

- [ ] Ran `python3 build.py` and committed what it generated (`tokens.css`, `index.html`, `template.html`, `v/<version>/`, `versions.json`)
- [ ] Changed a published file? Bumped `version` in `tokens.json` (published versions under `v/` never change)
- [ ] Behavior changes update or add the matching Playwright test in `e2e/`, and `npx playwright test` passes
- [ ] Tokens only, no raw hex
- [ ] Tested in Daybreak (light) and Deep Space (dark), kid mode, and at 390px wide
- [ ] Color changes meet WCAG 2.1 AA in both schemes (and I said so above, so the home page copies can be updated)
- [ ] No em dashes in anything I wrote
- [ ] I agree my contribution is licensed under the MIT License (see CONTRIBUTING.md)
