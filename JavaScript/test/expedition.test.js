import assert from "node:assert/strict";
import test from "node:test";
import {
  CHUNK_SIZE,
  chunkForTile,
  generateChunk,
} from "../../examples/world/generator.js";

const expedition = await import("../../examples/world/expedition.js").catch(() => null);

function api() {
  assert.ok(expedition, "the expedition content module must exist");
  assert.equal(typeof expedition.landmarksForSeed, "function");
  assert.equal(typeof expedition.decorateChunk, "function");
  assert.equal(expedition.EXPEDITION_VERSION, "verdant-expedition-3");
  return expedition;
}

function coordKey(x, y) { return `${x},${y}`; }

function makeDecoratedWorld(seed, landmarks) {
  const margin = 7;
  const sites = [...landmarks, ...api().biomeSitesForSeed(seed)];
  const minX = Math.min(0, ...sites.map((site) => site.x)) - margin;
  const maxX = Math.max(0, ...sites.map((site) => site.x)) + margin;
  const minY = Math.min(0, ...sites.map((site) => site.y)) - margin;
  const maxY = Math.max(0, ...sites.map((site) => site.y)) + margin;
  const minCx = Math.floor(minX / CHUNK_SIZE);
  const maxCx = Math.floor(maxX / CHUNK_SIZE);
  const minCy = Math.floor(minY / CHUNK_SIZE);
  const maxCy = Math.floor(maxY / CHUNK_SIZE);
  const chunks = [];
  const tiles = new Map();
  const blocking = new Set();

  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const chunk = api().decorateChunk(generateChunk({ seed, cx, cy }));
      chunks.push(chunk);
      for (const tile of chunk.tiles) tiles.set(coordKey(tile.x, tile.y), tile);
      for (const entity of chunk.entities) {
        if (entity.blocking) blocking.add(coordKey(entity.x, entity.y));
      }
    }
  }
  return { chunks, tiles, blocking };
}

function pathTiles(site) {
  const result = new Set();
  const fromX = Math.min(0, site.x);
  const toX = Math.max(0, site.x);
  for (let x = fromX; x <= toX; x++) {
    for (let offset = -1; offset <= 1; offset++) result.add(coordKey(x, offset));
  }
  const fromY = Math.min(0, site.y);
  const toY = Math.max(0, site.y);
  for (let y = fromY; y <= toY; y++) {
    for (let offset = -1; offset <= 1; offset++) result.add(coordKey(site.x + offset, y));
  }
  return result;
}

function destinationTiles(site, radius) {
  const result = new Set();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      result.add(coordKey(site.x + dx, site.y + dy));
    }
  }
  return result;
}

function reachableTiles(tiles, blocking, start = [0, 0]) {
  const seen = new Set([coordKey(...start)]);
  const queue = [start];
  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, y + dy];
      const key = coordKey(...next);
      const tile = tiles.get(key);
      if (!tile || ["water", "mountain"].includes(tile.terrain)
          || blocking.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
}

test("four nearby biome sites are seeded, typed, and independent of story landmarks", () => {
  assert.equal(typeof expedition?.biomeSitesForSeed, "function");
  const { biomeSitesForSeed, landmarksForSeed } = expedition;
  const kinds = ["marsh-herb-garden", "rocky-bluff", "tidal-lake", "woodland-grove"];
  const first = biomeSitesForSeed(41);
  assert.deepEqual(first.map((site) => site.kind).sort(), kinds);
  assert.deepEqual(biomeSitesForSeed("41"), first);
  assert.notDeepEqual(biomeSitesForSeed(42).map(({ x, y }) => [x, y]), first.map(({ x, y }) => [x, y]));
  assert.equal(new Set(first.map((site) => site.id)).size, 4);
  assert.equal(new Set(first.map(({ x, y }) => coordKey(x, y))).size, 4);

  for (const site of first) {
    assert.deepEqual(Object.keys(site).sort(), ["color", "id", "kind", "terrain", "text", "title", "x", "y"]);
    assert.ok(Number.isSafeInteger(site.x) && Number.isSafeInteger(site.y));
    assert.ok(Math.abs(site.x) >= 8 && Math.abs(site.x) <= 24);
    assert.ok(Math.abs(site.y) >= 8 && Math.abs(site.y) <= 24);
    assert.ok(site.title.length > 0 && site.text.length > 40 && site.color.length > 0);
    assert.ok(!landmarksForSeed(41).some((landmark) => landmark.id === site.id));
  }
});

