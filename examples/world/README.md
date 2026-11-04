# Verdant: The Drowned Signal

A colorful 3D survival expedition built on esinxe, with a self-hosted Three.js
renderer and an optional 2D compatibility view. Run `python -m http.server
8778 --bind 127.0.0.1` from the repository root and open
`http://127.0.0.1:8778/examples/world/`.

Move with WASD/arrows or the on-screen arrows. In 3D, movement follows the
camera; Space jumps on land or strokes in water, Shift dashes, J strikes or
harvests, E gathers/inspects/rests, F eats berries and R dives/surfaces. Orbit with
right-drag or Q/T, zoom with the wheel or +/-, and press H to reset the camera.
On touch, drag the world to orbit or use the camera buttons. M opens the survey
map and P pauses. Foreground trees fade when they obscure the explorer.

The bottom hotbar opens Satchel (I), Crafting (C), Journal (L) and Settings (O).
Menus and the survey pause the world, including jump and survival timers.
Escape or Close returns to play; a manual pause stays paused. Menu tabs support
left/right arrows. Long content scrolls inside the popup on small screens.
Settings offer Light/Balanced/Rich rendering and 2D compatibility. In 2D,
movement follows the map and Space retains dash/stroke; the jump button is hidden.
The first 3D visit starts paused with a short controls introduction.

Facing matters when striking. Harvest by hand to get started; an axe increases
the yield. Craft buttons show exact costs and missing materials. Campfire and
bridge kits must be placed on nearby valid ground. In 3D, aim at the ground and
click; on touch, tap to preview, then use Place here or E to confirm. Green/red
previews show valid/invalid sites; Cancel placement keeps the kit. A bridge
extends a crossing one water tile at a time. R toggles diving in deep water.
Watch air while diving and energy while swimming. Surface to breathe or return
to shore to rest; exhaustion returns you to the last safe shore with a health
penalty. Craft swim fins for faster, less tiring swimming, a lantern for dusk,
and trail boots for easier rough ground and mountain scrambling. Jumps clear
low rocks; tree trunks and unbooted mountains remain solid.

Terrain changes your route: old trails are quick, sand and shallows slow you,
marshes drain energy, and forest conceals you from sentinels. Bridges stay dry.
Four nearby biome discoveries offer useful supplies and separate field notes:
Tideglass Lake (search underwater), a marsh garden, a rocky bluff and an ancient
grove. Follow the exploration compass or use the survey map to find them.

Health and energy make excursions matter. Sentinels patrol and telegraph their
strikes; evade with a dash or fight with a pulse. The beacon camp is safe. A
campfire provides another recovery point. Defeat returns you to the beacon,
preserves discoveries, and leaves lost supplies in a recoverable cache.

Three independently placed ruins have connected trails, original journal entries
and sigils. Visit them in any order, or ignore them and gather/build. Bring all
three sigils to the beacon and inspect it to resolve the signal's mystery.
Free exploration continues after the ending.

Progress saves locally every five active seconds and on hiding the tab; Save
expedition saves immediately. Storage errors do not prevent play. New expedition
asks before replacing progress for the chosen seed. Saves are local to the
browser/origin, not cloud saves. Version 2 expeditions migrate automatically,
retaining progress and leaving the old save entry untouched. Sound is optional and starts
only on a user gesture; reduced-motion preferences limit animation/particles.

`generator.js` remains the frozen `verdant-world-1` integration. `expedition.js`
overlays seeded trails, landmarks and guaranteed starter supplies under content
version `verdant-expedition-3`. `game.js` separates mutable simulation and saved
progress from generated content. `stream.js` reuses workers and caches at most
49 chunks. `render3d.js` handles the camera, lighting, water, survey and mutable
actors; `scene-world.js` batches chunk geometry and decorations; `scene-actors.js`
builds animated procedural models. `spatial.js` shares terrain/picking height
rules. Chunks use local geometry under a floating origin, and release instance,
geometry and material resources on eviction. `render.js` remains the 2D view.

Three.js 0.187.0 and its MIT license are pinned under [vendor/three](vendor/three/README.md)
and copied by the guarded site builder, with no runtime CDN requests. The esinxe
library packages do not acquire this demo dependency. Rendering detail caps
pixel and shadow budgets; reduced motion limits camera easing, waves and effects.
The original world and v3 save format remain intact. Airborne saves resume from
the safe jump launch point, grounded, while keeping inventory/story progress.

The optional field lab retains seed/loading controls and an exportable 18-case
proof of the frozen base generator. It does not claim identical mutable combat
state for different player inputs. Tests separately verify expedition trails,
grass isolation, resource/crafting accounting, movement, combat, saves and the
complete story route. Run `npm test --prefix JavaScript`.
