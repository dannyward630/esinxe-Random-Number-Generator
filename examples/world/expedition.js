import { Random } from "../../JavaScript/src/index.js";
import { chunkForTile, generateChunk } from "./generator.js";

export const EXPEDITION_VERSION = "verdant-expedition-3";

const SITE_DEFINITIONS = Object.freeze([
  Object.freeze({
    kind: "drowned-observatory",
    title: "The Drowned Observatory",
    text: "The tide has left a ring of salt beneath the lens, though the tower stands far above the sea. Its oldest chart names this shore for a star that has not yet risen.",
    color: "#69c4d0",
  }),
  Object.freeze({
    kind: "glass-grove",
    title: "The Glass Grove",
    text: "Each glass trunk rings a moment before the wind arrives. A message inside the clearest bole claims the grove has leaves only when someone remembers them.",
    color: "#a7dbac",
  }),
  Object.freeze({
    kind: "ash-archive",
    title: "The Ash Archive",
    text: "The ash stays dry beneath the rain. Three hands wrote the same sentence in different scripts: We asked the dark to answer.",
    color: "#e69a71",
  }),
]);

const BIOME_SITE_DEFINITIONS = Object.freeze([
  Object.freeze({
    kind: "tidal-lake",
    title: "Tideglass Lake",
    text: "The lake keeps the tide after the coast has turned quiet. A cache below the islet carries a note about the small things that survive each retreating wave.",
    terrain: "water",
    color: "#69c4d0",
    radius: 5,
  }),
  Object.freeze({
    kind: "marsh-herb-garden",
    title: "Saltgrass Herb Garden",
    text: "Saltgrass and marsh mint grow in careful rows where no gardener could have walked. Their field note lists the leaves that remain edible after a long rain.",
    terrain: "marsh",
    color: "#86c59b",
    radius: 4,
  }),
  Object.freeze({
    kind: "rocky-bluff",
    title: "The Windcut Bluff",
    text: "A narrow seam of pale stone runs through the bluff. Someone marked the safest footholds and left a small stone cache beneath the lee of the ridge.",
    terrain: "hill",
    color: "#c1a887",
    radius: 4,
  }),
  Object.freeze({
    kind: "woodland-grove",
    title: "Elderwood Grove",
    text: "The grove holds its shade even at noon. A field note pairs the berry shrubs with a drywood cache, as if the last visitor meant to make camp here.",
    terrain: "forest",
    color: "#a7dbac",
    radius: 4,
  }),
]);

