const VERSION = "verdant-expedition-3";
const LEGACY_VERSION = "verdant-expedition-2";
const EVENT_LIMIT = 32;
const EFFECT_LIMIT = 64;
const ACTIVE_ENEMY_LIMIT = 24;
const MAX_SAVE_CHARS = 2_000_000;
const MAX_COORDINATE = 1_000_000;
const MAX_RESOURCE = 1_000_000;
const MAX_STRUCTURES = 1_024;
const MAX_HARVESTED = 8_192;
const MAX_DISCOVERIES = 256;
const MAX_FINDS = 32;
const MAX_AIR = 100;
const DAY_CYCLE = 180;
const PLAYER_SPEED = 3.2;
const DASH_SPEED = 10.5;
const DASH_TIME = 0.16;
const DASH_COOLDOWN = 1.25;
const DASH_COST = 8;
const PLAYER_ATTACK_WINDUP = 0.12;
const PLAYER_ATTACK_COOLDOWN = 0.42;
const INTERACTION_RANGE = 1.8;
const ATTACK_RANGE = 1.65;
const RESOURCE_TYPES = ["wood", "stone", "berries"];
const PLACEABLE_TYPES = ["campfire", "bridge"];
const TOOL_TYPES = ["axe", "lantern", "boots", "fins"];

const recipe = (label, wood, stone, berries, description) => Object.freeze({
  label,
  cost: Object.freeze({ wood, stone, berries }),
  description,
});