test("biome destinations keep old routes clear and place differentiated caches in their owner chunks", () => {
  const { biomeSitesForSeed, landmarksForSeed } = api();
  for (const seed of [1, 2, 3, 41, 20261103, -20261103]) {
    const landmarks = landmarksForSeed(seed);
    const sites = biomeSitesForSeed(seed);
    const world = makeDecoratedWorld(seed, landmarks);
    const allEntities = world.chunks.flatMap((chunk) => chunk.entities);
    const allBiomeSites = world.chunks.flatMap((chunk) => chunk.biomeSites ?? []);
    const storyTrail = new Set(landmarks.flatMap((landmark) => [...pathTiles(landmark)]));
    assert.deepEqual(allBiomeSites.map((site) => site.id).sort(), sites.map((site) => site.id).sort());
    assert.equal(new Set(allBiomeSites.map((site) => site.id)).size, 4);

    for (const site of sites) {
      const owner = chunkForTile(site.x, site.y);
      const ownerChunk = world.chunks.find((chunk) => chunk.cx === owner.cx && chunk.cy === owner.cy);
      assert.ok(ownerChunk?.biomeSites?.some((owned) => owned.id === site.id));
      assert.ok(!landmarks.some((landmark) => landmark.id === site.id));

      const radius = site.kind === "tidal-lake" ? 5 : 4;
      const footprint = destinationTiles(site, radius);
      for (const key of footprint) {
        assert.ok(!storyTrail.has(key), `${site.kind} overlaps an old trail at ${key} for seed ${seed}`);
        assert.ok(!allEntities.some((entity) => entity.campResource && coordKey(entity.x, entity.y) === key),
          `${site.kind} overlaps a starter resource at ${key} for seed ${seed}`);
      }

      const cache = allEntities.find((entity) => entity.type === "cache" && entity.noteId === site.id);
      assert.ok(cache, `missing ${site.kind} cache for seed ${seed}`);
      assert.equal(cache.note, site.text);
      assert.equal(cache.requiresDive, site.kind === "tidal-lake");
      assert.deepEqual(Object.keys(cache.reward).sort(), ["berries", "stone", "wood"]);
      assert.ok(Object.values(cache.reward).every((amount) => Number.isInteger(amount) && amount >= 0));
      assert.ok(Object.values(cache.reward).some((amount) => amount > 0));
      const cacheOwner = chunkForTile(cache.x, cache.y);
      const cacheOwnerChunk = world.chunks.find((chunk) => chunk.cx === cacheOwner.cx && chunk.cy === cacheOwner.cy);
      assert.ok(cacheOwnerChunk?.entities.some((entity) => entity.id === cache.id));
    }

    const cacheRewards = Object.fromEntries(sites.map((site) => [
      site.kind,
      allEntities.find((entity) => entity.type === "cache" && entity.noteId === site.id).reward,
    ]));
    assert.deepEqual(cacheRewards, {
      "tidal-lake": { wood: 0, stone: 1, berries: 2 },
      "marsh-herb-garden": { wood: 0, stone: 0, berries: 3 },
      "rocky-bluff": { wood: 0, stone: 3, berries: 0 },
      "woodland-grove": { wood: 2, stone: 0, berries: 2 },
    });

    const lake = sites.find((site) => site.kind === "tidal-lake");
    const lakeCache = allEntities.find((entity) => entity.type === "cache" && entity.noteId === lake.id);
    assert.equal(world.tiles.get(coordKey(lakeCache.x, lakeCache.y))?.terrain, "water");
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (Math.hypot(dx, dy) > 5) continue;
        const tile = world.tiles.get(coordKey(lake.x + dx, lake.y + dy));
        assert.ok(tile, `missing lake tile at ${dx},${dy} for seed ${seed}`);
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) {
          assert.notEqual(tile.terrain, "water", `lake islet flooded at ${dx},${dy} for seed ${seed}`);
        } else {
          assert.equal(tile.terrain, "water", `lake ring is dry at ${dx},${dy} for seed ${seed}`);
        }
      }
    }

    const reachable = reachableTiles(world.tiles, world.blocking);
    const shoreApproaches = [
      [lake.x - 6, lake.y], [lake.x + 6, lake.y],
      [lake.x, lake.y - 6], [lake.x, lake.y + 6],
    ];
    assert.ok(shoreApproaches.some(([x, y]) => reachable.has(coordKey(x, y))),
      `no walkable camp-to-shore landing for seed ${seed}`);

    const marsh = sites.find((site) => site.kind === "marsh-herb-garden");
    const bluff = sites.find((site) => site.kind === "rocky-bluff");
    const grove = sites.find((site) => site.kind === "woodland-grove");
    assert.equal(world.tiles.get(coordKey(marsh.x, marsh.y))?.terrain, "marsh");
    assert.equal(world.tiles.get(coordKey(bluff.x, bluff.y))?.terrain, "hill");
    assert.equal(world.tiles.get(coordKey(bluff.x + 3, bluff.y))?.terrain, "mountain");
    assert.equal(world.tiles.get(coordKey(grove.x, grove.y))?.terrain, "forest");
  }
});

