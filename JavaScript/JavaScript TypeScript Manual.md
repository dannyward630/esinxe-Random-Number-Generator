# JavaScript / TypeScript Manual

Dependencies: Node.js with BigInt support.

```js
import { Random } from "./src/index.js";

const rng = new Random(12345);
console.log(rng.next());
console.log(rng.nextRawAt(1000));
```

The JavaScript implementation returns `bigint` values so raw unsigned 64-bit
output is represented exactly. TypeScript declarations are available in
`src/index.d.ts`.

Run tests with:

```sh
cd JavaScript
npm test
```