export const RECIPES = Object.freeze({
  axe: recipe("Field axe", 3, 2, 0, "Breaks trees and rock outcrops into useful materials."),
  campfire: recipe("Campfire kit", 4, 2, 0, "Place a safe resting spot that restores health and energy."),
  lantern: recipe("Lantern", 2, 1, 1, "Lights the nearby path after dusk."),
  bridge: recipe("Bridge kit", 6, 3, 0, "Place a short crossing over a water tile."),
  boots: recipe("Trail boots", 2, 2, 3, "Move faster and spend less energy while exploring."),
  fins: recipe("Swim fins", 2, 2, 3, "Move faster through water and spend less energy while swimming."),
});

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function boundedNumber(value, min, max) {
  return finiteNumber(value) && value >= min && value <= max;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSeed(seed) {
  if (typeof seed !== "string" && typeof seed !== "number" && typeof seed !== "bigint") {
    throw new TypeError("seed must be a string or integer");
  }
  if (typeof seed === "number" && !Number.isSafeInteger(seed)) {
    throw new TypeError("numeric seed must be a safe integer");
  }
  const value = String(seed);
  if (value.length === 0 || value.length > 128) throw new TypeError("seed is outside the supported length");
  return value;
}

export function createGame(seed = "1") {
  return {
    seed: normalizeSeed(seed),
    version: VERSION,
    player: {
      x: 0,
      y: 0,
      hp: 100,
      energy: 100,
      facing: { x: 0, y: -1 },
      dashCooldown: 0,
      attackCooldown: 0,
      attackWindup: 0,
      invulnerability: 0,
      dashRemaining: 0,
      dashQueued: false,
      dashX: 0,
      dashY: -1,
      swimming: false,
      diving: false,
      air: MAX_AIR,
      lastShore: { x: 0, y: 0 },
      diveHeld: false,
      attackHeld: false,
      interactHeld: false,
      eatHeld: false,
    },
    inventory: { wood: 0, stone: 0, berries: 0, campfires: 0, bridges: 0 },
    tools: {},
    structures: [],
    harvested: [],
    discoveries: [],
    finds: [],
    restored: false,
    time: 0,
    events: [],
    enemies: [],
    effects: [],
  };
}

export function isNight(time) {
  return getWorldPhase(time).isNight;
}

export function getWorldPhase(time) {
  if (!finiteNumber(time)) return { phase: 0, night: 0, isNight: false };
  const phase = (((time % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE) / DAY_CYCLE;
  // Keep the simulation's night window synchronized with the renderer's soft dusk/dawn curve.
  const rawNight = Math.max(0, Math.sin((phase - 0.35) * Math.PI * 2)) * 0.64;
  const night = rawNight < 1e-9 ? 0 : rawNight;
  return { phase, night, isNight: night > 0 };
}

function pushEvent(state, type, text, x = state.player.x, y = state.player.y) {
  state.events.push({
    type: String(type).slice(0, 32),
    text: String(text).slice(0, 240),
    x: finiteNumber(x) ? x : 0,
    y: finiteNumber(y) ? y : 0,
  });
  if (state.events.length > EVENT_LIMIT) state.events.splice(0, state.events.length - EVENT_LIMIT);
}

function pushEffect(state, type, x, y, ttl = 0.35) {
  state.effects.push({ type, x, y, ttl });
  if (state.effects.length > EFFECT_LIMIT) state.effects.splice(0, state.effects.length - EFFECT_LIMIT);
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function tileAt(world, x, y) {
  if (!world || typeof world.tileAt !== "function") return undefined;
  // Player coordinates sit at tile centers (matching generated entity positions).
  const tileX = Math.floor(x + 0.5);
  const tileY = Math.floor(y + 0.5);
  try {
    return world.tileAt(tileX, tileY);
  } catch {
    return undefined;
  }
}

function entitiesNear(world, x, y, radius) {
  if (!world || typeof world.entitiesNear !== "function") return [];
  try {
    const entities = world.entitiesNear(x, y, radius);
    if (!Array.isArray(entities)) return [];
    return entities.filter((entity) => entity && typeof entity.id === "string"
      && typeof entity.type === "string" && finiteNumber(entity.x) && finiteNumber(entity.y));
  } catch {
    return [];
  }
}

function bridgeAt(state, x, y) {
  const tileX = Math.floor(x + 0.5);
  const tileY = Math.floor(y + 0.5);
  return (Array.isArray(state?.structures) ? state.structures : []).some((structure) => structure.kind === "bridge"
    && structure.x === tileX && structure.y === tileY);
}

function isSolidTerrain(terrain) {
  return terrain === undefined || terrain === "water" || terrain === "mountain";
}

export function getTerrainStatus(state, world) {
  const player = state?.player || {};
  const rawTerrain = tileAt(world, finiteNumber(player.x) ? player.x : 0,
    finiteNumber(player.y) ? player.y : 0);
  const terrain = rawTerrain === "water" && bridgeAt(state || { structures: [] }, player.x || 0, player.y || 0)
    ? "bridge"
    : rawTerrain ?? "unknown";
  const boots = Boolean(state?.tools?.boots);
  const fins = Boolean(state?.tools?.fins);
  const profiles = {
    meadow: { label: "Meadow", description: "Open ground offers steady footing.", speed: 1, concealed: false },
    path: { label: "Old trail", description: "A packed trail makes travel a little faster.", speed: 1.05, concealed: false },
    sand: { label: "Sand", description: "Loose sand slows each step.", speed: 0.85, concealed: false },
    forest: { label: "Forest", description: "Dense trees slow you and help hide you from sentinels.", speed: 0.9, concealed: true },
    marsh: { label: "Marsh", description: "Soft ground slows you and drains energy while you move.", speed: boots ? 0.85 : 0.55, concealed: false },
    hill: { label: "Rocky hillside", description: "Uneven stone makes the climb slower.", speed: boots ? 0.95 : 0.8, concealed: false },
    mountain: { label: boots ? "Mountain slope" : "Steep mountain", description: boots
      ? "Trail boots let you scramble up the steep slope."
      : "Too steep to cross without trail boots.", speed: boots ? 0.55 : 0, concealed: false },
    shallows: { label: "Shallows", description: "Shallow water slows your steps and takes a little energy.", speed: 0.65, concealed: false },
    water: { label: "Open water", description: "Swimming takes effort; fins make the crossing easier.", speed: fins ? 0.8 : 0.52, concealed: false },
    bridge: { label: "Bridge", description: "A dry crossing over the water.", speed: 1, concealed: false },
    unknown: { label: "Unmapped ground", description: "The terrain ahead is not mapped yet.", speed: 1, concealed: false },
  };
  const profile = profiles[terrain] || profiles.unknown;
  const swimming = terrain === "water";
  return {
    terrain,
    label: profile.label,
    description: profile.description,
    speed: profile.speed,
    swimming,
    diving: swimming && Boolean(player.diving),
    air: boundedNumber(player.air, 0, MAX_AIR) ? player.air : MAX_AIR,
    concealed: profile.concealed,
  };
}

function canOccupy(state, world, x, y) {
  const radius = 0.2;
  for (const [offsetX, offsetY] of [[0, 0], [-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
    const px = x + offsetX;
    const py = y + offsetY;
    const terrain = tileAt(world, px, py);
    if (terrain === undefined) return false;
    if (terrain === "water" && !bridgeAt(state, px, py)) continue;
    if (terrain === "mountain" && !state.tools?.boots) return false;
  }
  for (const entity of entitiesNear(world, x, y, 0.8)) {
    if (!entity.blocking || state.harvested.includes(entity.id)) continue;
    if (entity.type !== "tree" && entity.type !== "rock" && entity.type !== "sentinel") continue;
    if (distance(x, y, entity.x, entity.y) < 0.48) return false;
  }
  return true;
}

function moveWithCollision(state, world, dx, dy) {
  const longest = Math.max(Math.abs(dx), Math.abs(dy));
  if (longest === 0) return;
  const steps = Math.max(1, Math.ceil(longest / 0.08));
  const stepX = dx / steps;
  const stepY = dy / steps;
  for (let index = 0; index < steps; index += 1) {
    const nextX = state.player.x + stepX;
    if (canOccupy(state, world, nextX, state.player.y)) state.player.x = nextX;
    const nextY = state.player.y + stepY;
    if (canOccupy(state, world, state.player.x, nextY)) state.player.y = nextY;
  }
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);
  if (!length) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

function playerSafe(state, x = state.player.x, y = state.player.y) {
  if (distance(x, y, 0, 0) <= 3.25) return true;
  return state.structures.some((structure) => structure.kind === "campfire"
    && distance(x, y, structure.x, structure.y) <= 3.25);
}

function tickEffects(state, dt) {
  for (const effect of state.effects) effect.ttl -= dt;
  state.effects = state.effects.filter((effect) => finiteNumber(effect.ttl) && effect.ttl > 0);
  if (state.effects.length > EFFECT_LIMIT) state.effects.splice(0, state.effects.length - EFFECT_LIMIT);
}

function addUnique(list, value, cap) {
  if (typeof value !== "string" || !value || list.includes(value)) return false;
  if (list.length >= cap) return false;
  list.push(value);
  return true;
}

function startDash(state, direction, world) {
  const player = state.player;
  if (player.energy < DASH_COST) {
    player.dashQueued = false;
    pushEvent(state, "hint", "You need more energy to dash.");
    return false;
  }
  player.energy = Math.max(0, player.energy - DASH_COST);
  const requested = direction.x || direction.y ? direction : player.facing;
  const normalized = normalizeVector(requested.x, requested.y);
  player.dashX = normalized.x;
  player.dashY = normalized.y;
  player.dashRemaining = DASH_TIME;
  player.dashCooldown = DASH_COOLDOWN;
  player.dashQueued = false;
  player.invulnerability = Math.max(player.invulnerability, 0.12);
  const swimming = getTerrainStatus(state, world).swimming;
  pushEffect(state, swimming ? "swimstroke" : "dash", player.x, player.y, 0.24);
  pushEvent(state, "dash", swimming ? "You push off with a swim stroke." : "You dash across the trail.");
  return true;
}

function moveDash(state, world, directionX, directionY, duration) {
  let remaining = duration;
  // Recheck the terrain in short slices so a land dash loses speed as soon as
  // the player reaches water instead of carrying its full pace across a lake.
  while (remaining > 0) {
    const slice = Math.min(remaining, 0.02);
    const speed = getTerrainStatus(state, world).swimming ? 6 : DASH_SPEED;
    moveWithCollision(state, world, directionX * speed * slice, directionY * speed * slice);
    remaining -= slice;
  }
}

function movePlayer(state, inputX, inputY, dt, world) {
  const player = state.player;
  const beforeX = player.x;
  const beforeY = player.y;
  const direction = normalizeVector(inputX, inputY);
  if (direction.x || direction.y) player.facing = { x: direction.x, y: direction.y };
  if (player.dashQueued && player.dashCooldown <= 0) startDash(state, direction, world);

  const terrain = getTerrainStatus(state, world);
  const speed = PLAYER_SPEED * terrain.speed * (state.tools.boots && terrain.terrain === "meadow" ? 1.2 : 1)
    * (player.energy <= 0 ? 0.75 : 1);
  const dashTime = Math.min(dt, Math.max(0, player.dashRemaining));
  if (dashTime > 0) {
    moveDash(state, world, player.dashX, player.dashY, dashTime);
    const remainingTime = dt - dashTime;
    if (remainingTime > 0 && (direction.x || direction.y)) {
      const currentSpeed = PLAYER_SPEED * getTerrainStatus(state, world).speed
        * (state.tools.boots && getTerrainStatus(state, world).terrain === "meadow" ? 1.2 : 1)
        * (player.energy <= 0 ? 0.75 : 1);
      moveWithCollision(state, world, direction.x * currentSpeed * remainingTime,
        direction.y * currentSpeed * remainingTime);
    }
    player.dashRemaining = Math.max(0, player.dashRemaining - dt);
  } else if (direction.x || direction.y) {
    moveWithCollision(state, world, direction.x * speed * dt, direction.y * speed * dt);
  }
  return Math.hypot(player.x - beforeX, player.y - beforeY) > 1e-9;
}

function isDryWalkable(state, world, x, y) {
  const terrain = tileAt(world, x, y);
  if (terrain === undefined) return false;
  if (terrain === "water" && !bridgeAt(state, x, y)) return false;
  if (terrain === "mountain" && !state.tools?.boots) return false;
  return canOccupy(state, world, x, y);
}

function rememberShore(state, world) {
  const player = state.player;
  if (isDryWalkable(state, world, player.x, player.y)) {
    player.lastShore = { x: player.x, y: player.y };
  }
}

function rescueFromWater(state, world, reason) {
  const player = state.player;
  const shore = player.lastShore;
  let destination = shore && isDryWalkable(state, world, shore.x, shore.y) ? shore : null;
  if (!destination && isDryWalkable(state, world, 0, 0)) destination = { x: 0, y: 0 };
  // The generated starting clearing is always dry. Keep the camp fallback
  // available even when the caller has no loaded world to inspect.
  if (!destination) destination = { x: 0, y: 0 };
  player.x = destination.x;
  player.y = destination.y;
  player.lastShore = { x: destination.x, y: destination.y };
  player.hp = Math.max(1, player.hp - 15);
  player.energy = Math.max(20, player.energy);
  player.air = MAX_AIR;
  player.swimming = false;
  player.diving = false;
  player.dashRemaining = 0;
  player.dashQueued = false;
  player.invulnerability = Math.max(player.invulnerability, 1.5);
  pushEvent(state, "water-rescue", reason === "air"
    ? "Out of air. You surface at the last safe shore, shaken but safe."
    : "Exhausted in the water. You make it back to the last safe shore.", player.x, player.y);
  pushEffect(state, "rescue", player.x, player.y, 0.65);
}

function terrainEnergyRate(state, terrainStatus) {
  if (terrainStatus.terrain === "water") return state.tools?.fins ? 0.8 : 2;
  if (terrainStatus.terrain === "marsh") return 0.7;
  if (terrainStatus.terrain === "shallows") return 0.15;
  if (terrainStatus.terrain === "mountain" && state.tools?.boots) return 1;
  return 0;
}

function updateWaterState(state, controls, dt, world, moved) {
  const player = state.player;
  rememberShore(state, world);
  const status = getTerrainStatus(state, world);
  player.swimming = status.swimming;
  if (!player.swimming) player.diving = false;

  const diveHeld = Boolean(controls.dive);
  const divePressed = diveHeld && !player.diveHeld;
  if (divePressed) {
    if (player.swimming) {
      player.diving = !player.diving;
      pushEvent(state, player.diving ? "dive" : "surface", player.diving
        ? "You dive beneath the surface. Watch your air."
        : "You return to the surface to breathe.");
    } else {
      pushEvent(state, "hint", "You need to be swimming before you can dive.");
    }
  }
  player.diveHeld = diveHeld;

  if (player.diving && player.swimming) player.air = Math.max(0, player.air - 8 * dt);
  else player.air = Math.min(MAX_AIR, player.air + 25 * dt);
  if (moved) {
    const energyCost = terrainEnergyRate(state, getTerrainStatus(state, world));
    player.energy = Math.max(0, player.energy - energyCost * dt);
  }

  if (player.swimming && player.diving && player.air <= 0) {
    rescueFromWater(state, world, "air");
  } else if (player.swimming && player.energy <= 0) {
    rescueFromWater(state, world, "energy");
  }
}

function reportTerrainTransition(state, previous, current) {
  if (previous.terrain === current.terrain) return;
  if (current.terrain === "water") {
    pushEvent(state, "terrain", "The ground gives way to open water. Swim steadily; press R to dive, and watch your energy.");
  } else if (previous.terrain === "water" && !current.swimming) {
    pushEvent(state, "terrain", "You reach dry ground and surface to breathe.");
  } else if (current.terrain === "marsh") {
    pushEvent(state, "terrain", "The marsh slows your steps and drains energy while you move.");
  } else if (current.terrain === "forest") {
    pushEvent(state, "terrain", "The forest slows you, but its cover makes you harder for sentinels to notice.");
  } else if (current.terrain === "shallows") {
    pushEvent(state, "terrain", "You wade through the shallows; the water slows each step.");
  }
}

function nearestEntity(state, world, types, range) {
  const candidates = entitiesNear(world, state.player.x, state.player.y, range)
    .filter((entity) => types.includes(entity.type) && !state.harvested.includes(entity.id))
    .map((entity) => ({ entity, distance: distance(state.player.x, state.player.y, entity.x, entity.y) }))
    .filter((entry) => entry.distance <= range)
    .sort((a, b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id));
  return candidates[0]?.entity;
}

function attackTargetAllowed(state, entity) {
  const dx = entity.x - state.player.x;
  const dy = entity.y - state.player.y;
  const range = Math.hypot(dx, dy);
  if (!range) return true;
  const facing = normalizeVector(state.player.facing.x, state.player.facing.y);
  const forward = (dx / range) * facing.x + (dy / range) * facing.y;
  return forward >= -0.2;
}

function rewardHarvest(state, entity) {
  if (!addUnique(state.harvested, entity.id, MAX_HARVESTED)) {
    pushEvent(state, "hint", "Your field notes are full; record a discovery before gathering more.", entity.x, entity.y);
    return false;
  }
  if (entity.type === "tree") {
    const amount = state.tools.axe ? 3 : 1;
    state.inventory.wood = Math.min(MAX_RESOURCE, state.inventory.wood + amount);
    pushEvent(state, "harvest", state.tools.axe
      ? `You cut the tree and gather ${amount} wood.`
      : "You pry a little wood from the tree by hand.", entity.x, entity.y);
  } else if (entity.type === "rock") {
    const amount = state.tools.axe ? 2 : 1;
    state.inventory.stone = Math.min(MAX_RESOURCE, state.inventory.stone + amount);
    pushEvent(state, "harvest", state.tools.axe
      ? `You break the outcrop and gather ${amount} stone.`
      : "You chip a little stone from the outcrop by hand.", entity.x, entity.y);
  } else if (entity.type === "sentinel") {
    state.inventory.stone = Math.min(MAX_RESOURCE, state.inventory.stone + 1);
    pushEvent(state, "combat", "The sentinel falls quiet. You recover 1 stone.", entity.x, entity.y);
  }
  pushEffect(state, "pickup", entity.x, entity.y);
  return true;
}

function resolvePlayerAttack(state, world) {
  const target = nearestEntity(state, world, ["tree", "rock"], ATTACK_RANGE);
  if (target && attackTargetAllowed(state, target)) {
    rewardHarvest(state, target);
    return;
  }

  const enemy = state.enemies
    .filter((candidate) => !state.harvested.includes(candidate.id)
      && distance(state.player.x, state.player.y, candidate.x, candidate.y) <= ATTACK_RANGE
      && attackTargetAllowed(state, candidate))
    .sort((a, b) => distance(state.player.x, state.player.y, a.x, a.y)
      - distance(state.player.x, state.player.y, b.x, b.y) || a.id.localeCompare(b.id))[0];
  if (enemy) {
    enemy.hp = Math.max(0, enemy.hp - 1);
    enemy.hurt = 0.22;
    enemy.mode = "recover";
    enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.6);
    pushEffect(state, "hit", enemy.x, enemy.y);
    pushEvent(state, "combat", "Your pulse strikes the sentinel.", enemy.x, enemy.y);
    if (enemy.hp <= 0) {
      rewardHarvest(state, enemy);
      state.enemies = state.enemies.filter((candidate) => candidate.id !== enemy.id);
    }
    return;
  }
  pushEffect(state, "pulse", state.player.x + state.player.facing.x * 0.75,
    state.player.y + state.player.facing.y * 0.75);
  pushEvent(state, "attack", "Your pulse fades in the air.");
}

function updatePlayerAttack(state, input, dt, world) {
  const player = state.player;
  if (player.diving) {
    player.attackWindup = 0;
    player.attackHeld = Boolean(input.attack);
    return;
  }
  if (player.attackCooldown > 0) player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  if (player.attackWindup > 0) {
    player.attackWindup = Math.max(0, player.attackWindup - dt);
    if (player.attackWindup === 0) resolvePlayerAttack(state, world);
  }
  if (input.attack && player.attackCooldown <= 0 && player.attackWindup <= 0) {
    player.attackWindup = PLAYER_ATTACK_WINDUP;
    player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
    pushEvent(state, "attack", "You ready a pulse.");
  }
  player.attackHeld = Boolean(input.attack);
}

function validLandmarks(world) {
  return Array.isArray(world?.landmarks)
    ? world.landmarks.filter((landmark) => landmark && typeof landmark.id === "string"
      && finiteNumber(landmark.x) && finiteNumber(landmark.y))
    : [];
}

function isBeacon(landmark) {
  return typeof landmark?.id === "string" && landmark.id.toLowerCase().includes("beacon");
}

function landmarkTitle(landmark) {
  return typeof landmark.title === "string" && landmark.title ? landmark.title : "Unknown site";
}

function interact(state, world) {
  const player = state.player;
  const sites = validLandmarks(world).filter((landmark) => !isBeacon(landmark));
  const site = sites
    .filter((landmark) => distance(player.x, player.y, landmark.x, landmark.y) <= INTERACTION_RANGE
      && !state.discoveries.includes(landmark.id))
    .sort((a, b) => distance(player.x, player.y, a.x, a.y) - distance(player.x, player.y, b.x, b.y)
      || a.id.localeCompare(b.id))[0];
  if (site) {
    addUnique(state.discoveries, site.id, MAX_DISCOVERIES);
    // Every recovered sigil also sustains the expedition.
    state.inventory.berries = Math.min(MAX_RESOURCE, state.inventory.berries + 1);
    const title = landmarkTitle(site);
    const text = typeof site.text === "string" && site.text ? ` ${site.text}` : "";
    pushEvent(state, "discovery", `${title} recorded.${text}`, site.x, site.y);
    pushEffect(state, "discovery", site.x, site.y, 0.65);
    return { ok: true, message: state.events.at(-1).text };
  }

  const entity = nearestEntity(state, world, ["berry", "cache"], INTERACTION_RANGE);
  if (entity) {
    if (entity.type === "cache" && entity.requiresDive
        && (!player.swimming || !player.diving)) {
      const message = "Dive below the surface to reach this cache.";
      pushEvent(state, "hint", message, entity.x, entity.y);
      return { ok: false, message };
    }
    if (entity.type === "cache" && entity.requiresDive
        && (!entity.reward || typeof entity.reward !== "object"
          || RESOURCE_TYPES.some((key) => !Number.isSafeInteger(entity.reward[key])
            || entity.reward[key] < 0 || entity.reward[key] > MAX_RESOURCE))) {
      const message = "The underwater cache is too damaged to read.";
      pushEvent(state, "hint", message, entity.x, entity.y);
      return { ok: false, message };
    }
    if (!addUnique(state.harvested, entity.id, MAX_HARVESTED)) {
      const message = "Your field notes are full; record a discovery before gathering more.";
      pushEvent(state, "hint", message, entity.x, entity.y);
      return { ok: false, message };
    }
    if (entity.type === "berry") {
      const amount = Number.isSafeInteger(entity.amount) && entity.amount > 0 ? clamp(entity.amount, 1, 8) : 1;
      state.inventory.berries = Math.min(MAX_RESOURCE, state.inventory.berries + amount);
      pushEvent(state, "gather", `You gather ${amount} wild ${amount === 1 ? "berry" : "berries"}.`, entity.x, entity.y);
    } else if (entity.requiresDive) {
      for (const key of RESOURCE_TYPES) {
        state.inventory[key] = Math.min(MAX_RESOURCE, state.inventory[key] + entity.reward[key]);
      }
      const recorded = addUnique(state.finds, entity.noteId, MAX_FINDS);
      const note = typeof entity.note === "string" && entity.note ? ` ${entity.note}` : "";
      pushEvent(state, "cache", recorded
        ? `You recover the underwater cache and record its field note.${note}`
        : `You recover the underwater cache.${note}`, entity.x, entity.y);
    } else {
      state.inventory.wood = Math.min(MAX_RESOURCE, state.inventory.wood + 1);
      state.inventory.stone = Math.min(MAX_RESOURCE, state.inventory.stone + 1);
      state.inventory.berries = Math.min(MAX_RESOURCE, state.inventory.berries + 1);
      pushEvent(state, "cache", "The cache holds a little wood, stone, and food.", entity.x, entity.y);
    }
    pushEffect(state, "pickup", entity.x, entity.y);
    return { ok: true, message: state.events.at(-1).text };
  }

  const recovery = state.structures
    .filter((structure) => structure.kind === "recovery-cache"
      && distance(player.x, player.y, structure.x, structure.y) <= INTERACTION_RANGE)
    .sort((a, b) => distance(player.x, player.y, a.x, a.y)
      - distance(player.x, player.y, b.x, b.y))[0];
  if (recovery) {
    for (const key of RESOURCE_TYPES) {
      state.inventory[key] = Math.min(MAX_RESOURCE, state.inventory[key] + recovery.contents[key]);
    }
    state.structures.splice(state.structures.indexOf(recovery), 1);
    pushEvent(state, "recovery", "You recover the supplies lost when you fell.", recovery.x, recovery.y);
    return { ok: true, message: state.events.at(-1).text };
  }

  const campfire = state.structures
    .filter((structure) => structure.kind === "campfire"
      && distance(player.x, player.y, structure.x, structure.y) <= INTERACTION_RANGE)
    .sort((a, b) => distance(player.x, player.y, a.x, a.y)
      - distance(player.x, player.y, b.x, b.y))[0];
  if (campfire) {
    player.hp = Math.min(100, player.hp + 15);
    player.energy = Math.min(100, player.energy + 40);
    pushEvent(state, "rest", "The campfire restores your health and energy.", campfire.x, campfire.y);
    pushEffect(state, "rest", campfire.x, campfire.y, 0.6);
    return { ok: true, message: state.events.at(-1).text };
  }

  const beaconLandmark = validLandmarks(world).find(isBeacon);
  const beaconX = beaconLandmark ? beaconLandmark.x : 0;
  const beaconY = beaconLandmark ? beaconLandmark.y : 0;
  if (distance(player.x, player.y, beaconX, beaconY) <= INTERACTION_RANGE) {
    const siteIds = [...new Set(sites.map((landmark) => landmark.id))];
    const allSigilsFound = siteIds.length >= 3 && siteIds.every((id) => state.discoveries.includes(id));
    player.hp = Math.min(100, player.hp + 15);
    player.energy = Math.min(100, player.energy + 40);
    if (allSigilsFound && !state.restored) {
      state.restored = true;
      pushEvent(state, "story", "The three sigils wake the beacon. A signal answers from below; its warmth restores you.", beaconX, beaconY);
      pushEffect(state, "beacon", beaconX, beaconY, 1);
      return { ok: true, message: state.events.at(-1).text };
    }
    if (state.restored) {
      pushEvent(state, "story", "The restored beacon steadies you. The archipelago remains yours to explore.", beaconX, beaconY);
      return { ok: true, message: state.events.at(-1).text };
    }
    const missing = Math.max(3, siteIds.length) - siteIds.filter((id) => state.discoveries.includes(id)).length;
    pushEvent(state, "beacon", `The signal is still broken. Its warmth restores you; recover ${missing} more ${missing === 1 ? "sigil" : "sigils"}.`, beaconX, beaconY);
    return { ok: true, message: state.events.at(-1).text };
  }

  pushEvent(state, "hint", "Nothing nearby answers your call.");
  return { ok: false, message: state.events.at(-1).text };
}

export { interact };

function hasBlockingEntity(state, world, x, y) {
  return entitiesNear(world, x, y, 0.9).some((entity) => entity.blocking
    && !state.harvested.includes(entity.id)
    && distance(x, y, entity.x, entity.y) < 0.58);
}

function structureAt(state, x, y) {
  return state.structures.some((structure) => structure.x === x && structure.y === y
    && structure.kind !== "recovery-cache");
}

function cardinalNeighbors(world, x, y, state) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .map(([neighborX, neighborY]) => ({ x: neighborX, y: neighborY, terrain: tileAt(world, neighborX, neighborY) }))
    .some((neighbor) => neighbor.terrain !== undefined
      && (!isSolidTerrain(neighbor.terrain) || bridgeAt(state, neighbor.x, neighbor.y)));
}

export function canPlace(state, kind, x, y, world) {
  if (!state?.player || !state.inventory || !Array.isArray(state.structures)) {
    return { ok: false, message: "The expedition is not ready to build." };
  }
  if (!PLACEABLE_TYPES.includes(kind)) return { ok: false, message: "That item cannot be placed." };
  if (state.structures.length >= MAX_STRUCTURES) return { ok: false, message: "Your expedition has reached its building limit (1024 structures)." };
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)
      || Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE) {
    return { ok: false, message: "Choose a valid tile." };
  }
  const countKey = kind === "campfire" ? "campfires" : "bridges";
  if (!Number.isSafeInteger(state.inventory?.[countKey]) || state.inventory[countKey] < 1) {
    return { ok: false, message: `Craft a ${kind} kit first.` };
  }
  if (distance(state.player.x, state.player.y, x, y) > 3.5) {
    return { ok: false, message: "Place it within a few steps of your position." };
  }
  const terrain = tileAt(world, x, y);
  if (terrain === undefined) return { ok: false, message: "That tile has not been explored yet." };
  if (structureAt(state, x, y)) return { ok: false, message: "Something is already built there." };
  if (hasBlockingEntity(state, world, x, y)) return { ok: false, message: "Clear the tree, rock, or sentinel first." };
  if (kind === "campfire" && (terrain === "water" || terrain === "mountain")) {
    return { ok: false, message: "A campfire needs stable ground." };
  }
  if (kind === "bridge" && (terrain !== "water" || !cardinalNeighbors(world, x, y, state))) {
    return { ok: false, message: "A bridge needs a short water crossing beside walkable ground." };
  }
  return { ok: true, message: kind === "campfire" ? "Campfire can be placed here." : "Bridge can be placed here." };
}

export function place(state, kind, x, y, world) {
  const validation = canPlace(state, kind, x, y, world);
  if (!validation.ok) return validation;
  const countKey = kind === "campfire" ? "campfires" : "bridges";
  state.inventory[countKey] -= 1;
  const structure = { id: `${kind}:${x}:${y}`, kind, x, y };
  state.structures.push(structure);
  pushEvent(state, "build", kind === "campfire" ? "Campfire placed." : "Bridge placed.", x, y);
  pushEffect(state, "build", x, y, 0.45);
  return { ok: true, message: state.events.at(-1).text };
}

export function craft(state, recipeName) {
  const item = RECIPES[recipeName];
  if (!item) return { ok: false, message: "That recipe is not known." };
  if (TOOL_TYPES.includes(recipeName) && state.tools?.[recipeName]) {
    return { ok: false, message: `You already crafted ${item.label.toLowerCase()}.` };
  }
  const inventory = state.inventory;
  if (!inventory || RESOURCE_TYPES.some((key) => !Number.isSafeInteger(inventory[key]) || inventory[key] < item.cost[key])) {
    const missing = RESOURCE_TYPES.filter((key) => (inventory?.[key] ?? 0) < item.cost[key]);
    const labels = missing.map((key) => key === "berries" ? "berries" : key);
    return { ok: false, message: `Need more ${labels.join(", ") || "materials"}.` };
  }
  for (const key of RESOURCE_TYPES) inventory[key] -= item.cost[key];
  if (TOOL_TYPES.includes(recipeName)) {
    state.tools[recipeName] = true;
  } else if (recipeName === "campfire") {
    inventory.campfires = (Number.isSafeInteger(inventory.campfires) ? inventory.campfires : 0) + 1;
  } else if (recipeName === "bridge") {
    inventory.bridges = (Number.isSafeInteger(inventory.bridges) ? inventory.bridges : 0) + 1;
  }
  pushEvent(state, "craft", `${item.label} crafted.`, state.player.x, state.player.y);
  return { ok: true, message: state.events.at(-1).text };
}

function deterministicPhase(id) {
  let value = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    value ^= id.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return ((value >>> 0) % 6283) / 1000;
}

function newEnemy(entity) {
  return {
    id: entity.id,
    x: entity.x,
    y: entity.y,
    originX: entity.x,
    originY: entity.y,
    hp: 2,
    mode: "patrol",
    windup: 0,
    attackCooldown: 0.25,
    pursuitTime: 0,
    hurt: 0,
    phase: deterministicPhase(entity.id),
  };
}

function syncEnemies(state, world) {
  const existing = new Map(state.enemies.map((enemy) => [enemy.id, enemy]));
  const visible = entitiesNear(world, state.player.x, state.player.y, 14)
    .filter((entity) => {
      if (entity.type !== "sentinel" || state.harvested.includes(entity.id)) return false;
      const terrain = tileAt(world, entity.x, entity.y);
      if (terrain === "water" && !bridgeAt(state, entity.x, entity.y)) return false;
      if (terrain === "mountain") return false;
      if (state.player.swimming && distance(state.player.x, state.player.y, entity.x, entity.y) < 1) return false;
      return true;
    })
    .map((entity) => ({ entity, distance: distance(state.player.x, state.player.y, entity.x, entity.y) }))
    .filter(({ distance: range }) => range <= 14)
    .sort((a, b) => a.distance - b.distance || a.entity.id.localeCompare(b.entity.id))
    .slice(0, ACTIVE_ENEMY_LIMIT)
    .map(({ entity }) => existing.get(entity.id) || newEnemy(entity));
  state.enemies = visible;
}

function moveEnemy(state, enemy, dx, dy, world) {
  const distanceMoved = Math.hypot(dx, dy);
  if (!distanceMoved) return;
  const steps = Math.max(1, Math.ceil(distanceMoved / 0.1));
  const stepX = dx / steps;
  const stepY = dy / steps;
  for (let index = 0; index < steps; index += 1) {
    const nextX = enemy.x + stepX;
    const nextY = enemy.y + stepY;
    const tx = tileAt(world, nextX, enemy.y);
    const ty = tileAt(world, enemy.x, nextY);
    if (!isSolidTerrain(tx) || (tx === "water" && bridgeAt(state, nextX, enemy.y))) enemy.x = nextX;
    if (!isSolidTerrain(ty) || (ty === "water" && bridgeAt(state, enemy.x, nextY))) enemy.y = nextY;
  }
}

function hitPlayer(state, enemy, world) {
  const player = state.player;
  if (player.swimming || player.invulnerability > 0 || player.dashRemaining > 0 || playerSafe(state)) return false;
  player.hp = Math.max(0, player.hp - 18);
  player.invulnerability = 0.9;
  const away = normalizeVector(player.x - enemy.x, player.y - enemy.y);
  moveWithCollision(state, world, away.x * 0.25, away.y * 0.25);
  pushEffect(state, "hit", player.x, player.y, 0.4);
  pushEvent(state, "damage", "A sentinel strike catches you. Find space to recover.");
  return true;
}

function updateEnemies(state, world, dt) {
  const night = isNight(state.time);
  const terrainStatus = getTerrainStatus(state, world);
  for (const enemy of state.enemies) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.hurt = Math.max(0, enemy.hurt - dt);
    const range = distance(state.player.x, state.player.y, enemy.x, enemy.y);
    const safe = playerSafe(state);

    if (terrainStatus.swimming) {
      enemy.mode = "patrol";
      enemy.windup = 0;
      enemy.pursuitTime = 0;
      continue;
    }

    if (enemy.mode === "windup") {
      enemy.windup = Math.max(0, enemy.windup - dt);
      if (enemy.windup === 0) {
        if (range <= 1.7) hitPlayer(state, enemy, world);
        enemy.mode = "recover";
        enemy.attackCooldown = 1.15;
      }
      continue;
    }
    if (enemy.mode === "recover") {
      if (enemy.attackCooldown === 0) enemy.mode = "patrol";
      else continue;
    }

    const noticeRange = (night ? 8.5 : 6) * (terrainStatus.concealed ? 0.6 : 1);
    if (!safe && range <= noticeRange) {
      enemy.pursuitTime = 3;
      if (range <= 1.3 && enemy.attackCooldown <= 0) {
        enemy.mode = "windup";
        enemy.windup = 0.55;
        pushEvent(state, "telegraph", "A sentinel gathers itself to strike. Dash or move away.", enemy.x, enemy.y);
      } else {
        enemy.mode = "pursue";
        const toward = normalizeVector(state.player.x - enemy.x, state.player.y - enemy.y);
        moveEnemy(state, enemy, toward.x * 1.15 * dt, toward.y * 1.15 * dt, world);
      }
      continue;
    }

    enemy.pursuitTime = Math.max(0, enemy.pursuitTime - dt);
    if (enemy.pursuitTime > 0 && !safe && !terrainStatus.concealed) {
      enemy.mode = "pursue";
      const toward = normalizeVector(state.player.x - enemy.x, state.player.y - enemy.y);
      moveEnemy(state, enemy, toward.x * 0.8 * dt, toward.y * 0.8 * dt, world);
      continue;
    }

    enemy.mode = "patrol";
    const angle = state.time * 0.55 + enemy.phase;
    const patrolX = enemy.originX + Math.cos(angle) * 1.1;
    const patrolY = enemy.originY + Math.sin(angle) * 1.1;
    const toward = normalizeVector(patrolX - enemy.x, patrolY - enemy.y);
    moveEnemy(state, enemy, toward.x * 0.42 * dt, toward.y * 0.42 * dt, world);
  }
}

function dropSuppliesOnDefeat(state, x, y) {
  const contents = { wood: 0, stone: 0, berries: 0 };
  for (const key of RESOURCE_TYPES) {
    const count = state.inventory[key];
    const lost = count > 0 ? Math.max(1, Math.ceil(count * 0.2)) : 0;
    contents[key] = lost;
    state.inventory[key] = Math.max(0, count - lost);
  }
  if (contents.wood || contents.stone || contents.berries) {
    let suffix = 0;
    let id = `recovery-cache:${Math.round(x)}:${Math.round(y)}:${Math.floor(state.time * 1000)}`;
    while (state.structures.some((structure) => structure.id === id)) id = `recovery-cache:${Math.round(x)}:${Math.round(y)}:${Math.floor(state.time * 1000)}:${++suffix}`;
    if (state.structures.length >= MAX_STRUCTURES) {
      const removable = state.structures.findIndex((structure) => structure.kind === "recovery-cache");
      if (removable >= 0) state.structures.splice(removable, 1);
    }
    if (state.structures.length < MAX_STRUCTURES) {
      state.structures.push({ id, kind: "recovery-cache", x: Math.round(x), y: Math.round(y), contents });
    }
  }
}

function respawn(state) {
  const oldX = state.player.x;
  const oldY = state.player.y;
  dropSuppliesOnDefeat(state, oldX, oldY);
  state.player.x = 0;
  state.player.y = 0;
  state.player.hp = 100;
  state.player.energy = Math.max(55, state.player.energy);
  state.player.invulnerability = 1.1;
  state.player.dashRemaining = 0;
  state.player.dashCooldown = 0.8;
  state.player.attackCooldown = 0;
  state.player.attackWindup = 0;
  state.player.dashQueued = false;
  state.enemies = [];
  pushEvent(state, "respawn", "Defeated. You return to the beacon camp; lost supplies can be recovered where you fell.");
  pushEffect(state, "respawn", 0, 0, 0.75);
}

function eatFood(state) {
  if (state.inventory.berries <= 0) {
    pushEvent(state, "hint", "You have no berries to eat.");
    return false;
  }
  if (state.player.energy >= 99) {
    pushEvent(state, "hint", "You have enough energy for now.");
    return false;
  }
  state.inventory.berries -= 1;
  state.player.energy = Math.min(100, state.player.energy + 35);
  pushEvent(state, "eat", "You eat wild berries and regain energy.");
  pushEffect(state, "eat", state.player.x, state.player.y);
  return true;
}

export function stepGame(state, input = {}, dt = 1 / 60, world = {}) {
  if (!state || !state.player || !finiteNumber(dt) || dt < 0 || dt > 5) {
    throw new TypeError("stepGame needs a valid state and a finite delta from 0 to 5 seconds");
  }
  const controls = input && typeof input === "object" ? input : {};
  const previousNight = isNight(state.time);
  state.time = Math.min(1_000_000_000_000, state.time + dt);
  const player = state.player;
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invulnerability = Math.max(0, player.invulnerability - dt);
  player.energy = Math.max(0, player.energy - 0.02 * dt);
  if (previousNight !== isNight(state.time)) {
    pushEvent(state, "time", isNight(state.time) ? "Night settles over the islands." : "Daylight returns to the islands.");
  }
  if (player.dashCooldown > 0 && controls.dash) player.dashQueued = true;
  if (player.dashCooldown <= 0 && controls.dash) player.dashQueued = true;

  const rawX = finiteNumber(controls.x) ? clamp(controls.x, -1, 1) : 0;
  const rawY = finiteNumber(controls.y) ? clamp(controls.y, -1, 1) : 0;
  rememberShore(state, world);
  const previousTerrain = getTerrainStatus(state, world);
  const moved = movePlayer(state, rawX, rawY, dt, world);
  reportTerrainTransition(state, previousTerrain, getTerrainStatus(state, world));
  updateWaterState(state, controls, dt, world, moved);
  syncEnemies(state, world);

  const eatPressed = Boolean(controls.eat) && !player.eatHeld;
  if (eatPressed) eatFood(state);
  player.eatHeld = Boolean(controls.eat);

  updatePlayerAttack(state, controls, dt, world);
  const interactPressed = Boolean(controls.interact) && !player.interactHeld;
  if (interactPressed) interact(state, world);
  player.interactHeld = Boolean(controls.interact);

  updateEnemies(state, world, dt);
  tickEffects(state, dt);
  if (player.hp <= 0) respawn(state);
  return state;
}

function requireBoundedInteger(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`${name} is invalid`);
}

