# C# Manual

Dependencies: `System`, `System.Collections.Generic`

`Esinxecs.Random` is the primary class.

- `SetSeed(seed)` resets the seed and sequence index.
- `Next()` returns the next integer and advances the sequence.
- `NextAt(offset)` returns the integer at an offset without advancing.
- `NextRaw()` returns the next raw 64-bit value and advances.
- `NextRawAt(offset)` returns the raw 64-bit value at an offset without advancing.
- `NextMax(maxvalue)` returns `0 <= value < maxvalue`.
- `NextMaxAt(offset, maxvalue)` returns a bounded value without advancing.
- `NextMinMax(minvalue, maxvalue)` returns `minvalue <= value < maxvalue`.
- `NextMinMaxAt(offset, minvalue, maxvalue)` returns a ranged value without advancing.
- `NextList(length)` returns `length` consecutive integers.
- `NextListMax(length, maxvalue)` returns `length` bounded integers.
- `NextListMinMax(length, minvalue, maxvalue)` returns `length` ranged integers.

This generator is deterministic and non-cryptographic.