const CACHE_LOOT = Object.freeze(["jade-shard", "amber-charm", "old-coin"]);
const BIOME_CACHE_REWARDS = Object.freeze({
  "tidal-lake": Object.freeze({ wood: 0, stone: 1, berries: 2 }),
  "marsh-herb-garden": Object.freeze({ wood: 0, stone: 0, berries: 3 }),
  "rocky-bluff": Object.freeze({ wood: 0, stone: 3, berries: 0 }),
  "woodland-grove": Object.freeze({ wood: 2, stone: 0, berries: 2 }),
});
const STARTING_CLEAR_RADIUS = 3;
const SITE_CLEAR_RADIUS = 3;
const DIRECTIONS_30_DEGREES = Object.freeze([
  [1, 0],
  [0.8660254037844386, 0.5],
  [0.5, 0.8660254037844386],
  [0, 1],
  [-0.5, 0.8660254037844386],
  [-0.8660254037844386, 0.5],
  [-1, 0],
  [-0.8660254037844386, -0.5],
  [-0.5, -0.8660254037844386],
  [0, -1],
  [0.5, -0.8660254037844386],
  [0.8660254037844386, -0.5],
]);
const BIOME_QUADRANTS = Object.freeze([
  Object.freeze([1, 1]),
  Object.freeze([-1, 1]),
  Object.freeze([-1, -1]),
  Object.freeze([1, -1]),
]);
const CARDINAL_DIRECTIONS = Object.freeze([
  Object.freeze([1, 0]),
  Object.freeze([-1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([0, -1]),
]);
const BASE_CHUNK_CACHE = new Map();
const BASE_CHUNK_CACHE_LIMIT = 128;
const BIOME_SITE_CACHE = new Map();
const BIOME_APPROACH_CACHE = new Map();
const EXPEDITION_CACHE_LIMIT = 64;

function normalizedSeed(seed) {
  try {
    return new Random(seed).seed.toString();
  } catch (error) {
    throw new TypeError(`seed is invalid: ${error.message}`);
  }
}

function compareId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

function coordKey(x, y) { return `${x},${y}`; }

function generatedChunkForTile(seed, x, y) {
  const { cx, cy } = chunkForTile(x, y);
  const key = `${seed}:${cx},${cy}`;
  if (BASE_CHUNK_CACHE.has(key)) return BASE_CHUNK_CACHE.get(key);
  const chunk = generateChunk({ seed, cx, cy });
  BASE_CHUNK_CACHE.set(key, chunk);
  if (BASE_CHUNK_CACHE.size > BASE_CHUNK_CACHE_LIMIT) {
    BASE_CHUNK_CACHE.delete(BASE_CHUNK_CACHE.keys().next().value);
  }
  return chunk;
}

function hasGeneratedStructureAt(seed, x, y) {
  const chunk = generatedChunkForTile(seed, x, y);
  if (chunk.entities.some((entity) => entity.x === x && entity.y === y
      && (entity.type === "cache" || entity.type === "ruin"))) return true;
  return chunk.rooms.some((room) => x >= room.x && x < room.x + room.width
    && y >= room.y && y < room.y + room.height);
}

function isInSquare(x, y, centerX, centerY, radius) {
  return Math.abs(x - centerX) <= radius && Math.abs(y - centerY) <= radius;
}

function makeEntity(type, x, y, loot, extra = {}) {
  return {
    id: `${type}:${x}:${y}`,
    type,
    x,
    y,
    blocking: type === "tree" || type === "rock" || type === "sentinel",
    loot,
    ...extra,
  };
}

export function landmarksForSeed(seed = 1) {
  const seedValue = normalizedSeed(seed);
  const random = new Random(seedValue);
  const rotation = Number(random.int(12, "verdant.expedition.landmarks", "rotation"));

  return SITE_DEFINITIONS.map((site, index) => {
    // A seeded rotation spreads the sites around the beacon. Their independent
    // radii stay safely inside the 18-to-40 tile expedition ring.
    const radius = 24 + Number(random.int(11, "verdant.expedition.landmarks", "radius", site.kind));
    const [directionX, directionY] = DIRECTIONS_30_DEGREES[(rotation + index * 4) % 12];
    const x = Math.round(directionX * radius);
    const y = Math.round(directionY * radius);
    return {
      id: `landmark:${site.kind}:${x}:${y}`,
      x,
      y,
      title: site.title,
      text: site.text,
      color: site.color,
      kind: site.kind,
    };
  });
}

function squareTouchesCells(x, y, radius, cells) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (cells.has(coordKey(x + dx, y + dy))) return true;
    }
  }
  return false;
}

function overlapsSquare(x, y, radius, otherX, otherY, otherRadius) {
  return Math.abs(x - otherX) <= radius + otherRadius
    && Math.abs(y - otherY) <= radius + otherRadius;
}

function hasGeneratedStructureInSquare(seed, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (hasGeneratedStructureAt(seed, x + dx, y + dy)) return true;
    }
  }
  return false;
}

