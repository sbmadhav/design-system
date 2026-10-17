# Versioned design-system releases and a shared light-DOM header composed at build time

Status: accepted (owner decision D5, 2026-10-17). First release under it: 2.1.0.

Four repos make up sbmadhav.com (the main site, this design system, Vedic Math and the voice report), each deployed on its own by GitHub Pages. Until 2.0 they shared the design system through two unversioned files, `/design-system/tokens.css` and `/design-system/components.css`, and each copied the header out of `template.html` and then edited its copy. That gave two problems: the header drifted (four sites, four headers, three theme controls), and every push here restyled all four sites at once, with no way to hold one site back or roll one back alone.

So from 2.1.0:

1. **Every release is published twice.** `build.py` writes the published files (`tokens.css`, `tokens.json`, `components.css`, `header.html`, `music.html`, `header.js`, `compose.py`) to `/design-system/v/<version>/` as well as to `/design-system/`. A versioned copy never changes once it is on `main`: CI runs `build.py --check-immutable` against the base branch and fails if it would. The unversioned paths stay as "latest" for older pages and the main site's worker. `versions.json` lists every version.
2. **Sites pin a version** in their pages (`/design-system/v/2.1.0/tokens.css` and so on) and move to a new one in their own change, which they can review and roll back alone. Because the URLs are immutable, a service worker can precache them by hash and serve them cache first.
3. **The header is one design-system component**: `header.html` (markup with four slots: brand, nav, music, end), its CSS in `components.css` (`md-header`), and `header.js` (the theme button only). It is plain light DOM. Sites copy it into their pages **at build time** with `compose.py`, which keeps the page's slot content and re-renders everything else from the pinned partial, and can `--check` that a page is in step. The committed page always holds the complete header, so it shows without JavaScript, crawlers see the links, and there is no layout shift.
4. The Music pill (`music.html`, `md-music`) is part of the same contract: one look everywhere, each site keeps its own tracks and panel.

## Considered Options

- **Keep unversioned shared files** (2.0): rejected. One bad push breaks four sites at once and a site cannot stay on a known-good version.
- **Custom elements with Shadow DOM** (`<site-header>` rendering its own markup): rejected. Kid mode (`body.kidmode` swapping `.pro` and `.kid`), `html.motion-paused`, page focus styles and `@font-face` do not cross a shadow boundary cleanly, `:host-context()` is missing in Firefox and Safari, and a JavaScript-rendered header shows nothing without scripts and shifts the layout when it appears.
- **Module federation or another bundler feature**: rejected. None of the repos use a bundler, and adopting one to share a header is all cost.
- **One monorepo for the whole site**: rejected for now. It would end independent deploys and the per-repo Pages sites, and many branches are open in the app repos. Reconsider only if versioned pins become more work than they save.
- **Runtime fetch of the header partial** (like `/assets/explore.js` injects the Explore menu): rejected for the header, which is layout, for the same reasons as Shadow DOM rendering. Explore stays global and unversioned because it must list every page.

## Consequences

- Any change to a published file needs a new `version` in `tokens.json` (semver: new tokens or classes are minor, fixes are patch, renames or removals are major). Existing token names and classes keep working within a major version.
- Each consuming repo needs a small build step: fetch or vendor the pinned `header.html`, run `compose.py`, and (for the app with a service worker) precache the pinned files with their hashes. The voice report, which has no build, can commit the composed header and run `compose.py --check` in CI.
- A repo that forgets to move to a new version stays on the old look, visibly and on purpose. A CI warning when a pin is behind `versions.json` keeps that honest without forcing upgrades.
- The repo grows by one directory per release under `v/`. The files are small (tens of kilobytes), so this is fine for years; if it ever is not, old versions can move to a separate archive branch without changing their URLs.
- One theme control everywhere (owner decision D1): the round sun/moon button run by `header.js`, saving `theme` in localStorage only when the choice differs from the system. The System / Daybreak / Deep Space picker is gone; its CSS (`md-modes`) stays as the segmented control.
