import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Random, i64, u64 } from "../src/index.js";

const corpus = JSON.parse(readFileSync(new URL("../../tests/conformance-v1.json", import.meta.url)));
const decode = ({ type, value }) => ({
  i64: () => i64(BigInt(value)), u64: () => u64(BigInt(value)),
  string: () => value, bytes: () => Uint8Array.from(Buffer.from(value, "hex")),
})[type]();
for (const row of corpus.cases) test(`shared helper corpus: ${row.id}`, () => {
  const p = corpus.parameters, expected = row.expected;
  const root = new Random(row.seed), field = root.scope(...row.prefix.map(decode));
  const keys = row.keys.map(decode), items = [0, 1, 2, 3], weights = p.weights.map(BigInt);
  assert.equal(field.raw(...keys).toString(), expected.raw);
  assert.equal(field.int(BigInt(p.bound), ...keys).toString(), expected.int);
  assert.equal(field.range(BigInt(p.min), BigInt(p.max), ...keys).toString(), expected.range);
  assert.equal(BigInt(field.float01(...keys) * 2 ** 53).toString(), expected.floatUpper53);
  assert.equal(field.at2D(BigInt(p.x), BigInt(p.y), row.namespace).toString(), expected.at2D);
  assert.equal(field.at3D(BigInt(p.x), BigInt(p.y), BigInt(p.z), row.namespace).toString(), expected.at3D);
  assert.equal(field.chanceRatio(BigInt(p.numerator), BigInt(p.denominator), ...keys), expected.chanceRatio);
  assert.equal(field.choose(items, ...keys), expected.choose);
  assert.deepEqual(field.shuffle(items, ...keys), expected.shuffle);
  assert.deepEqual(field.sample([0, 1, 2, 3, 4], p.sampleCount, ...keys), expected.sample);
  assert.equal(field.weightedChoice(items, weights, ...keys), expected.weightedChoice);
  assert.equal(field.prepareWeightedChoice(items, weights).choose(...keys), expected.weightedChoice);
  assert.equal(root.nextRaw(), new Random(row.seed).nextRaw());
  assert.equal(field.nextRaw(), new Random(row.seed).nextRaw());
});

test("scope and prepared choices own snapshots and do not advance streams", () => {
  for (const makeBytes of [() => new Uint8Array([1, 2]), () => new Uint8Array([1, 2]).buffer]) {
    const root = new Random(42), bytes = makeBytes(), field = root.scope(bytes);
    const reference = new Random(42).scope(new Uint8Array([1, 2]));
    const nested = field.scope("nested");
    assert.equal(nested.raw("k"), reference.raw("nested", "k"));
    const items = ["zero", "one", "two"], weights = [0n, 1n, 3n];
    const prepared = field.prepareWeightedChoice(items, weights);
    new Uint8Array(bytes instanceof ArrayBuffer ? bytes : bytes.buffer).fill(9);
    root.setSeed(9);
    assert.equal(field.raw("k"), reference.raw("k"));
    weights.fill(0n); items.fill("changed"); field.setSeed(8);
    for (let i = 0; i < 200; i++) assert.equal(prepared.choose(i), reference.weightedChoice(["zero", "one", "two"], [0, 1, 3], i));
    assert.equal(nested.nextRaw(), new Random(42).nextRaw());
  }
});

test("sample validates count and keys, preserves positions, and uses a count-independent permutation", () => {
  const field = new Random(19).scope("scope"), items = [1, 1, 2, 3];
  const full = field.sample(items, items.length, "key");
  for (let n = 0; n <= items.length; n++) assert.deepEqual(field.sample(items, n, "key"), full.slice(0, n));
  assert.deepEqual(items, [1, 1, 2, 3]);
  for (const n of [-1, 5, 0.5, NaN, Infinity, "1", 1n]) assert.throws(() => field.sample(items, n));
  assert.throws(() => field.sample([], 0, {}));
  assert.throws(() => field.scope({}));
  for (const weights of [[0, 0], [1], [-1, 2], [1.5, 2], [(1n << 64n) - 1n, 1n]]) assert.throws(() => field.prepareWeightedChoice([1, 2], weights));
});

test("prepared binary search handles repeated cumulative bounds and uint64 maximum", () => {
  const field = new Random(123).scope("weights"), items = [0, 1, 2, 3];
  for (const weights of [[0n, 0n, 1n, 0n], [1n, 0n, 0n, 1n], [0n, (1n << 64n) - 2n, 1n, 0n]]) {
    const prepared = field.prepareWeightedChoice(items, weights);
    for (let key = 0; key < 200; key++) assert.equal(prepared.choose(key), field.weightedChoice(items, weights, key));
  }
});
