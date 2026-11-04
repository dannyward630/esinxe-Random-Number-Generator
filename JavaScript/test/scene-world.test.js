import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../examples/world/vendor/three/three.module.js";
import { createChunkVisual } from "../../examples/world/scene-world.js";
import { surfaceHeight } from "../../examples/world/spatial.js";

function makeChunk(cx = -2, cy = -1) {
  const tiles = [];
  for (let dy = 0; dy < 16; dy++) for (let dx = 0; dx < 16; dx++) {
    tiles.push({
      id: `tile:${cx * 16 + dx}:${cy * 16 + dy}`,
      x: cx * 16 + dx,
      y: cy * 16 + dy,
      terrain: "meadow",
      elevation: 0.5,
      moisture: 0.5,
      texture: 0.5,
    });
  }
  const at = (dx, dy) => tiles[dy * 16 + dx];
  Object.assign(at(3, 4), { terrain: "hill", elevation: 0.91, texture: 0.52 });
  Object.assign(at(2, 2), { terrain: "forest", elevation: 0.64, texture: 0.68 });
  Object.assign(at(8, 9), { terrain: "water", elevation: 0.2, texture: 0.4 });
  const entities = [
    { id: `tree:${at(2, 2).x}:${at(2, 2).y}`, type: "tree", x: at(2, 2).x, y: at(2, 2).y },
    { id: `rock:${at(4, 5).x}:${at(4, 5).y}`, type: "rock", x: at(4, 5).x, y: at(4, 5).y },
    { id: `berry:${at(6, 7).x}:${at(6, 7).y}`, type: "berry", x: at(6, 7).x, y: at(6, 7).y },
    { id: `cache:${at(8, 9).x}:${at(8, 9).y}`, type: "cache", x: at(8, 9).x, y: at(8, 9).y },
    { id: `sentinel:${at(10, 10).x}:${at(10, 10).y}`, type: "sentinel", x: at(10, 10).x, y: at(10, 10).y },
    { id: `ruin:${at(11, 11).x}:${at(11, 11).y}`, type: "ruin", x: at(11, 11).x, y: at(11, 11).y },
  ];
  return { cx, cy, key: `${cx},${cy}`, tiles, entities, grass: [] };
}

function matrixScale(THREERef, mesh, index) {
  const matrix = new THREERef.Matrix4();
  mesh.getMatrixAt(index, matrix);
  const e = matrix.elements;
  return new THREERef.Vector3(
    Math.hypot(e[0], e[1], e[2]),
    Math.hypot(e[4], e[5], e[6]),
    Math.hypot(e[8], e[9], e[10]),
  );
}

test("chunk terrain has finite faceted geometry and raycasts exact negative-coordinate heights", () => {
  const chunk = makeChunk();
  const visual = createChunkVisual(THREE, chunk);
  const { group, ground } = visual;
  group.updateMatrixWorld(true);

  assert.ok(ground instanceof THREE.Mesh);
  assert.equal(group.position.x, -32);
  assert.equal(group.position.z, -16);
  assert.ok(ground.geometry.getAttribute("color").count > 16 * 16 * 4);
  assert.ok([...ground.geometry.getAttribute("position").array].every(Number.isFinite));
  assert.ok([...ground.geometry.getAttribute("color").array].every(Number.isFinite));
  assert.ok(ground.geometry.boundingBox.min.y < -1.39);
  assert.ok(ground.geometry.boundingBox.max.y > 1.5);

  const hill = chunk.tiles.find((tile) => tile.x === -29 && tile.y === -12);
  const expectedHeight = surfaceHeight(hill);
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(hill.x, expectedHeight + 8, hill.y),
    new THREE.Vector3(0, -1, 0),
  );
  const hit = raycaster.intersectObject(ground, false)[0];
  assert.ok(hit, "terrain should be pickable by the root placement raycaster");
  assert.ok(Math.abs(hit.point.x - hill.x) < 1e-5);
  assert.ok(Math.abs(hit.point.z - hill.y) < 1e-5);
  assert.ok(Math.abs(hit.point.y - expectedHeight) < 1e-5);
  visual.dispose();
});

