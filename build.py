#!/usr/bin/env python3
"""Build the design system's generated files from its sources, then check them.

    python3 build.py                           build and check
    python3 build.py --check-immutable REF     also fail if a published version under v/ differs from git REF

Reads  tokens.json, README.md, header.html, components.css, music.html, header.js, compose.py
Writes tokens.css     (CSS custom properties, Daybreak default, Deep Space for dark)
       index.html     (the design system reference page at /design-system/)
       template.html  (its header block, re-composed from header.html, and its pinned version)
       v/<version>/   (an immutable copy of the published files for this version, see docs/adr/0001)
       versions.json  (every published version and the latest)
Checks every themed token is emitted in each scheme block, the accent fills' and category colours' contrast
(and the category colours' distinctness), and that hand-written files use tokens (no raw hex or rgb colours).
Requires: pip install markdown

index.html gets a Content-Security-Policy <meta> (and an explicit Referrer-Policy) right after
<meta charset>, with the sha256 of each inline script computed here, so never edit the hashes by
hand. GitHub Pages cannot send headers, so the policy has to be a <meta>; it cannot carry
frame-ancestors, report-uri or sandbox.
"""
import base64, hashlib, html, itertools, json, math, pathlib, re, shutil, subprocess, sys
import markdown

import compose

HERE = pathlib.Path(__file__).parent
T = json.loads((HERE / "tokens.json").read_text())
VERSION = T["version"]
COLORS = T["color"]["tokens"]
SHADOWS = T["shadow"]["tokens"]
THEMED = T["theme"]["tokens"] + T["effect"]["tokens"]
THEMES = {"daybreak": "Daybreak", "deep-space": "Deep Space"}
FAMILY = {"display": "var(--display)", "sans": "var(--font-sans)", "mono": "var(--font-mono)"}
STYLES = [(g["family"], s) for g in T["type"]["groups"] for s in g["styles"]]
STYLE_FAMILY = {s["name"]: fam for fam, s in STYLES}
ALIASES = T["type"]["aliases"]
# The files other repos load, also published (immutable) at /design-system/v/<version>/
PUBLISHED = ["tokens.css", "tokens.json", "components.css", "header.html", "music.html", "header.js", "compose.py"]


def val(v):
    m = re.fullmatch(r"\{(.+)\}", v)
    return f"var(--{m.group(1)})" if m else v


def shorthand(n, fam):
    return f"var(--text-{n}-weight) var(--text-{n}-size)/var(--text-{n}-leading) {FAMILY[fam]}"


def tracking(s, theme):
    if theme == "deep-space" and s.get("letterSpacingDeepSpace"):
        return s["letterSpacingDeepSpace"]
    return s.get("letterSpacing", "0")


def type_themed(theme):
    """Type tokens that depend on the scheme: display styles use --display and tighter Deep Space tracking.
    They sit in every scheme block (and .mode-*), so a pinned preview block recomputes them."""
    out = []
    for fam, s in STYLES:
        if fam == "display":
            n = s["name"]
            out += [f"--text-{n}-tracking: {tracking(s, theme)};", f"--text-{n}: {shorthand(n, fam)};"]
    for a, n in ALIASES.items():
        if STYLE_FAMILY[n] == "display":
            out += [f"--text-{a}: var(--text-{n});", f"--text-{a}-tracking: var(--text-{n}-tracking);"]
    return out


def themed_decls(theme):
    out = [f"--{c['name']}: {val(c['value'][theme])};" for c in COLORS]
    out += [f"--{s['name']}: {s['value'][theme]};" for s in SHADOWS + THEMED]
    out += type_themed(theme)
    out.append(f"color-scheme: {'dark' if theme == 'deep-space' else 'light'};")
    return out


def theme_vars(theme, indent="  "):
    return "\n".join(indent + d for d in themed_decls(theme))


def static_decls():
    out = [f"--font-{k}: {v};" for k, v in T["type"]["families"].items()]
    for group in ("spacing", "radius", "size", "z", "motion"):
        out += [f"--{t['name']}: {t['value']};" for t in T[group]["tokens"]]
    for fam, s in STYLES:
        n = s["name"]
        out += [f"--text-{n}-size: {s.get('fluid', s['fontSize'])};", f"--text-{n}-weight: {s['fontWeight']};",
                f"--text-{n}-leading: {s['lineHeight']};"]
        if fam != "display":
            out += [f"--text-{n}-tracking: {tracking(s, 'daybreak')};", f"--text-{n}: {shorthand(n, fam)};"]
    for a, n in ALIASES.items():
        out += [f"--text-{a}-size: var(--text-{n}-size);"]
        if STYLE_FAMILY[n] != "display":
            out += [f"--text-{a}: var(--text-{n});", f"--text-{a}-tracking: var(--text-{n}-tracking);"]
    return out


def static_vars():
    return "\n".join("  " + d for d in static_decls())


# Self-hosted faces, shared by every page that links tokens.css. index.html and
# /vedic-math/ also inline the same rules for first paint; the browser loads each file once.
FONT_FACES = [
    ("Fredoka", "600", "fredoka-latin-600-normal.woff2", "woff2"),
    ("Fredoka", "700", "fredoka-latin-700-normal.woff2", "woff2"),
    ('"Nunito Sans"', "200 1000", "nunito-sans-latin-wght-normal.woff2", "woff2-variations"),
    ('"Space Grotesk"', "300 700", "space-grotesk-latin-wght-normal.woff2", "woff2-variations"),
    ('"JetBrains Mono"', "500", "jetbrains-mono-latin-500-normal.woff2", "woff2"),
]


def font_faces():
    return "\n".join(
        f'@font-face {{ font-family: {fam}; font-style: normal; font-weight: {w}; font-display: swap; '
        f'src: url(/assets/fonts/{f}) format("{fmt}"); }}'
        for fam, w, f, fmt in FONT_FACES
    )


