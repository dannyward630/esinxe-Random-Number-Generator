# Verdant: The Drowned Signal

A dependency-free survival expedition built on esinxe. Run `python -m http.server
8778 --bind 127.0.0.1` from the repository root and open
`http://127.0.0.1:8778/examples/world/`.

Move with WASD/arrows or hold the on-screen arrows. Space dashes, J strikes or
harvests, E gathers/inspects/rests, F eats berries, M opens the survey map and P
pauses. The game fills the screen; the bottom hotbar opens Satchel (I), Crafting
(C), Journal (L) and Settings (O) as popups. Menus pause the world, including
survival timers. Escape or Close returns to play; a manual pause stays paused.
Use left/right arrows to switch menu tabs. Long menu content scrolls within
the popup on small screens. Facing matters when striking. Harvest by hand to get started; an axe
increases the yield. Craft buttons show exact costs and missing materials.
Campfire/bridge kits must be placed on nearby valid ground; click the map to
place or use Cancel placement. A bridge extends a crossing one water tile at a
time. R toggles diving in deep water; Space becomes a swim stroke. Watch air
while diving and energy while swimming. Surface to breathe, or return to shore
to rest. Running out returns you to the last safe shore with a health penalty.
Craft swim fins for faster, less tiring swimming. A lantern helps after dusk;
trail boots ease marshes and hills and let you scramble over mountains.

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
49 chunks; `render.js` caches terrain and draws moving entities and effects.

The optional field lab retains seed/loading controls and an exportable 18-case
proof of the frozen base generator. It does not claim identical mutable combat
state for different player inputs. Tests separately verify expedition trails,
grass isolation, resource/crafting accounting, movement, combat, saves and the
complete story route. Run `npm test --prefix JavaScript`.
