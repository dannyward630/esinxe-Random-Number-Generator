"""Build only known site files; never recursively delete a caller's directory."""

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = ".esinxe-site"
OWNER = "esinxe static site v1\n"
REDIRECT = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url=demo/">
    <title>esinxe deterministic field inspector</title>
  </head>
  <body><p><a href="demo/">Open the esinxe deterministic field inspector</a>.</p></body>
</html>
"""


def build(output):
    requested = Path(output).absolute()
    # Refuse symlinks, including ancestors; aliases must not redirect writes.
    for path in (requested, *requested.parents):
        if path.is_symlink():
            raise ValueError(f"symlink output path is not supported: {path}")
    output = requested.resolve()
    if output == ROOT or output in ROOT.parents:
        raise ValueError("output must not be the repository or an ancestor")
    files = {
        path: (ROOT / path).read_bytes()
        for path in (
            "demo/index.html",
            "demo/app.js",
            "demo/snippets.mjs",
            "demo/styles.css",
            "JavaScript/src/index.js",
            "SPEC_V1.md",
            "docs/RNG_ANALYSIS.md",
        )
    }
    files.update(
        {"index.html": REDIRECT.encode(), ".nojekyll": b"", MARKER: OWNER.encode()}
    )
    if output.exists():
        if not output.is_dir():
            raise ValueError("output is not a directory")
        marker = output / MARKER
        if any(output.iterdir()) and (
            marker.is_symlink() or not marker.is_file() or marker.read_text() != OWNER
        ):
            raise ValueError(
                "refusing a non-empty directory without the site ownership marker"
            )
    # Validate all destinations before changing any of them. Unrelated files stay.
    for relative in files:
        destination = output / relative
        for path in (destination, *destination.parents):
            if path == output:
                break
            if path.is_symlink():
                raise ValueError(f"symlink in generated site: {path}")
            if path != destination and path.exists() and not path.is_dir():
                raise ValueError(f"generated parent is not a directory: {path}")
        if destination.exists() and not destination.is_file():
            raise ValueError(f"generated file destination is not a file: {destination}")
    for relative, content in files.items():
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", default=str(ROOT / "_site"))
    args = parser.parse_args()
    try:
        output = build(args.output)
    except (ValueError, OSError) as error:
        parser.exit(1, f"Site build refused: {error}\n")
    print(f"Built static site at {output}")


if __name__ == "__main__":
    main()
