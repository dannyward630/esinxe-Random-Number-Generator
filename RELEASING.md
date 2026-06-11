# Release Process

Package registries are not currently configured, but release artifacts and
compatibility commitments should still be prepared consistently.

1. Choose a package version using Semantic Versioning.
2. Confirm whether the algorithm version changes. Ordinary fixes and API
   additions must not alter algorithm v1 vectors.
3. Update versions in `pyproject.toml`, `JavaScript/package.json`,
   `JavaScript/package-lock.json`, `Rust/Cargo.toml`, `Rust/Cargo.lock`, and
   `src/esinxe/__init__.py`.
4. Regenerate `tests/vectors-v1.json` and confirm it is unchanged unless a new
   algorithm version is intentionally being introduced.
5. Update `CHANGELOG.md`.
6. Run `./scripts/ci.sh`.
7. Create an annotated tag such as `v1.1.0`.
8. Publish a GitHub release containing the changelog section, Python wheel and
   source distribution, and checksums.

Registry publication should be added as a separate, protected workflow using
trusted publishing rather than long-lived API tokens.
