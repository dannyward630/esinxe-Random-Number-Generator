import { Random } from "../../JavaScript/src/index.js";

export const CONTENT_VERSION = "verdant-world-1";
export const GENERATION_ALGORITHM = "esinxe-v1-keyed-smooth-value-noise";
export const CHUNK_SIZE = 16;
export const ROOM_CELL_SIZE = 36;
export const TERRAIN_TYPES = Object.freeze([
  "water", "shallows", "sand", "meadow", "forest", "marsh", "hill", "mountain",
]);
export const ENTITY_TYPES = Object.freeze(["tree", "rock", "berry", "cache", "ruin"]);

const ENTITY_TYPE_SET = new Set(ENTITY_TYPES);
const TERRAIN_TYPE_SET = new Set(TERRAIN_TYPES);
const CHUNK_ORDER_TYPES = new Set(["normal", "reverse", "shuffled"]);
const SURFACE_PATCH_RADIUS = 3;

function assertSafeInteger(value, name) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${name} must be a safe integer`);
  return value;
}

function normalizedSeed(seed) {
  try {
    return new Random(seed).seed.toString();
  } catch (error) {
    throw new TypeError(`seed is invalid: ${error.message}`);
  }
}

export function getChunkKey(cx, cy) {
  assertSafeInteger(cx, "chunk x");
  assertSafeInteger(cy, "chunk y");
  return `${cx},${cy}`;
}

export function chunkForTile(x, y) {
  assertSafeInteger(x, "tile x");
  assertSafeInteger(y, "tile y");
  return { cx: Math.floor(x / CHUNK_SIZE), cy: Math.floor(y / CHUNK_SIZE) };
}

export function validateEntityTypes(entityTypes = ENTITY_TYPES) {
  if (!Array.isArray(entityTypes)) throw new TypeError("entityTypes must be an array");
  const seen = new Set();
  for (const type of entityTypes) {
    if (typeof type !== "string" || !ENTITY_TYPE_SET.has(type)) {
      throw new TypeError(`unknown entity type: ${String(type)}`);
    }
    if (seen.has(type)) throw new TypeError(`duplicate entity type: ${type}`);
    seen.add(type);
  }
  return Object.freeze([...entityTypes]);
}

function validateChunkCoordinates(chunks) {
  if (!Array.isArray(chunks)) throw new TypeError("chunks must be an array");
  const seen = new Set();
  return chunks.map((coordinate, index) => {
    if (coordinate === null || typeof coordinate !== "object") {
      throw new TypeError(`chunks[${index}] must have integer x and y coordinates`);
    }
    const x = assertSafeInteger(coordinate.x, `chunks[${index}].x`);
    const y = assertSafeInteger(coordinate.y, `chunks[${index}].y`);
    const key = getChunkKey(x, y);
    if (seen.has(key)) throw new TypeError(`duplicate chunk key: ${key}`);
    seen.add(key);
    validateChunkExtent(x, "chunk x");
    validateChunkExtent(y, "chunk y");
    return { x, y };
  });
}

function validateChunkExtent(coordinate, name) {
  const first = coordinate * CHUNK_SIZE;
  const last = first + CHUNK_SIZE - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) {
    throw new RangeError(`${name} is outside the safe tile coordinate range`);
  }
}

export function orderChunkCoordinates(chunks, seed, order = "normal") {
  const validated = validateChunkCoordinates(chunks);
  if (!CHUNK_ORDER_TYPES.has(order)) throw new TypeError(`unknown generation order: ${String(order)}`);
  const sorted = validated.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  if (order === "normal") return sorted;
  if (order === "reverse") return sorted.reverse();
  return new Random(seed).shuffle(sorted, "world", "chunk-load-order");
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

function createField(seed) {
  const random = new Random(seed);
  const cornerCache = new Map();

  function corner(namespace, scale, x, y) {
    const key = `${namespace}|${scale}|${x}|${y}`;
    if (!cornerCache.has(key)) {
      cornerCache.set(key, random.float01(namespace, scale, x, y));
    }
    return cornerCache.get(key);
  }

  function noise(namespace, scale, x, y) {
    const cellX = Math.floor(x / scale);
    const cellY = Math.floor(y / scale);
    const u = smooth((x - cellX * scale) / scale);
    const v = smooth((y - cellY * scale) / scale);
    const a = corner(namespace, scale, cellX, cellY);
    const b = corner(namespace, scale, cellX + 1, cellY);
    const c = corner(namespace, scale, cellX, cellY + 1);
    const d = corner(namespace, scale, cellX + 1, cellY + 1);
    const top = a + (b - a) * u;
    const bottom = c + (d - c) * u;
    return top + (bottom - top) * v;
  }

  function surface(x, y) {
    const broad = noise("world.surface.height", 72, x, y);
    const regional = noise("world.surface.height", 31, x, y);
    const local = noise("world.surface.height", 13, x, y);
    const detail = noise("world.surface.height", 5, x, y);
    const baseElevation = 0.52 + (broad - 0.5) * 0.82 + (regional - 0.5) * 0.54
      + (local - 0.5) * 0.26 + (detail - 0.5) * 0.1;
    // A radial land floor guarantees an explorable entry region rather than a
    // tiny square clearing surrounded by impassable water for ocean seeds.
    const distance = Math.hypot(x, y);
    const elevation = Math.max(baseElevation, 0.6 * (1 - smooth(Math.min(1, distance / 80))));
    const damp = noise("world.surface.moisture", 43, x, y);
    const localDamp = noise("world.surface.moisture", 18, x, y);
    const moisture = 0.5 + (damp - 0.5) * 0.76 + (localDamp - 0.5) * 0.38;
    let terrain;

    if (elevation < 0.295) terrain = "water";
    else if (elevation < 0.355) terrain = "shallows";
    else if (elevation < 0.41) terrain = "sand";
    else if (elevation > 0.835) terrain = "mountain";
    else if (elevation > 0.735) terrain = "hill";
    else if (moisture > 0.88 && elevation < 0.56) terrain = "marsh";
    else if (moisture > 0.61) terrain = "forest";
    else terrain = "meadow";

    // A small, intentional clearing gives every seed a safe entry point.
    if (Math.abs(x) <= SURFACE_PATCH_RADIUS && Math.abs(y) <= SURFACE_PATCH_RADIUS) {
      terrain = "meadow";
    }
    return {
      terrain,
      elevation: round3(elevation),
      moisture: round3(moisture),
      texture: round3(noise("world.surface.texture", 4, x, y)),
    };
  }

  return { random, noise, surface };
}

function isStartingClearing(x, y) {
  return Math.abs(x) <= SURFACE_PATCH_RADIUS && Math.abs(y) <= SURFACE_PATCH_RADIUS;
}

function makeEntity(type, x, y, extra = {}) {
  return {
    id: `${type}:${x}:${y}`,
    type,
    x,
    y,
    blocking: type === "tree" || type === "rock",
    ...extra,
  };
}

function addTileEntity(field, tile, entities, allowedTypes) {
  const { x, y, terrain } = tile;
  if (isStartingClearing(x, y)) {
    if (x === 2 && y === 0 && allowedTypes.has("berry")) {
      entities.push(makeEntity("berry", x, y, { loot: "wild-berries" }));
    }
    return;
  }

  const roll = field.random.float01("world.entity.roll", x, y);
  let type = null;
  if (terrain === "forest") {
    if (roll < 0.115) type = "tree";
    else if (roll < 0.151) type = "berry";
  } else if (terrain === "meadow" || terrain === "marsh") {
    if (roll < (terrain === "marsh" ? 0.018 : 0.024)) type = "berry";
    else if (roll > 0.9985) type = "cache";
  } else if (terrain === "hill" && roll < 0.12) {
    type = "rock";
  }
  if (type && allowedTypes.has(type)) {
    entities.push(makeEntity(type, x, y, {
      loot: type === "berry" ? "wild-berries" : type === "cache" ? "old-coin" : undefined,
    }));
  }
}

function roomAnchor(field, cellX, cellY) {
  const x = cellX * ROOM_CELL_SIZE + 3 + Number(field.random.int(28, "world.room.x", cellX, cellY));
  const y = cellY * ROOM_CELL_SIZE + 3 + Number(field.random.int(28, "world.room.y", cellX, cellY));
  return { x, y };
}

function makeRooms(field, cx, cy, allowedTypes) {
  if (!allowedTypes.has("ruin")) return { rooms: [], entities: [] };
  const minX = cx * CHUNK_SIZE;
  const minY = cy * CHUNK_SIZE;
  const maxX = minX + CHUNK_SIZE - 1;
  const maxY = minY + CHUNK_SIZE - 1;
  const firstCellX = Math.floor(minX / ROOM_CELL_SIZE);
  const lastCellX = Math.floor(maxX / ROOM_CELL_SIZE);
  const firstCellY = Math.floor(minY / ROOM_CELL_SIZE);
  const lastCellY = Math.floor(maxY / ROOM_CELL_SIZE);
  const rooms = [];
  const entities = [];

  for (let cellY = firstCellY; cellY <= lastCellY; cellY++) {
    for (let cellX = firstCellX; cellX <= lastCellX; cellX++) {
      if (field.random.float01("world.room.exists", cellX, cellY) >= 0.2) continue;
      const { x, y } = roomAnchor(field, cellX, cellY);
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      if (isStartingClearing(x, y)) continue;
      const terrain = field.surface(x, y).terrain;
      if (!(terrain === "meadow" || terrain === "forest" || terrain === "hill")) continue;
      const roomId = `room:ruin:${x}:${y}`;
      const room = { id: roomId, type: "ruin-hall", x, y, width: 4, height: 4, entrance: { x: x + 1, y: y + 3 } };
      rooms.push(room);
      entities.push(makeEntity("ruin", x, y, { roomId }));
    }
  }
  return { rooms, entities };
}

function makeGrass(seed, tiles) {
  const decor = new Random(seed).scope("world", "decor", "grass");
  const grass = [];
  for (const tile of tiles) {
    if (tile.terrain !== "meadow" && tile.terrain !== "forest") continue;
    const density = tile.terrain === "forest" ? 0.16 : 0.27;
    if (decor.float01(tile.x, tile.y, "tuft") >= density) continue;
    grass.push({
      id: `grass:${tile.x}:${tile.y}`,
      x: tile.x,
      y: tile.y,
      variant: Number(decor.int(4, tile.x, tile.y, "variant")),
    });
  }
  return grass;
}

export function generateChunk({ seed = 1, cx, cy, entityTypes = ENTITY_TYPES, includeGrass = false } = {}) {
  cx = assertSafeInteger(cx, "chunk x");
  cy = assertSafeInteger(cy, "chunk y");
  validateChunkExtent(cx, "chunk x");
  validateChunkExtent(cy, "chunk y");
  const seedValue = normalizedSeed(seed);
  const types = validateEntityTypes(entityTypes);
  if (typeof includeGrass !== "boolean") throw new TypeError("includeGrass must be a boolean");
  const allowedTypes = new Set(types);
  const field = createField(seedValue);
  const minX = cx * CHUNK_SIZE;
  const minY = cy * CHUNK_SIZE;
  const tiles = [];
  const entities = [];

  for (let y = minY; y < minY + CHUNK_SIZE; y++) {
    for (let x = minX; x < minX + CHUNK_SIZE; x++) {
      const tile = { id: `tile:${x}:${y}`, x, y, ...field.surface(x, y) };
      tiles.push(tile);
      addTileEntity(field, tile, entities, allowedTypes);
    }
  }
  const { rooms, entities: roomEntities } = makeRooms(field, cx, cy, allowedTypes);
  entities.push(...roomEntities);
  entities.sort((a, b) => a.id.localeCompare(b.id));
  rooms.sort((a, b) => a.id.localeCompare(b.id));

  const chunk = {
    contentVersion: CONTENT_VERSION,
    seed: seedValue,
    cx,
    cy,
    key: getChunkKey(cx, cy),
    tiles,
    entities,
    rooms,
  };
  if (includeGrass) chunk.grass = makeGrass(seedValue, tiles);
  return chunk;
}

export function generateWorld({
  seed = 1,
  chunks = [],
  order = "normal",
  entityTypes = ENTITY_TYPES,
  includeGrass = false,
} = {}) {
  const seedValue = normalizedSeed(seed);
  const types = validateEntityTypes(entityTypes);
  if (typeof includeGrass !== "boolean") throw new TypeError("includeGrass must be a boolean");
  const ordered = orderChunkCoordinates(chunks, seedValue, order);
  return ordered.map(({ x, y }) => generateChunk({
    seed: seedValue,
    cx: x,
    cy: y,
    entityTypes: types,
    includeGrass,
  }));
}

export function canonicalizeCore(chunk) {
  const tiles = chunk.tiles
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(({ id, x, y, terrain, elevation, moisture, texture }) => [id, x, y, terrain, elevation, moisture, texture]);
  const entities = chunk.entities
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, type, x, y, blocking, loot, roomId }) => [id, type, x, y, blocking, loot ?? null, roomId ?? null]);
  const rooms = chunk.rooms
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, type, x, y, width, height, entrance }) => [id, type, x, y, width, height, entrance.x, entrance.y]);
  return JSON.stringify({
    contentVersion: chunk.contentVersion,
    seed: chunk.seed,
    cx: chunk.cx,
    cy: chunk.cy,
    tiles,
    entities,
    rooms,
  });
}

export function canonicalizeWorld(chunks) {
  const ordered = chunks.slice().sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  const keys = new Set();
  for (const chunk of ordered) {
    const key = getChunkKey(chunk.cx, chunk.cy);
    if (keys.has(key)) throw new TypeError(`duplicate chunk key: ${key}`);
    keys.add(key);
  }
  return JSON.stringify(ordered.map((chunk) => JSON.parse(canonicalizeCore(chunk))));
}
