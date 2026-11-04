# Verdant 3D acceptance

Tested 2026-11-03/04 in the Windows in-app Chromium browser, using the generated
site and isolated localhost save fixtures. These are desktop browser observations,
including phone-size viewport emulation, not physical phone hardware results.

## Play and presentation

- Actual WebGL renders faceted raised terrain, forests, flowers, shallow/deep
  water, shore foam, the beacon, ruins, clouds, animated explorer and sentinels.
  Foreground tree instances fade independently, including decorative trees.
- Camera-relative held movement, Q/T orbit, camera buttons, zoom, reset, jumping
  and landing worked. Walked from camp through x=16 to (23.4, 1.9); chunk and
  floating-origin transitions retained continuous ground and actors.
- Harvested a tree with J. Crafted axe, boots, fins, lantern and a campfire.
  Touch-pointer aiming showed a world preview and separate Place here button;
  confirmation placed a fire at (2, 4). Inventory was wood 17, stone 21,
  berries 23 with all four tools equipped and no unspent campfire kit.
- Entered Tideglass Lake and swam to its cache near (-11, 9). Surface inspection
  requested diving; diving and inspection awarded one stone, two berries and a
  field note, with no story sigil. Swimming pose, wakes and air were visible.
  A saved dive restored its position, diving state and air; Surface restored
  breathing. Air depletion returned the explorer to the recorded shore with
  the expected health penalty. Submerged camera orbit now stops before banks
  and islands rather than passing through their geometry.
- Encountered a pursuing 3D sentinel outside camp; its strike reduced health
  from 100 to 82. Moving away escaped it. Actor tests also cover windup/hit poses.
- Native Satchel/Crafting/Journal/Settings popups and the overhead survey pause
  simulation. The survey labels camp, ruins and the four biome destinations.
  Manual pause survives menu use. Existing crafting, lore and survival remain.
- Explicit 2D compatibility preserved position, tools, inventory and the placed
  fire. Space retained its 2D dash behavior. A local-only fixture forcing WebGL
  creation failure automatically selected working 2D controls and a clear notice.
- Inspected the 3D world, survey and menus at 390x844 and menus at 844x390.
  Gameplay controls fit the viewport; longer popup content scrolls internally.
  Tested Light/Rich/Balanced settings and changed workers/grass without losing
  supplies. Viewport and temporary browser overrides were reset after testing.

## Engineering verification

- 98 Node tests passed, including real Three.js geometry/raycast/resource tests,
  shared positive/negative chunk corners, ambient occlusion, camera movement,
  jump arcs/obstacles/water, safe airborne saves, and existing full story tests.
- TypeScript, six Python site-build tests, repository metadata checks, Ruff and
  JavaScript syntax checks passed. The frozen generator and original fixtures
  have no changes. The guarded builder copies all pinned vendor modules/license.
- Browser logs showed no new errors during normal 3D checks. The deliberately
  induced WebGL failure is excluded from that observation.
- Observed 59-60 FPS in an active balanced desktop session. After a chunk
  transition, telemetry showed 350 draw calls, 103110 triangles, 239 geometries,
  8 textures and 30 cached chunks. These are one-host measurements, not a device
  performance guarantee. Quality modes cap pixel/shadow budgets; the stream
  caps at 49 chunks and effects have fixed bounds.
- Independent integration review found seam walls, double jump lift, missing
  instance-buffer disposal, immediate touch placement and misleading hints.
  All were corrected. A follow-up identified decorative canopy occlusion;
  root added global visual-only occluder metadata and a regression test.

## Compatibility choices

The original horizontal world and v3 save identity remain authoritative. Jump
height is transient, and airborne saves resume grounded at their safe launch
point. This is a third-person 3D expedition with existing tile-based crafting
and building, not arbitrary voxel editing. WebGL2 is required for 3D; the 2D
view remains available. Three.js 0.187.0 is self-hosted with its MIT license.

The first 3D arrival starts paused to explain controls and protect a returning
expedition. Public save data is never replaced with acceptance fixtures.
