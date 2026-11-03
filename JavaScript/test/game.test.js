import assert from "node:assert/strict";
import test from "node:test";
import {
  RECIPES,
  createGame,
  stepGame,
  craft,
  canPlace,
  place,
  interact,
  serializeGame,
  restoreGame,
  getWorldPhase,
  isNight,
} from "../../examples/world/game.js";
import { generateChunk } from "../../examples/world/generator.js";

function makeWorld({ terrain = () => "meadow", entities = [], landmarks = [] } = {}) {
  return {
    loaded: true,
    tileAt(x, y) {
      return terrain(Math.floor(x), Math.floor(y));
    },
    entitiesNear(x, y, radius) {
      return entities.filter((entity) => Math.hypot(entity.x - x, entity.y - y) <= radius);
    },
    landmarks,
  };
}

test("movement keeps diagonal speed equal to straight-line speed", () => {
  const straight = createGame("42");
  const diagonal = createGame("42");
  const world = makeWorld();

  stepGame(straight, { x: 1, y: 0 }, 0.1, world);
  stepGame(diagonal, { x: 1, y: 1 }, 0.1, world);

  assert.ok(Math.abs(Math.hypot(diagonal.player.x, diagonal.player.y) - straight.player.x) < 0.001);
});

test("movement collides with water and unharvested blocking resources", () => {
  const state = createGame("42");
  const world = makeWorld({
    terrain: (x) => x === 1 ? "water" : "meadow",
    entities: [{ id: "tree:1:0", type: "tree", x: 1, y: 0, blocking: true }],
  });

  stepGame(state, { x: 1, y: 0 }, 0.5, world);

  assert.ok(state.player.x < 1);
});

test("a buffered dash starts when its cooldown expires and cannot cross blocked terrain", () => {
  const state = createGame("42");
  state.player.facing = { x: 1, y: 0 };
  state.player.dashCooldown = 0.3;
  const world = makeWorld({ terrain: (x) => x >= 1 ? "water" : "meadow" });

  stepGame(state, { dash: true }, 0.1, world);
  stepGame(state, {}, 0.25, world);
  stepGame(state, {}, 0.1, world);

  assert.ok(state.player.dashCooldown > 1);
  assert.ok(state.player.x < 1);
});

test("a directional dash uses the complete current input vector", () => {
  const state = createGame("42");
  state.player.facing = { x: 0, y: -1 };

  stepGame(state, { x: 1, y: 0, dash: true }, 0.16, makeWorld());

  assert.ok(state.player.x > 1.5);
  assert.ok(Math.abs(state.player.y) < 0.001);
});

test("crafting charges exact materials and produces a usable axe", () => {
  const state = createGame("42");
  state.inventory = { wood: 3, stone: 2, berries: 0, campfires: 0, bridges: 0 };

  assert.deepEqual(RECIPES.axe.cost, { wood: 3, stone: 2, berries: 0 });
  assert.equal(craft(state, "axe").ok, true);
  assert.deepEqual(state.inventory, { wood: 0, stone: 0, berries: 0, campfires: 0, bridges: 0 });
  assert.equal(state.tools.axe, true);
});

test("an uncrafted tool or unaffordable recipe leaves resources unchanged", () => {
  const state = createGame("42");
  state.inventory = { wood: 2, stone: 0, berries: 0, campfires: 0, bridges: 0 };

  const result = craft(state, "axe");

  assert.equal(result.ok, false);
  assert.deepEqual(state.inventory, { wood: 2, stone: 0, berries: 0, campfires: 0, bridges: 0 });
});

test("attacking with an axe harvests a tree after a short windup", () => {
  const state = createGame("42");
  state.tools.axe = true;
  state.player.facing = { x: 0, y: 1 };
  const tree = { id: "tree:0:1", type: "tree", x: 0, y: 0.8, blocking: true };
  const world = makeWorld({ entities: [tree] });

  stepGame(state, { attack: true }, 0.05, world);
  assert.equal(state.harvested.includes(tree.id), false);
  stepGame(state, {}, 0.2, world);

  assert.equal(state.harvested.includes(tree.id), true);
  assert.ok(state.inventory.wood >= 1);
});