test("expedition landmarks are seeded, distinct, and carry original site lore", () => {
  const { landmarksForSeed } = api();
  const seeds = [1, 2, 3, 4, 5, 17, 41, -20261103];
  const coordinateSets = new Set();

  for (const seed of seeds) {
    const landmarks = landmarksForSeed(seed);
    assert.equal(landmarks.length, 3);
    assert.deepEqual(landmarks.map((site) => site.kind).sort(), [
      "ash-archive", "drowned-observatory", "glass-grove",
    ]);
    assert.equal(new Set(landmarks.map((site) => site.id)).size, 3);
    assert.equal(new Set(landmarks.map((site) => coordKey(site.x, site.y))).size, 3);
    for (const site of landmarks) {
      assert.deepEqual(Object.keys(site).sort(), ["color", "id", "kind", "text", "title", "x", "y"]);
      assert.ok(Number.isSafeInteger(site.x) && Number.isSafeInteger(site.y));
      const distance = Math.hypot(site.x, site.y);
      assert.ok(distance >= 18 && distance <= 40, `${site.kind} distance was ${distance}`);
      assert.ok(site.title.length > 0 && site.text.length > 40 && site.color.length > 0);
      assert.ok(site.id.length > 0);
    }
    coordinateSets.add(JSON.stringify(landmarks.map(({ x, y }) => [x, y])));
  }
  assert.ok(coordinateSets.size > 1, "landmark coordinates should vary with the seed");
});

test("decorating a chunk clones it and leaves the base generation and grass untouched", () => {
  const { decorateChunk, EXPEDITION_VERSION } = api();
  const base = generateChunk({ seed: 41, cx: -1, cy: 0, includeGrass: true });
  const snapshot = structuredClone(base);
  const first = decorateChunk(base);
  const second = decorateChunk(base);
  assert.deepEqual(base, snapshot);
  assert.deepEqual(first, second);
  assert.equal(first.contentVersion, EXPEDITION_VERSION);
  assert.ok(first !== base && first.tiles !== base.tiles && first.entities !== base.entities);
  assert.deepEqual(first.grass, base.grass);
  assert.ok(first.grass.length > 0);
});

