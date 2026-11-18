# Release Process

The tag workflow publishes verified downloads to GitHub Releases. Registry
publication can use the same verified builds once trusted publishing is configured.

1. Choose a package version using Semantic Versioning.
2. Confirm whether the algorithm version changes. Ordinary fixes and API
   additions must not alter algorithm v1 vectors.
3. Set the release version in `pyproject.toml` and synchronize `JavaScript/package.json`,
   `JavaScript/package-lock.json`, `Rust/Cargo.toml`, `Rust/Cargo.lock`, and
   `src/esinxe/__init__.py`, and `CITATION.cff`. Run `python scripts/check_repo.py`.
4. Regenerate `tests/vectors-v1.json` and confirm that only its package version
   metadata changed. Algorithm v1 results are frozen.
5. Add a version heading such as `## 1.2.0 - 2026-11-17` to `CHANGELOG.md`.
6. Run `./scripts/ci.sh` and wait for the published commit to pass CI.
7. Tag the tested commit with `v1.2.0` and `Go/v1.2.0` for the nested Go module.
8. Push both tags and verify the release workflow, downloads and SHA-256 manifest.

Registry publication should be added as a separate, protected workflow using
trusted publishing rather than long-lived API tokens.