export function biomeSitesForSeed(seed = 1) {
  const seedValue = normalizedSeed(seed);
  if (BIOME_SITE_CACHE.has(seedValue)) {
    return BIOME_SITE_CACHE.get(seedValue).map((site) => ({ ...site }));
  }
  const random = new Random(seedValue);
  const landmarks = landmarksForSeed(seedValue);
  const oldTrails = trailCellsFor(landmarks);
  const occupied = [];
  const selected = new Map();
  const definitions = random.shuffle(
    BIOME_SITE_DEFINITIONS,
    "verdant.expedition.biome-sites",
    "site-order",
  );
  const quadrants = random.shuffle(
    BIOME_QUADRANTS,
    "verdant.expedition.biome-sites",
    "quadrant-order",
  );
  const protectedStoryPoints = landmarks.map((site) => ({ x: site.x + 4, y: site.y + 2 }));

  definitions.forEach((definition, index) => {
    const [signX, signY] = quadrants[index];
    const minimum = definition.radius + 5;
    const candidates = [];
    for (let y = minimum; y <= 24; y++) {
      for (let x = minimum; x <= 24; x++) {
        candidates.push({ x: signX * x, y: signY * y });
      }
    }
    candidates.sort((a, b) => ((a.x - signX * 12) ** 2 + (a.y - signY * 12) ** 2)
      - ((b.x - signX * 12) ** 2 + (b.y - signY * 12) ** 2)
      || a.y - b.y || a.x - b.x);
    const nearbyValid = [];
    for (const candidate of candidates) {
      const { x, y } = candidate;
      if (squareTouchesCells(x, y, definition.radius, oldTrails)) continue;
      if (landmarks.some((site) => overlapsSquare(
        x, y, definition.radius, site.x, site.y, SITE_CLEAR_RADIUS,
      ))) continue;
      if (protectedStoryPoints.some((point) => overlapsSquare(
        x, y, definition.radius, point.x, point.y, 0,
      ))) continue;
      if (occupied.some((site) => overlapsSquare(
        x, y, definition.radius, site.x, site.y, site.radius,
      ))) continue;
      if (hasGeneratedStructureInSquare(seedValue, x, y, definition.radius)) continue;
      nearbyValid.push(candidate);
      if (nearbyValid.length === 8) break;
    }
    const placement = random.shuffle(
      nearbyValid,
      "verdant.expedition.biome-sites",
      "position",
      definition.kind,
    )[0];
    if (!placement) throw new Error(`no clear biome site position found for ${definition.kind}`);

    const site = {
      id: `biome:${definition.kind}:${placement.x}:${placement.y}`,
      title: definition.title,
      text: definition.text,
      kind: definition.kind,
      terrain: definition.terrain,
      color: definition.color,
      x: placement.x,
      y: placement.y,
    };
    selected.set(site.kind, site);
    occupied.push({ ...placement, radius: definition.radius });
  });

  const sites = BIOME_SITE_DEFINITIONS.map((definition) => selected.get(definition.kind));
  BIOME_SITE_CACHE.set(seedValue, sites.map((site) => Object.freeze({ ...site })));
  if (BIOME_SITE_CACHE.size > EXPEDITION_CACHE_LIMIT) {
    BIOME_SITE_CACHE.delete(BIOME_SITE_CACHE.keys().next().value);
  }
  return sites.map((site) => ({ ...site }));
}

function trailCellsForSite(site) {
  const cells = new Set();
  const stepX = Math.sign(site.x);
  for (let x = 0; x !== site.x + stepX; x += stepX) {
    for (let offset = -1; offset <= 1; offset++) cells.add(coordKey(x, offset));
  }
  const stepY = Math.sign(site.y);
  for (let y = 0; y !== site.y + stepY; y += stepY) {
    for (let offset = -1; offset <= 1; offset++) cells.add(coordKey(site.x + offset, y));
  }
  return cells;
}

function trailCellsFor(landmarks) {
  return new Set(landmarks.flatMap((site) => [...trailCellsForSite(site)]));
}

function isCampClearing(x, y) {
  return isInSquare(x, y, 0, 0, STARTING_CLEAR_RADIUS);
}

function isSiteClearing(x, y, landmarks) {
  return landmarks.some((site) => isInSquare(x, y, site.x, site.y, SITE_CLEAR_RADIUS));
}

function pathCacheEntities(seed, landmarks, trailCells) {
  const random = new Random(seed);
  const used = new Set();
  const entities = [];

  for (const site of landmarks) {
    const candidates = [];
    for (const key of trailCellsForSite(site)) {
      const [x, y] = key.split(",").map(Number);
      if (isCampClearing(x, y) || isSiteClearing(x, y, landmarks) || used.has(key)) continue;
      if (x === site.x && y === site.y) continue;
      candidates.push({ x, y, key });
    }
    candidates.sort((a, b) => a.y - b.y || a.x - b.x);
    if (candidates.length === 0) continue;

    const start = Number(random.int(candidates.length, "verdant.expedition.path-cache", site.kind));
    const selected = candidates[start];
    used.add(selected.key);
    const loot = random.stableChoice(
      CACHE_LOOT,
      CACHE_LOOT,
      "verdant.expedition.path-cache-loot",
      site.kind,
    );
    entities.push(makeEntity("cache", selected.x, selected.y, loot));
  }
  return entities;
}

