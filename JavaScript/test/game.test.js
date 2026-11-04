import assert from "node:assert/strict";
import test from "node:test";

test("recorded shore remains the rescue target after its chunk is unloaded", () => {
  const state = createGame("42");
  state.player.x = 80;
  state.player.y = 5;
  state.player.lastShore = { x: 40, y: 5 };
  state.player.energy = 0;
  const world = makeWorld({
    terrain: (x, y) => (x === 40 && y === 5 ? undefined : "water"),
  });
  stepGame(state, {}, 1 / 60, world);
  assert.equal(state.player.x, 40);
  assert.equal(state.player.y, 5);
});

test("temporarily unknown terrain does not erase a saved dive", () => {
  const state = createGame("42");
  state.player.swimming = true;
  state.player.diving = true;
  state.player.air = 37;
  stepGame(state, {}, 1 / 60, makeWorld({ terrain: () => undefined }));
  assert.equal(state.player.diving, true);
  assert.equal(state.player.swimming, true);
  assert.equal(state.player.air, 37);
});

test("placement stops at the save format building limit without spending a kit", () => {
  const state = createGame("42");
  state.inventory.campfires = 1;
  state.structures = Array.from({ length: 1024 }, (_, i) => ({
    id: `campfire:${i}:9`,
    kind: "campfire",
    x: i,
    y: 9,
  }));
  const result = place(state, "campfire", 1, 0, makeWorld());
  assert.equal(result.ok, false);
  assert.equal(state.inventory.campfires, 1);
  assert.ok(restoreGame(serializeGame(state), "42"));
});
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
  getTerrainStatus,
  getWorldPhase,
  isNight,
} from "../../examples/world/game.js";
import { generateChunk } from "../../examples/world/generator.js";