# ---------- tokens.css ----------
tokens_css = f"""/* Madhav design system tokens, version {VERSION}. GENERATED by build.py from tokens.json; edit that file, not this one.
   Color modes: Daybreak (light) and Deep Space (dark).
   Default: follow the visitor's system setting (prefers-color-scheme).
   Override: <html data-theme="light"> or <html data-theme="dark">, saved by the theme button (header.js).
   Pin a version: /design-system/v/{VERSION}/tokens.css never changes; /design-system/tokens.css is the latest. */

/* Self-hosted fonts in /assets/fonts (no third-party requests) */
{font_faces()}

/* Scheme-independent: fonts, spacing, radius, sizes, z-index, motion and the type scale */
:root {{
{static_vars()}
}}

/* Daybreak: the base values */
:root {{
{theme_vars('daybreak')}
}}

/* Deep Space when the system is dark and the visitor has not picked light */
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
{theme_vars('deep-space', '    ')}
  }}
}}

/* Deep Space when the visitor picked dark */
:root[data-theme="dark"] {{
{theme_vars('deep-space')}
}}

/* Pin a block to one mode regardless of the page (used for side-by-side previews) */
.mode-daybreak {{
{theme_vars('daybreak')}
}}
.mode-deep-space {{
{theme_vars('deep-space')}
}}
"""
(HERE / "tokens.css").write_text(tokens_css)

# ---------- index.html ----------
e = html.escape
HEADER = (HERE / "header.html").read_text()
MUSIC = (HERE / "music.html").read_text().strip()


def swatches(theme):
    rows = []
    for c in COLORS:
        v = c["value"][theme]
        v = re.sub(r"^\{(.+)\}$", r"= \1", v)
        rows.append(
            f'<div class="sw"><span class="chip-c" style="background:var(--{c["name"]})"></span>'
            f'<span class="sw-t"><b>{e(c["name"])}</b><span class="md-mono">{e(v)}</span></span></div>'
        )
    return "\n".join(rows)


def mode_panel(theme):
    label = THEMES[theme]
    sub = "Light. Cool slate-white ground, coral and teal accents, Fredoka headings." if theme == "daybreak" else "Dark. Calm slate night, soft coral and teal accents, Space Grotesk headings."
    return f"""<div class="mode mode-{theme}">
  <div class="mode-head"><div><span class="md-tag">{label}</span><h3>{label}</h3><p>{sub}</p></div>
  <div class="mode-demo"><button class="md-btn md-btn--primary">Primary</button><button class="md-btn">Secondary</button><span class="md-tag md-tag--plum">Tag</span></div></div>
  <div class="sw-grid">{swatches(theme)}</div>
</div>"""


CATS = [c["name"][4:] for c in COLORS if re.fullmatch(r"cat-[a-z]+", c["name"])]


def cat_panel(theme):
    fills = "".join(f'<span class="cat-fill" style="background:var(--cat-{n})">{n.capitalize()}</span>' for n in CATS)
    strong = "".join(f'<span class="cat-strong" style="color:var(--cat-{n}-strong)">{n.capitalize()}</span>' for n in CATS)
    return f'<div class="mode mode-{theme} cat-panel"><span class="md-tag">{THEMES[theme]}</span><div class="cat-row">{fills}</div><div class="cat-row">{strong}</div></div>'


type_rows = []
for fam, s in STYLES:
    n = s["name"]
    st = f"font:var(--text-{n});letter-spacing:var(--text-{n}-tracking);"
    if n == "kicker":
        st += "text-transform:uppercase;"
    size = s.get("fluid", s["fontSize"])
    type_rows.append(
        f'<div class="ty"><div class="ty-meta"><b>{e(n)}</b><code class="md-mono">--text-{e(n)}</code><span class="md-mono">{e(s["fontSize"])} / {s["lineHeight"]} / {s["fontWeight"]}</span><span>{e(s.get("usage",""))}</span></div>'
        f'<div class="ty-sample" style="{st}">{e(s.get("sample",""))}</div></div>'
    )

space_rows = "".join(
    f'<div class="sp"><span class="md-mono">{e(t["name"])}</span><i style="width:{t["value"]}"></i><span class="md-mono">{e(t["value"])}</span></div>'
    for t in T["spacing"]["tokens"] if t["name"] != "content-max"
)
radius_rows = "".join(
    f'<div class="rd"><i style="border-radius:var(--{t["name"]})"></i><b>{e(t["name"])}</b><span class="md-mono">{e(t["value"])}</span></div>'
    for t in T["radius"]["tokens"]
)


def token_table(group, caption):
    rows = "".join(f'<tr><td><code class="md-mono">--{e(t["name"])}</code></td><td><code class="md-mono">{e(t["value"])}</code></td><td>{e(t["usage"])}</td></tr>' for t in T[group]["tokens"])
    return f'<div class="tok"><h3>{caption}</h3><div class="tbl" tabindex="0" role="region" aria-label="Table: {caption}"><table><thead><tr><th>Token</th><th>Value</th><th>Use</th></tr></thead><tbody>{rows}</tbody></table></div></div>'


def themed_table(tokens, caption):
    rows = "".join(f'<tr><td><code class="md-mono">--{e(t["name"])}</code></td><td>{e(t["usage"])}</td></tr>' for t in tokens)
    return f'<div class="tok"><h3>{caption}</h3><div class="tbl" tabindex="0" role="region" aria-label="Table: {caption}"><table><thead><tr><th>Token</th><th>Use (a value per scheme, see tokens.json)</th></tr></thead><tbody>{rows}</tbody></table></div></div>'


icons = sorted(p.name for p in (HERE / "icons").glob("*.svg") if p.name != "bolt.svg")
icon_rows = "".join(f'<figure><img src="icons/{n}" alt="" width="40" height="40"><figcaption>{n[:-4]}</figcaption></figure>' for n in icons)

# Everything in README.md after this marker is about the repo, not the design system,
# so the reference page leaves it out.
REPO_ONLY = "<!-- repo-only -->"
readme = (HERE / "README.md").read_text()
readme = re.sub(r"\A# .*\n", "", readme)  # the page has its own title
readme = readme.split(REPO_ONLY)[0]  # repo docs (contributing, license, thanks) stay off the page
guide_html = markdown.markdown(readme, extensions=["tables", "fenced_code"])


