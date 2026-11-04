import {
  generateChunk,
  orderChunkCoordinates,
  canonicalizeWorld,
} from "./generator.js";
import { decorateChunk } from "./expedition.js?v=3";

export class ChunkStream {
  constructor(seed, workers = 4, order = "normal", grass = true) {
    this.seed = seed;
    this.order = order;
    this.grass = grass;
    this.cache = new Map();
    this.pending = new Map();
    this.queue = [];
    this.serial = 0;
    this.closed = false;
    this.pool = Array.from({ length: workers }, () => {
      const slot = {
        worker: new Worker(new URL("./worker.js", import.meta.url), {
          type: "module",
        }),
        busy: false,
      };
      slot.worker.onmessage = ({ data }) => {
        const job = slot.job;
        slot.busy = false;
        slot.job = null;
        if (data.kind === "error") job.reject(new Error(data.error.message));
        else job.resolve(data.chunk);
        this.pump();
      };
      slot.worker.onerror = () => {
        if (slot.job)
          slot.job.reject(
            new Error("World worker failed. Try New expedition."),
          );
        slot.busy = false;
        slot.job = null;
        this.dispose();
      };
      return slot;
    });
  }
  pump() {
    for (const slot of this.pool) {
      if (slot.busy || !this.queue.length) continue;
      slot.busy = true;
      slot.job = this.queue.shift();
      slot.worker.postMessage({
        kind: "generate",
        requestId: ++this.serial,
        request: slot.job.request,
      });
    }
  }
  raw(request) {
    if (this.closed) return Promise.reject(new Error("World stream closed"));
    if (!this.pool.length)
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(generateChunk(request));
          } catch (e) {
            reject(e);
          }
        }, 0),
      );
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.pump();
    });
  }
  async ensureAround(x, y, onChunk = () => {}) {
    const cx = Math.floor(x / 16),
      cy = Math.floor(y / 16),
      coords = [];
    this.center = { cx, cy };
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++) coords.push({ x: cx + i, y: cy + j });
    const ordered = orderChunkCoordinates(coords, this.seed, this.order);
    // Nearest chunks arrive first; the chosen order breaks equal-distance ties.
    ordered.sort(
      (a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy),
    );
    await Promise.all(
      ordered.map(({ x, y }) => {
        const key = `${x},${y}`;
        if (this.cache.has(key)) return;
        if (this.pending.has(key)) return this.pending.get(key);
        const task = this.raw({
          seed: this.seed,
          cx: x,
          cy: y,
          includeGrass: this.grass,
        })
          .then((chunk) => {
            if (this.closed) return;
            this.cache.set(key, decorateChunk(chunk));
            while (this.cache.size > 49) {
              const far = [...this.cache.values()].sort(
                (a, b) =>
                  Math.hypot(b.cx - this.center.cx, b.cy - this.center.cy) -
                  Math.hypot(a.cx - this.center.cx, a.cy - this.center.cy),
              )[0];
              this.cache.delete(far.key);
            }
            onChunk();
          })
          .finally(() => this.pending.delete(key));
        this.pending.set(key, task);
        return task;
      }),
    );
  }
  tileAt(x, y) {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      cx = Math.floor(ix / 16),
      cy = Math.floor(iy / 16);
    const tile = this.cache.get(`${cx},${cy}`)?.tiles[
      (iy - cy * 16) * 16 + ix - cx * 16
    ];
    return tile?.trail ? "path" : tile?.terrain;
  }
  entitiesNear(x, y, r) {
    const out = [];
    for (const c of this.cache.values()) {
      if (
        c.cx * 16 > x + r ||
        c.cx * 16 + 16 < x - r ||
        c.cy * 16 > y + r ||
        c.cy * 16 + 16 < y - r
      )
        continue;
      for (const e of c.entities)
        if (Math.hypot(e.x - x, e.y - y) <= r) out.push(e);
    }
    return out;
  }
  dispose() {
    this.closed = true;
    const error = new Error("World stream closed");
    for (const slot of this.pool) {
      slot.worker.terminate();
      if (slot.job) slot.job.reject(error);
    }
    for (const job of this.queue) job.reject(error);
    this.queue = [];
  }
}

export async function prove(seed, progress) {
  const coords = [];
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) coords.push({ x, y });
  const results = [];
  for (const order of ["normal", "reverse", "shuffled"])
    for (const workers of [0, 1, 4])
      for (const grass of [false, true]) {
        progress(`${order} · ${workers} workers · grass ${grass}`);
        const stream = new ChunkStream(seed, workers, order, grass);
        try {
          const chunks = await Promise.all(
            orderChunkCoordinates(coords, seed, order).map(({ x, y }) =>
              stream.raw({ seed, cx: x, cy: y, includeGrass: grass }),
            ),
          );
          // Frozen base-generator proof; expedition overlay has separate tests.
          const bytes = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonicalizeWorld(chunks)),
          );
          results.push({
            order,
            workers,
            grass,
            sha256: [...new Uint8Array(bytes)]
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(""),
          });
        } finally {
          stream.dispose();
        }
      }
  return {
    seed,
    contentVersion: "verdant-world-1",
    coordinates: coords,
    recordedAt: new Date().toISOString(),
    passed: new Set(results.map((r) => r.sha256)).size === 1,
    results,
  };
}