function makeWorld({
  terrain = () => "meadow",
  entities = [],
  landmarks = [],
} = {}) {
  return {
    loaded: true,
    tileAt(x, y) {
      return terrain(Math.floor(x), Math.floor(y));
    },
    entitiesNear(x, y, radius) {
      return entities.filter(
        (entity) => Math.hypot(entity.x - x, entity.y - y) <= radius,
      );
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

  assert.ok(
    Math.abs(
      Math.hypot(diagonal.player.x, diagonal.player.y) - straight.player.x,
    ) < 0.001,
  );
});

test("jump reaches a readable apex, lands, and requires a fresh press to jump again", () => {
  const state = createGame("42");
  const world = makeWorld();

  stepGame(state, { jump: true }, 0, world);
  assert.equal(state.player.lift, 0);
  assert.equal(state.player.verticalVelocity, 6.6);
  assert.ok(state.effects.some((effect) => effect.type === "jump"));

  for (let index = 0; index < 22; index += 1)
    stepGame(state, { jump: true }, 1 / 60, world);
  assert.ok(Math.abs(state.player.lift - 1.21) < 1e-9);
  assert.ok(Math.abs(state.player.verticalVelocity) < 1e-9);

  for (let index = 0; index < 22; index += 1)
    stepGame(state, { jump: true }, 1 / 60, world);
  assert.equal(state.player.lift, 0);
  assert.equal(state.player.verticalVelocity, 0);
  assert.equal(state.events.filter((event) => event.type === "jump").length, 1);
  assert.equal(state.events.filter((event) => event.type === "land").length, 1);
  assert.ok(state.effects.some((effect) => effect.type === "land"));

  for (let index = 0; index < 30; index += 1)
    stepGame(state, { jump: true }, 1 / 60, world);
  assert.equal(state.player.lift, 0);
  assert.equal(state.events.filter((event) => event.type === "jump").length, 1);

  stepGame(state, {}, 0, world);
  stepGame(state, { jump: true }, 0, world);
  assert.equal(state.player.verticalVelocity, 6.6);
});

test("jump arc and horizontal travel stay stable across frame sizes", () => {
  const world = makeWorld();
  const singleStep = createGame("42");
  const manySteps = createGame("42");

  stepGame(singleStep, { jump: true, x: 1 }, 0.4, world);
  for (let index = 0; index < 40; index += 1)
    stepGame(manySteps, { jump: true, x: 1 }, 0.01, world);

  for (const key of ["x", "y", "lift", "verticalVelocity"])
    assert.ok(
      Math.abs(singleStep.player[key] - manySteps.player[key]) < 1e-5,
      `${key} differs across frame sizes`,
    );
});

test("jumps clear low rocks and return to a safe takeoff point when landing over one", () => {
  const state = createGame("42");
  const rockWorld = makeWorld({
    entities: [
      { id: "rock:1:0", type: "rock", x: 0.8, y: 0, blocking: true },
    ],
  });

  stepGame(state, { jump: true, x: 1 }, 0.25, rockWorld);
  assert.ok(state.player.lift > 0.8);
  assert.ok(state.player.x > 0.6);

  for (let index = 0; index < 30; index += 1)
    stepGame(state, { jump: true }, 1 / 60, rockWorld);

  assert.equal(state.player.lift, 0);
  assert.equal(state.player.verticalVelocity, 0);
  assert.equal(state.player.x, 0);
  assert.ok(Math.hypot(state.player.x - 0.8, state.player.y) >= 0.48);
});

test("airborne rock clearance does not overwrite the last grounded shore", () => {
  const state = createGame("42");
  state.player.x = -1;
  const rockWorld = makeWorld({
    entities: [
      { id: "rock:0:0", type: "rock", x: -0.2, y: 0, blocking: true },
    ],
  });

  stepGame(state, { jump: true, x: 1 }, 0.25, rockWorld);

  assert.ok(state.player.lift > 0.8);
  assert.ok(state.player.x > -0.5);
  assert.deepEqual(state.player.lastShore, { x: -1, y: 0 });
});

test("saving during a rock-clearing jump restores at its grounded takeoff point", () => {
  const state = createGame("42");
  const rockWorld = makeWorld({
    entities: [
      { id: "rock:1:0", type: "rock", x: 0.8, y: 0, blocking: true },
    ],
  });

  stepGame(state, { jump: true, x: 1 }, 0.25, rockWorld);
  assert.ok(state.player.x > 0.6);
  assert.ok(state.player.lift > 0.8);

  const payload = JSON.parse(serializeGame(state));
  assert.equal(payload.player.x, 0);
  assert.equal(payload.player.y, 0);
  const restored = restoreGame(JSON.stringify(payload), "42");
  assert.equal(restored.player.x, 0);
  assert.equal(restored.player.y, 0);
  assert.equal(restored.player.lift, 0);
  assert.equal(restored.player.verticalVelocity, 0);

  stepGame(restored, { x: 1 }, 0.5, rockWorld);
  assert.ok(restored.player.x < 0.4);
});

test("trees, sentinels, and mountains without boots still block a jump", () => {
  for (const type of ["tree", "sentinel"]) {
    const state = createGame("42");
    const world = makeWorld({
      entities: [
        { id: `${type}:1:0`, type, x: 0.8, y: 0, blocking: true },
      ],
    });
    stepGame(state, { jump: true, x: 1 }, 0.5, world);
    assert.ok(state.player.x < 0.4, `${type} should remain blocking`);
    assert.ok(state.player.lift > 0);
  }

  const climber = createGame("42");
  const mountain = makeWorld({
    terrain: (x) => (x >= 1 ? "mountain" : "meadow"),
  });
  stepGame(climber, { jump: true, x: 1 }, 0.5, mountain);
  assert.ok(climber.player.x < 1);
  assert.ok(climber.player.lift > 0);
});

test("entering water cancels a jump and rescue leaves the player grounded", () => {
  const state = createGame("42");
  const shoreline = makeWorld({
    terrain: (x) => (x >= 1 ? "water" : "meadow"),
  });

  stepGame(state, { jump: true, x: 1 }, 0.5, shoreline);
  assert.equal(state.player.swimming, true);
  assert.equal(state.player.lift, 0);
  assert.equal(state.player.verticalVelocity, 0);
  assert.equal(state.events.filter((event) => event.type === "land").length, 0);

  state.player.energy = 0;
  stepGame(state, { jump: true }, 0.1, shoreline);
  assert.equal(state.player.swimming, false);
  assert.equal(state.player.lift, 0);
  assert.equal(state.player.verticalVelocity, 0);
  assert.equal(state.player.x, 0);
  assert.equal(state.player.jumpHeld, true);
});

test("respawn and save restoration clear transient vertical motion without changing v3 progress", () => {
  const state = createGame("42");
  state.player.x = 12;
  state.player.lift = 0.9;
  state.player.verticalVelocity = -2;
  state.player.jumpHeld = true;
  state.player.jumpTakeoffX = 12;
  state.inventory.wood = 7;
  state.discoveries.push("glass-grove");

  const text = serializeGame(state);
  const payload = JSON.parse(text);
  assert.equal(payload.version, "verdant-expedition-3");
  assert.equal("lift" in payload.player, false);
  assert.equal("verticalVelocity" in payload.player, false);
  assert.equal("jumpHeld" in payload.player, false);
  const restored = restoreGame(text, "42");
  assert.equal(restored.player.x, 12);
  assert.equal(restored.player.lift, 0);
  assert.equal(restored.player.verticalVelocity, 0);
  assert.equal(restored.player.jumpHeld, false);
  assert.equal(restored.inventory.wood, 7);
  assert.deepEqual(restored.discoveries, ["glass-grove"]);

  state.player.hp = 0;
  stepGame(state, {}, 0, makeWorld());
  assert.equal(state.player.x, 0);
  assert.equal(state.player.lift, 0);
  assert.equal(state.player.verticalVelocity, 0);
});

test("water is swimmable, resources still block movement, and boots enable mountain scrambling", () => {
  const state = createGame("42");
  const world = makeWorld({
    terrain: (x) => (x >= 1 ? "water" : "meadow"),
  });

  stepGame(state, { x: 1, y: 0 }, 0.5, world);
  assert.ok(state.player.x > 1);
  assert.equal(state.player.swimming, true);

  const blocked = createGame("42");
  const treeWorld = makeWorld({
    entities: [{ id: "tree:1:0", type: "tree", x: 1, y: 0, blocking: true }],
  });
  stepGame(blocked, { x: 1, y: 0 }, 0.5, treeWorld);
  assert.ok(blocked.player.x < 1);

  const climber = createGame("42");
  const mountain = makeWorld({
    terrain: (x) => (x >= 1 ? "mountain" : "meadow"),
  });
  stepGame(climber, { x: 1, y: 0 }, 0.5, mountain);
  assert.ok(climber.player.x < 1);
  climber.tools.boots = true;
  stepGame(climber, { x: 1, y: 0 }, 0.5, mountain);
  assert.ok(climber.player.x > 1);
});

test("terrain status reports movement modifiers, concealment, swimming, and bridge crossings", () => {
  const state = createGame("42");
  const world = makeWorld({ terrain: () => "water" });
  assert.deepEqual(getTerrainStatus(state, world), {
    terrain: "water",
    label: "Open water",
    description: "Swimming takes effort; fins make the crossing easier.",
    speed: 0.52,
    swimming: true,
    diving: false,
    air: 100,
    concealed: false,
  });

  state.tools.fins = true;
  assert.equal(getTerrainStatus(state, world).speed, 0.8);
  state.player.x = 0;
  state.player.y = 0;
  state.structures.push({ id: "bridge:0:0", kind: "bridge", x: 0, y: 0 });
  assert.equal(getTerrainStatus(state, world).terrain, "bridge");
  assert.equal(getTerrainStatus(state, world).swimming, false);

  state.structures.length = 0;
  const forest = makeWorld({ terrain: () => "forest" });
  assert.equal(getTerrainStatus(state, forest).speed, 0.9);
  assert.equal(getTerrainStatus(state, forest).concealed, true);
  assert.equal(
    getTerrainStatus(state, makeWorld({ terrain: () => "path" })).label,
    "Old trail",
  );
  assert.equal(
    getTerrainStatus(state, makeWorld({ terrain: () => "path" })).speed,
    1.05,
  );
  const hill = makeWorld({ terrain: () => "hill" });
  assert.equal(getTerrainStatus(state, hill).speed, 0.8);
  state.tools.boots = true;
  assert.equal(getTerrainStatus(state, hill).speed, 0.95);
  const marsh = makeWorld({ terrain: () => "marsh" });
  assert.equal(getTerrainStatus(state, marsh).speed, 0.85);
  const mountain = makeWorld({ terrain: () => "mountain" });
  assert.equal(getTerrainStatus(state, mountain).speed, 0.55);
});

test("water drains energy only while moving, and fins improve swimming pace and stamina", () => {
  const world = makeWorld({ terrain: () => "water" });
  const idle = createGame("42");
  stepGame(idle, {}, 1, world);
  assert.ok(idle.player.energy > 99.9);

  const swimmer = createGame("42");
  stepGame(swimmer, { x: 1, y: 0 }, 1, world);
  assert.ok(swimmer.player.energy < 98.1);
  assert.equal(swimmer.player.swimming, true);

  const finned = createGame("42");
  finned.tools.fins = true;
  stepGame(finned, { x: 1, y: 0 }, 1, world);
  assert.ok(finned.player.energy > swimmer.player.energy + 1);
  assert.ok(finned.player.x > swimmer.player.x);
  assert.deepEqual(RECIPES.fins.cost, { wood: 2, stone: 2, berries: 3 });
});

test("dive toggles only on a press, consumes air underwater, and restores it at the surface", () => {
  const state = createGame("42");
  const world = makeWorld({ terrain: () => "water" });

  stepGame(state, { dive: true }, 0.25, world);
  assert.equal(state.player.diving, true);
  assert.ok(state.player.air < 99);
  const submergedAir = state.player.air;
  stepGame(state, { dive: true }, 0.25, world);
  assert.equal(state.player.diving, true);
  assert.ok(state.player.air < submergedAir);

  stepGame(state, {}, 0.01, world);
  stepGame(state, { dive: true }, 0.25, world);
  assert.equal(state.player.diving, false);
  assert.ok(state.player.air > submergedAir);

  stepGame(
    state,
    { x: 1, y: 0 },
    1,
    makeWorld({ terrain: (x) => (x < 1 ? "water" : "meadow") }),
  );
  assert.equal(state.player.diving, false);
});

test("entering water, marsh, and forest explains their effects once per tile transition", () => {
  const state = createGame("42");
  const world = makeWorld({ terrain: (x) => (x >= 1 ? "water" : "meadow") });
  state.player.x = 0.49;
  stepGame(state, { x: 1, y: 0 }, 0.1, world);
  const waterEvents = state.events.filter((event) => event.type === "terrain");
  assert.equal(waterEvents.length, 1);
  assert.match(waterEvents[0].text, /press R to dive/i);
  stepGame(state, { x: 1, y: 0 }, 0.1, world);
  assert.equal(
    state.events.filter((event) => event.type === "terrain").length,
    1,
  );

  state.player.x = 0.49;
  stepGame(
    state,
    { x: 1, y: 0 },
    0.1,
    makeWorld({ terrain: (x) => (x >= 1 ? "marsh" : "meadow") }),
  );
  assert.ok(
    state.events.some(
      (event) => event.type === "terrain" && /marsh slows/i.test(event.text),
    ),
  );
  state.player.x = 0.49;
  stepGame(
    state,
    { x: 1, y: 0 },
    0.1,
    makeWorld({ terrain: (x) => (x >= 1 ? "forest" : "meadow") }),
  );
  assert.ok(
    state.events.some(
      (event) =>
        event.type === "terrain" && /harder for sentinels/i.test(event.text),
    ),
  );
});

test("swim strokes use the slower dash speed and a land dash slows when it enters water", () => {
  const water = makeWorld({ terrain: () => "water" });
  const swimmer = createGame("42");
  swimmer.player.facing = { x: 1, y: 0 };
  stepGame(swimmer, { x: 1, y: 0, dash: true }, 0.16, water);
  assert.ok(swimmer.player.x > 0.8 && swimmer.player.x < 1.1);

  const shoreline = createGame("42");
  shoreline.player.facing = { x: 1, y: 0 };
  stepGame(
    shoreline,
    { x: 1, y: 0, dash: true },
    0.16,
    makeWorld({ terrain: (x) => (x >= 1 ? "water" : "meadow") }),
  );
  assert.ok(shoreline.player.x < 1.5);
});

test("underwater caches require a dive and award their exact reward and separate field note", () => {
  const state = createGame("42");
  const cache = {
    id: "cache:lake:1",
    type: "cache",
    x: 1,
    y: 0,
    requiresDive: true,
    noteId: "note:lake",
    note: "A brass marker points beneath the reef.",
    reward: { wood: 2, stone: 4, berries: 1 },
  };
  const world = makeWorld({ entities: [cache] });

  state.player.swimming = true;
  assert.equal(interact(state, world).ok, false);
  assert.deepEqual(state.inventory, {
    wood: 0,
    stone: 0,
    berries: 0,
    campfires: 0,
    bridges: 0,
  });
  assert.deepEqual(state.finds, []);

  state.player.diving = true;
  assert.equal(interact(state, world).ok, true);
  assert.deepEqual(state.inventory, {
    wood: 2,
    stone: 4,
    berries: 1,
    campfires: 0,
    bridges: 0,
  });
  assert.deepEqual(state.finds, ["note:lake"]);
  assert.match(state.events.at(-1).text, /brass marker/i);
  state.player.x = -3;
  assert.equal(interact(state, world).ok, false);
  assert.deepEqual(state.finds, ["note:lake"]);

  const fullNotes = createGame("43");
  fullNotes.player.swimming = true;
  fullNotes.player.diving = true;
  fullNotes.finds = Array.from({ length: 32 }, (_, index) => `note:${index}`);
  const secondCache = { ...cache, id: "cache:lake:2", noteId: "note:extra" };
  assert.equal(
    interact(fullNotes, makeWorld({ entities: [secondCache] })).ok,
    true,
  );
  assert.equal(fullNotes.finds.length, 32);
  assert.equal(fullNotes.finds.includes("note:extra"), false);
});

test("air or swimming-energy exhaustion rescues to the last dry shore with one damage penalty", () => {
  const shoreline = makeWorld({
    terrain: (x) => (x >= 1 ? "water" : "meadow"),
  });
  const airState = createGame("42");
  airState.player.x = 1;
  airState.player.swimming = true;
  airState.player.diving = true;
  airState.player.air = 0.1;
  airState.player.hp = 60;
  airState.player.lastShore = { x: 0, y: 0 };
  stepGame(airState, {}, 0.1, shoreline);
  assert.deepEqual(
    { x: airState.player.x, y: airState.player.y },
    { x: 0, y: 0 },
  );
  assert.equal(airState.player.hp, 45);
  assert.ok(airState.player.invulnerability > 0);
  for (let index = 0; index < 5; index += 1)
    stepGame(airState, {}, 0.1, shoreline);
  assert.equal(airState.player.hp, 45);

  const tired = createGame("42");
  tired.player.x = 1;
  tired.player.swimming = true;
  tired.player.energy = 0.1;
  tired.player.lastShore = { x: 0, y: 0 };
  stepGame(tired, { x: 1, y: 0 }, 0.1, shoreline);
  assert.deepEqual({ x: tired.player.x, y: tired.player.y }, { x: 0, y: 0 });
  assert.equal(tired.player.hp, 85);
});

test("forest concealment reduces sentinel notice and enemies cannot cross or appear in water", () => {
  const forest = createGame("42");
  forest.player.x = 0;
  const distant = {
    id: "sentinel:-4:0",
    type: "sentinel",
    x: -4,
    y: 0,
    blocking: true,
  };
  stepGame(
    forest,
    {},
    0.1,
    makeWorld({ terrain: () => "forest", entities: [distant] }),
  );
  assert.equal(forest.enemies[0]?.mode, "patrol");

  const swimmer = createGame("42");
  swimmer.player.x = 0;
  const waterWorld = makeWorld({
    terrain: (x) => (x >= 0 ? "water" : "meadow"),
    entities: [
      { id: "sentinel:0:0", type: "sentinel", x: 0, y: 0, blocking: true },
    ],
  });
  stepGame(swimmer, {}, 0.1, waterWorld);
  assert.deepEqual(swimmer.enemies, []);

  const shoreEnemy = {
    id: "sentinel:-2:0",
    type: "sentinel",
    x: -2,
    y: 0,
    blocking: true,
  };
  waterWorld.entitiesNear = (x, y, radius) =>
    [shoreEnemy].filter(
      (entity) => Math.hypot(entity.x - x, entity.y - y) <= radius,
    );
  for (let index = 0; index < 20; index += 1)
    stepGame(swimmer, {}, 0.1, waterWorld);
  assert.ok(swimmer.enemies.every((enemy) => enemy.x < 0));
  assert.equal(swimmer.player.hp, 100);
});

test("save format v3 persists water state and migrates a v2 save without losing progress", () => {
  const state = createGame("2026");
  state.player.x = 12;
  state.player.y = -3;
  state.player.swimming = true;
  state.player.diving = true;
  state.player.air = 47.5;
  state.player.lastShore = { x: 9, y: -3 };
  state.finds.push("note:reef");
  state.inventory.wood = 7;
  state.tools.fins = true;
  state.discoveries.push("old-story-progress");
  const text = serializeGame(state);
  const restored = restoreGame(text, "2026");

  assert.equal(JSON.parse(text).version, "verdant-expedition-3");
  assert.equal(restored.player.swimming, true);
  assert.equal(restored.player.diving, true);
  assert.equal(restored.player.air, 47.5);
  assert.deepEqual(restored.player.lastShore, { x: 9, y: -3 });
  assert.deepEqual(restored.finds, ["note:reef"]);
  assert.equal(restored.inventory.wood, 7);
  assert.equal(restored.tools.fins, true);
  assert.deepEqual(restored.discoveries, ["old-story-progress"]);

  const legacy = JSON.parse(text);
  legacy.version = "verdant-expedition-2";
  delete legacy.player.swimming;
  delete legacy.player.diving;
  delete legacy.player.air;
  delete legacy.player.lastShore;
  delete legacy.finds;
  const migrated = restoreGame(JSON.stringify(legacy), "2026");
  assert.ok(migrated);
  assert.equal(migrated.version, "verdant-expedition-3");
  assert.equal(migrated.player.x, 12);
  assert.equal(migrated.player.air, 100);
  assert.equal(migrated.player.diving, false);
  assert.deepEqual(migrated.player.lastShore, { x: 0, y: 0 });
  assert.deepEqual(migrated.finds, []);
  assert.equal(migrated.tools.fins, true);

  const corrupted = JSON.parse(text);
  corrupted.player.air = 101;
  assert.equal(restoreGame(JSON.stringify(corrupted), "2026"), null);
  corrupted.player.air = 47.5;
  corrupted.player.lastShore.x = 1_000_001;
  assert.equal(restoreGame(JSON.stringify(corrupted), "2026"), null);
  corrupted.player.lastShore.x = 9;
  corrupted.player.diving = "yes";
  assert.equal(restoreGame(JSON.stringify(corrupted), "2026"), null);
  corrupted.player.diving = true;
  corrupted.finds = ["note:duplicate", "note:duplicate"];
  assert.equal(restoreGame(JSON.stringify(corrupted), "2026"), null);
});

test("a buffered dash starts when its cooldown expires and cannot cross a mountain", () => {
  const state = createGame("42");
  state.player.facing = { x: 1, y: 0 };
  state.player.dashCooldown = 0.3;
  const world = makeWorld({ terrain: (x) => (x >= 1 ? "mountain" : "meadow") });

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
  assert.deepEqual(state.inventory, {
    wood: 0,
    stone: 0,
    berries: 0,
    campfires: 0,
    bridges: 0,
  });
  assert.equal(state.tools.axe, true);
});

test("an uncrafted tool or unaffordable recipe leaves resources unchanged", () => {
  const state = createGame("42");
  state.inventory = { wood: 2, stone: 0, berries: 0, campfires: 0, bridges: 0 };

  const result = craft(state, "axe");

  assert.equal(result.ok, false);
  assert.deepEqual(state.inventory, {
    wood: 2,
    stone: 0,
    berries: 0,
    campfires: 0,
    bridges: 0,
  });
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
  const world = makeWorld({
    entities: [
      { id: "tree:0:1", type: "tree", x: 0, y: 0.7, blocking: true },
      { id: "tree:0:2", type: "tree", x: 0, y: 1.2, blocking: true },
    ],
  });

  stepGame(state, { attack: true }, 0.12, world);
  stepGame(state, { attack: true }, 0.12, world);
  assert.deepEqual(state.harvested, ["tree:0:1"]);
  stepGame(state, { attack: true }, 0.29, world);

  assert.equal(state.player.attackWindup, 0);
  assert.deepEqual(state.harvested, ["tree:0:1"]);
});

test("a new expedition can hand-harvest generated resources and craft its first axe", () => {
  const chunk = generateChunk({ seed: "2", cx: 0, cy: 0 });
  const terrain = new Map(
    chunk.tiles.map((tile) => [`${tile.x},${tile.y}`, tile.terrain]),
  );
  const resources = chunk.entities.filter(
    (entity) => entity.type === "tree" || entity.type === "rock",
  );
  const world = {
    loaded: true,
    tileAt(x, y) {
      return terrain.get(`${x},${y}`);
    },
    entitiesNear(x, y, radius) {
      return resources.filter(
        (entity) => Math.hypot(entity.x - x, entity.y - y) <= radius,
      );
    },
    landmarks: [],
  };
  const state = createGame("2");
  const starterNodes = [
    "rock:10:4",
    "rock:10:5",
    "tree:10:12",
    "tree:14:10",
    "tree:15:11",
  ];

  for (const id of starterNodes) {
    const node = resources.find((entity) => entity.id === id);
    assert.ok(node, `${id} exists in the generated chunk`);
    state.player.x = node.x - 1;
    state.player.y = node.y;
    state.player.facing = { x: 1, y: 0 };
    stepGame(state, { attack: true }, 0.2, world);
    stepGame(state, {}, 0.5, world);
    assert.ok(
      state.harvested.includes(id),
      `${id} can be gathered without an axe`,
    );
  }

  assert.deepEqual(
    { wood: state.inventory.wood, stone: state.inventory.stone },
    { wood: 3, stone: 2 },
  );
  assert.equal(craft(state, "axe").ok, true);
  assert.equal(state.tools.axe, true);
});

test("interacting gathers a berry once and reports when out of range", () => {
  const state = createGame("42");
  const berry = {
    id: "berry:1:0",
    type: "berry",
    x: 1,
    y: 0,
    loot: "wild-berries",
  };
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
  const world = makeWorld({
    entities: [
      { id: "cache:1:0", type: "cache", x: 1, y: 0, loot: "old-coin" },
    ],
  });

  assert.equal(interact(state, world).ok, true);
  assert.deepEqual(
    {
      wood: state.inventory.wood,
      stone: state.inventory.stone,
      berries: state.inventory.berries,
    },
    {
      wood: 1,
      stone: 1,
      berries: 1,
    },
  );
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
    {
      id: "observatory",
      x: 10,
      y: 0,
      title: "Drowned Observatory",
      text: "A cracked lens points inland.",
    },
    {
      id: "glass-grove",
      x: 20,
      y: 0,
      title: "Glass Grove",
      text: "The glass hums beneath your hand.",
    },
    {
      id: "ash-archive",
      x: 30,
      y: 0,
      title: "Ash Archive",
      text: "The ash remembers rain.",
    },
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
    entities: [
      { id: "berry:0:0", type: "berry", x: 0, y: 0, loot: "wild-berries" },
    ],
    landmarks: [
      {
        id: "observatory",
        x: 0,
        y: 0,
        title: "Drowned Observatory",
        text: "A cracked lens points inland.",
      },
    ],
  });

  assert.equal(interact(state, world).ok, true);

  assert.deepEqual(state.discoveries, ["observatory"]);
  assert.equal(state.inventory.berries, 1);
  assert.deepEqual(state.harvested, []);
});

