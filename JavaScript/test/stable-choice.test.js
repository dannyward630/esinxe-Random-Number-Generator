import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Random, i64, u64 } from "../src/index.js";

const corpus = JSON.parse(readFileSync(new URL("../../tests/stable-choice-v1.json", import.meta.url)));
function decode(keys) {
  return keys.map(({ type, value }) => type === "i64" ? i64(BigInt(value))
    : type === "u64" ? u64(BigInt(value)) : type === "bytes"
      ? Uint8Array.from(Buffer.from(value, "hex")) : value);
}
test("stable IDs consume portable fixtures and ignore candidate ordering", () => {
  for (const row of corpus.cases) {
    const field = new Random(row.seed).scope(...decode(row.prefix));
    const keys = decode(row.keys);
    assert.equal(field.stableChoice(row.ids, row.ids, ...keys), row.expectedId);
    assert.equal(field.stableChoice([...row.ids].reverse(), [...row.ids].reverse(), ...keys), row.expectedId);
    assert.equal(field.index, 0n);
  }
});
test("adding an ID only moves assignments won by that ID", () => {
  const field = new Random(42);
  const ids = ["a", "b", "c"];
  for (let i = 0; i < 128; i++) {
    const before = field.stableChoice(ids, ids, i);
    const after = field.stableChoice([...ids, "d"], [...ids, "d"], i);
    assert.ok(before === after || after === "d");
  }
  assert.throws(() => field.stableChoice([], []));
  assert.throws(() => field.stableChoice([1, 2], ["x", "x"]));
  assert.throws(() => field.stableChoice([1], ["\ud800"]));
  assert.throws(() => field.stableChoice([1], ["x"], true));
});
