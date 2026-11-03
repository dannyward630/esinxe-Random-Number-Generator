# Complete Review Implementation Plan

> **For agentic workers:** Use test-driven implementation and the parallel-agent skill for independent port work. Each owner runs focused red/green checks; integration runs the full suite and a fresh branch review.

**Goal:** Fix the reviewed issues, add the approved portable helpers, and merge verified changes into public main.

**Architecture:** Build on PR #12. Preserve frozen v1 outputs. Extend each port with seed/prefix snapshots, sample-v1 Fisher-Yates, and copied cumulative-weight samplers; use one machine-readable corpus across ports.

**Tech Stack:** Python 3.9+, C11, C++17, C#, Ruby, Node 18+/TypeScript, Rust 1.70+, Go, Java 21, Kotlin.

**Spec:** ../specs/2026-11-02-complete-review-design.md

## Global Constraints

- Existing v1 vector files remain byte-for-byte unchanged.
- No new runtime dependencies or registry publication.
- Public pushes/merges are explicitly authorized.
- All ten advertised ports implement new keyed helper semantics.

## Review Focus

- Zero counts/weights and invalid keys must not bypass validation.
- Scoped/prepared snapshots must survive caller mutation and parent reseeding.
- UTF-8, embedded NUL, absent/empty namespaces, integer extremes, and rejection retries require shared cases.
- Windows tools/encodings and installed consumer artifacts must work without diagnostic monkeypatches.
- Sample prefixes and prepared selections must match their documented deterministic contracts.

## Task 1: Shared corpus and specification

- [x] Define helper supplement and JSON corpus schema, including expected existing and new results.
- [x] Use independent byte encoding to calculate fixtures and pin edge/retry behavior.

## Task 2: Native ports (C/C++)

- [x] Add failing scope/sample/prepared and length-bearing string tests.
- [x] Implement helpers without changing existing outputs, document C ownership.
- [x] Run strict compiler and shared-corpus checks.

## Task 3: Managed ports (Java/Kotlin/C#/Ruby)

- [x] Add failing helper/snapshot tests per port.
- [x] Implement scope/sample/prepared semantics.
- [x] Add adapters consuming shared fixture expectations and run available toolchains.

## Task 4: Modern ports (JavaScript/Rust/Go)

- [x] Add failing helper/snapshot tests and declarations.
- [x] Implement helper contracts, shared-corpus adapters, and idiomatic errors.
- [x] Run language tests, formatting, typing, and packaged Rust checks.

## Task 5: Python, Windows tooling, typing, and consumers

- [x] Add failing Windows tool/encoding and Python helper/snapshot tests.
- [x] Implement helpers, UTF-8 subprocess scripts, tool resolution/overrides, and Windows CI.
- [x] Add public generic stubs, py.typed, installed-wheel/type consumer tests.
- [x] Run native/fallback tests, typing, lint, packaging, and Windows suite.

## Task 6: Integration and publication

- [x] Document capability matrix and additions, update quick starts/changelog and CI.
- [x] Review integrated branch independently, fix findings, preserve original vectors.
- [ ] Push concrete commits, refresh PR description, wait for checks, merge PR #12 and compatible pending dependency updates after checks.
- [ ] Verify main commit/checks and public demo; report links and limitations.
