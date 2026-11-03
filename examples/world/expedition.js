import { Random } from "../../JavaScript/src/index.js";
import { chunkForTile } from "./generator.js";

export const EXPEDITION_VERSION = "verdant-expedition-2";

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

const CACHE_LOOT = Object.freeze(["jade-shard", "amber-charm", "old-coin"]);
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

function normalizedSeed(seed) {
  try {
    return new Random(seed).seed.toString();
  } catch (error) {
    throw new TypeError(`seed is invalid: ${error.message}`);
  }
}

function compareId(a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }

function coordKey(x, y) { return `${x},${y}`; }

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
  const guardianSpawns = new Set(guardians.map((entity) => coordKey(entity.x, entity.y)));
  const decorated = cloneChunk(chunk);

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

  const blockedZones = new Set(trails);
  for (const tile of decorated.tiles) {
    if (isCampClearing(tile.x, tile.y) || isSiteClearing(tile.x, tile.y, landmarks)) {
      blockedZones.add(coordKey(tile.x, tile.y));
    }
  }
  decorated.entities = decorated.entities.filter((entity) => {
    const isBlockingType = entity.type === "tree" || entity.type === "rock" || entity.type === "sentinel";
    return !(blockedZones.has(coordKey(entity.x, entity.y)) && (entity.blocking || isBlockingType));
  });

  const chunkEntities = [
    ...campEntitiesList,
    ...caches,
    ...decor,
    ...guardians,
  ].filter((entity) => {
    const owner = chunkForTile(entity.x, entity.y);
    return owner.cx === cx && owner.cy === cy;
  });
  for (const entity of chunkEntities) {
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
  decorated.contentVersion = EXPEDITION_VERSION;
  decorated.landmarks = ownedLandmarks.map((site) => ({ ...site }));
  decorated.entities.sort(compareId);
  return decorated;
}