test("a held attack does not start another pulse before its cooldown expires", () => {
  const state = createGame("42");
  state.tools.axe = true;
  state.player.facing = { x: 0, y: 1 };
  const world = makeWorld({ entities: [
    { id: "tree:0:1", type: "tree", x: 0, y: 0.7, blocking: true },
    { id: "tree:0:2", type: "tree", x: 0, y: 1.2, blocking: true },
  ] });

  stepGame(state, { attack: true }, 0.12, world);
  stepGame(state, { attack: true }, 0.12, world);
  assert.deepEqual(state.harvested, ["tree:0:1"]);
  stepGame(state, { attack: true }, 0.29, world);

  assert.equal(state.player.attackWindup, 0);
  assert.deepEqual(state.harvested, ["tree:0:1"]);
});

test("a new expedition can hand-harvest generated resources and craft its first axe", () => {
  const chunk = generateChunk({ seed: "2", cx: 0, cy: 0 });
  const terrain = new Map(chunk.tiles.map((tile) => [`${tile.x},${tile.y}`, tile.terrain]));
  const resources = chunk.entities.filter((entity) => entity.type === "tree" || entity.type === "rock");
  const world = {
    loaded: true,
    tileAt(x, y) { return terrain.get(`${x},${y}`); },
    entitiesNear(x, y, radius) {
      return resources.filter((entity) => Math.hypot(entity.x - x, entity.y - y) <= radius);
    },
    landmarks: [],
  };
  const state = createGame("2");
  const starterNodes = ["rock:10:4", "rock:10:5", "tree:10:12", "tree:14:10", "tree:15:11"];

  for (const id of starterNodes) {
    const node = resources.find((entity) => entity.id === id);
    assert.ok(node, `${id} exists in the generated chunk`);
    state.player.x = node.x - 1;
    state.player.y = node.y;
    state.player.facing = { x: 1, y: 0 };
    stepGame(state, { attack: true }, 0.2, world);
    stepGame(state, {}, 0.5, world);
    assert.ok(state.harvested.includes(id), `${id} can be gathered without an axe`);
  }

  assert.deepEqual({ wood: state.inventory.wood, stone: state.inventory.stone }, { wood: 3, stone: 2 });
  assert.equal(craft(state, "axe").ok, true);
  assert.equal(state.tools.axe, true);
});

test("interacting gathers a berry once and reports when out of range", () => {
  const state = createGame("42");
  const berry = { id: "berry:1:0", type: "berry", x: 1, y: 0, loot: "wild-berries" };
  const world = makeWorld({ entities: [berry] });

  state.player.x = -3;
  assert.equal(interact(state, world).ok, false);
  state.player.x = 0;
  assert.equal(interact(state, world).ok, true);
  assert.equal(state.inventory.berries, 1);
  state.player.x = -3;
  assert.equal(interact(state, world).ok, false);
  assert.equal(state.inventory.berries, 1);
});

test("interacting opens a cache once and campfires restore health and energy", () => {
  const state = createGame("42");
  const world = makeWorld({ entities: [{ id: "cache:1:0", type: "cache", x: 1, y: 0, loot: "old-coin" }] });

  assert.equal(interact(state, world).ok, true);
  assert.deepEqual({ wood: state.inventory.wood, stone: state.inventory.stone, berries: state.inventory.berries }, {
    wood: 1, stone: 1, berries: 1,
  });
  assert.deepEqual(state.discoveries, []);
  state.player.x = -3;
  assert.equal(interact(state, world).ok, false);

  state.player.x = 0;
  state.structures.push({ id: "campfire:0:1", kind: "campfire", x: 0, y: 1 });
  state.player.hp = 70;
  state.player.energy = 20;
  assert.equal(interact(state, makeWorld()).ok, true);
  assert.equal(state.player.hp, 85);
  assert.equal(state.player.energy, 60);
});

test("eating restores energy once per press", () => {
  const state = createGame("42");
  state.inventory.berries = 2;
  state.player.energy = 50;

  stepGame(state, { eat: true }, 0.1, makeWorld());
  stepGame(state, { eat: true }, 0.1, makeWorld());

  assert.equal(state.inventory.berries, 1);
  assert.ok(Math.abs(state.player.energy - 85) < 0.01);
});