function requireString(value, maxLength, name) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
}

function validatePersistentState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new TypeError("game state is invalid");
  if (state.version !== VERSION) throw new TypeError("game version is unsupported");
  normalizeSeed(state.seed);
  if (!state.player || typeof state.player !== "object") throw new TypeError("player state is invalid");
  for (const key of ["x", "y"]) {
    if (!boundedNumber(state.player[key], -MAX_COORDINATE, MAX_COORDINATE)) throw new TypeError(`player ${key} is invalid`);
  }
  if (!boundedNumber(state.player.hp, 0, 100) || !boundedNumber(state.player.energy, 0, 100)) {
    throw new TypeError("player health or energy is invalid");
  }
  if (typeof state.player.swimming !== "boolean" || typeof state.player.diving !== "boolean"
      || (state.player.diving && !state.player.swimming)
      || !boundedNumber(state.player.air, 0, MAX_AIR)) throw new TypeError("player water state is invalid");
  if (!state.player.lastShore || typeof state.player.lastShore !== "object"
      || Array.isArray(state.player.lastShore)
      || !boundedNumber(state.player.lastShore.x, -MAX_COORDINATE, MAX_COORDINATE)
      || !boundedNumber(state.player.lastShore.y, -MAX_COORDINATE, MAX_COORDINATE)) {
    throw new TypeError("player last shore is invalid");
  }
  if (!state.player.facing || !boundedNumber(state.player.facing.x, -1, 1)
      || !boundedNumber(state.player.facing.y, -1, 1)) throw new TypeError("player facing is invalid");
  if (!boundedNumber(state.player.dashCooldown, 0, 10)) throw new TypeError("dash cooldown is invalid");
  if (!state.inventory || typeof state.inventory !== "object") throw new TypeError("inventory is invalid");
  for (const key of [...RESOURCE_TYPES, "campfires", "bridges"]) {
    requireBoundedInteger(state.inventory[key], 0, MAX_RESOURCE, `inventory ${key}`);
  }
  if (!state.tools || typeof state.tools !== "object" || Array.isArray(state.tools)) throw new TypeError("tools are invalid");
  for (const [key, value] of Object.entries(state.tools)) {
    if (!TOOL_TYPES.includes(key) || typeof value !== "boolean") throw new TypeError("tool entry is invalid");
  }
  if (!Array.isArray(state.structures) || state.structures.length > MAX_STRUCTURES) throw new TypeError("structures are invalid");
  const structureIds = new Set();
  for (const structure of state.structures) {
    if (!structure || typeof structure !== "object") throw new TypeError("structure entry is invalid");
    requireString(structure.id, 192, "structure id");
    if (structureIds.has(structure.id)) throw new TypeError("structure IDs must be unique");
    structureIds.add(structure.id);
    if (![...PLACEABLE_TYPES, "recovery-cache"].includes(structure.kind)) throw new TypeError("structure kind is invalid");
    requireBoundedInteger(structure.x, -MAX_COORDINATE, MAX_COORDINATE, "structure x");
    requireBoundedInteger(structure.y, -MAX_COORDINATE, MAX_COORDINATE, "structure y");
    if (structure.kind === "recovery-cache") {
      if (!structure.contents || typeof structure.contents !== "object") throw new TypeError("recovery cache is invalid");
      for (const key of RESOURCE_TYPES) requireBoundedInteger(structure.contents[key], 0, MAX_RESOURCE, `recovery cache ${key}`);
    }
  }
  for (const [key, cap] of [["harvested", MAX_HARVESTED], ["discoveries", MAX_DISCOVERIES], ["finds", MAX_FINDS]]) {
    const values = state[key];
    if (!Array.isArray(values) || values.length > cap) throw new TypeError(`${key} are invalid`);
    const seen = new Set();
    for (const value of values) {
      requireString(value, 192, key.slice(0, -1));
      if (seen.has(value)) throw new TypeError(`${key} must be unique`);
      seen.add(value);
    }
  }
  if (typeof state.restored !== "boolean") throw new TypeError("restored flag is invalid");
  if (!boundedNumber(state.time, 0, 1_000_000_000_000)) throw new TypeError("time is invalid");
}

