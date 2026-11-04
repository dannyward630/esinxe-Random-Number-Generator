import test from "node:test";
import assert from "node:assert/strict";
import { generateChunk } from "../../examples/world/generator.js";
import {
  decorateChunk,
  biomeSitesForSeed,
} from "../../examples/world/expedition.js";
import {
  createGame,
  stepGame,
  interact,
  serializeGame,
  restoreGame,
} from "../../examples/world/game.js";

test("a generated underwater discovery needs diving and survives a save round trip", () => {
  const tiles = new Map(),
    entities = [];
  for (let y = -3; y < 3; y++)
    for (let x = -3; x < 3; x++) {
      const chunk = decorateChunk(generateChunk({ seed: "42", cx: x, cy: y }));
      for (const tile of chunk.tiles)
        tiles.set(`${tile.x},${tile.y}`, tile.terrain);
      entities.push(...chunk.entities.filter((e) => e.type !== "sentinel"));
    }
  const chest = entities.find((e) => e.requiresDive);
  assert.ok(chest, "generated dive reward exists");
  assert.equal(tiles.get(`${chest.x},${chest.y}`), "water");
  const world = {
    loaded: true,
    landmarks: [],
    biomeSites: biomeSitesForSeed("42"),
    tileAt: (x, y) => tiles.get(`${Math.floor(x)},${Math.floor(y)}`),
    entitiesNear: (x, y, r) =>
      entities.filter((e) => Math.hypot(e.x - x, e.y - y) <= r),
  };
  const state = createGame("42");
  state.player.x = chest.x;
  state.player.y = chest.y;
  stepGame(state, {}, 1 / 60, world);
  assert.equal(state.player.swimming, true);
  const before = { ...state.inventory };
  interact(state, world);
  assert.deepEqual(
    state.inventory,
    before,
    "surface inspection does not take submerged treasure",
  );
  stepGame(state, { dive: true }, 1 / 60, world);
  assert.equal(state.player.diving, true);
  interact(state, world);
  assert.ok(state.harvested.includes(chest.id));
  assert.ok(state.finds.includes(chest.noteId));
  for (const [resource, amount] of Object.entries(chest.reward)) {
    assert.equal(state.inventory[resource], (before[resource] || 0) + amount);
  }
  assert.equal(
    state.discoveries.length,
    0,
    "field notes never count as story sigils",
  );
  const saved = restoreGame(serializeGame(state), "42");
  assert.ok(saved);
  assert.deepEqual(saved.finds, state.finds);
  assert.ok(saved.player.air > 0 && saved.player.air <= 100);
});