test("sentinel telegraphs, damages the player, and respects invulnerability", () => {
  const state = createGame("42");
  state.player.x = 10;
  const world = makeWorld({
    entities: [
      { id: "sentinel:11:0", type: "sentinel", x: 10.8, y: 0, blocking: true },
    ],
  });

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
  const sentinel = {
    id: "sentinel:11:0",
    type: "sentinel",
    x: 10.8,
    y: 0,
    blocking: true,
  };
  const loaded = makeWorld({ entities: [sentinel] });

  for (let index = 0; index < 3; index += 1)
    stepGame(state, { attack: true }, 0.5, loaded);
  assert.ok(state.harvested.includes(sentinel.id));
  stepGame(state, {}, 0.1, makeWorld());
  stepGame(state, {}, 0.1, loaded);

  assert.equal(
    state.enemies.some((enemy) => enemy.id === sentinel.id),
    false,
  );
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
  assert.ok(
    state.inventory.wood < 5 ||
      state.inventory.stone < 3 ||
      state.inventory.berries < 2,
  );
  assert.match(state.events.at(-1).text, /returned|beacon/i);
  const cache = state.structures.find(
    (structure) => structure.kind === "recovery-cache",
  );
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
  const world = makeWorld({ terrain: (x) => (x === 1 ? "water" : "meadow") });

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
  const world = makeWorld({ terrain: (x) => (x === 1 ? "water" : "meadow") });

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
  assert.equal(
    restoreGame(
      JSON.stringify({ ...JSON.parse(text), version: "verdant-expedition-1" }),
      "2026",
    ),
    null,
  );
  assert.throws(
    () => serializeGame({ ...state, time: Number.NaN }),
    /invalid|finite|time/i,
  );
});

test("events stay capped while active enemies stay bounded", () => {
  const state = createGame("42");
  for (let index = 0; index < 40; index += 1) interact(state, makeWorld());
  const entities = Array.from({ length: 80 }, (_, index) => ({
    id: `sentinel:${index}:0`,
    type: "sentinel",
    x: index / 10,
    y: 0,
    blocking: true,
  }));

  stepGame(state, {}, 0.1, makeWorld({ entities }));

  assert.equal(state.events.length, 32);
  assert.ok(state.enemies.length <= 24);
});
