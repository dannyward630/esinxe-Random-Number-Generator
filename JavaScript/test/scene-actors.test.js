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
      object.position.x, object.position.y, object.position.z,
      object.rotation.x, object.rotation.y, object.rotation.z,
      object.scale.x, object.scale.y, object.scale.z,
    ]) assert.ok(Number.isFinite(value), `${object.name} has a non-finite transform`);
  });
}

function assertAtLocalOrigin(model) {
  assert.ok(model instanceof THREE.Group);
  assert.deepEqual(model.position.toArray(), [0, 0, 0]);
  assert.deepEqual(model.rotation.toArray(), [0, 0, 0, "XYZ"]);
  assertFiniteTransforms(model);
  const bounds = new THREE.Box3().setFromObject(model);
  assert.ok(bounds.min.y >= -0.025, `${model.name} extends below its ground plane: ${bounds.min.y}`);
  assert.ok(bounds.max.y > 0.15, `${model.name} is unexpectedly small`);
}

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
    assert.ok(bounds.max.y >= 2.8 && bounds.max.y <= 5.2, `${landmark.name} height ${bounds.max.y}`);
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
  assert.equal(pose.axe.visible, true);
  assert.equal(pose.lantern.visible, true);
  const runningArm = pose.leftArm.rotation.x;
  animatePlayer(player, { swimming: true, diving: true, lift: 0.3 }, 1.8, 2, false);
  assert.notEqual(pose.body.rotation.x, 0);
  assert.ok(pose.animated.position.y >= 0.3);
  animatePlayer(player, { attackWindup: 0.12, dashRemaining: 0.18 }, 2, 0, true);
  assert.notEqual(pose.rightArm.rotation.x, 0);
  assert.notEqual(runningArm, pose.leftArm.rotation.x);
  assert.deepEqual(player.position.toArray(), rootPosition.toArray());
  assert.deepEqual(player.rotation.toArray(), rootRotation.toArray());
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
  animateSentinel(sentinel, { mode: "windup", windup: 0.4, hurt: 0 }, 0.8, false);
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
