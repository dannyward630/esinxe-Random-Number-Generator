# Changelog

All notable changes are documented here. The project follows
[Semantic Versioning](https://semver.org/) for package releases. The algorithm
compatibility version is independent and is named explicitly.

## Unreleased

### Fixed

- Verdant walking now interpolates between simulation updates and integrates
  its stride phase continuously, preventing snapping at high refresh rates or
  after long play sessions. Mouse-look works with a click, releases on Escape
  and menus, and supports embedded browsers without cursor capture.

### Added

- Verdant 3D adventure: a third-person orbit camera, camera-relative movement,
  physical jumping, raised faceted terrain, animated explorer/sentinels, distinct
  ruins, water and underwater views, sky/clouds, soft shadows and warm lights.
  Instanced foliage fades around the player; streamed GPU resources are bounded
  and disposed on eviction. Menus remain in view, touch building gains aim/confirm,
  and self-hosted rendering has quality controls plus a 2D compatibility option.

- Verdant viewport-filling game layout with a four-slot menu hotbar, item-slot
  satchel and popup crafting, journal and settings. I/C/L/O open menus; native
  dialog focus/Escape handling and automatic simulation pause keep play in view.
- Verdant terrain traversal, forest concealment, swimming/strokes, diving with
  an air budget, safe shore recovery and craftable fins. Four seeded biome
  discoveries add underwater salvage, supplies and field notes. Swimming wakes,
  underwater effects and terrain/air HUD make traversal visible; existing
  expedition saves migrate with their progress preserved.
- Verdant survival expedition: continuous movement/dash, active sentinels,
  harvesting and crafting, placeable campfires/bridges, day/night, local saves,
  three seeded story ruins and an optional beacon ending. Incremental chunk
  caching and a persistent worker pool replace whole-area reloads.
- Playable streamed-world integration with actual browser/Node workers and
  exportable loading-order, worker-count, and optional-decor invariance evidence.
- Unweighted stable-ID rendezvous choice across all ten ports and a shared
  independently generated corpus; existing v1 choices and vectors are unchanged.
- Python `rawBatch` native acceleration with fallback parity, plus reproducible
  stable-hash and experimental Philox benchmarks with retained raw measurements.
- Installed npm tarball runtime/type checks and downloadable CI package artifacts.
- Scoped typed key prefixes, deterministic sampling without replacement, and
  prepared cumulative-weight choices across all ten ports, with copied snapshots
  and a separate additive helper specification.
- Independent shared conformance corpus covering numeric limits, multiple
  rejection retries, UTF-8/NULs, namespaces, and the new helpers across ports.
- Length-bearing C string/coordinate helpers and a documented capability matrix.
- Generic Python stubs, `py.typed`, and installed-wheel runtime/type consumer tests.
- Windows cross-language CI and Node 18 / Rust 1.70 / Go 1.22 minimum-runtime checks.

### Fixed

- Windows compiler/launcher discovery, Unicode subprocess source, and explicit
  source-file encoding; honored quoted `CC`/`CXX` compiler overrides.
- Rust lockfile compatibility with the documented 1.70 compiler floor.

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
