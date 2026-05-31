# Ruby Manual

Dependencies: none

`Random` is the primary class.

- `SetSeed(seed)` resets the seed and sequence index.
- `Next()` returns the next integer and advances the sequence.
- `Next(offset)` returns the integer at an offset without advancing.
- `Next(offset, maxvalue)` returns `0 <= value < maxvalue`.
- `Next(offset, minvalue, maxvalue)` returns `minvalue <= value < maxvalue`.
- `NextArray(length)` returns `length` consecutive integers and advances.
- `NextArray(length, offset)` returns values starting at `offset` without advancing.
- `NextArray(length, offset, maxvalue)` returns bounded values without advancing.
- `NextArray(length, offset, minvalue, maxvalue)` returns ranged values without advancing.

This generator is deterministic and non-cryptographic.
