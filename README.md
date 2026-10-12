# Madhav design system

The design system behind sbmadhav.com: professional enough for recruiters, fun enough for kids. Every new page should feel like part of the same site, in both color schemes, in both grown-up and kid mode.

## Start a new page

1. Copy [`template.html`](template.html) to the new page's folder (for example `/projects/index.html`).
2. Keep its `<head>` as is: the theme script, the Google Fonts link, `/design-system/tokens.css` and `/design-system/components.css`, in that order.
3. Write every piece of copy twice: `<span class="pro">…</span><span class="kid">…</span>`.
4. Build from the components below; add page-specific styles with tokens only (`var(--coral)`, `var(--space-6)`, `var(--radius-lg)`), never raw hex.
5. Check both schemes (sun/moon button), kid mode, a 390px-wide phone, and reduced motion before publishing.

## Files

| File | What it is |
|---|---|
| `tokens.json` | The source of truth: every color (both schemes), type style, spacing step, radius and shadow, each with a usage note. |
| `tokens.css` | The same tokens as CSS custom properties, with Daybreak as default and Deep Space for `prefers-color-scheme: dark` or `data-theme="dark"`. Regenerate it when `tokens.json` changes. |
| `components.css` | The `md-` components plus page basics (`md-page`, `md-wrap`, `md-section`, `md-band`, `md-grid`) and the kid-mode `.pro` / `.kid` swap. |
| `template.html` | A starter page wired up with the scheme toggle and kid mode. |
| `icons/` | The 18 line icons and Bolt the mascot as SVG files. |

The interactive version of this system, with live previews of every component, is kept privately in Claude.

## Principles

- **Two audiences, one page.** Every piece of copy has a grown-up version and a kid version. The layout never changes between them; only the words do.
- **Two schemes, two personalities.** Daybreak (light) is a warm, sunny paper notebook. Deep Space (dark) is a neon night sky. They should surprise people with how different they feel, while every component stays in the same place.
- **Friendly, never childish.** Rounded shapes, chunky borders and a solid "ledge" under controls make things feel touchable. Restraint in copy and layout keeps it professional.
- **Play is opt-in.** Music, motion and games never start on their own. Everything respects reduced-motion settings.
- **Show, then tell.** Prefer an interactive demo (Brain Lab, Design Lab) over a paragraph that explains an idea.

## Content fundamentals

- **Voice:** first person, warm, plain words, dry humor in grown-up mode ("Zero-defect release. Principal engineer energy."), wonder in kid mode ("Whoa! We just blasted into deep space!").
- **Never use em dashes.** Use a period, comma or colon instead.
- **Short.** Ledes are one or two sentences. Card descriptions fit in two lines.
- **Grown-up copy** names real things: titles, metrics, technologies. **Kid copy** names what it does: "builds robot helpers for a really big bank."
- **Sentence case** for headings and buttons. Uppercase only for kickers (`kicker` style).
- **Numbers** in stats are big and specific: `17`, `2 → 25`, `+25%`, `$70M+`.

## Color

Use tokens, never raw hex. Each token has a Daybreak and a Deep Space value; switching scheme swaps every value at once.

| Role | Token | Daybreak | Deep Space |
|---|---|---|---|
| Page ground | `bg` | warm cream | near-black indigo |
| Section bands | `bg-alt` | peach | deep indigo |
| Cards | `card` | white | translucent indigo (blur behind) |
| Text | `ink` / `ink-muted` | navy / slate | lavender white / lilac |
| Control border | `edge` | navy | violet |
| Control ledge | `ledge` (in `shadow-ledge`) | navy | hot pink |
| Signature | `coral` | coral | hot pink |
| Success | `teal` | teal | aqua |
| Highlight | `sun` | gold | lime |
| Info, focus | `sky` | blue | electric blue |
| Play | `plum` | purple | violet |
| Text on accent fills | `on-accent` | navy | near-black |

**Page background** is a gradient, not a flat fill: a soft sun glow top right and a faint sky glow left in Daybreak; violet, aqua and pink nebulae in Deep Space. It ships as `--page` in `tokens.css`; use `background: var(--page); background-attachment: fixed;` on `body`.