test("decorated core is invariant to optional grass", () => {
  const { decorateChunk } = api();
  const bare = decorateChunk(generateChunk({ seed: "-20261103", cx: 0, cy: 0 }));
  const grassy = decorateChunk(generateChunk({ seed: "-20261103", cx: 0, cy: 0, includeGrass: true }));
  assert.deepEqual(bare.tiles, grassy.tiles);
  assert.deepEqual(bare.entities, grassy.entities);
  assert.deepEqual(bare.landmarks, grassy.landmarks);
  assert.deepEqual(bare.biomeSites, grassy.biomeSites);
  assert.ok(Array.isArray(grassy.grass) && grassy.grass.length > 0);
});

test("three-tile trails and site clearings are passable and connected across chunk boundaries", () => {
  const { landmarksForSeed } = api();
  for (const seed of [1, 2, 3, 41, 20261103, -20261103]) {
    const landmarks = landmarksForSeed(seed);
    const world = makeDecoratedWorld(seed, landmarks);
    for (const site of landmarks) {
      const corridor = pathTiles(site);
      for (const key of corridor) {
        const tile = world.tiles.get(key);
        assert.ok(tile, `missing corridor tile ${key}`);
        assert.ok(!["water", "mountain"].includes(tile.terrain), `blocked terrain at ${key}`);
        assert.ok(!world.blocking.has(key), `blocking entity on corridor at ${key}`);
      }

      const seen = new Set(["0,0"]);
      const queue = [[0, 0]];
      for (let index = 0; index < queue.length; index++) {
        const [x, y] = queue[index];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const key = coordKey(x + dx, y + dy);
          const tile = world.tiles.get(key);
          if (!tile || ["water", "mountain"].includes(tile.terrain)
              || world.blocking.has(key) || seen.has(key)) continue;
          seen.add(key);
          queue.push([x + dx, y + dy]);
        }
      }
      assert.ok(seen.has(coordKey(site.x, site.y)), `${site.kind} was unreachable for seed ${seed}`);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const key = coordKey(site.x + dx, site.y + dy);
          const tile = world.tiles.get(key);
          assert.ok(tile && !["water", "mountain"].includes(tile.terrain), `uncleared site tile ${key}`);
          assert.ok(!world.blocking.has(key), `blocking site entity at ${key}`);
        }
      }
    }
    const owned = world.chunks.flatMap((chunk) => chunk.landmarks);
    assert.deepEqual(owned.map((site) => site.id).sort(), landmarks.map((site) => site.id).sort());
    assert.equal(new Set(owned.map((site) => site.id)).size, 3);
    const allEntities = world.chunks.flatMap((chunk) => chunk.entities);
    assert.equal(new Set(allEntities.map((entity) => entity.id)).size, allEntities.length);
    assert.ok(allEntities.filter((entity) => entity.type === "cache").length >= 3);
    for (const chunk of world.chunks) {
      for (const site of chunk.landmarks) {
        assert.deepEqual(chunkForTile(site.x, site.y), { cx: chunk.cx, cy: chunk.cy });
        const decorByKind = {
          "drowned-observatory": "observatory-spire",
          "glass-grove": "glass-tree",
          "ash-archive": "archive-pillar",
        };
        assert.ok(allEntities.some((entity) => entity.type === decorByKind[site.kind]
          && entity.siteId === site.id));
      }
    }
  }
});

test("negative chunks keep stable global tile and entity identities", () => {
  const { decorateChunk } = api();
  const chunk = decorateChunk(generateChunk({ seed: 8675309, cx: -2, cy: -1 }));
  assert.equal(chunk.tiles[0].x, -2 * CHUNK_SIZE);
  assert.equal(chunk.tiles[0].y, -CHUNK_SIZE);
  assert.ok(chunk.tiles.every((tile) => tile.id === `tile:${tile.x}:${tile.y}`));
  assert.equal(new Set(chunk.entities.map((entity) => entity.id)).size, chunk.entities.length);
  assert.ok(chunk.entities.every((entity) => ["id", "type", "x", "y", "blocking", "loot"]
    .every((key) => Object.hasOwn(entity, key))));
});