def focusable_code(src):
    """Code samples scroll sideways (.guide pre has overflow-x: auto), so keyboard users must be
    able to reach them: each <pre> becomes a focusable, labelled region named after the heading
    above it, for example "Code sample: Start a new page"."""
    out, heading, seen = [], "", {}
    for part in re.split(r"(<h[1-6][^>]*>.*?</h[1-6]>|<pre>)", src, flags=re.S):
        m = re.match(r"<h[1-6][^>]*>(.*?)</h[1-6]>", part, re.S)
        if m:
            heading = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        elif part == "<pre>":
            name = f"Code sample: {heading}" if heading else "Code sample"
            seen[name] = seen.get(name, 0) + 1
            if seen[name] > 1:
                name += f" ({seen[name]})"
            part = f'<pre tabindex="0" role="region" aria-label="{e(name)}">'
        out.append(part)
    return "".join(out)


guide_html = focusable_code(guide_html)


def focusable_tables(src):
    """Wide tables scroll sideways on phones, so each sits in a focusable, labelled region named after
    the heading above it (markdown tables have no caption), for example "Table: Color"."""
    out, heading, seen = [], "", {}
    for part in re.split(r"(<h[1-6][^>]*>.*?</h[1-6]>|<table>|</table>)", src, flags=re.S):
        m = re.match(r"<h[1-6][^>]*>(.*?)</h[1-6]>", part, re.S)
        if m:
            heading = html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip()
        elif part == "<table>":
            name = f"Table: {heading}" if heading else "Table"
            seen[name] = seen.get(name, 0) + 1
            if seen[name] > 1:
                name += f" ({seen[name]})"
            part = f'<div class="tbl" tabindex="0" role="region" aria-label="{e(name)}"><table>'
        elif part == "</table>":
            part = "</table></div>"
        out.append(part)
    return "".join(out)


guide_html = focusable_tables(guide_html)

