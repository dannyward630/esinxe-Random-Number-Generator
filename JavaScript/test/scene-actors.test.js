import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../examples/world/vendor/three/three.module.js";
import {
  animatePlayer,
  animateSentinel,
  createBeacon,
  createLandmark,
  createPlayer,
  createSentinel,
  createStructure,
} from "../../examples/world/scene-actors.js";

function assertFiniteTransforms(root) {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    for (const value of [
      object.position.x,
      object.position.y,
      object.position.z,
      object.rotation.x,
      object.rotation.y,
      object.rotation.z,
      object.scale.x,
      object.scale.y,
      object.scale.z,
    ])
      assert.ok(
        Number.isFinite(value),
        `${object.name} has a non-finite transform`,
      );
  });
}

test("walk cycles stay continuous when frame-sampled speed changes after long play sessions", () => {
  const model = createPlayer(THREE);
  const pose = model.userData.animation;
  let lastAngle;
  let largestStep = 0;
  for (let frame = 0; frame < 180; frame++) {
    // At 144 Hz the 60 Hz simulation alternates between no movement and a step.
    const speed = frame % 2 ? 4 : 0;
    animatePlayer(model, {}, 3600 + frame / 144, speed, false);
    if (lastAngle !== undefined)
      largestStep = Math.max(
        largestStep,
        Math.abs(pose.leftLeg.rotation.x - lastAngle),
      );
    lastAngle = pose.leftLeg.rotation.x;
  }
  assert.ok(
    largestStep < 0.16,
    `limb snaps by ${largestStep.toFixed(3)} radians between frames`,
  );
});

test("locomotion pose does not depend on the wall-clock epoch", () => {
  const fresh = createPlayer(THREE);
  const old = createPlayer(THREE);
  for (let frame = 0; frame < 120; frame++) {
    const speed = frame < 80 ? 3.2 : 0;
    animatePlayer(fresh, {}, 10 + frame / 60, speed, false);
    animatePlayer(old, {}, 3610 + frame / 60, speed, false);
    assert.ok(
      Math.abs(
        fresh.userData.animation.leftLeg.rotation.x -
          old.userData.animation.leftLeg.rotation.x,
      ) < 1e-8,
    );
  }
});

function assertAtLocalOrigin(model) {
  assert.ok(model instanceof THREE.Group);
  assert.deepEqual(model.position.toArray(), [0, 0, 0]);
  assert.deepEqual(model.rotation.toArray(), [0, 0, 0, "XYZ"]);
  assertFiniteTransforms(model);
  const bounds = new THREE.Box3().setFromObject(model);
  assert.ok(
    bounds.min.y >= -0.025,
    `${model.name} extends below its ground plane: ${bounds.min.y}`,
  );
  assert.ok(bounds.max.y > 0.15, `${model.name} is unexpectedly small`);
}

test("steady locomotion has the same cadence at 30, 60 and 144 Hz", () => {
  const angles = [30, 60, 144].map((hz) => {
    const model = createPlayer(THREE);
    animatePlayer(model, {}, 5000, 0, false);
    for (let frame = 1; frame <= hz * 3; frame++)
      animatePlayer(model, {}, 5000 + frame / hz, 3.2, false);
    return model.userData.animation.leftLeg.rotation.x;
  });
  assert.ok(
    Math.max(...angles) - Math.min(...angles) < 1e-8,
    `refresh-rate dependent stride: ${angles}`,
  );
});

test("jump, landing and swimming blend from the current pose instead of snapping", () => {
  const model = createPlayer(THREE);
  const pose = model.userData.animation;
  let frame = 0;
  for (; frame <= 120; frame++)
    animatePlayer(model, {}, 1000 + frame / 120, 3.2);
  let last = [pose.leftLeg.rotation.x, pose.body.rotation.x];
  let largest = 0;
  for (const state of [
    { lift: 0.8 },
    {},
    { swimming: true },
    { swimming: true, diving: true },
    {},
  ]) {
    for (let i = 0; i < 24; i++, frame++) {
      animatePlayer(model, state, 1000 + frame / 120, 3.2);
      const next = [pose.leftLeg.rotation.x, pose.body.rotation.x];
      largest = Math.max(
        largest,
        ...next.map((angle, j) => Math.abs(angle - last[j])),
      );
      last = next;
    }
  }
  assert.ok(
    largest < 0.2,
    `mode change snaps by ${largest.toFixed(3)} radians`,
  );
});

