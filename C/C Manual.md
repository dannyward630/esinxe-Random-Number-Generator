# C Manual

Dependencies: `stdint.h`, `time.h`

- `SetSeed(seed)` resets the seed and sequence index.
- `SetTimeSeed()` seeds from the current Unix time.
- `Next()` returns the next integer and advances the sequence.
- `NextAt(offset)` returns the integer at an offset without advancing.
- `NextMax(maxvalue)` returns `0 <= value < maxvalue`.
- `NextMaxAt(offset, maxvalue)` returns a bounded value without advancing.
- `NextMinMax(minvalue, maxvalue)` returns `minvalue <= value < maxvalue`.
- `NextMinMaxAt(offset, minvalue, maxvalue)` returns a ranged value without advancing.

This generator is deterministic and non-cryptographic.
