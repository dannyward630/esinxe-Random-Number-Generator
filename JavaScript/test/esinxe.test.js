import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Random } from "../src/index.js";

const vectors = JSON.parse(readFileSync(new URL("../../tests/vectors.json", import.meta.url)));

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
