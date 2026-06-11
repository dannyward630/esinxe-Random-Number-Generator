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

## Test

```sh
cd JavaScript
npm ci
npm test
npm run typecheck
```

This generator is deterministic and non-cryptographic.