NAV = '<nav class="md-nav" aria-label="Sections"><a href="#modes">Color modes</a><a href="#type">Type</a><a href="#tokens">Tokens</a><a href="#components">Components</a><a href="#guide">Guidelines</a></nav>'
page_header = compose.render(HEADER, {"nav": NAV})

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Madhav design system</title>
<meta name="description" content="Color modes, type, spacing, components and guidelines for sbmadhav.com.">
<script>try{{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;if(localStorage.getItem('motion')==='paused')document.documentElement.classList.add('motion-paused');}}catch(e){{}}</script>
<meta name="theme-color" content="#F6F7F9">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='8' y='14' width='48' height='40' rx='14' fill='%234FB3A6'/%3E%3Ccircle cx='24' cy='34' r='7' fill='white'/%3E%3Ccircle cx='40' cy='34' r='7' fill='white'/%3E%3Ccircle cx='25' cy='35' r='3' fill='%23151B2B'/%3E%3Ccircle cx='41' cy='35' r='3' fill='%23151B2B'/%3E%3Ccircle cx='32' cy='7' r='5' fill='%23EE7A63'/%3E%3C/svg%3E">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/fredoka-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/nunito-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
<style>
  /* Header: the cover */
  .hero {{ position: relative; overflow: hidden; border-bottom: 1px solid var(--line); }}
  .hero .md-wrap {{ display: grid; grid-template-columns: 1.2fr .8fr; align-items: center; min-height: 360px; gap: var(--space-6); }}
  .hero h1 {{ font-size: clamp(3.4rem, 9vw, 7rem); line-height: .92; letter-spacing: -.02em; padding: 56px 0 var(--space-2); }}
  .hero p {{ color: var(--ink-muted); margin: var(--space-1-5) 0 40px var(--space-1); font-size: var(--text-small-size); }}
  .hero .ver {{ display: inline-block; margin-left: var(--space-1); }}
  .portrait {{ position: relative; justify-self: center; width: min(320px, 70vw); aspect-ratio: 1; margin: var(--space-7) 0; }}
  .portrait .blob {{ position: absolute; inset: 4%; border-radius: 46% 54% 50% 50% / 52% 46% 54% 48%; background: var(--sun); animation: morph 12s ease-in-out infinite; }}
  :root[data-theme="dark"] .portrait .blob {{ background: conic-gradient(var(--coral), var(--plum), var(--teal), var(--sun), var(--coral)); }}
  @media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) .portrait .blob {{ background: conic-gradient(var(--coral), var(--plum), var(--teal), var(--sun), var(--coral)); }} }}
  .portrait img:not(.bolt) {{ position: absolute; inset: 9%; width: 82%; height: 82%; object-fit: cover; object-position: 50% 35%; border-radius: var(--radius-round); border: 5px solid var(--card); box-shadow: var(--shadow-card); }}
  .portrait .bolt {{ position: absolute; right: -8%; bottom: -4%; width: 42%; height: auto; animation: bob 3.4s ease-in-out infinite; filter: drop-shadow(0 10px 14px color-mix(in srgb, var(--bolt-line) 25%, transparent)); }}
  @keyframes morph {{ 50% {{ border-radius: 56% 44% 42% 58% / 44% 58% 42% 56%; }} }}
  @keyframes bob {{ 50% {{ transform: translateY(-10px) rotate(-3deg); }} }}
  @media (max-width: 760px) {{ .hero .md-wrap {{ grid-template-columns: 1fr; }} .portrait {{ order: -1; margin: var(--space-6) 0 0; width: min(260px, 66vw); }} .hero h1 {{ padding-top: var(--space-4); }} }}

  /* Color modes */
  .modes {{ display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4-5); }}
  @media (max-width: 900px) {{ .modes {{ grid-template-columns: 1fr; }} }}
  .mode {{ background: var(--page); color: var(--ink); border: 2px solid var(--edge); border-radius: var(--radius-xl); padding: 22px; box-shadow: var(--shadow-card); font-family: var(--font-sans); }}
  .mode h3 {{ font: 600 26px/1.1 var(--display); letter-spacing: var(--tracking-heading); margin: var(--space-2-5) 0 var(--space-1); }}
  .mode-head {{ display: flex; justify-content: space-between; gap: var(--space-3-5); flex-wrap: wrap; align-items: flex-end; margin-bottom: var(--space-4); }}
  .mode-head p {{ margin: 0; color: var(--ink-muted); font-size: var(--text-small-size); }}
  .mode-demo {{ display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }}
  .sw-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-2); }}
  .sw {{ display: flex; gap: var(--space-2-5); align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-2); }}
  .chip-c {{ flex: none; width: 34px; height: 34px; border-radius: var(--radius-xs); border: 1px solid var(--line); }}
  .sw-t {{ display: flex; flex-direction: column; line-height: 1.25; font-size: 13.5px; min-width: 0; }}
  .sw-t .md-mono {{ color: var(--ink-muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
  .note {{ margin-top: var(--space-3-5); color: var(--ink-muted); font-size: var(--text-small-size); }}
  .cat-panel {{ display: grid; gap: var(--space-3); }}
  .cat-panel > .md-tag {{ justify-self: start; }}
  .cat-row {{ display: flex; flex-wrap: wrap; gap: var(--space-2); }}
  .cat-fill {{ padding: var(--space-1-5) var(--space-3-5); border: 2px solid var(--edge); border-radius: var(--radius-pill); color: var(--on-accent); font: var(--text-label); }}
  .cat-strong {{ padding: var(--space-1-5) var(--space-2); font: 700 var(--text-body-size)/1.2 var(--font-sans); }}

  /* Type, spacing, radius, more tokens */
  .ty {{ display: grid; grid-template-columns: 260px 1fr; gap: var(--space-5); align-items: center; padding: var(--space-3-5) 0; border-top: 1px solid var(--line); }}
  .ty-meta {{ display: flex; flex-direction: column; font-size: 13.5px; color: var(--ink-muted); }}
  .ty-meta b {{ color: var(--ink); font-size: var(--text-small-size); }}
  .ty-meta code {{ color: var(--ink); }}
  .ty-sample {{ overflow-wrap: anywhere; }}
  @media (max-width: 700px) {{ .ty {{ grid-template-columns: 1fr; gap: var(--space-1-5); }} }}
  .two {{ display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4-5); }}
  @media (max-width: 800px) {{ .two {{ grid-template-columns: 1fr; }} }}
  .sp {{ display: grid; grid-template-columns: 120px 1fr 56px; gap: var(--space-2-5); align-items: center; padding: 5px 0; }}
  .sp i {{ display: block; height: 14px; border-radius: var(--radius-2xs); background: var(--sky); }}
  .rds {{ display: flex; flex-wrap: wrap; gap: var(--space-3-5); }}
  .rd {{ display: flex; flex-direction: column; align-items: center; gap: var(--space-1); font-size: 13px; }}
  .rd i {{ width: 72px; height: 72px; background: var(--sun); border: 2px solid var(--edge); }}
  .rd .md-mono {{ color: var(--ink-muted); }}
  .toks {{ display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4-5); }}
  @media (max-width: 900px) {{ .toks {{ grid-template-columns: 1fr; }} }}
  .tok {{ min-width: 0; }}
  .tok h3 {{ font-size: 1.2rem; margin-bottom: var(--space-2) !important; }}

  /* Components and icons */
  .demo {{ display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }}
  .demo-col {{ display: grid; gap: var(--space-3); }}
  .comp-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4-5); }}
  @media (max-width: 800px) {{ .comp-grid {{ grid-template-columns: 1fr; }} }}
  .comp-grid .md-card {{ padding: var(--space-5); min-width: 0; }}
  .comp-grid .md-card:hover {{ transform: none; }}
  .comp-grid h3 {{ margin-bottom: var(--space-3); }}
  .comp-grid .md-tile {{ min-width: 140px; }}
  /* The prose and popover samples sit inside demo cards, whose paragraphs are small and muted; on a real page they are body text */
  .comp-grid .md-card :is(.md-prose, .md-popover) p {{ color: var(--ink); font-size: var(--text-body-size); line-height: var(--text-body-leading); }}
  .comp-grid .md-popover {{ max-width: none; }}
  .icons {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: var(--space-2-5); }}
  .icons figure {{ margin: 0; background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-1-5) var(--space-2); text-align: center; }}
  .icons figcaption {{ font-size: 12px; color: var(--ink-muted); margin-top: var(--space-1); }}

  /* Guidelines (rendered README) */
  .guide {{ max-width: 820px; overflow-wrap: break-word; }}
  .guide h2 {{ font-size: 1.7rem; margin: 40px 0 var(--space-2-5) !important; }}
  .guide h3 {{ font-size: 1.2rem; margin: 26px 0 var(--space-1-5) !important; }}
  .tbl {{ overflow-x: auto; margin: var(--space-2-5) 0; border-radius: var(--radius-xs); }}
  .tbl table {{ border-collapse: collapse; width: 100%; font-size: var(--text-small-size); }}
  .tbl th, .tbl td {{ text-align: left; padding: var(--space-2) var(--space-2-5); border-bottom: 1px solid var(--line); vertical-align: top; }}
  .guide code {{ font-family: var(--font-mono); font-size: .85em; background: var(--bg-alt); padding: 1px var(--space-1-5); border-radius: var(--radius-xs); overflow-wrap: anywhere; }}
  .guide td code {{ overflow-wrap: normal; }}
  .guide pre {{ background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3-5); overflow-x: auto; }}
  .guide pre code {{ background: none; padding: 0; }}
  .guide blockquote {{ margin: var(--space-3-5) 0; padding: var(--space-2-5) var(--space-4); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--coral) 12%, transparent); }}
  .guide a {{ color: var(--ink); }}
  footer {{ padding: var(--space-7) 0 40px; color: var(--ink-muted); font-size: var(--text-label-size); }}
</style>
</head>
<body class="md-page md-root">
<a class="md-skip" href="#main">Skip to content</a>

{page_header}
<main id="main" tabindex="-1">
<section class="hero">
  <div class="md-wrap">
    <div>
      <h1>Madhav</h1>
      <p>Design system <span class="md-mono ver">v{VERSION}</span>. Professional enough for recruiters, fun enough for kids.</p>
    </div>
    <div class="portrait" aria-hidden="true">
      <div class="blob"></div>
      <img src="/assets/profile.jpg" alt="" width="400" height="400">
      <img class="bolt md-bolt" src="icons/bolt.svg" alt="" width="160" height="170">
    </div>
    </div>
  </div>
</section>

