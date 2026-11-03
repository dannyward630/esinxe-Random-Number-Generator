import test from "node:test";
import assert from "node:assert/strict";
import { generateChunk } from "../../examples/world/generator.js";
import { ChunkStream } from "../../examples/world/stream.js";

test("stream reuses chunks, deduplicates requests and bounds the cache", async () => {
  let requests = 0,
    terminated = 0;
  const previous = globalThis.Worker;
  globalThis.Worker = class {
    postMessage(job) {
      requests++;
      queueMicrotask(() =>
        this.onmessage({
          data: { kind: "generated", chunk: generateChunk(job.request) },
        }),
      );
    }
    terminate() {
      terminated++;
    }
  };
  const stream = new ChunkStream("42", 4);
  try {
    await Promise.all([stream.ensureAround(0, 0), stream.ensureAround(0, 0)]);
    assert.equal(requests, 25);
    await stream.ensureAround(1, 1);
    assert.equal(requests, 25);
    await stream.ensureAround(16, 0);
    assert.equal(requests, 30);
    for (let i = 2; i < 6; i++) await stream.ensureAround(i * 16, 0);
    assert.ok(stream.cache.size <= 49);
    assert.ok(stream.tileAt(80, 0));
  } finally {
    stream.dispose();
    globalThis.Worker = previous;
  }
  assert.equal(terminated, 4);
});
