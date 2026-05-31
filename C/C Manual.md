# C Manual

Dependencies: `stdint.h`, `time.h`

The preferred API is instance based:

- `EsinxeRandom rng;`
- `EsinxeInit(&rng, seed)` resets the seed and sequence index.
- `EsinxeSetTimeSeed(&rng)` seeds from the current Unix time.
- `EsinxeNext(&rng)` returns the next integer and advances the sequence.
- `EsinxeNextAt(&rng, offset)` returns the integer at an offset without advancing.
- `EsinxeNextRaw(&rng)` returns the next raw 64-bit value and advances.
- `EsinxeNextRawAt(&rng, offset)` returns the raw 64-bit value at an offset.
- `EsinxeNextMax(&rng, maxvalue)` returns `0 <= value < maxvalue`.
- `EsinxeNextMaxAt(&rng, offset, maxvalue)` returns a bounded value.
- `EsinxeNextMinMax(&rng, minvalue, maxvalue)` returns `minvalue <= value < maxvalue`.
- `EsinxeNextMinMaxAt(&rng, offset, minvalue, maxvalue)` returns a ranged value.

Legacy global wrappers are still available: `SetSeed`, `SetTimeSeed`, `Next`,
`NextAt`, `NextRaw`, `NextRawAt`, `NextMax`, `NextMaxAt`, `NextMinMax`, and
`NextMinMaxAt`.

This generator is deterministic and non-cryptographic.