function campEntities(seed, landmarks, trailCells) {
  const candidates = [];
  for (let y = -4; y <= 4; y++) {
    for (let x = -4; x <= 4; x++) {
      const onSquareEdge = Math.abs(x) === 4 || Math.abs(y) === 4;
      const nextToCamp = Math.max(Math.abs(x), Math.abs(y)) === 4
        && Math.min(Math.abs(x), Math.abs(y)) <= STARTING_CLEAR_RADIUS;
      if (!onSquareEdge || !nextToCamp || trailCells.has(coordKey(x, y))) continue;
      if (isSiteClearing(x, y, landmarks)) continue;
      candidates.push({ x, y });
    }
  }
  candidates.sort((a, b) => a.y - b.y || a.x - b.x);

  const random = new Random(seed);
  const chosen = [];
  const remaining = candidates.slice();
  for (let index = 0; index < 7; index++) {
    if (remaining.length === 0) break;
    const selectedIndex = Number(random.int(
      remaining.length,
      "verdant.expedition.camp-resources",
      index,
    ));
    chosen.push(remaining.splice(selectedIndex, 1)[0]);
  }
  const types = random.shuffle(
    ["tree", "tree", "tree", "rock", "rock", "berry", "sentinel"],
    "verdant.expedition.camp-resource-types",
  );
  return chosen.map(({ x, y }, index) => {
    const type = types[index];
    const loot = type === "berry" ? "wild-berries"
      : type === "tree" ? "wood"
        : type === "rock" ? "stone" : "iron-token";
    const marker = type === "sentinel" ? { campSentinel: true } : { campResource: true };
    return makeEntity(type, x, y, loot, marker);
  });
}

function biomeTerrainAt(site, x, y) {
  const dx = x - site.x;
  const dy = y - site.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const distance = Math.hypot(dx, dy);

  if (site.kind === "tidal-lake") {
    if (Math.max(absX, absY) <= 1) return "meadow";
    if (distance <= 5) return "water";
    if ((absX === 6 && dy === 0) || (absY === 6 && dx === 0)) return "meadow";
  } else if (site.kind === "marsh-herb-garden" && Math.max(absX, absY) <= 4) {
    return "marsh";
  } else if (site.kind === "rocky-bluff" && Math.max(absX, absY) <= 4) {
    if (absX === 3 || absY === 3) return "mountain";
    return "hill";
  } else if (site.kind === "woodland-grove" && Math.max(absX, absY) <= 4) {
    return "forest";
  }
  return undefined;
}

function hasGeneratedEntityAt(seed, x, y) {
  return generatedChunkForTile(seed, x, y).entities.some((entity) => entity.x === x && entity.y === y);
}

function biomeCacheCandidates(site, seed) {
  const candidates = [];
  const radius = BIOME_SITE_DEFINITIONS.find((definition) => definition.kind === site.kind).radius;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = site.x + dx;
      const y = site.y + dy;
      const terrain = biomeTerrainAt(site, x, y);
      if (site.kind === "tidal-lake") {
        const distance = Math.hypot(dx, dy);
        if (distance < 3 || distance > 5 || terrain !== "water") continue;
      } else if (terrain !== site.terrain) {
        continue;
      }
      if (hasGeneratedEntityAt(seed, x, y) || hasGeneratedStructureAt(seed, x, y)) continue;
      candidates.push({ x, y });
    }
  }
  return new Random(seed).shuffle(candidates, "verdant.expedition.biome-cache", site.kind);
}

function biomeCacheEntities(seed, sites) {
  return sites.map((site) => {
    const selected = biomeCacheCandidates(site, seed)[0];
    if (!selected) throw new Error(`no clear cache position found for ${site.kind}`);
    return makeEntity("cache", selected.x, selected.y, "field-supplies", {
      biomeCache: true,
      requiresDive: site.kind === "tidal-lake",
      noteId: site.id,
      note: site.text,
      reward: { ...BIOME_CACHE_REWARDS[site.kind] },
    });
  });
}

function siteDecorEntities(landmarks) {
  const placements = {
    "drowned-observatory": [
      ["observatory-spire", 0, -2],
      ["tidal-lens", 1, 1],
    ],
    "glass-grove": [
      ["glass-tree", 0, -2],
      ["glass-bloom", -1, 1],
    ],
    "ash-archive": [
      ["archive-pillar", 0, -2],
      ["ash-tablet", 1, 1],
    ],
  };
  return landmarks.flatMap((site) => placements[site.kind].map(([type, dx, dy]) => (
    makeEntity(type, site.x + dx, site.y + dy, undefined, { siteId: site.id })
  )));
}

function siteGuardianEntities(landmarks) {
  return landmarks.map((site) => makeEntity(
    "sentinel",
    site.x + 4,
    site.y + 2,
    "iron-token",
    { siteGuardian: true, siteId: site.id },
  ));
}

