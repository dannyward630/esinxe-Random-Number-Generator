# Terrain and water gameplay

User requests more engaging terrain and actual swimming. Design approval is not
required by the updated brainstorming skill. Retain all story progress and v1.

Build biome-dependent movement and energy, forest concealment, wading, swimming
and a Space swim burst; R toggles diving with a visible air budget. Exhaustion
or depleted air returns the player safely to a recorded shore rather than trapping
them. Bridges remain dry crossings. Fins improve swimming; boots aid rough ground.

Add nearby seeded lake/underwater reward, marsh garden, rocky bluff and woodland
discovery. These preserve old trails, sites and starter resources. They supply
different useful resources and concise field notes separate from story sigils.
Existing v2 saves migrate to v3; the old storage entry remains untouched.

- [x] Simulation and migration tests: movement, water, breath, safety, rewards.
- [x] Seeded biome destinations and tests of overlap, stable IDs, water access.
- [x] Render/UI: swimming posture, wakes, underwater tint, terrain and air HUD,
  tactile terrain detail, new journal/map destinations and dive touch control.
- [ ] Browser play-test, review, CI, push/merge and verify public deployment.

Local generated-world swimming, diving, salvage and surfacing were observed in
the browser. Final browser save/reload observation is unavailable because local
browser control is disabled in Work settings. Automated save/migration coverage
passes. Local validation: 77 Node tests, TypeScript, Ruff, repository checks,
five site tests and static-site build.

Keep no dependency additions and a bounded per-frame effect budget. Use the
current game.js / expedition.js / render.js / app.js module boundaries.
