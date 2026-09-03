# Changelog

All notable changes are documented here. The project follows
[Semantic Versioning](https://semver.org/) for package releases. The algorithm
compatibility version is independent and is named explicitly.

## Unreleased

### Fixed

- Preserved Python scalar/native batch parity for non-positive and full-width
  bounds, and rejected oversized legacy bounds before they can hang or truncate.
- Guarded C shuffle allocation/offset arithmetic and self-swaps.
- Rejected malformed Unicode and forged typed keys in higher-level ports;
  corrected Java wide signed ranges and C# checked-build encoding.
- Replaced destructive site-output deletion with guarded writes and corrected
  demo literals for normalized seeds and Rust string escapes.
- Made Rust package tests self-contained and verified extracted packages in CI.
- Made C instance APIs safe across translation units and moved the legacy
  process-wide stream state into one implementation file.
- Aligned bounded keyed APIs to the largest portable upper bound,
  `2^64 - 1`.
- Rejected unsafe JavaScript `number` inputs before precision can be lost.

### Changed

- Corrected overbroad uniformity/independence claims without changing algorithm
  v1 or its existing golden vectors; expanded keyed, grid, and retry diagnostics.
- Added native/fallback, sanitizer, Unicode, overflow, packaging, and site-output
  regression coverage. See the [engineering evaluation](docs/EVALUATION_2026-09-03.md).
- Added repository automation, project policies, metadata validation, and
  complete per-language documentation.

## 1.1.0 - 2026-06-11

### Added

- Frozen esinxe algorithm v1 and its canonical binary key encoding.
- Structured signed integers, unsigned integers, UTF-8 strings, and byte keys.
- Stateless `raw`, bounded integer, range, float, coordinate, chance, choice,
  shuffle, and weighted-choice helpers across ten languages.
- Shared conformance vectors and a canonical Python vector generator.
- Browser field inspector, practical examples, benchmarks, and quick starts.
- JavaScript/TypeScript, Rust, Go, Java, and Kotlin ports.

### Preserved

- The historical `Next*` stream and random-access APIs.

## 1.0.4 - 2026-06-03

### Added

- Python package metadata and optional native batch acceleration.
- Raw uint64 access, bounded ranges, and statistical regression tests.
- Revived C, C++, C#, Python, and Ruby implementations.

## Historical prototype - 2022-12

- Initial function-based random-number generator experiments.