function routeBlockedByBase(seed, x, y) {
  const chunk = generatedChunkForTile(seed, x, y);
  if (chunk.entities.some((entity) => entity.x === x && entity.y === y && entity.blocking)) return true;
  return chunk.rooms.some((room) => x >= room.x && x < room.x + room.width
    && y >= room.y && y < room.y + room.height);
}

function lakeApproachPath(seed, landmarks, campEntitiesList, biomeSites) {
  if (BIOME_APPROACH_CACHE.has(seed)) return new Set(BIOME_APPROACH_CACHE.get(seed));
  const lake = biomeSites.find((site) => site.kind === "tidal-lake");
  const goals = new Set(CARDINAL_DIRECTIONS.map(([dx, dy]) => coordKey(
    lake.x + dx * 6,
    lake.y + dy * 6,
  )));
  const campBlockers = new Set(campEntitiesList
    .filter((entity) => entity.blocking)
    .map((entity) => coordKey(entity.x, entity.y)));
  const storyBlockers = new Set(siteGuardianEntities(landmarks)
    .map((entity) => coordKey(entity.x, entity.y)));
  const directions = new Random(seed).shuffle(
    CARDINAL_DIRECTIONS,
    "verdant.expedition.biome-approach",
    lake.id,
  );
  const start = [0, 0];
  const startKey = coordKey(...start);
  const queue = [start];
  const previous = new Map([[startKey, null]]);
  let reachedKey;

  for (let index = 0; index < queue.length; index++) {
    const [x, y] = queue[index];
    const key = coordKey(x, y);
    if (goals.has(key)) {
      reachedKey = key;
      break;
    }
    for (const [dx, dy] of directions) {
      const nextX = x + dx;
      const nextY = y + dy;
      if (Math.abs(nextX) > 30 || Math.abs(nextY) > 30) continue;
      const nextKey = coordKey(nextX, nextY);
      if (previous.has(nextKey) || campBlockers.has(nextKey) || storyBlockers.has(nextKey)) continue;
      if (goals.has(nextKey) === false && biomeSites.some((site) => (
        biomeTerrainAt(site, nextX, nextY) !== undefined
      ))) continue;
      if (routeBlockedByBase(seed, nextX, nextY)) continue;
      previous.set(nextKey, key);
      queue.push([nextX, nextY]);
    }
  }

  if (!reachedKey) throw new Error("could not find a land route from camp to the tidal lake");
  const route = new Set();
  for (let key = reachedKey; key !== null; key = previous.get(key)) route.add(key);
  BIOME_APPROACH_CACHE.set(seed, [...route]);
  if (BIOME_APPROACH_CACHE.size > EXPEDITION_CACHE_LIMIT) {
    BIOME_APPROACH_CACHE.delete(BIOME_APPROACH_CACHE.keys().next().value);
  }
  return route;
}

function cloneChunk(chunk) {
  return {
    ...chunk,
    tiles: chunk.tiles.map((tile) => ({ ...tile })),
    entities: chunk.entities.map((entity) => ({ ...entity, loot: entity.loot })),
    rooms: chunk.rooms?.map((room) => ({
      ...room,
      ...(room.entrance ? { entrance: { ...room.entrance } } : {}),
    })),
    ...(chunk.grass ? { grass: chunk.grass.map((blade) => ({ ...blade })) } : {}),
  };
}

