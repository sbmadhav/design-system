"""compose.py: slot markers must be exact pairs, or the page's own header content would be silently lost.
    python3 -m unittest discover -s tests"""
import pathlib, sys, unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import compose  # noqa: E402

PARTIAL = (ROOT / "header.html").read_text()
NAV = '<nav class="md-nav"><a href="#a">A</a></nav>'


def page(block):
    return f"<body>\n<!-- md-header -->\n{block}\n<!-- /md-header -->\n<main></main>"


class GoodPages(unittest.TestCase):
    def test_slots_are_kept_and_the_rest_comes_from_the_partial(self):
        out = compose.compose(page(f"<!-- slot:nav -->{NAV}<!-- /slot:nav -->"), PARTIAL)
        self.assertIn(f"<!-- slot:nav -->{NAV}<!-- /slot:nav -->", out)
        self.assertIn('id="themeBtn"', out)
        self.assertIn("<!-- slot:brand -->Madhav<!-- /slot:brand -->", out)  # default kept

    def test_composing_twice_changes_nothing(self):
        once = compose.compose(page(f"<!-- slot:nav -->{NAV}<!-- /slot:nav -->"), PARTIAL)
        self.assertEqual(compose.compose(once, PARTIAL), once)

    def test_template_and_partial_are_valid(self):
        compose.compose((ROOT / "template.html").read_text(), PARTIAL)


class BadPages(unittest.TestCase):
    def bad(self, block, message, whole=None):
        with self.assertRaises(compose.ComposeError) as e:
            compose.compose(whole or page(block), PARTIAL)
        self.assertIn(message, str(e.exception))

    def test_unclosed_slot(self):
        self.bad(f"<!-- slot:nav -->{NAV}", "never closed")

    def test_stray_closing_marker(self):
        self.bad(f"{NAV}<!-- /slot:nav -->", "without a matching")

    def test_mismatched_names(self):
        self.bad(f"<!-- slot:nav -->{NAV}<!-- /slot:end -->", "without a matching")

    def test_duplicate_slot(self):
        self.bad(f"<!-- slot:nav -->{NAV}<!-- /slot:nav --><!-- slot:nav -->x<!-- /slot:nav -->", "more than once")

    def test_nested_slot(self):
        self.bad("<!-- slot:nav --><!-- slot:end -->x<!-- /slot:end --><!-- /slot:nav -->", "inside slot")

    def test_malformed_marker(self):
        self.bad(f"<!--slot:nav-->{NAV}<!-- /slot:nav -->", "malformed slot marker")
        self.bad(f"<!-- slot: nav -->{NAV}<!-- /slot:nav -->", "malformed slot marker")

    def test_unknown_slot(self):
        self.bad("<!-- slot:footer -->x<!-- /slot:footer -->", "unknown header slot")

    def test_missing_or_duplicate_block(self):
        self.bad(None, "found markers none", whole="<body></body>")
        self.bad(None, "expected one", whole=page("") + page(""))
        self.bad(None, "expected one", whole="<!-- md-header -->\n<header></header>")

    def test_cli_exits_with_the_error_and_leaves_the_file_alone(self):
        import subprocess, tempfile
        with tempfile.TemporaryDirectory() as d:
            f = pathlib.Path(d, "p.html"); src = page(f"<!-- slot:nav -->{NAV}")
            f.write_text(src)
            r = subprocess.run([sys.executable, str(ROOT / "compose.py"), str(ROOT / "header.html"), str(f)], capture_output=True, text=True)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("never closed", r.stderr)
            self.assertEqual(f.read_text(), src)


if __name__ == "__main__":
    unittest.main()