test("three distinct landmarks unlock the optional beacon ending", () => {
  const state = createGame("42");
  const landmarks = [
    { id: "observatory", x: 10, y: 0, title: "Drowned Observatory", text: "A cracked lens points inland." },
    { id: "glass-grove", x: 20, y: 0, title: "Glass Grove", text: "The glass hums beneath your hand." },
    { id: "ash-archive", x: 30, y: 0, title: "Ash Archive", text: "The ash remembers rain." },
  ];
  const world = makeWorld({ landmarks });

  state.player.x = 10;
  assert.equal(interact(state, world).ok, true);
  assert.equal(state.restored, false);
  state.player.x = 20;
  assert.equal(interact(state, world).ok, true);
  state.player.x = 30;
  assert.equal(interact(state, world).ok, true);
  state.player.x = 0;
  state.player.hp = 80;
  state.player.energy = 30;
  assert.equal(interact(state, world).ok, true);

  assert.equal(state.discoveries.length, 3);
  assert.equal(state.restored, true);
  assert.equal(state.player.hp, 95);
  assert.equal(state.player.energy, 70);
});

test("the broken home beacon is a real recovery point before the sigils are found", () => {
  const state = createGame("42");
  state.player.hp = 50;
  state.player.energy = 20;

  const result = interact(state, makeWorld());

  assert.equal(result.ok, true);
  assert.equal(state.player.hp, 65);
  assert.equal(state.player.energy, 60);
  assert.equal(state.restored, false);
  assert.match(result.message, /still broken/i);
});

test("an undiscovered landmark takes interaction priority over nearby resources", () => {
  const state = createGame("42");
  const world = makeWorld({
    entities: [{ id: "berry:0:0", type: "berry", x: 0, y: 0, loot: "wild-berries" }],
    landmarks: [{ id: "observatory", x: 0, y: 0, title: "Drowned Observatory", text: "A cracked lens points inland." }],
  });

  assert.equal(interact(state, world).ok, true);

  assert.deepEqual(state.discoveries, ["observatory"]);
  assert.equal(state.inventory.berries, 1);
  assert.deepEqual(state.harvested, []);
});

test("sentinel telegraphs, damages the player, and respects invulnerability", () => {
  const state = createGame("42");
  state.player.x = 10;
  const world = makeWorld({ entities: [{ id: "sentinel:11:0", type: "sentinel", x: 10.8, y: 0, blocking: true }] });

  for (let index = 0; index < 12; index += 1) stepGame(state, {}, 0.1, world);
  const healthAfterHit = state.player.hp;
  assert.ok(healthAfterHit < 100);
  assert.ok(state.player.invulnerability > 0);
  for (let index = 0; index < 3; index += 1) stepGame(state, {}, 0.1, world);
  assert.equal(state.player.hp, healthAfterHit);
});

test("dead sentinel IDs stay harvested after the entity unloads and reloads", () => {
  const state = createGame("42");
  state.player.x = 10;
  state.player.facing = { x: 1, y: 0 };
  const sentinel = { id: "sentinel:11:0", type: "sentinel", x: 10.8, y: 0, blocking: true };
  const loaded = makeWorld({ entities: [sentinel] });

  for (let index = 0; index < 3; index += 1) stepGame(state, { attack: true }, 0.5, loaded);
  assert.ok(state.harvested.includes(sentinel.id));
  stepGame(state, {}, 0.1, makeWorld());
  stepGame(state, {}, 0.1, loaded);

  assert.equal(state.enemies.some((enemy) => enemy.id === sentinel.id), false);
});

test("defeat returns to the beacon camp, preserves discoveries, and costs recoverable supplies", () => {
  const state = createGame("42");
  state.player.x = 14;
  state.player.hp = 0;
  state.inventory = { wood: 5, stone: 3, berries: 2, campfires: 0, bridges: 0 };
  state.discoveries.push("observatory");

  stepGame(state, {}, 0.1, makeWorld());

  assert.deepEqual({ x: state.player.x, y: state.player.y }, { x: 0, y: 0 });
  assert.equal(state.player.hp, 100);
  assert.deepEqual(state.discoveries, ["observatory"]);
  assert.ok(state.inventory.wood < 5 || state.inventory.stone < 3 || state.inventory.berries < 2);
  assert.match(state.events.at(-1).text, /returned|beacon/i);
  const cache = state.structures.find((structure) => structure.kind === "recovery-cache");
  assert.ok(cache);
  const recovered = { ...cache.contents };
  state.player.x = cache.x;
  state.player.y = cache.y;
  assert.equal(interact(state, makeWorld()).ok, true);
  for (const key of ["wood", "stone", "berries"]) {
    assert.ok(state.inventory[key] >= recovered[key]);
  }
});

