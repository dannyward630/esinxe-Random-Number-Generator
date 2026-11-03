# Verdant living world implementation plan

**Goal:** Build the approved survival sandbox and optional mystery.
**Spec:** ../specs/2026-11-03-verdant-living-world-design.md
**Architecture:** Keep frozen generator intact; overlay a versioned expedition
content layer. Pure simulation owns input, combat, crafting and saves. Canvas
renderer and browser shell own presentation and cached streaming.
**Tech stack:** Dependency-free ESM, Canvas, WebAudio, browser workers, Node tests.

## Constraints and review

Preserve library v1 and existing generator evidence. New content has its own
version. Review resource conservation, unreachable sites, stale worker results,
save validation, frame-rate-independent movement, and bounded caches.

- [ ] Pure simulation: failing tests, implement movement/dash/collision, resources,
  recipes/placement, enemies, day/night, story and versioned save round trips.
- [ ] Expedition content: seeded landmarks, connected trails, distinctive story
  sites and independent resources; tests of IDs and reachable corridors.
- [ ] Browser integration: held input, cached incremental chunks, HUD/crafting/
  journal/save controls, rendered sprites, weather/light/audio/feedback.
- [ ] Play-test complete loop, mobile controls, blur/pause, persistence and proof.
- [ ] Review whole branch, run checks, push PR, wait CI, merge and verify Pages.

Ruling: the previous generator remains a frozen reproducibility example; new
expedition content overlays it so old evidence remains meaningful. The field lab
labels the frozen proof explicitly. Live game saves use a separate version.
