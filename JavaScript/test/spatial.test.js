import test from "node:test";
import * as spatial from "../../examples/world/spatial.js";
import assert from "node:assert/strict";
import {
  movementForCamera,
  surfaceHeight,
  heightFromStream,
  groundHeight,
  cameraHeading,
} from "../../examples/world/spatial.js";

test("rendered player moves evenly between fixed simulation updates without changing saved state", () => {
  assert.equal(
    typeof spatial.interpolatePlayer,
    "function",
    "fixed-step positions need a presentation interpolator",
  );
  const before = { x: -16.02, y: 2, lift: 0.2, hp: 80, facing: { x: 1, y: 0 } };
  const after = { ...before, x: -15.96, y: 2.06, lift: 0.3, hp: 70 };
  const snapshots = JSON.stringify([before, after]);
  const halfway = spatial.interpolatePlayer(before, after, 0.5);
  assert.ok(Math.abs(halfway.x + 15.99) < 1e-9);
  assert.ok(Math.abs(halfway.y - 2.03) < 1e-9);
  assert.equal(halfway.lift, 0.25);
  assert.equal(halfway.hp, 70);
  assert.equal(JSON.stringify([before, after]), snapshots);
  assert.equal(spatial.interpolatePlayer(before, after, -1).x, before.x);
  assert.equal(spatial.interpolatePlayer(before, after, 2).x, after.x);
  assert.equal(
    spatial.interpolatePlayer(before, { ...after, x: 100 }, 0.5).x,
    100,
    "respawns snap instead of flying across the map",
  );
});

test("camera-relative input preserves direction and normalized travel at every yaw", () => {
  assert.equal(cameraHeading(0), "N");
  assert.equal(cameraHeading(Math.PI / 2), "W");
  assert.equal(cameraHeading(-Math.PI / 2), "E");
  assert.deepEqual(movementForCamera(0, -1, 0), { x: 0, y: -1 });
  const west = movementForCamera(0, -1, Math.PI / 2);
  assert.ok(Math.abs(west.x + 1) < 1e-9 && Math.abs(west.y) < 1e-9);
  for (let angle = -Math.PI * 2; angle <= Math.PI * 2; angle += 0.1) {
    for (const [x, y] of [
      [1, 1],
      [-1, 1],
      [0, -1],
      [1, 0],
    ]) {
      const moved = movementForCamera(x, y, angle);
      assert.ok(Math.abs(Math.hypot(moved.x, moved.y) - 1) < 1e-9);
    }
  }
});

test("uncaptured mouse-look can keep turning at an edge and stops outside the world", () => {
  assert.equal(typeof spatial.edgeLook, "function");
  assert.deepEqual(spatial.edgeLook(200, 150, 400, 300), { x: 0, y: 0 });
  assert.deepEqual(spatial.edgeLook(0, 0, 400, 300), { x: -1, y: -1 });
  assert.deepEqual(spatial.edgeLook(400, 300, 400, 300), { x: 1, y: 1 });
  assert.deepEqual(spatial.edgeLook(401, 150, 400, 300), { x: 0, y: 0 });
  assert.deepEqual(spatial.edgeLook(10, 10, 0, 0), { x: 0, y: 0 });
  assert.ok(spatial.edgeLook(10, 150, 400, 300).x < 0);
});

test("3D terrain keeps water submerged, hills raised and old routes level", () => {
  assert.ok(surfaceHeight({ terrain: "water" }) < 0);
  assert.ok(surfaceHeight({ terrain: "shallows" }) < 0);
  assert.ok(surfaceHeight({ terrain: "sand" }) > 0);
  assert.ok(
    surfaceHeight({ terrain: "hill" }) > surfaceHeight({ terrain: "meadow" }),
  );
  assert.ok(
    surfaceHeight({ terrain: "mountain" }) > surfaceHeight({ terrain: "hill" }),
  );
  assert.equal(surfaceHeight({ terrain: "mountain", trail: true }), 0.14);
});

test("height sampling uses tile centers and floor-correct negative chunk coordinates", () => {
  const tiles = Array.from({ length: 256 }, () => ({ terrain: "water" }));
  tiles[15 * 16 + 15] = { terrain: "mountain" };
  const stream = { cache: new Map([["-1,-1", { tiles }]]) };
  assert.equal(
    heightFromStream(stream, -1, -1),
    surfaceHeight({ terrain: "mountain" }),
  );
  const slope = heightFromStream(stream, -1.49, -1.49);
  assert.ok(
    slope > surfaceHeight({ terrain: "water" }) &&
      slope < surfaceHeight({ terrain: "mountain" }),
  );
  assert.equal(heightFromStream(stream, 0, 0), 0.14);
});

test("foot heights follow the shared terrain fan continuously across positive and negative chunk edges", () => {
  for (const boundary of [-16.5, -0.5, 15.5]) {
    const sample = (x, y) => ({
      terrain: x < boundary ? "meadow" : "hill",
      elevation: 0.5,
    });
    for (const z of [-17.2, -0.5, 0, 16.3]) {
      const left = groundHeight(sample, boundary - 1e-8, z);
      const right = groundHeight(sample, boundary + 1e-8, z);
      assert.ok(Math.abs(left - right) < 1e-6);
    }
  }
});