test("harvested tree, rock, berry bush and cache hide and can be restored", () => {
  const chunk = makeChunk();
  const visual = createChunkVisual(THREE, chunk);
  const ids = ["tree:-30:-14", "rock:-28:-11", "berry:-26:-9", "cache:-24:-7"];
  const affected = () => visual.group.children
    .filter((child) => child instanceof THREE.InstancedMesh)
    .flatMap((mesh) => mesh.userData.entityIds
      .map((id, index) => ({ id, mesh, index }))
      .filter((record) => ids.includes(record.id)));
  const records = affected();
  assert.ok(records.length >= 12, "all resource pieces should be represented by batched instances");
  assert.ok(records.every(({ mesh, index }) => matrixScale(THREE, mesh, index).length() > 0));

  const waterTile = chunk.tiles.find((tile) => tile.terrain === "water");
  const chestMeshes = visual.group.children.filter((child) => child instanceof THREE.InstancedMesh
    && child.userData.instancePart.startsWith("chest"));
  assert.equal(chestMeshes.length, 5);
  for (const mesh of chestMeshes) {
    mesh.geometry.computeBoundingBox();
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const chestBounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    assert.ok(chestBounds.min.y > surfaceHeight(waterTile), "submerged chest clears the lake floor");
    assert.ok(chestBounds.max.y < 0, "submerged chest stays below the water surface");
  }

  visual.updateHarvested(new Set(ids));
  assert.ok(records.every(({ mesh, index }) => matrixScale(THREE, mesh, index).length() === 0));

  visual.updateHarvested(new Set());
  assert.ok(records.every(({ mesh, index }) => matrixScale(THREE, mesh, index).length() > 0));

  const includedEntities = visual.group.children
    .filter((child) => child instanceof THREE.InstancedMesh)
    .flatMap((mesh) => mesh.userData.entityIds);
  assert.ok(!includedEntities.includes("sentinel:-22:-6"));
  assert.ok(!includedEntities.includes("ruin:-21:-5"));
  visual.dispose();
});

test("chunks stay batched and dispose all owned resources idempotently", () => {
  const visual = createChunkVisual(THREE, makeChunk());
  const { group, ground } = visual;
  const parent = new THREE.Group();
  parent.add(group);
  const meshes = group.children.slice();
  const ownedGeometries = new Set(meshes.map((mesh) => mesh.geometry));
  const ownedMaterials = new Set(meshes.flatMap((mesh) => Array.isArray(mesh.material)
    ? mesh.material : [mesh.material]));
  let geometryDisposals = 0;
  let materialDisposals = 0;
  for (const geometry of ownedGeometries) geometry.addEventListener("dispose", () => geometryDisposals++);
  for (const material of ownedMaterials) material.addEventListener("dispose", () => materialDisposals++);
  const sibling = createChunkVisual(THREE, makeChunk(-1, -1));
  let siblingDisposals = 0;
  sibling.ground.geometry.addEventListener("dispose", () => siblingDisposals++);

  assert.ok(meshes.length < 30, `chunk should use a small number of batched draw calls (got ${meshes.length})`);
  assert.ok(meshes.some((mesh) => mesh instanceof THREE.InstancedMesh));
  visual.dispose();
  visual.dispose();
  assert.equal(group.children.length, 0);
  assert.equal(parent.children.length, 0);
  assert.equal(geometryDisposals, ownedGeometries.size);
  assert.equal(materialDisposals, ownedMaterials.size);
  assert.equal(siblingDisposals, 0, "disposing one chunk does not release a sibling chunk's geometry");
  assert.ok(sibling.ground.geometry.getAttribute("position").count > 0);
  sibling.dispose();
  assert.ok(ground.geometry.getAttribute("position").count > 0);
});