export function serializeGame(state) {
  validatePersistentState(state);
  const payload = {
    seed: state.seed,
    version: VERSION,
    player: {
      x: state.player.x,
      y: state.player.y,
      hp: state.player.hp,
      energy: state.player.energy,
      facing: { x: state.player.facing.x, y: state.player.facing.y },
      dashCooldown: state.player.dashCooldown,
      swimming: state.player.swimming,
      diving: state.player.diving,
      air: state.player.air,
      lastShore: { x: state.player.lastShore.x, y: state.player.lastShore.y },
    },
    inventory: {
      wood: state.inventory.wood,
      stone: state.inventory.stone,
      berries: state.inventory.berries,
      campfires: state.inventory.campfires,
      bridges: state.inventory.bridges,
    },
    tools: Object.fromEntries(Object.entries(state.tools).sort(([a], [b]) => a.localeCompare(b))),
    structures: state.structures.map((structure) => structure.kind === "recovery-cache"
      ? { id: structure.id, kind: structure.kind, x: structure.x, y: structure.y, contents: { ...structure.contents } }
      : { id: structure.id, kind: structure.kind, x: structure.x, y: structure.y }),
    harvested: [...state.harvested],
    discoveries: [...state.discoveries],
    finds: [...state.finds],
    restored: state.restored,
    time: state.time,
  };
  const text = JSON.stringify(payload);
  if (text.length > MAX_SAVE_CHARS) throw new TypeError("save is too large");
  return text;
}

