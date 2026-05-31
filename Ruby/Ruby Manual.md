# Ruby Manual

Dependencies: none

`Esinxe::Generator` is the primary class. It intentionally does not define a
top-level `Random` class, because Ruby already has one.

- `SetSeed(seed)` resets the seed and sequence index.
- `Next()` returns the next integer and advances the sequence.
- `NextRaw()` returns the next raw 64-bit value and advances.
- `NextRawAt(offset)` returns the raw 64-bit value at an offset without advancing.
- `Next(offset)` returns the integer at an offset without advancing.
- `Next(offset, maxvalue)` returns `0 <= value < maxvalue`.
- `Next(offset, minvalue, maxvalue)` returns `minvalue <= value < maxvalue`.
- `NextArray(length)` returns `length` consecutive integers and advances.
- `NextArray(length, offset)` returns values starting at `offset` without advancing.
- `NextArray(length, offset, maxvalue)` returns bounded values without advancing.
- `NextArray(length, offset, minvalue, maxvalue)` returns ranged values without advancing.

This generator is deterministic and non-cryptographic.