test("campfire crafting stores a placeable kit and rejected placement costs nothing", () => {
  const state = createGame("42");
  state.inventory = { wood: 4, stone: 2, berries: 0, campfires: 0, bridges: 0 };
  const world = makeWorld({ terrain: (x) => x === 1 ? "water" : "meadow" });

  assert.equal(craft(state, "campfire").ok, true);
  assert.equal(state.inventory.campfires, 1);
  const beforePreview = structuredClone(state);
  const rejected = canPlace(state, "campfire", 1, 0, world);
  assert.equal(rejected.ok, false);
  assert.deepEqual(state, beforePreview);
  assert.equal(state.inventory.campfires, 1);
  assert.equal(canPlace(state, "campfire", 0, 1, world).ok, true);
  assert.equal(state.inventory.campfires, 1);
  assert.equal(place(state, "campfire", 0, 1, world).ok, true);
  assert.equal(state.inventory.campfires, 0);
});

test("a placed bridge overrides water for movement", () => {
  const state = createGame("42");
  state.inventory.bridges = 1;
  state.player.facing = { x: 1, y: 0 };
  const world = makeWorld({ terrain: (x) => x === 1 ? "water" : "meadow" });

  assert.equal(place(state, "bridge", 1, 0, world).ok, true);
  stepGame(state, { x: 1, y: 0 }, 0.5, world);
  assert.ok(state.player.x > 1);
});

test("day and night advance on the 180 second cycle and energy drains slowly", () => {
  const state = createGame("42");
  state.time = 62.9;
  const startingEnergy = state.player.energy;

  stepGame(state, {}, 0.2, makeWorld());

  assert.equal(isNight(state.time), true);
  assert.ok(getWorldPhase(state.time).night > 0);
  assert.ok(state.player.energy < startingEnergy);
  assert.ok(state.events.some((event) => /night/i.test(event.text)));
  assert.equal(isNight(63), false);
  assert.equal(isNight(63.1), true);
  assert.equal(isNight(153), false);
});

test("saving resumes the same seed and rejects corrupt, old, oversized, or mismatched saves", () => {
  const state = createGame("2026");
  state.player.x = -4.25;
  state.inventory = { wood: 7, stone: 3, berries: 2, campfires: 1, bridges: 0 };
  state.tools.axe = true;
  state.structures.push({ id: "campfire:0:1", kind: "campfire", x: 0, y: 1 });
  state.harvested.push("tree:-2:5");
  state.discoveries.push("glass-grove");
  const text = serializeGame(state);

  const restored = restoreGame(text, "2026");
  assert.equal(restored.player.x, -4.25);
  assert.deepEqual(restored.inventory, state.inventory);
  assert.deepEqual(restored.tools, state.tools);
  assert.deepEqual(restored.structures, state.structures);
  assert.deepEqual(restored.harvested, state.harvested);
  assert.deepEqual(restored.discoveries, state.discoveries);
  assert.equal(restoreGame("{", "2026"), null);
  assert.equal(restoreGame(text, "other-seed"), null);
  assert.equal(restoreGame(text.repeat(50000), "2026"), null);
  assert.equal(restoreGame(JSON.stringify({ ...JSON.parse(text), version: "verdant-expedition-1" }), "2026"), null);
  assert.throws(() => serializeGame({ ...state, time: Number.NaN }), /invalid|finite|time/i);
});

test("events stay capped while active enemies stay bounded", () => {
  const state = createGame("42");
  for (let index = 0; index < 40; index += 1) interact(state, makeWorld());
  const entities = Array.from({ length: 80 }, (_, index) => ({
    id: `sentinel:${index}:0`, type: "sentinel", x: index / 10, y: 0, blocking: true,
  }));

  stepGame(state, {}, 0.1, makeWorld({ entities }));

  assert.equal(state.events.length, 32);
  assert.ok(state.enemies.length <= 24);
});