export function decorateChunk(chunk) {
  if (chunk === null || typeof chunk !== "object") throw new TypeError("chunk must be an object");
  if (!Array.isArray(chunk.tiles) || !Array.isArray(chunk.entities)) {
    throw new TypeError("chunk must contain tiles and entities arrays");
  }
  const cx = chunk.cx;
  const cy = chunk.cy;
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) {
    throw new TypeError("chunk must have safe integer cx and cy coordinates");
  }
  const seed = normalizedSeed(chunk.seed);
  const landmarks = landmarksForSeed(seed);
  const trails = trailCellsFor(landmarks);
  const campEntitiesList = campEntities(seed, landmarks, trails);
  const caches = pathCacheEntities(seed, landmarks, trails);
  const decor = siteDecorEntities(landmarks);
  const guardians = siteGuardianEntities(landmarks);
  const biomeSites = biomeSitesForSeed(seed);
  const biomeCaches = biomeCacheEntities(seed, biomeSites);
  const approach = lakeApproachPath(seed, landmarks, campEntitiesList, biomeSites);
  const guardianSpawns = new Set(guardians.map((entity) => coordKey(entity.x, entity.y)));
  const decorated = cloneChunk(chunk);
  const protectedFeatureTiles = new Set(decorated.entities
    .filter((entity) => entity.type === "cache" || entity.type === "ruin")
    .map((entity) => coordKey(entity.x, entity.y)));
  for (const room of decorated.rooms ?? []) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) protectedFeatureTiles.add(coordKey(x, y));
    }
  }

  for (const tile of decorated.tiles) {
    const key = coordKey(tile.x, tile.y);
    if (guardianSpawns.has(key)) {
      tile.terrain = "meadow";
      tile.siteGuardianSpawn = true;
    } else if (isSiteClearing(tile.x, tile.y, landmarks)) {
      tile.terrain = "meadow";
      tile.clearing = true;
      tile.siteClearing = true;
    } else if (isCampClearing(tile.x, tile.y)) {
      tile.terrain = "meadow";
      tile.clearing = true;
      tile.startingClearing = true;
    } else if (trails.has(key)) {
      tile.terrain = "sand";
      tile.trail = true;
    }
  }

  const biomePatchTiles = new Set();
  for (const tile of decorated.tiles) {
    const key = coordKey(tile.x, tile.y);
    if (tile.trail || tile.siteClearing || tile.startingClearing || tile.siteGuardianSpawn) continue;
    if (protectedFeatureTiles.has(key)) continue;
    const siteTerrain = biomeSites
      .map((site) => biomeTerrainAt(site, tile.x, tile.y))
      .find((terrain) => terrain !== undefined);
    if (siteTerrain !== undefined) {
      tile.terrain = siteTerrain;
      biomePatchTiles.add(key);
    } else if (approach.has(key)) {
      tile.terrain = "meadow";
      tile.biomeApproach = true;
    }
  }

  const blockedZones = new Set([...trails, ...approach]);
  for (const tile of decorated.tiles) {
    if (isCampClearing(tile.x, tile.y) || isSiteClearing(tile.x, tile.y, landmarks)) {
      blockedZones.add(coordKey(tile.x, tile.y));
    }
  }
  decorated.entities = decorated.entities.filter((entity) => {
    const isBlockingType = entity.type === "tree" || entity.type === "rock" || entity.type === "sentinel";
    if (biomePatchTiles.has(coordKey(entity.x, entity.y)) && isBlockingType
        && !entity.siteGuardian && !entity.campResource) return false;
    return !(blockedZones.has(coordKey(entity.x, entity.y)) && (entity.blocking || isBlockingType));
  });

  const chunkEntities = [
    ...campEntitiesList,
    ...caches,
    ...decor,
    ...guardians,
    ...biomeCaches,
  ].filter((entity) => {
    const owner = chunkForTile(entity.x, entity.y);
    return owner.cx === cx && owner.cy === cy;
  });
  for (const entity of chunkEntities) {
    if (entity.biomeCache && decorated.entities.some((existing) => (
      existing.x === entity.x && existing.y === entity.y
    ))) continue;
    // A guaranteed expedition placement owns its tile so IDs remain unique and
    // harvesting/interaction never targets two resources at the same spot.
    decorated.entities = decorated.entities.filter((existing) => (
      existing.x !== entity.x || existing.y !== entity.y
    ));
    decorated.entities.push(entity);
  }

  for (const resource of campEntitiesList) {
    const owner = chunkForTile(resource.x, resource.y);
    if (owner.cx !== cx || owner.cy !== cy) continue;
    const tile = decorated.tiles.find((candidate) => candidate.x === resource.x && candidate.y === resource.y);
    if (tile) {
      tile.terrain = resource.type === "tree" ? "forest"
        : resource.type === "rock" ? "hill" : "meadow";
      delete tile.trail;
      delete tile.siteClearing;
      delete tile.clearing;
      delete tile.startingClearing;
    }
  }

  const ownedLandmarks = landmarks.filter((site) => {
    const owner = chunkForTile(site.x, site.y);
    return owner.cx === cx && owner.cy === cy;
  });
  const ownedBiomeSites = biomeSites.filter((site) => {
    const owner = chunkForTile(site.x, site.y);
    return owner.cx === cx && owner.cy === cy;
  });
  decorated.contentVersion = EXPEDITION_VERSION;
  decorated.landmarks = ownedLandmarks.map((site) => ({ ...site }));
  decorated.biomeSites = ownedBiomeSites.map((site) => ({ ...site }));
  decorated.entities.sort(compareId);
  return decorated;
}
