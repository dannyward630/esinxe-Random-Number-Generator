import test from "node:test";
import assert from "node:assert/strict";
import {
  movementForCamera,
  surfaceHeight,
  heightFromStream,
  groundHeight,
  cameraHeading,
} from "../../examples/world/spatial.js";

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
