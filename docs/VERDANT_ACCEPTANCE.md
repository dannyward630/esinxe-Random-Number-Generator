# Verdant expedition acceptance notes — 2026-11-03

Tested local generated site in the in-app Chromium browser on Windows.

- Held movement: a one-second right input moved about 3.3 tiles; a 9.3-second
  west input moved about 29.9 tiles, matching the 3.2 tiles/second simulation
  within input/capture timing. Movement no longer depends on keyboard repeat.
  This is an input observation, not a universal frame-rate claim.
- Followed the west trail to the Drowned Observatory, returned through camp,
  visited the Glass Grove and Ash Archive, recovered three sigils and activated
  the beacon. Health fell from sentinel strikes while travelling. Continued play
  remained available after the ending.
- Saved, reloaded, and observed the completed story, journal and position resume.
- In a fresh final build, hand-harvested three trees/two stone nodes, observed
  recipe availability change, crafted the axe, and verified beacon recovery.
- Inspected phone layout at 390x844, including the game, HUD, touch directions,
  action row and stacked inventory/crafting/journal. Reset viewport afterwards.
- 63 Node tests passed locally, including movement/dash, actual generated starter
  crafting, combat, depletion, placement, save validation, whole story traversal,
  site guardians, trails, worker invariance and chunk-cache reuse/bounds.
- Existing base generator and original library fixtures remain unchanged.

Review fixes: no story credit for caches; real home recovery; whole-vector dash
selection; one attack cooldown decrement; capped placement compatible with save
limits; story interactions precede pickups; keyboard buttons retain Space;
independent touch pointers; accurate placement preview and touch cancellation;
recipe shortage messages; distinct site silhouettes and guaranteed guardians.

Design ruling: bridge kits extend water crossings one tile at a time from a
walkable bank or existing bridge. This is deliberate incremental construction,
not a promise to span arbitrarily deep water with one kit.
