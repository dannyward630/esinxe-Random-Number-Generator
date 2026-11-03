# JavaScript and TypeScript Port

The ESM implementation targets Node.js 18 or newer and modern browsers.
TypeScript declarations ship beside the source. Runtime uint64 values are
returned as `bigint`.

## Quick Start

```javascript
import { Random, i64, u64 } from "./src/index.js";

const field = new Random(12345n);
const value = field.raw("terrain", i64(-4), u64(9));
const height = field.at2D(-4, 9, "terrain");
```

Key components accept `bigint`, safe integer `number`, string, `Uint8Array`, or
`ArrayBuffer`; use `i64()` and `u64()` to distinguish positive signed and
unsigned keys. Unsafe JavaScript numbers are rejected because they have
already lost integer precision. Use `bigint` for large values.

The keyed methods are `raw`, `int`, `range`, `float01`, `at2D`, `at3D`,
`chanceRatio`, `choose`, `shuffle`, and `weightedChoice`. They throw on invalid
input and never mutate stream position. The camelCase and historical `Next*`
methods provide compatible stream access.

See [the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Scoped fields, sampling, and prepared weights

```javascript
const terrain = field.scope("world", new Uint8Array([1, 2]));
const locations = terrain.sample(["hill", "lake", "wood"], 2, "region");
const encounters = terrain.prepareWeightedChoice(["common", "rare"], [80n, 20n]);
const encounter = encounters.choose("tile", i64(-4));
```

`scope(...prefix)` snapshots the seed and copies typed prefix bytes, including
`ArrayBuffer` and `Uint8Array` inputs. Nested prefixes concatenate. Raw calls
equal the original field with prefix keys prepended; helper domains precede
the prefix. Reseeding either field cannot change the other. Each scoped field
has its own stream starting at offset zero; prefixes affect only keyed calls.

`sample(items, count, ...keys)` copies the input and returns the first `count`
positions of a descending Fisher-Yates permutation under `sample-v1`. Counts
must be integer numbers from zero through the input length. Requested count
does not change the permutation; duplicate values retain distinct positions.
Invalid keys are rejected even for zero counts and empty inputs.

`prepareWeightedChoice(items, weights)` returns `PreparedWeightedChoice<T>`.
Its `choose(...keys)` uses binary search and exactly matches `weightedChoice`,
including zero weights. Construction copies both sequences, validates equal
nonzero lengths, integer nonnegative weights and a total in `[1, 2^64-1]`, and
snapshots the field. Item objects themselves retain their usual references.
All collection APIs accept readonly arrays and preserve generic item types.
Creating scopes, sampling, preparing, and choosing never advance a stream.

## Test

```sh
cd JavaScript
npm ci
npm test
npm run typecheck
```

This generator is deterministic and non-cryptographic.

## Stable-ID choice

`field.stableChoice(items, ids, ...keys)` ranks unique UTF-8 string IDs independently.
Items and IDs must have equal nonzero lengths; an empty individual ID is valid.
Reordering preserves the winning ID. Adding an ID changes only assignments it
wins; removing a nonwinner has no effect. No stream state changes. See the
[portable helper contract](../SPEC_HELPERS_V1.md) for score and tie rules.
