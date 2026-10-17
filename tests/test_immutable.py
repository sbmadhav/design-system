"""build.py --check-immutable: a version published in git REF may not gain, lose or change a file.
Builds a throwaway copy of the repo in a temporary git repository. Needs the markdown package.
    python3 -m unittest discover -s tests"""
import json, os, pathlib, shutil, subprocess, sys, tempfile, unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCES = ["build.py", "compose.py", "tokens.json", "README.md", "header.html", "music.html", "header.js", "components.css", "template.html", "icons"]
# Git hooks export GIT_DIR, GIT_INDEX_FILE and friends. Without removing them, the git commands below would act
# on the repository being committed to instead of the throwaway one (a real hazard: the pre-commit hook runs this).
ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
ENV["GIT_CEILING_DIRECTORIES"] = tempfile.gettempdir()
GIT = ["git", "-c", "user.email=test@example.com", "-c", "user.name=test", "-c", "commit.gpgsign=false"]


class Immutable(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self.tmp.name)
        for s in SOURCES:
            src = ROOT / s
            (shutil.copytree if src.is_dir() else shutil.copyfile)(src, self.d / s)
        self.version = json.loads((self.d / "tokens.json").read_text())["version"]
        self.run_ok([sys.executable, "build.py"])
        self.run_ok(GIT + ["init", "-q"])
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=self.d, env=ENV, capture_output=True, text=True).stdout.strip()
        assert pathlib.Path(top).resolve() == self.d.resolve(), f"refusing to run: git resolves to {top}, not the temp repo"
        self.run_ok(GIT + ["add", "-A"])
        self.run_ok(GIT + ["commit", "-qm", "published"])
        self.vdir = self.d / "v" / self.version

    def tearDown(self):
        self.tmp.cleanup()

    def run_ok(self, cmd):
        r = subprocess.run(cmd, cwd=self.d, env=ENV, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def check(self):
        return subprocess.run([sys.executable, "build.py", "--check-immutable", "HEAD"], cwd=self.d, env=ENV, capture_output=True, text=True)

    def test_unchanged_passes(self):
        self.assertEqual(self.check().returncode, 0)

    def test_added_file_fails(self):
        (self.vdir / "extra.js").write_text("alert(1)")
        r = self.check()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(f"v/{self.version}/extra.js was added", r.stderr)

    def test_added_file_in_a_subfolder_fails(self):
        (self.vdir / "sub").mkdir()
        (self.vdir / "sub" / "x.css").write_text("a{}")
        self.assertIn(f"v/{self.version}/sub/x.css was added", self.check().stderr)

    def bump(self):
        t = json.loads((self.d / "tokens.json").read_text())
        major, minor, patch = map(int, t["version"].split("."))
        t["version"] = f"{major}.{minor}.{patch + 1}"
        (self.d / "tokens.json").write_text(json.dumps(t, indent=2, ensure_ascii=False) + "\n")

    def test_deleted_file_from_an_older_version_fails(self):
        self.bump()  # the build rewrites only the current version, so deletion matters for older ones
        (self.vdir / "music.html").unlink()
        r = self.check()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(f"v/{self.version}/music.html was deleted", r.stderr)

    def test_deleting_an_older_version_fails(self):
        self.bump()
        shutil.rmtree(self.vdir)
        r = self.check()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(f"v/{self.version}/tokens.css was deleted", r.stderr)

    def test_changed_file_fails(self):
        css = self.d / "components.css"
        css.write_text(css.read_text() + "\n.x { color: var(--ink); }\n")
        r = self.check()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn(f"v/{self.version}/components.css differs", r.stderr)

    def test_a_new_version_may_be_added(self):
        self.bump()
        css = self.d / "components.css"
        css.write_text(css.read_text() + "\n.x { color: var(--ink); }\n")
        r = self.check()
        self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
