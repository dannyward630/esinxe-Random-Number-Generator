import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import test from "node:test";
import {
  CHUNK_SIZE,
  ENTITY_TYPES,
  canonicalizeCore,
  canonicalizeWorld,
  generateChunk,
  generateWorld,
  getChunkKey,
  orderChunkCoordinates,
} from "../../examples/world/generator.js";

const workerUrl = new URL("../../examples/world/worker.js", import.meta.url);
const coordinates = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 0 },
];

test("committed browser proof matches current generator content", () => {
  const proof = JSON.parse(readFileSync(new URL("../../research/results/verdant-browser-evidence.json", import.meta.url)));
  const chunks = generateWorld({seed: proof.seed, chunks: proof.coordinates});
  const digest = createHash("sha256").update(canonicalizeWorld(chunks)).digest("hex");
  assert.equal(proof.passed, true);
  assert.equal(proof.results.length, 18);
  assert.ok(proof.results.every((row) => row.sha256 === digest));
});

test("starting land extends beyond the clearing into explorable chunks", () => {
  const chunk = generateChunk({seed: "20261102", cx: 0, cy: 0});
  const edge = chunk.tiles.find((tile)=>tile.x===15 && tile.y===0);
  assert.ok(!["water", "mountain"].includes(edge.terrain));
});

async function generateUsingWorkers(workerCount, requests) {
  const workers = Array.from({ length: workerCount }, () => new Worker(workerUrl));
  try {
    const pending = new Map();
    for (const worker of workers) {
      worker.on("message", (message) => {
        const resolve = pending.get(message.requestId);
        if (!resolve) return;
        pending.delete(message.requestId);
        if (message.kind === "error") {
          resolve(Promise.reject(Object.assign(new Error(message.error.message), { name: message.error.name })));
        } else {
          resolve(Promise.resolve(message.chunk));
        }
      });
    }
    const jobs = requests.map((request, index) => new Promise((resolve, reject) => {
      const requestId = `job-${index}`;
      pending.set(requestId, (result) => result.then(resolve, reject));
      workers[index % workerCount].postMessage({ kind: "generate", requestId, request });
    }));
    return await Promise.all(jobs);
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
}

function sortedCore(chunks) {
  return chunks
    .slice()
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx)
    .map(canonicalizeCore);
}

test("chunk identity uses floor-correct negative coordinates and stable global IDs", () => {
  const chunk = generateChunk({ seed: "8675309", cx: -1, cy: -1 });
  assert.equal(CHUNK_SIZE, 16);
  assert.equal(getChunkKey(-1, -1), "-1,-1");
  assert.equal(chunk.tiles[0].x, -16);
  assert.equal(chunk.tiles[0].y, -16);
  assert.ok(chunk.entities.every((entity) => entity.id === `${entity.type}:${entity.x}:${entity.y}`));
  assert.equal(new Set(chunk.entities.map((entity) => entity.id)).size, chunk.entities.length);
  assert.ok(chunk.entities.every((entity) => ENTITY_TYPES.includes(entity.type)));
});

test("public generation boundary rejects duplicate chunk keys and entity types", () => {
  assert.throws(() => generateWorld({
    seed: 9,
    chunks: [{ x: -1, y: 0 }, { x: -1, y: 0 }],
  }), /duplicate chunk key/i);
  assert.throws(() => generateChunk({ seed: 9, cx: 0, cy: 0, entityTypes: ["tree", "tree"] }), /duplicate entity type/i);
  assert.throws(() => generateWorld({ seed: 9, chunks: [{ x: 0, y: 0 }], entityTypes: ["bogus"] }), /unknown entity type/i);
});

test("core world content is identical across request order, worker count, and grass setting", async () => {
  const seed = "-20261102";
  const expected = sortedCore(generateWorld({ seed, chunks: coordinates, order: "normal" }));

  for (const order of ["normal", "reverse", "shuffled"]) {
    for (const workerCount of [0, 1, 4]) {
      const orderedCoordinates = orderChunkCoordinates(coordinates, seed, order);
      const requests = orderedCoordinates.map(({ x, y }) => ({
        seed,
        cx: x,
        cy: y,
        includeGrass: workerCount % 2 === 0,
      }));
      const chunks = workerCount === 0
        ? generateWorld({ seed, chunks: orderedCoordinates, order, includeGrass: true })
        : await generateUsingWorkers(workerCount, requests);
      assert.deepEqual(sortedCore(chunks), expected, `${order} order with ${workerCount} workers`);
    }
  }
});

test("grass is independently addressed decor and never changes core content", () => {
  const bare = generateChunk({ seed: 41, cx: 0, cy: 0, includeGrass: false });
  const grassy = generateChunk({ seed: 41, cx: 0, cy: 0, includeGrass: true });
  assert.equal(bare.grass, undefined);
  assert.ok(Array.isArray(grassy.grass));
  assert.ok(grassy.grass.length > 0);
  assert.deepEqual(canonicalizeCore(grassy), canonicalizeCore(bare));
});

test("enemy IDs and loot survive decor and unrelated entity toggles", () => {
  const options = {seed: 41, chunks: [{x: 0,y: 0}, {x: 1,y: 0}, {x: -1,y: 0}]};
  const enemies = (chunks) => chunks.flatMap((chunk) => chunk.entities)
    .filter((entity) => entity.type === "sentinel");
  const expected = enemies(generateWorld(options));
  assert.ok(expected.length > 0);
  assert.deepEqual(enemies(generateWorld({...options, includeGrass: true, entityTypes: ["sentinel"]})), expected);
  assert.ok(expected.every((enemy) => enemy.blocking && enemy.loot.endsWith("-token")));
});

test("worker message protocol returns chunks and serializes validation errors", async () => {
  const worker = new Worker(workerUrl);
  try {
    const responseFor = async (requestId) => {
      const [message] = await once(worker, "message");
      assert.equal(message.requestId, requestId);
      return message;
    };
    worker.postMessage({ kind: "generate", requestId: "good", request: { seed: 5, cx: 0, cy: 0 } });
    const good = await responseFor("good");
    assert.equal(good.kind, "generated");
    assert.equal(good.chunk.cx, 0);

    worker.postMessage({
      kind: "generate",
      requestId: "bad",
      request: { seed: 5, cx: 0, cy: 0, entityTypes: ["tree", "tree"] },
    });
    const bad = await responseFor("bad");
    assert.equal(bad.kind, "error");
    assert.match(bad.error.message, /duplicate entity type/i);
  } finally {
    await worker.terminate();
  }
});

