# Practical Value Implementation Plan

**Goal:** Demonstrate practical use, measure alternatives, improve stable content
selection and keyed throughput, and package usable deliverables without changing v1.

**Spec:** ../specs/2026-11-02-practical-value-design.md

**Architecture:** A browser world consumes the existing public JS API. Independent
benchmark candidates remain outside the core. Stable-choice adds a reserved domain;
native Python batching reuses frozen encoding/mixing. One corpus verifies ports.

**Tech stack:** Existing ten ports; browser Canvas/modules/workers; Python stdlib
benchmark tooling with explicitly optional research dependencies.

## Review focus

- Worker scheduling, scope/namespace boundaries, and unrelated optional features.
- Stable candidate IDs, candidate reorder/add/remove and deterministic tie breaking.
- Native/fallback parity, invalid rows, mutable bytes, and unchanged stream state.
- Fair scalar versus batch comparisons and full reproducible source provenance.
- Installed consumers, public artifact links and no unsupported backend claims.

## Tasks

- [x] Build browser world and executable order/worker/feature-isolation proofs.
- [x] Build independent stable-hash/Philox research harness and record comparisons.
- [x] Add/test Python native keyed batches and measure the end-to-end effect.
- [x] Specify/implement/test stable-ID choice across ports and shared fixtures.
- [x] Verify installable Python/npm artifacts and document a working integration.
- [ ] Review, run full checks, preserve old vectors, and publish evidence/deliverables.