test("starting camp has three wood nodes, two stone nodes, berries, and an optional sentinel", () => {
  const { decorateChunk } = api();
  for (const seed of [1, 2, 3, 41, 20261103, -20261103]) {
    const campChunks = [];
    for (const cy of [-1, 0]) {
      for (const cx of [-1, 0]) campChunks.push(decorateChunk(generateChunk({ seed, cx, cy })));
    }
    const entities = campChunks.flatMap((chunk) => chunk.entities);
    const requiredCounts = { tree: 3, rock: 2, berry: 1 };
    for (const [type, count] of Object.entries(requiredCounts)) {
      const nodes = entities.filter((entity) => entity.type === type && entity.campResource
        && Math.hypot(entity.x, entity.y) > 3 && Math.hypot(entity.x, entity.y) <= 7);
      assert.ok(nodes.length >= count, `expected ${count} nearby ${type} nodes for seed ${seed}`);
      for (const node of nodes) {
        const adjacent = [[1, 0], [-1, 0], [0, 1], [0, -1]]
          .some(([dx, dy]) => Math.max(Math.abs(node.x + dx), Math.abs(node.y + dy)) <= 3);
        assert.ok(adjacent, `${type} cannot be reached from the starting clearing`);
      }
    }
    assert.equal(new Set(entities.map((entity) => entity.id)).size, entities.length);
    const sentinel = entities.find((entity) => entity.type === "sentinel" && entity.campSentinel);
    assert.ok(sentinel, `missing optional near-camp sentinel for seed ${seed}`);
    assert.ok(Math.hypot(sentinel.x, sentinel.y) > 3, "near-camp sentinel must stay outside the safe clearing");
    assert.ok(!pathTiles(api().landmarksForSeed(seed)).has(coordKey(sentinel.x, sentinel.y)));
  }
});

test("each story site has one reachable sentinel guardian in its owner chunk", () => {
  const { landmarksForSeed } = api();
  for (const seed of [1, 2, 3, 41, 20261103, -20261103]) {
    const landmarks = landmarksForSeed(seed);
    const world = makeDecoratedWorld(seed, landmarks);
    const entities = world.chunks.flatMap((chunk) => chunk.entities);
    const guardians = entities.filter((entity) => entity.siteGuardian);
    const allTrailTiles = new Set(landmarks.flatMap((site) => [...pathTiles(site)]));
    assert.equal(guardians.length, 3, `expected one guardian per site for seed ${seed}`);
    assert.equal(new Set(guardians.map((entity) => entity.id)).size, 3);

    for (const site of landmarks) {
      const guard = guardians.find((entity) => entity.siteId === site.id);
      assert.ok(guard, `missing ${site.kind} guardian for seed ${seed}`);
      assert.equal(guard.type, "sentinel");
      assert.equal(guard.blocking, true);
      assert.deepEqual({ x: guard.x, y: guard.y }, { x: site.x + 4, y: site.y + 2 });
      assert.ok(!allTrailTiles.has(coordKey(guard.x, guard.y)), "guardian must not block a trail corridor");
      assert.ok(Math.max(Math.abs(guard.x - site.x), Math.abs(guard.y - site.y)) > 3,
        "guardian must be outside the local site clearing");
      assert.ok(Math.hypot(guard.x, guard.y) > 3, "guardian must be outside the starting safe clearing");
      const owner = chunkForTile(guard.x, guard.y);
      const ownerChunk = world.chunks.find((chunk) => chunk.cx === owner.cx && chunk.cy === owner.cy);
      assert.ok(ownerChunk?.entities.some((entity) => entity.id === guard.id));
      const tile = world.tiles.get(coordKey(guard.x, guard.y));
      assert.ok(tile && !["water", "mountain"].includes(tile.terrain), "guardian spawn terrain must be walkable");
    }
  }
});
