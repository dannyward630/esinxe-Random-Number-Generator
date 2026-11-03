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
  assert.equal(expedition.EXPEDITION_VERSION, "verdant-expedition-2");
  return expedition;
}

function coordKey(x, y) { return `${x},${y}`; }

function makeDecoratedWorld(seed, landmarks) {
  const margin = 4;
  const minX = Math.min(0, ...landmarks.map((site) => site.x)) - margin;
  const maxX = Math.max(0, ...landmarks.map((site) => site.x)) + margin;
  const minY = Math.min(0, ...landmarks.map((site) => site.y)) - margin;
  const maxY = Math.max(0, ...landmarks.map((site) => site.y)) + margin;
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
