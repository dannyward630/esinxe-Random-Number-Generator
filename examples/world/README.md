# Verdant: The Drowned Signal

A dependency-free survival expedition built on esinxe. Run `python -m http.server
8778 --bind 127.0.0.1` from the repository root and open
`http://127.0.0.1:8778/examples/world/`.

Move with WASD/arrows or hold the on-screen arrows. Space dashes, J strikes or
harvests, E gathers/inspects/rests, F eats berries, M opens the survey map and P
pauses. Facing matters when striking. Harvest by hand to get started; an axe
increases the yield. Craft buttons show exact costs and missing materials.
Campfire/bridge kits must be placed on nearby valid ground; click the map to
place or use Cancel placement. A bridge extends a crossing one water tile at a
time. A lantern helps after dusk, and trail boots improve movement.

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
browser/origin and content version, not cloud saves. Sound is optional and starts
only on a user gesture; reduced-motion preferences limit animation/particles.

`generator.js` remains the frozen `verdant-world-1` integration. `expedition.js`
overlays seeded trails, landmarks and guaranteed starter supplies under content
version `verdant-expedition-2`. `game.js` separates mutable simulation and saved
progress from generated content. `stream.js` reuses workers and caches at most
49 chunks; `render.js` caches terrain and draws moving entities and effects.

The optional field lab retains seed/loading controls and an exportable 18-case
proof of the frozen base generator. It does not claim identical mutable combat
state for different player inputs. Tests separately verify expedition trails,
grass isolation, resource/crafting accounting, movement, combat, saves and the
complete story route. Run `npm test --prefix JavaScript`.
