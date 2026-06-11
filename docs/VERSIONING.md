# Versioning and Compatibility

esinxe has two distinct version numbers.

## Package Version

The package version follows Semantic Versioning:

- patch: fixes, documentation, tests, and performance changes that preserve
  public behavior;
- minor: backward-compatible APIs or ports; and
- major: incompatible package or API changes.

The same package version is displayed for Python, JavaScript, and Rust. Other
source-first ports identify compatibility through the algorithm version until
they gain independent registry packages.

## Algorithm Version

The algorithm version controls deterministic output. Algorithm v1 is frozen.
For a given seed, typed key, and v1 helper, every conforming implementation
must return the same result permanently.

Any intentional output change requires:

- a new specification such as `SPEC_V2.md`;
- new versioned vector files;
- explicit API selection or migration guidance;
- simultaneous support in every advertised conforming port; and
- a package release that clearly describes the compatibility break.

Bug fixes must not silently rewrite v1 vectors.

## Source Pinning

Until registry packages are published, consumers should pin a Git commit or
release tag. Tracking `main` directly is appropriate for evaluation, not for a
production compatibility boundary.
