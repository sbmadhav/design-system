"""The rules components.css and the generated tokens.css must keep (design system 2.2): the focus ring follows the
element's shape, the header's auto margin is scoped to the non-tabs header, the 2.2 classes and tokens exist,
paddings are tokens, control heights are tokens, and versions.json lists every release.
    python3 -m unittest discover -s tests"""
import json, pathlib, re, unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS = (ROOT / "components.css").read_text()
TOKENS = (ROOT / "tokens.css").read_text()
VERSIONS = json.loads((ROOT / "versions.json").read_text())

# (selector, declarations) for every rule, including those inside @media blocks; comments removed first
FLAT = re.sub(r"/\*.*?\*/", "", CSS, flags=re.S)
RULES = [(sel.strip(), body) for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", FLAT) if not sel.strip().startswith("@") and ":" in body]


def rules_with(selector_part):
    return [(s, b) for s, b in RULES if selector_part in s]


class FocusRing(unittest.TestCase):
    def test_the_focus_ring_rule_sets_no_border_radius(self):
        ring = [b for s, b in RULES if s == ".md-root :focus-visible"]
        self.assertEqual(len(ring), 1, "one .md-root :focus-visible rule")
        self.assertIn("outline: 3px solid var(--focus)", ring[0])
        self.assertIn("outline-offset: 3px", ring[0])
        self.assertNotIn("border-radius", ring[0], "the ring follows the element's own shape")

    def test_only_bare_links_and_link_buttons_round_the_ring(self):
        rounded = [s for s, b in RULES if "border-radius: var(--radius-xs)" in b and ":focus-visible" in s]
        self.assertEqual(rounded, [".md-root :is(a:not([class]), .md-link):focus-visible"])

    def test_script_focus_targets_show_no_ring_but_roving_tabindex_widgets_keep_it(self):
        self.assertIn('.md-root :is(main, section, article, h1, h2, h3, h4, h5, h6)[tabindex="-1"]:focus { outline: none; }', CSS)
        self.assertNotIn('main[tabindex="-1"]:focus', CSS)
        # Never a bare [tabindex="-1"]: a button, tab or tile focused with the arrow keys must keep its ring (WCAG 2.4.7)
        self.assertFalse(re.search(r'\.md-root \[tabindex="-1"\]', CSS))


class Header(unittest.TestCase):
    def test_the_auto_margin_on_the_end_controls_is_scoped_to_the_non_tabs_header(self):
        auto = [s for s, b in rules_with(".md-header-end") if "margin-left: auto" in b]
        self.assertTrue(auto, "the end controls still take the auto margin in the plain header")
        for s in auto:
            self.assertIn(":not(.md-header--tabs)", s, s)


class Classes(unittest.TestCase):
    NEW = ["md-btn--lg", "md-actions", "md-actions--stack", "md-popover", "md-prose", "md-table", "md-table--stack", "md-foot", "md-fill", "md-hl", "md-text-cta"]

    def test_the_2_2_classes_exist(self):
        for c in self.NEW:
            self.assertTrue(re.search(rf"\.{re.escape(c)}(?![\w-])", FLAT), f".{c} is missing from components.css")

    def test_the_large_button_uses_the_cta_style_and_the_large_control_height(self):
        lg = [b for s, b in RULES if s == ".md-btn--lg"]
        self.assertEqual(len(lg), 1)
        self.assertIn("min-height: var(--control-height-lg)", lg[0])
        self.assertIn("font: var(--text-cta)", lg[0])

    def test_the_popover_is_solid_and_on_the_popover_layer(self):
        pop = [b for s, b in RULES if s == ".md-popover" and "background" in b]  # the base rule, not the phone radius
        self.assertEqual(len(pop), 1)
        self.assertIn("background: linear-gradient(var(--card), var(--card)), var(--bg)", pop[0])
        self.assertIn("z-index: var(--z-popover)", pop[0])
        self.assertIn("box-shadow: var(--shadow-modal)", pop[0])


class Tokens(unittest.TestCase):
    def test_tokens_css_declares_the_2_2_tokens(self):
        for n in ["--control-height-lg: 56px", "--touch-target: 44px", "--popover-max: 380px", "--measure-prose: 40em", "--text-cta-size: clamp(1.2rem, 2.8vw, 1.4rem)", "--text-cta-weight: 800", "--text-cta:"]:
            self.assertIn(n, TOKENS, n)

    def test_versions_json_lists_every_release(self):
        self.assertEqual(VERSIONS["latest"], "2.2.0")
        for v in ["2.1.0", "2.2.0"]:
            self.assertIn(v, VERSIONS["versions"])
            self.assertTrue((ROOT / "v" / v / "components.css").is_file(), f"v/{v}/components.css")


class EveryValueAToken(unittest.TestCase):
    PX = re.compile(r"(?<![\w.-])\d+(?:\.\d+)?px\b")

    def test_no_bare_px_padding(self):
        bad = []
        for sel, body in RULES:
            for prop, value in re.findall(r"(padding(?:-[a-z]+)?)\s*:\s*([^;]+)", body):
                if self.PX.search(value):
                    bad.append(f"{sel} {{ {prop}: {value.strip()} }}")
        self.assertEqual(bad, [], "paddings are spacing tokens (or 0)")

    def test_control_heights_are_tokens(self):
        # 44px is --touch-target: never written out as a height. 32px is the documented small size (md-btn--sm, md-icon-btn--sm)
        # and appears nowhere else as a height.
        self.assertFalse(re.search(r"(?:min-)?height:\s*44px", FLAT), "44px heights are var(--touch-target)")
        for sel, body in RULES:
            if re.search(r"(?:min-)?height:\s*32px", body):
                self.assertIn("--sm", sel, f"a 32px height outside the small size: {sel}")

    def test_no_raw_colours(self):
        self.assertFalse(re.search(r"#[0-9A-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(", FLAT))


if __name__ == "__main__":
    unittest.main()