<section class="md-section" id="modes">
  <div class="md-wrap">
    <span class="md-tag md-tag--plum">Color modes</span>
    <h2 class="md-heading">Two modes, one system</h2>
    <p class="md-lede">Pages follow the visitor's system setting by default. The round sun or moon button in the header switches scheme and remembers the choice; switching back to match the device clears it, so the page follows the device again. Both modes are shown here side by side, whatever this page is set to.</p>
    <div class="modes">
{mode_panel('daybreak')}
{mode_panel('deep-space')}
    </div>
    <p class="note">How it works: <code class="md-mono">tokens.css</code> sets Daybreak on <code class="md-mono">:root</code>, switches to Deep Space under <code class="md-mono">prefers-color-scheme: dark</code>, and lets <code class="md-mono">&lt;html data-theme="light|dark"&gt;</code> override both. Add <code class="md-mono">class="mode-daybreak"</code> or <code class="md-mono">class="mode-deep-space"</code> to pin any block to one mode.</p>
  </div>
</section>

<section class="md-section md-band" id="categories">
  <div class="md-wrap">
    <span class="md-tag md-tag--sky">Categories</span>
    <h2 class="md-heading">Category colours</h2>
    <p class="md-lede">Six distinct hues for things that need telling apart: belts, categories, legend keys. Fills carry <code class="md-mono">on-accent</code> text; the <code class="md-mono">-strong</code> shades are for text and marks. Every pairing meets AA in both schemes.</p>
    <div class="modes">
{cat_panel('daybreak')}
{cat_panel('deep-space')}
    </div>
  </div>
</section>

<section class="md-section" id="type">
  <div class="md-wrap">
    <span class="md-tag md-tag--sky">Typography</span>
    <h2 class="md-heading">Type scale</h2>
    <p class="md-lede">Each style is a token: <code class="md-mono">font: var(--text-title)</code> plus <code class="md-mono">letter-spacing: var(--text-title-tracking)</code>, or the class <code class="md-mono">md-text-title</code>. Headings use Fredoka in Daybreak and Space Grotesk in Deep Space through <code class="md-mono">var(--display)</code>. Body is Nunito Sans; code is JetBrains Mono.</p>
    {''.join(type_rows)}
  </div>
</section>

<section class="md-section md-band">
  <div class="md-wrap two">
    <div><span class="md-tag md-tag--teal">Spacing</span><h2 class="md-heading" style="font-size:1.8rem">Spacing</h2><div style="margin-top:18px">{space_rows}</div></div>
    <div><span class="md-tag">Shape</span><h2 class="md-heading" style="font-size:1.8rem">Corners</h2><div class="rds" style="margin-top:18px">{radius_rows}</div></div>
  </div>
</section>

<section class="md-section" id="tokens">
  <div class="md-wrap">
    <span class="md-tag md-tag--coral">Tokens</span>
    <h2 class="md-heading">Depth, layers and motion</h2>
    <p class="md-lede">Shadows and effects have a value per scheme; sizes, layers and motion are the same in both.</p>
    <div class="toks">
{themed_table(SHADOWS + T['effect']['tokens'], 'Shadows and effects')}
{token_table('size', 'Sizes')}
{token_table('z', 'Layers (z-index)')}
{token_table('motion', 'Motion')}
    </div>
  </div>
</section>

