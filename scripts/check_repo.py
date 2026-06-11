#!/usr/bin/env python3
"""Validate repository metadata and public documentation invariants."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.9 and 3.10
    import tomli as tomllib

ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.1.0"
REPOSITORY = "https://github.com/dannyward630/esinxe-Random-Number-Generator"

MANUALS = (
    ROOT / "Python/Python Manual.md",
    ROOT / "C/C Manual.md",
    ROOT / "C++/C++ Manual.md",
    ROOT / "C#/C# Manual.md",
    ROOT / "Ruby/Ruby Manual.md",
    ROOT / "Go/Go Manual.md",
    ROOT / "JavaScript/JavaScript TypeScript Manual.md",
    ROOT / "Rust/Rust Manual.md",
    ROOT / "JVM/Java Kotlin Manual.md",
)

MARKDOWN_LINK = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
IGNORED_LINK_SCHEMES = ("http://", "https://", "mailto:", "#")
GENERATED_PARTS = {
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
}


def fail(message: str) -> None:
    print(f"repository check: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def check_versions() -> None:
    with (ROOT / "pyproject.toml").open("rb") as handle:
        pyproject = tomllib.load(handle)
    with (ROOT / "Rust/Cargo.toml").open("rb") as handle:
        cargo = tomllib.load(handle)

    package = load_json(ROOT / "JavaScript/package.json")
    package_lock = load_json(ROOT / "JavaScript/package-lock.json")
    python_source = (ROOT / "src/esinxe/__init__.py").read_text(encoding="utf-8")
    citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    python_version = re.search(
        r'^__version__ = "([^"]+)"$', python_source, re.MULTILINE
    )
    citation_version = re.search(r"^version: ([^\s]+)$", citation, re.MULTILINE)
    if python_version is None:
        fail("src/esinxe/__init__.py has no __version__ assignment")
    if citation_version is None:
        fail("CITATION.cff has no version field")

    versions = {
        "pyproject.toml": pyproject["project"]["version"],
        "JavaScript/package.json": package["version"],
        "JavaScript/package-lock.json": package_lock["version"],
        "JavaScript/package-lock.json package": package_lock["packages"][""]["version"],
        "Rust/Cargo.toml": cargo["package"]["version"],
        "src/esinxe/__init__.py": python_version.group(1),
        "CITATION.cff": citation_version.group(1),
    }
    mismatches = [
        f"{name}={value}" for name, value in versions.items() if value != VERSION
    ]
    if mismatches:
        fail("version drift: " + ", ".join(mismatches))

    urls = {
        pyproject["project"]["urls"]["Repository"],
        package["repository"]["url"].removeprefix("git+").removesuffix(".git"),
        cargo["package"]["repository"],
    }
    if urls != {REPOSITORY}:
        fail(f"repository URL drift: {sorted(urls)}")

    go_module = (ROOT / "Go/go.mod").read_text(encoding="utf-8").splitlines()[0]
    expected_module = (
        "module github.com/dannyward630/esinxe-Random-Number-Generator/Go"
    )
    if go_module != expected_module:
        fail(f"Go module drift: {go_module}")


def check_json() -> None:
    for path in ROOT.rglob("*.json"):
        if any(part in GENERATED_PARTS for part in path.parts):
            continue
        load_json(path)


def check_markdown_links() -> None:
    failures: list[str] = []
    for path in ROOT.rglob("*.md"):
        if any(part in GENERATED_PARTS for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK.findall(text):
            target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
            if target.startswith(IGNORED_LINK_SCHEMES):
                continue
            relative = unquote(target.split("#", 1)[0])
            if not relative:
                continue
            resolved = (path.parent / relative).resolve()
            if not resolved.exists():
                failures.append(f"{path.relative_to(ROOT)} -> {target}")
    if failures:
        fail("broken Markdown links:\n  " + "\n  ".join(failures))


def check_manuals() -> None:
    required = ("SPEC_V1.md", "key", "stream", "test")
    for path in MANUALS:
        text = path.read_text(encoding="utf-8")
        missing = [term for term in required if term.lower() not in text.lower()]
        if missing:
            fail(f"{path.relative_to(ROOT)} is missing: {', '.join(missing)}")


def check_tracked_artifacts() -> None:
    result = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    tracked = [Path(item.decode()) for item in result.stdout.split(b"\0") if item]
    bad = [
        str(path)
        for path in tracked
        if path.suffix in {".o", ".pyc", ".so"}
        or any(
            part.endswith(".egg-info") or part in GENERATED_PARTS
            for part in path.parts
        )
    ]
    if bad:
        fail("generated artifacts are tracked: " + ", ".join(bad))


def main() -> None:
    check_versions()
    check_json()
    check_markdown_links()
    check_manuals()
    check_tracked_artifacts()
    print("repository metadata and documentation checks passed")


if __name__ == "__main__":
    main()
