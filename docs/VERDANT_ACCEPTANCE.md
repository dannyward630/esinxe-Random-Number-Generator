# Verdant expedition acceptance notes — 2026-11-03

## Popup menu follow-up

- Browser-tested viewport layout at 1280x720, 390x844 and 844x390. Page width and
  height matched the viewport with no outer overflow; menus remained bounded
  and long content scrolled inside the popup.
- Opened all four menus by hotbar or I/C/L/O; switched tabs by arrow key and
  closed by Escape, Close and the active shortcut. Focus returned to the canvas.
  Typing `i` in the seed input stayed in Settings instead of opening Satchel.
- Crafted a campfire from a stocked local fixture. The popup closed into world
  placement; Cancel retained the kit. Reopened Crafting, placed that kit and
  observed the recipe return from Place to Craft. Satchel lists building kits.
- Manual pause remained active after opening and closing a menu. In a diving
  fixture, air stayed at 49, energy at 100, position at (-11, 9) and the clock
  stayed unchanged while the menu remained open through other checks. Movement
  input in the popup did not move the player. Original local save was restored
  after fixture testing; public progress was not modified for these tests.
- 77 Node tests, TypeScript, five site tests, metadata and formatting checks
  passed. The simulation, save format and world content remain unchanged.

## Terrain and water follow-up

- On the generated local seed 42, walked from camp to Tideglass Lake, entered
  open water and observed swimming posture, wakes and the air HUD. Swam to the
  submerged cache, dove with R and recovered one stone, two berries and one
  field note; story sigils remained zero. Surfacing restored air.
- Automated coverage checks terrain speeds and energy, boots/fins, bridges,
  forest concealment, sentinel water boundaries, air/exhaustion rescue, v2 save
  migration, save round trips and generated biome placement/rewards.
- Review fixes preserve diving while terrain loads and preserve the recorded
  shore when its chunk has been evicted. Simulation waits for the current tile
  to load, preventing underwater saves from advancing against missing terrain.
- Browser automation became unavailable in Work settings before the final
  underwater reload observation. Save/resume is covered by automated tests;
  that final browser observation is not claimed here.

## Original expedition

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