test("procedural actors and landmarks are grounded, finite Three.js groups", () => {
  const models = [
    createPlayer(THREE),
    createSentinel(THREE),
    createLandmark(THREE, { id: "obs", kind: "drowned-observatory" }),
    createLandmark(THREE, { id: "grove", kind: "glass-grove" }),
    createLandmark(THREE, { id: "archive", kind: "ash-archive" }),
    createBeacon(THREE),
    createStructure(THREE, { id: "fire", kind: "campfire" }),
    createStructure(THREE, { id: "bridge", kind: "bridge" }),
    createStructure(THREE, { id: "cache", kind: "recovery-cache" }),
  ];
  for (const model of models) assertAtLocalOrigin(model);

  const playerBounds = new THREE.Box3().setFromObject(models[0]);
  assert.ok(playerBounds.max.y > 1.2 && playerBounds.max.y < 1.6);
  for (const landmark of models.slice(2, 5)) {
    const bounds = new THREE.Box3().setFromObject(landmark);
    assert.ok(
      bounds.max.y >= 2.8 && bounds.max.y <= 5.2,
      `${landmark.name} height ${bounds.max.y}`,
    );
  }
  assert.equal(models[5].userData.crystals.length, 3);
  assert.equal(models[5].userData.beam.visible, false);
  assert.ok(models[6].getObjectByName("flame"));
});

test("player animation changes child poses and leaves root placement to the renderer", () => {
  const player = createPlayer(THREE);
  const rootPosition = player.position.clone();
  const rootRotation = player.rotation.clone();
  const pose = player.userData.animation;

  animatePlayer(player, { hasAxe: true, hasLantern: true }, 1.2, 3, false);
  animatePlayer(player, { hasAxe: true, hasLantern: true }, 1.4, 3, false);
  assert.equal(pose.axe.visible, true);
  assert.equal(pose.lantern.visible, true);
  const runningArm = pose.leftArm.rotation.x;
  animatePlayer(
    player,
    { swimming: true, diving: true, lift: 0.3 },
    1.8,
    2,
    false,
  );
  animatePlayer(
    player,
    { swimming: true, diving: true, lift: 0.3 },
    1.9,
    2,
    false,
  );
  animatePlayer(
    player,
    { swimming: true, diving: true, lift: 0.3 },
    2,
    2,
    false,
  );
  assert.ok(
    Math.abs(pose.body.rotation.x) > 0.5,
    "swim pose leans into the water after its transition",
  );
  assert.equal(pose.animated.position.y, 0);
  animatePlayer(
    player,
    { attackWindup: 0.12, dashRemaining: 0.18 },
    2,
    0,
    true,
  );
  assert.notEqual(pose.rightArm.rotation.x, 0);
  assert.notEqual(runningArm, pose.leftArm.rotation.x);
  assert.deepEqual(player.position.toArray(), rootPosition.toArray());
  assert.deepEqual(player.rotation.toArray(), rootRotation.toArray());

  // Simulate the renderer owning the jump translation on the model root.
  player.position.set(0, 0.45, 0);
  animatePlayer(player, {}, 0, 0, true);
  const groundedMaxY = new THREE.Box3().setFromObject(player).max.y;
  animatePlayer(player, { lift: 0.3 }, 0, 0, true);
  assert.equal(pose.animated.position.y, 0);
  assert.ok(
    pose.leftLeg.rotation.x < 0,
    "lift still selects the airborne tuck pose",
  );
  assert.equal(
    player.position.y,
    0.45,
    "animation leaves root altitude to the renderer",
  );
  player.position.y += 0.3;
  const liftedMaxY = new THREE.Box3().setFromObject(player).max.y;
  assert.ok(Math.abs(liftedMaxY - groundedMaxY - 0.3) < 1e-9);
  assertFiniteTransforms(player);
});

test("sentinel telegraphs windup and reacts to hits on its child rig", () => {
  const sentinel = createSentinel(THREE);
  const rootPosition = sentinel.position.clone();
  const rootRotation = sentinel.rotation.clone();
  const pose = sentinel.userData.animation;

  animateSentinel(sentinel, { mode: "patrol", hurt: 0 }, 0.5, false);
  assert.equal(pose.warning.visible, false);
  const calmEye = pose.eyeMaterial.color.getHex();
  animateSentinel(
    sentinel,
    { mode: "windup", windup: 0.4, hurt: 0 },
    0.8,
    false,
  );
  assert.equal(pose.warning.visible, true);
  assert.notEqual(pose.eyeMaterial.color.getHex(), calmEye);
  const alertEye = pose.eyeMaterial.color.getHex();
  animateSentinel(sentinel, { mode: "recover", hurt: 0.2 }, 1.1, true);
  assert.equal(pose.warning.visible, false);
  assert.notEqual(pose.eyeMaterial.color.getHex(), alertEye);
  assert.deepEqual(sentinel.position.toArray(), rootPosition.toArray());
  assert.deepEqual(sentinel.rotation.toArray(), rootRotation.toArray());
  assertFiniteTransforms(sentinel);
});