<section class="md-section md-band" id="components">
  <div class="md-wrap">
    <span class="md-tag md-tag--coral">Components</span>
    <h2 class="md-heading">Components</h2>
    <p class="md-lede">Live, from <code class="md-mono">components.css</code>. The header at the top of this page is the shared site header. Switch scheme with the sun or moon to see each one change.</p>
    <div class="comp-grid">
      <div class="md-card"><h3>Button</h3><div class="demo"><button class="md-btn md-btn--primary">See how my agents think</button><button class="md-btn" id="demoBtn">Squash some bugs</button><button class="md-btn md-btn--sm" id="demoBtnSm">Undo</button><button class="md-btn md-btn--primary md-btn--lg" id="demoLarge">Start learning<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></div>
      <div class="md-card"><h3>Actions row</h3><div class="md-actions md-actions--stack" id="demoActions"><button type="button" class="md-btn md-btn--primary">Save progress</button><button type="button" class="md-btn">Not now</button><button type="button" class="md-link">Why we ask</button></div></div>
      <div class="md-card"><h3>Chip</h3><div class="demo"><button class="md-chip" aria-pressed="true">The Ticket Drop</button><button class="md-chip" aria-pressed="false">The App Went Viral</button></div></div>
      <div class="md-card"><h3>Tag</h3><div class="demo"><span class="md-tag">About</span><span class="md-tag md-tag--sky">Brain Lab</span><span class="md-tag md-tag--coral">Bug Hunt</span><span class="md-tag md-tag--plum">Design Lab</span><span class="md-tag md-tag--teal">Journey</span></div></div>
      <div class="md-card"><h3>Switch</h3><div class="demo"><button class="md-switch" role="switch" aria-checked="false" id="demoSwitch"><span>Kid mode</span><span class="md-track"><span class="md-knob"></span></span></button></div></div>
      <div class="md-card"><h3>Stat</h3><div class="demo"><div class="md-stat"><div class="md-kicker">Years building</div><div class="md-value">17</div><p>Since 2009</p></div><div class="md-stat"><div class="md-kicker">AI squad</div><div class="md-value">2 → 25</div><p>Engineers, QA, design</p></div></div></div>
      <div class="md-card"><h3>Bubble</h3><div class="demo" style="padding-top:12px"><div class="md-bubble">Hi, I'm Bolt. I route requests so the big model does not have to.</div></div></div>
      <div class="md-card"><h3>Raised tile</h3><div class="demo" id="demoTiles" role="group" aria-label="Tiles"><button class="md-tile" aria-pressed="true"><span class="md-tile-t">Grade 3</span><span class="md-tile-s">Times tables</span></button><button class="md-tile" aria-pressed="false"><span class="md-tile-t">Grade 4</span><span class="md-tile-s">Long division</span></button><button class="md-tile md-tile--fill" aria-pressed="false" style="--tile-fill:var(--cat-blue)"><span class="md-tile-t">Blue belt</span><span class="md-tile-s">Three tricks</span></button><button class="md-tile md-tile--fill" id="demoFillPressed" aria-pressed="true" style="--tile-fill:var(--cat-purple)"><span class="md-tile-t">Purple belt</span><span class="md-tile-s">Selected</span></button></div></div>
      <div class="md-card"><h3>Text input</h3><div class="demo-col"><div><label class="md-label" for="demoName">Nickname</label><input class="md-input" id="demoName" placeholder="Swift Otter" aria-describedby="demoNameHint"><span class="md-hint" id="demoNameHint">Leaderboards only see this name.</span></div><div><label class="md-label" for="demoGrade">Grade</label><select class="md-input" id="demoGrade"><option>Grade 3</option><option>Grade 4</option></select></div></div></div>
      <div class="md-card"><h3>Music pill</h3><div class="demo" id="demoMusic">{MUSIC.replace('id="musicBtn"', 'id="demoMusicBtn"').replace('id="nextTrack"', 'id="demoNext"')}<span class="md-music is-on" role="group" aria-label="Music (panel style)"><button type="button" class="md-music-btn" aria-expanded="false" aria-label="Calm music"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/></svg><span class="md-music-lbl">Music</span><span class="md-eq" aria-hidden="true"><i></i><i></i><i></i></span></button></span></div></div>
      <div class="md-card"><h3>Round icon button and link button</h3><div class="demo"><button type="button" class="md-icon-btn" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button><button type="button" class="md-icon-btn md-icon-btn--sm" aria-label="Flip back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><p style="margin:0">Progress stays here. <button type="button" class="md-link">Reset play mode</button></p></div></div>
      <div class="md-card"><h3>Progress bar</h3><div class="demo-col"><div class="md-progress" role="progressbar" aria-label="Quest progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60"><span style="--value:60%"></span></div><div class="md-progress md-progress--sm" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="100" aria-valuenow="35" style="--bar:var(--sun-strong)"><span style="--value:35%"></span></div><progress class="md-progress md-progress--lg" value="80" max="100" aria-label="Lesson progress">80%</progress></div></div>
      <div class="md-card"><h3>Dialog and toast</h3><div class="demo"><button type="button" class="md-btn" id="demoDialogBtn">Open a dialog</button><button type="button" class="md-btn" id="demoToastBtn">Show a toast</button></div>
        <dialog class="md-dialog" id="demoDialog" aria-labelledby="demoDialogT"><div class="md-dialog-head"><h2 id="demoDialogT">Sutra of the day</h2><button type="button" class="md-icon-btn md-icon-btn--sm" id="demoDialogX" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button></div><p style="margin:0">By one more than the one before. A dialog has a scrim behind it, a modal shadow and a close button.</p><div class="md-dialog-foot"><button type="button" class="md-btn md-btn--primary" id="demoDialogOk">Got it</button></div></dialog></div>
      <div class="md-card"><h3>Segmented control and kicker</h3><div class="demo-col"><div class="md-seg" role="group" aria-label="Leaderboard" id="demoSeg"><button aria-pressed="true">Today</button><button aria-pressed="false">This week</button><button aria-pressed="false">All time</button></div><span class="md-kicker">Kicker on its own</span><p class="md-sr-only">Screen-reader-only text sits here: read aloud, never shown.</p></div></div>
      <div class="md-card"><h3>Popover</h3><div class="md-popover" id="demoPopover" role="dialog" aria-labelledby="demoPopoverT"><span class="md-kicker">Quick tour, 1 of 3</span><h4 class="md-text-card-title" id="demoPopoverT" style="margin:var(--space-1) 0 var(--space-2)">This is your belt</h4><p style="margin:0">It fills as you learn tricks. Tap it any time to see what comes next.</p><div class="md-actions" style="margin-bottom:0"><button type="button" class="md-btn md-btn--primary md-btn--sm">Next</button><button type="button" class="md-btn md-btn--sm">Skip tour</button></div></div></div>
      <div class="md-card"><h3>Prose</h3><div class="md-prose" id="demoProse"><h2>Why the tricks work</h2><p>Every Vedic sutra is a rule about place value. Once you see the rule, the <a href="#type">shortcut</a> stops feeling like magic.</p><h3>By one more than the one before</h3><ul><li>Squaring a number that ends in 5</li><li>Multiplying two numbers whose first digits match</li></ul><blockquote>Say the rule out loud before you use it. The words carry the maths.</blockquote><hr><p>Try it on 35 × 35, then on 65 × 65.</p></div></div>
      <div class="md-card"><h3>Table</h3><div class="md-table md-table--stack" id="demoTable" tabindex="0" role="region" aria-label="Belts, table"><table><thead><tr><th>Belt</th><th>Tricks</th><th>Earned by</th></tr></thead><tbody><tr><td data-label="Belt">White</td><td data-label="Tricks">3</td><td data-label="Earned by">Everyone who starts</td></tr><tr><td data-label="Belt">Yellow</td><td data-label="Tricks">6</td><td data-label="Earned by">Finishing Grade 3</td></tr><tr><td data-label="Belt">Green</td><td data-label="Tricks">10</td><td data-label="Earned by">Three perfect rounds</td></tr></tbody></table></div></div>
      <div class="md-card"><h3>Footer</h3><footer class="md-foot" id="demoFoot" style="padding-bottom:0"><div><p>Learn Vedic Math is free and open source. No ads, nothing sold.</p><nav aria-label="Site"><ul><li><a href="#guide">Privacy</a></li><li><a href="#guide">Terms</a></li><li><a href="#guide">For parents</a></li><li><a href="#guide">GitHub</a></li></ul></nav></div></footer></div>
      <div class="md-card"><h3>Highlight</h3><h4 class="md-text-heading" id="demoHl" style="margin:0">Speed tricks for <span class="md-hl">everyone</span></h4></div>
    </div>
  </div>
</section>

<section class="md-section">
  <div class="md-wrap">
    <span class="md-tag md-tag--teal">Icons</span>
    <h2 class="md-heading">Icons and mascot</h2>
    <p class="md-lede">32 by 32 line icons with 2.4px round strokes. Files live in <code class="md-mono">icons/</code>. Shown on a Daybreak ground in both schemes, since they are drawn in navy.</p>
    <div class="icons mode-daybreak">{icon_rows}<figure><img src="icons/bolt.svg" alt="Bolt the robot" width="40" height="42"><figcaption>bolt</figcaption></figure></div>
  </div>
</section>

