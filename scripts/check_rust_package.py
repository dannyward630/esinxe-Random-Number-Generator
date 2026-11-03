"""Test the actual Rust package, including tests compiled outside the monorepo."""

import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    manifest = str(ROOT / "Rust/Cargo.toml")
    metadata = json.loads(
        subprocess.check_output(
            [
                "cargo",
                "metadata",
                "--manifest-path",
                manifest,
                "--format-version",
                "1",
                "--no-deps",
                "--offline",
            ],
            text=True,
        )
    )
    package = next(
        item
        for item in metadata["packages"]
        if Path(item["manifest_path"]) == Path(manifest)
    )
    with tempfile.TemporaryDirectory(prefix="esinxe-package-") as temporary:
        subprocess.run(
            [
                "cargo",
                "package",
                "--manifest-path",
                manifest,
                "--allow-dirty",
                "--offline",
                "--target-dir",
                temporary,
            ],
            check=True,
        )
        extracted = (
            Path(temporary)
            / "package"
            / f"{package['name']}-{package['version']}"
            / "Cargo.toml"
        )
        subprocess.run(
            [
                "cargo",
                "test",
                "--manifest-path",
                str(extracted),
                "--offline",
            ],
            check=True,
        )


if __name__ == "__main__":
    main()
