import test from "node:test";
import assert from "node:assert/strict";
import { generateChunk } from "../../examples/world/generator.js";
import {
  decorateChunk,
  landmarksForSeed,
} from "../../examples/world/expedition.js";
import {
  createGame,
  stepGame,
  interact,
  serializeGame,
  restoreGame,
} from "../../examples/world/game.js";

test("actual expedition trails support every discovery and a return to the beacon", () => {
  const tiles = new Map(),
    entities = [],
    landmarks = landmarksForSeed("42");
  for (let y = -3; y <= 2; y++)
    for (let x = -3; x <= 2; x++) {
      const chunk = decorateChunk(generateChunk({ seed: "42", cx: x, cy: y }));
      for (const tile of chunk.tiles)
        tiles.set(`${tile.x},${tile.y}`, tile.terrain);
      entities.push(...chunk.entities.filter((e) => e.type !== "sentinel"));
    }
  const world = {
    loaded: true,
    landmarks,
    tileAt: (x, y) => tiles.get(`${Math.floor(x)},${Math.floor(y)}`),
    entitiesNear: (x, y, r) =>
      entities.filter((e) => Math.hypot(e.x - x, e.y - y) <= r),
  };
  let state = createGame("42");
  function travel(x, y) {
    for (let n = 0; n < 2000; n++) {
      const dx = x - state.player.x,
        dy = y - state.player.y;
      if (Math.hypot(dx, dy) < 0.1) return;
      stepGame(
        state,
        {
          x: Math.abs(dx) > 0.08 ? Math.sign(dx) : 0,
          y: Math.abs(dy) > 0.08 ? Math.sign(dy) : 0,
        },
        1 / 60,
        world,
      );
    }
    assert.fail(
      `Route blocked approaching ${x},${y} at ${state.player.x},${state.player.y}`,
    );
  }
  for (const site of landmarks) {
    travel(site.x, 0);
    travel(site.x, site.y);
    interact(state, world);
    assert.ok(state.discoveries.includes(site.id));
    state = restoreGame(serializeGame(state), "42");
    assert.ok(state);
    travel(site.x, 0);
    travel(0, 0);
  }
  interact(state, world);
  assert.equal(state.restored, true);
  const before = state.player.x;
  stepGame(state, { x: 1 }, 0.1, world);
  assert.ok(state.player.x > before, "free play continues after story");
});