export function restoreGame(text, seed) {
  try {
    if (typeof text !== "string" || text.length === 0 || text.length > MAX_SAVE_CHARS) return null;
    const parsed = JSON.parse(text);
    const expectedSeed = normalizeSeed(seed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)
        || ![VERSION, LEGACY_VERSION].includes(parsed.version) || parsed.seed !== expectedSeed) return null;
    const state = createGame(expectedSeed);
    state.player.x = parsed.player?.x;
    state.player.y = parsed.player?.y;
    state.player.hp = parsed.player?.hp;
    state.player.energy = parsed.player?.energy;
    state.player.facing = parsed.player?.facing;
    state.player.dashCooldown = parsed.player?.dashCooldown;
    if (parsed.version === VERSION) {
      state.player.swimming = parsed.player?.swimming;
      state.player.diving = parsed.player?.diving;
      state.player.air = parsed.player?.air;
      state.player.lastShore = parsed.player?.lastShore;
      state.finds = parsed.finds;
    } else {
      // Version 2 did not track swimming. Existing expeditions resume at their
      // original position with full air and the beacon camp as a safe fallback.
      state.player.swimming = false;
      state.player.diving = false;
      state.player.air = MAX_AIR;
      state.player.lastShore = { x: 0, y: 0 };
      state.finds = [];
    }
    state.inventory = parsed.inventory;
    state.tools = parsed.tools;
    state.structures = parsed.structures;
    state.harvested = parsed.harvested;
    state.discoveries = parsed.discoveries;
    state.restored = parsed.restored;
    state.time = parsed.time;
    validatePersistentState(state);
    return state;
  } catch {
    return null;
  }
}