<section class="md-section md-band" id="guide">
  <div class="md-wrap">
    <span class="md-tag">Guidelines</span>
    <h2 class="md-heading">How to use it</h2>
    <div class="guide">
{guide_html}
    </div>
  </div>
</section>
</main>

<div class="md-toasts" id="demoToasts" role="status" aria-live="polite"></div>

<footer><div class="md-wrap">Version {VERSION}. Generated by <code class="md-mono">build.py</code> from <code class="md-mono">tokens.json</code> and <code class="md-mono">README.md</code>. <a href="/" style="color:var(--ink);font-weight:700">Back to sbmadhav.com</a></div></footer>

<script>
(() => {{
  const $ = s => document.getElementById(s);
  const sw = $('demoSwitch');
  sw.addEventListener('click', () => sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true')));
  const music = $('demoMusicBtn');
  music.addEventListener('click', () => {{
    const on = music.getAttribute('aria-pressed') !== 'true';
    music.setAttribute('aria-pressed', String(on));
    music.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
  }});
  const press = group => group.addEventListener('click', ev => {{
    const b = ev.target.closest('button[aria-pressed]');
    if (!b) return;
    group.querySelectorAll('button[aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }});
  press($('demoSeg')); press($('demoTiles'));
  const dlg = $('demoDialog');
  $('demoDialogBtn').addEventListener('click', () => dlg.showModal());
  $('demoDialogX').addEventListener('click', () => dlg.close());
  $('demoDialogOk').addEventListener('click', () => dlg.close());
  const toasts = $('demoToasts');
  $('demoToastBtn').addEventListener('click', () => {{
    const t = document.createElement('div');
    t.className = 'md-toast';
    t.textContent = 'Saved. Nice streak!';
    toasts.append(t);
    setTimeout(() => {{ t.classList.add('is-leaving'); setTimeout(() => t.remove(), 300); }}, 2600);
  }});
}})();
</script>
<script src="header.js" defer></script>
<script src="/assets/explore.js" defer></script>
<script src="/assets/analytics.js" defer></script>
</body>
</html>
"""
# ---------- Content-Security-Policy ----------
# Everything the page loads is on this origin (this repo, plus /assets/ from sbmadhav.github.io:
# fonts, icons, the Explore menu, analytics and GoatCounter's count.js). The only third party is
# GoatCounter's beacon: sendBeacon (connect-src), or an <img> when that fails (img-src). Styles
# need 'unsafe-inline' for the style="" attributes in the reference page.
GOATCOUNTER = "https://sbmadhav.goatcounter.com"
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' INLINE_SCRIPTS",
    "style-src 'self' 'unsafe-inline'",
    f"img-src 'self' data: {GOATCOUNTER}",
    "font-src 'self'",
    f"connect-src 'self' {GOATCOUNTER}",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
])


def add_csp(text):
    """The CSP and referrer <meta> tags after <meta charset>, allowing each inline script by hash."""
    if re.search(r"""<[a-z][^>]*\s(on[a-z]+)\s*=""", text, re.I) or re.search(r"""(href|src)\s*=\s*["']?\s*javascript:""", text, re.I):
        sys.exit("build.py: index.html has an inline event handler or a javascript: URL, which the CSP blocks")
    hashes = []
    for attrs, body in re.findall(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", text, re.S | re.I):
        if "type=" in attrs.lower() and not re.search(r"""type=["']?(text/javascript|module)\b""", attrs, re.I):
            continue  # a data block never runs
        hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(body.encode()).digest()).decode() + "'")
    policy = CSP.replace("INLINE_SCRIPTS", " ".join(dict.fromkeys(hashes)))
    charset = '<meta charset="utf-8">\n'
    return text.replace(charset, charset + f'<meta http-equiv="Content-Security-Policy" content="{policy}">\n'
                        '<meta name="referrer" content="strict-origin-when-cross-origin">\n', 1)


(HERE / "index.html").write_text(add_csp(page))

# ---------- template.html: the header block and the pinned version ----------
template_path = HERE / "template.html"
template = compose.compose(template_path.read_text(), HEADER)
template = re.sub(r"/design-system/v/\d+\.\d+\.\d+/", f"/design-system/v/{VERSION}/", template)
template_path.write_text(template)

# ---------- versioned copy: v/<version>/ and versions.json ----------
vdir = HERE / "v" / VERSION
vdir.mkdir(parents=True, exist_ok=True)
for f in PUBLISHED:
    shutil.copyfile(HERE / f, vdir / f)
# Pages publishes every file, so a version folder holds exactly PUBLISHED: anything else would ship at a pinned URL
extra = sorted(p.relative_to(vdir).as_posix() for p in vdir.rglob("*") if p.is_file() and p.relative_to(vdir).as_posix() not in PUBLISHED)
if extra:
    sys.exit(f"build.py: v/{VERSION}/ holds files outside PUBLISHED: {', '.join(extra)}. Remove them (or add them to PUBLISHED).")
versions = sorted((p.name for p in (HERE / "v").iterdir() if re.fullmatch(r"\d+\.\d+\.\d+", p.name)),
                  key=lambda v: tuple(map(int, v.split("."))))
(HERE / "versions.json").write_text(json.dumps({"latest": VERSION, "versions": versions, "files": PUBLISHED}, indent=2) + "\n")


# ---------- checks ----------
problems = []


def rgb(hexv):
    h = hexv.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def color(name, theme, over=None):
    """A color token as sRGB 0..1, rgba composited over `over` (a hex), {aliases} resolved."""
    v = next(c for c in COLORS if c["name"] == name)["value"][theme]
    m = re.fullmatch(r"\{(.+)\}", v)
    if m:
        return color(m.group(1), theme, over)
    m = re.fullmatch(r"rgba\(([^)]+)\)", v)
    if m:
        r, g, b, a = [float(x) for x in m.group(1).split(",")]
        base = rgb(over or "#000000")
        return [a * x / 255 + (1 - a) * y for x, y in zip((r, g, b), base)]
    return rgb(v)


def lum(c):
    r, g, b = [lin(x) for x in c]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def lab(c):
    r, g, b = [lin(x) for x in c]
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return (116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z)))


# 1. Accent fills (the floor the README states: on-accent at least 6.2:1 on coral, teal, sun, sky and plum) and their
#    -strong shades on every ground; category colours: on-accent text on each fill, each -strong shade on every
#    ground, all six distinct
FILLS = ["coral", "teal", "sun", "sky", "plum"]
MIN_FILL = 6.2
MIN_DE = 20  # CIE76 distance between any two category colours in the same scheme
for theme in THEMES:
    bg = next(c for c in COLORS if c["name"] == "bg")["value"][theme]
    grounds = {g: color(g, theme, bg) for g in ("bg", "bg-alt", "card")}
    for n in FILLS:
        r = contrast(color("on-accent", theme), color(n, theme))
        if r < MIN_FILL:
            problems.append(f"{theme}: on-accent on {n} is {r:.2f}:1 (needs {MIN_FILL})")
        for g, gc in grounds.items():
            r = contrast(color(f"{n}-strong", theme), gc)
            if r < 4.5:
                problems.append(f"{theme}: {n}-strong on {g} is {r:.2f}:1 (needs 4.5)")
    for n in CATS:
        r = contrast(color("on-accent", theme), color(f"cat-{n}", theme))
        if r < 4.5:
            problems.append(f"{theme}: on-accent on cat-{n} is {r:.2f}:1 (needs 4.5)")
        for g, gc in grounds.items():
            r = contrast(color(f"cat-{n}-strong", theme), gc)
            if r < 4.5:
                problems.append(f"{theme}: cat-{n}-strong on {g} is {r:.2f}:1 (needs 4.5)")
    for kind in ("", "-strong"):
        for a, b in itertools.combinations(CATS, 2):
            d = math.dist(lab(color(f"cat-{a}{kind}", theme)), lab(color(f"cat-{b}{kind}", theme)))
            if d < MIN_DE:
                problems.append(f"{theme}: cat-{a}{kind} and cat-{b}{kind} are too alike (distance {d:.1f}, needs {MIN_DE})")
    r = contrast(color("media-ink", theme), color("media-black", theme))
    if r < 4.5:
        problems.append(f"{theme}: media-ink on media-black is {r:.2f}:1")
    if len(CATS) != 6:
        problems.append(f"expected 6 category colours, found {len(CATS)}")

# 2. Every themed token is declared in each of the five scheme blocks of tokens.css, and every static one once
css = tokens_css
blocks = {
    "Daybreak :root": re.findall(r"^:root \{\n(.*?)^\}", css, re.S | re.M)[1],
    "Deep Space (system)": re.search(r':root:not\(\[data-theme="light"\]\) \{\n(.*?)^  \}', css, re.S | re.M).group(1),
    'Deep Space (data-theme="dark")': re.search(r'^:root\[data-theme="dark"\] \{\n(.*?)^\}', css, re.S | re.M).group(1),
    ".mode-daybreak": re.search(r"^\.mode-daybreak \{\n(.*?)^\}", css, re.S | re.M).group(1),
    ".mode-deep-space": re.search(r"^\.mode-deep-space \{\n(.*?)^\}", css, re.S | re.M).group(1),
}
static_block = re.findall(r"^:root \{\n(.*?)^\}", css, re.S | re.M)[0]
names = lambda decls: [d.split(":")[0] for d in decls]
for label, block in blocks.items():
    declared = set(re.findall(r"^\s*(--[\w-]+):", block, re.M))
    missing = [n for n in names(themed_decls("daybreak")) if n.startswith("--") and n not in declared]
    if missing:
        problems.append(f"tokens.css {label} is missing {', '.join(missing)}")
declared = set(re.findall(r"^\s*(--[\w-]+):", static_block, re.M))
missing = [n for n in names(static_decls()) if n not in declared]
if missing:
    problems.append(f"tokens.css static :root is missing {', '.join(missing)}")

# 3. Hand-written files use tokens: no raw hex or rgb() colours. HTML attributes that cannot read CSS
#    (the favicon data URI and <meta name="theme-color">, which header.js keeps on --bg) are exempt.
RAW = re.compile(r"#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(")
for f in ["components.css", "header.html", "music.html", "header.js", "template.html"]:
    for i, line in enumerate((HERE / f).read_text().splitlines(), 1):
        if 'rel="icon"' in line or 'name="theme-color"' in line:
            continue
        if f == "header.js" and line.lstrip().startswith(("/*", "*", "//")):
            continue
        if RAW.search(line):
            problems.append(f"{f}:{i}: raw colour, use a token: {line.strip()[:100]}")

# 4. Published versions never change: every v/<version>/ that exists in git REF must hold exactly the same
#    files with the same bytes here. Added, changed and deleted files all fail (Pages publishes every file).
def immutable_problems(ref):
    out = []
    listed = subprocess.run(["git", "ls-tree", "-r", "--name-only", ref, "v/"], cwd=HERE, capture_output=True, text=True)
    if listed.returncode:
        return [f"--check-immutable: cannot list v/ at {ref}: {listed.stderr.strip()}"]
    published = {}
    for path in filter(None, listed.stdout.splitlines()):
        published.setdefault(path.split("/")[1], set()).add(path)
    for ver, old_paths in sorted(published.items()):
        vroot = HERE / "v" / ver
        now = {p.relative_to(HERE).as_posix() for p in vroot.rglob("*") if p.is_file()} if vroot.is_dir() else set()
        for path in sorted(now - old_paths):
            out.append(f"{path} was added to published version {ver}: published versions are immutable. Bump \"version\" in tokens.json instead.")
        for path in sorted(old_paths - now):
            out.append(f"{path} was deleted from published version {ver}: published versions are immutable.")
        for path in sorted(old_paths & now):
            old = subprocess.run(["git", "show", f"{ref}:{path}"], cwd=HERE, capture_output=True).stdout
            if (HERE / path).read_bytes() != old:
                out.append(f"{path} differs from {ref}: published versions are immutable. Bump \"version\" in tokens.json instead.")
    return out


if "--check-immutable" in sys.argv:
    problems += immutable_problems(sys.argv[sys.argv.index("--check-immutable") + 1])

if problems:
    print("build.py: checks failed:\n  " + "\n  ".join(problems), file=sys.stderr)
    sys.exit(1)
print(f"wrote tokens.css, index.html, template.html, v/{VERSION}/ and versions.json; checks passed")