**Accent rules**
- In Daybreak, `coral` and `teal` are fills only. As text on cream they fail contrast (2.7:1 and 2.9:1). In Deep Space every accent works as text.
- Text on any accent fill uses `on-accent`, never white. White on coral is 2.8:1, on teal 3.1:1, on sky 3.2:1: all fail.
- No more than five colors in one composition. One accent leads; others support.
- Section tags take one accent each: `sun` for About, `sky` for Brain Lab, `coral` for Bug Hunt, `plum` for games, `teal` for Journey.

> **Known issue on the live site:** the primary buttons and some section tags currently use white text on coral, teal, sky and plum in Daybreak, which fails WCAG AA. New pages use `on-accent`. The live page should be updated to match.

## Typography

Four families, all from Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Space+Grotesk:wght@500;600;700&family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
```

- **Display** is Fredoka in Daybreak and **Space Grotesk in Deep Space.** `tokens.css` swaps it through one variable, `--display`; every heading uses `font-family: var(--display)`. This font swap is a big part of why the two schemes feel so different.
- **Nunito Sans** for all body text, buttons and labels.
- **JetBrains Mono** for agent thoughts, code, costs and disclaimers.
- Headings are weight 600, tracked in slightly (-0.01em; -0.025em in Deep Space). Body is 17px at 1.6.
- Highlight one word in a hero heading with a `sun` underline band (Daybreak) or a coral-to-teal gradient fill (Deep Space). Use it once per page.

## Layout and spacing

- Content max width `content-max` (1120px), gutter `space-6` (24px), `space-4` (16px) on phones.
- Every section: `space-section` (72px) top and bottom padding; alternate plain sections with `bg-alt` bands that have a 1px `line` top and bottom.
- Section header: a tag, a `heading`, then a `lede` in `ink-muted` at most 40em wide, then `space-7` (28px) before content.
- Cards in grids: 4 across on desktop, 2 under 980px, 1 under 560px.
- No horizontal scroll at 390px. The sticky header collapses its nav links under 1180px and keeps the scheme, music and kid-mode controls.

## Shape and depth

- Radius ladder: `radius-sm` 12, `radius-md` 16, `radius-lg` 22, `radius-xl` 28, `radius-pill`.
- Raised controls (buttons, chips, palette blocks, game boards) get a 2px `edge` border and a solid `shadow-ledge`. They lift on hover and press down on click.
- Cards and panels get a 1px `line` border, `shadow-card`, and lift 4px with a tiny tilt (-0.4deg) on hover.
- Deep Space adds `backdrop-filter: blur(8px)` to cards and controls so the starfield shows through softly.

## Motion

- Gentle and looping: Bolt bobs (3.4s), planets drift (45 to 130s per crossing), stars twinkle, the hero blob morphs (12s).
- Springy UI: toggles and level nodes use `cubic-bezier(.5,1.6,.5,1)`.
- Sections fade up 18px on first scroll into view.
- `prefers-reduced-motion: reduce` turns all of it off. Nothing essential may depend on motion.

## Interaction patterns

- **Kid mode:** write both versions side by side as `<span class="pro">…</span><span class="kid">…</span>`; `body.kidmode` swaps them. Remember the choice; `?kid` in the URL starts in kid mode.
- **Color scheme:** follow the system by default. The sun/moon button overrides it and saves `light` or `dark`; toggling back to match the system clears the override. Set `data-theme` from a tiny inline script in `<head>` to avoid a flash.
- **Bolt** (the robot mascot) reacts to actions in a speech bubble under him. A tap-hint pill and a halo show until the first click.
- **Music** is generated in the browser, never auto-plays, and pauses when the tab is hidden. Games may take over the music while they run and give it back after.

## Iconography

- Inline SVG `<symbol>` sprites on a 32×32 grid, 2.4px round-capped strokes, no fills except small solid details; stroke uses `currentColor` in code.
- Shown on icon tiles: a 54px `radius-md` tile filled with the accent at 18% and the icon in the full accent.
- Illustrations (planets, rockets, astronaut, Bolt) use flat fills with a 3 to 5px navy outline.
- No emoji in the UI. No brand logos of other companies.

## Accessibility

- Text meets 4.5:1 in both schemes: `ink` and `ink-muted` on `bg`, `bg-alt` and `card`.
- Focus: `outline: 3px solid var(--sky); outline-offset: 3px`.
- Toggles use `role="switch"` and `aria-checked`; chips and toggle buttons use `aria-pressed`; live results use `aria-live="polite"`.
- Every game and animation has a still, keyboard-usable path.

## Components

### Button

Classes: `md-btn`, `md-btn--primary`, `md-btn--sm`.

A pill with a 2px edge and a solid ledge underneath that lifts on hover and presses down on click.

- **Primary** (`md-btn md-btn--primary`): one per view, the main call to action. Coral in Daybreak; a coral-to-plum gradient in Deep Space. Label in `on-accent`.
- **Secondary** (`md-btn`): card background. Use for every other action.
- **Small** (`md-btn--sm`): inside tools and games (Undo, Clear, Reset).
- Labels are verbs in sentence case and can have kid and grown-up versions ("See how my agents think" / "Peek inside a robot brain").
- Icons go before the label at 18px.
- The consumer provides the label, the click handler and `disabled` when the action is not available.

### Chip

Classes: `md-chip` with `aria-pressed`.

A pill-shaped choice for picking one option from a small set: Brain Lab questions, Design Lab scenarios.

- Use `aria-pressed="true"` on the selected chip; it fills with `ink` and its text flips to `bg`.
- Hover fills with `sun` and `on-accent` text.
- Keep labels under about 30 characters; they wrap as a row with `space-2` gaps.

### Tag

Classes: `md-tag`, `md-tag--sky|coral|plum|teal`.

The small colored label that opens every section, above the heading.

- One accent per section: `sun` (default), `sky`, `coral`, `plum`, `teal`. Pick by meaning: play is plum, debugging is coral, thinking is sky, career is teal.
- Text is `on-accent` in the display face at 14px. It can have kid and grown-up versions ("Architect Mode" / "Code Quest").
- One tag per section; never inline in body text.

### Card

Classes: `md-card`, `md-icon-tile`.

The default container: white (Daybreak) or translucent indigo (Deep Space), 1px `line` border, `radius-lg`, `shadow-card`, `space-5` padding.

- Optional icon tile on top: 54px, `radius-md`, filled with the card's accent at 18% (`color-mix(in srgb, var(--teal) 18%, transparent)`) with the icon in the accent color.
- Heading in `card-title`; description in `small`, `ink-muted`, two lines or fewer.
- Lifts 4px and tilts -0.4deg on hover. Use in grids of 2 to 4.

### Stat

Classes: `md-stat` with `md-kicker`, `md-value`, `p`.

A metric tile: kicker label, a big number in the `stat` style, and an optional one-line note.

- Numbers are specific and short (`17`, `2 → 25`, `$70M+`). Put the unit in the number, not the label.
- Use 2 to 4 in a row. Scoreboards in games use the same tile.
- The note is `ink-muted` at 14px; give kid mode its own wording.

### Switch

Classes: `md-switch` with `md-track` and `md-knob`, `role="switch"`.

The on/off pill used for kid mode, with a springy knob.

- `role="switch"` and `aria-checked` carry the state; the track fills with `sun` when on.
- The label names the mode, not the action. Shorten it on phones ("Kid mode").
- Turning kid mode on swaps every `.pro` span for its `.kid` twin and gets a confetti burst.

### Bubble

Classes: `md-bubble`.

Bolt's speech bubble: card background, 2px `edge`, 18px corners, ledge shadow and a pointer toward the speaker.

- Place it under Bolt with the pointer up, never over content or photos.
- One or two short sentences, in the current mode's voice. Auto-hide after about 4 seconds.
- Announce it with `role="status"` and `aria-live="polite"`.

## Icons

The line icons from sbmadhav.com, exported from its inline SVG sprite. 32×32 grid, 2.4px round-capped strokes, drawn here in `ink` navy (#1C2541).

- On the site they live in a `<svg><defs><symbol>` sprite and use `currentColor`, so they take the accent color of their tile or text. Copy the paths into a sprite rather than loading the files in `icons/` with `<img>` when the color must change.
- Pair each with a meaning, not a decoration: agent (agentic AI), voice, interface, shield (responsible AI), briefcase (consulting), hardware, sneaker, health, bank, mystery (what's next), bug, star (goal or current level).

## Mascot

Bolt, the site's original robot mascot: teal body, cream face, coral antenna and cheeks, gold chest, navy outlines.

- Bolt speaks through the Bubble component and reacts to what people do (switching schemes, playing music, winning games).
- Keep Bolt's colors fixed in both schemes; in Deep Space add a soft violet glow (`drop-shadow(0 0 12px rgba(164,123,255,.55))`).
- Never put words on Bolt or change his shape; poses come from small transforms (bob, tilt, eyes following the pointer).
