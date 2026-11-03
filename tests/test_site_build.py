"""Site generation must not erase source or unrelated output directories."""

import importlib.util
import re
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "site_builder", ROOT / "scripts/build_site.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SiteBuildTests(unittest.TestCase):
    def test_generated_documentation_links_resolve_within_site(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = builder.build(Path(temporary).resolve() / "site")
            for document in output.rglob("*.md"):
                text = document.read_text(encoding="utf-8")
                text = re.sub(r"(?ms)^```[^\n]*\n.*?^```[ \t]*$", "", text)
                for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
                    if target.startswith(("https://", "http://", "#")):
                        continue
                    resolved = document.parent / unquote(target.split("#", 1)[0])
                    self.assertTrue(resolved.exists(), f"{document.name}: {target}")

    def test_refuses_repository_and_ancestors(self):
        for path in (ROOT, ROOT.parent, Path("/")):
            with self.assertRaises(ValueError):
                builder.build(path)

    def test_refuses_unowned_directory_and_preserves_its_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary).resolve()
            source = output / "important.txt"
            source.write_text("keep")
            with self.assertRaises(ValueError):
                builder.build(output)
            self.assertEqual(source.read_text(), "keep")
            self.assertEqual(list(output.iterdir()), [source])

    def test_rebuilds_known_files_without_deleting_unrelated_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary).resolve() / "site"
            builder.build(output)
            extra = output / "keep.txt"
            extra.write_text("keep")
            builder.build(output)
            self.assertEqual(extra.read_text(), "keep")
            self.assertEqual(
                (output / "docs/RNG_ANALYSIS.md").read_bytes(),
                (ROOT / "docs/RNG_ANALYSIS.md").read_bytes(),
            )
            self.assertEqual(
                (output / "demo/app.js").read_bytes(),
                (ROOT / "demo/app.js").read_bytes(),
            )

    def test_refuses_symlink_destinations(self):
        with tempfile.TemporaryDirectory() as temporary:
            parent = Path(temporary).resolve()
            outside = parent / "outside"
            outside.write_text("keep")
            output = parent / "site"
            builder.build(output)
            (output / "index.html").unlink()
            (output / "index.html").symlink_to(outside)
            with self.assertRaises(ValueError):
                builder.build(output)
            self.assertEqual(outside.read_text(), "keep")
            alias = parent / "alias"
            alias.symlink_to(output, target_is_directory=True)
            with self.assertRaises(ValueError):
                builder.build(alias)
