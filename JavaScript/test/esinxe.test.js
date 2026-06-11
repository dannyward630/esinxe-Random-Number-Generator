import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Random, i64, u64 } from "../src/index.js";

const vectors = JSON.parse(readFileSync(new URL("../../tests/vectors.json", import.meta.url)));
const v1 = JSON.parse(readFileSync(new URL("../../tests/vectors-v1.json", import.meta.url)));

test("matches shared vectors", () => {
  const rng = new Random(vectors.seed);
  assert.deepEqual(
    Array.from({ length: 5 }, () => rng.Next().toString()),
    vectors.first_values
  );

  rng.SetSeed(vectors.seed);
  assert.deepEqual(
    Array.from({ length: 5 }, (_, i) => rng.NextRawAt(i).toString()),
    vectors.first_raw_values
  );
});

test("bounded and ranged values match shared vectors", () => {
  const bounded = new Random(vectors.seed);
  assert.deepEqual(
    Array.from({ length: 5 }, () => Number(bounded.NextMax(100))),
    vectors.first_max_100
  );

  const ranged = new Random(vectors.seed);
  assert.deepEqual(
    Array.from({ length: 5 }, () => Number(ranged.NextMinMax(50, 100))),
    vectors.first_range_50_100
  );
});

test("keyed API matches canonical v1 vectors without advancing the stream", () => {
  const rng = new Random(BigInt(v1.seed));
  const key = [
    i64(-1),
    u64((1n << 64n) - 1n),
    "snowman \u2603",
    Uint8Array.from([0, 1, 255]),
  ];
  const expectedNext = rng.NextRawAt(0);

  assert.equal(rng.raw().toString(), v1.cases.rawEmpty);
  assert.equal(rng.raw(i64(1)).toString(), v1.cases.rawSignedPositive);
  assert.equal(rng.raw(u64(1)).toString(), v1.cases.rawUnsignedPositive);
  assert.equal(rng.raw(...key).toString(), v1.cases.rawMixed);
  assert.equal(rng.raw("").toString(), v1.cases.rawEmptyString);
  assert.equal(rng.raw(new Uint8Array()).toString(), v1.cases.rawEmptyBytes);
  assert.equal(rng.int(100, ...key).toString(), v1.cases.int100);
  assert.equal(rng.range(-500, 500, ...key).toString(), v1.cases.rangeSigned);
  assert.equal((rng.raw(...key) >> 11n).toString(), v1.cases.floatUpper53);
  assert.equal(rng.at2D(-17, 42, "terrain/\u96ea").toString(), v1.cases.at2D);
  assert.equal(rng.at2D(-17, 42).toString(), v1.cases.at2DNoNamespace);
  assert.equal(rng.at3D(-17, 42, -(1n << 63n), "caves").toString(), v1.cases.at3D);
  assert.equal(rng.chanceRatio(7, 23, ...key), v1.cases.chanceRatio);
  assert.equal(rng.choose(["forest", "desert", "tundra", "ocean"], ...key), v1.cases.choose);
  assert.deepEqual(
    rng.shuffle(["forest", "desert", "tundra", "ocean"], ...key),
    v1.cases.shuffle
  );
  assert.equal(
    rng.weightedChoice(["common", "rare", "legendary"], [80, 18, 2], ...key),
    v1.cases.weightedChoice
  );
  assert.equal(rng.index, 0n);
  assert.equal(rng.NextRaw(), expectedNext);
});

test("keyed API rejects invalid inputs", () => {
  const rng = new Random(0);
  assert.throws(() => rng.int(0, "invalid"), RangeError);
  assert.throws(() => rng.range(5, 5, "invalid"), RangeError);
  assert.throws(() => rng.chanceRatio(1, 0, "invalid"), RangeError);
  assert.throws(() => rng.choose([], "invalid"), RangeError);
  assert.throws(() => rng.weightedChoice(["x"], [-1], "invalid"), RangeError);
  assert.throws(() => rng.weightedChoice(["x"], [0], "invalid"), RangeError);
  assert.throws(() => i64(1n << 63n), RangeError);
  assert.throws(() => u64(1n << 64n), RangeError);
  assert.throws(() => u64(Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => new Random(Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => rng.int(1n << 64n, "invalid"), RangeError);
  assert.throws(() => rng.weightedChoice(["x"], [1.5], "invalid"), RangeError);
});
