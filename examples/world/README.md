# Verdant: a practical esinxe integration

From the repository root, run `python -m http.server 8778 --bind 127.0.0.1`, then
open `http://127.0.0.1:8778/examples/world/`. It uses the public JS library without
an engine installation, build step, external assets, or runtime dependencies.

Explore using arrows/WASD or the on-screen movement buttons. Use E/Gather near
berries or caches; E also disarms nearby red sentinels and takes their tokens.
Chunks stream around your position; water, mountains, trees
and rocks restrict movement. Collected entities retain stable IDs through chunk
reloads during the session. A changed seed starts a fresh expedition.

Change worker count, loading order, or grass. Verify reproducibility runs all
18 combinations of three loading orders, three worker counts and two grass
settings against the same chunk coordinates. Export evidence saves the exact
seed, coordinates, content version, configuration results and core SHA-256 hashes.
Grass is excluded from the core fingerprint deliberately; it is optional decor.
Enemies and cache loot use independent addresses. Loot uses stable-ID choice, so
reordering a loot table preserves its results and adding an item only changes
locations won by that item. This tiny exploration example has static encounters,
not a combat simulation or persistent save system.

`generator.js` is the reusable integration boundary; `worker.js` implements the
same message protocol in browser workers and Node worker_threads. Tests use real
workers, not a mocked scheduler. Run `node --test JavaScript/test/world.test.js`.

Terrain interpolation and the entry-region land floor are application rules.
They do not change esinxe. Content version `verdant-world-1` identifies these
rules. Changing a rule or its own loot table can intentionally change results;
algorithm compatibility does not freeze arbitrary application content forever.
