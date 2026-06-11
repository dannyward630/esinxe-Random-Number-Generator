# RNG Analysis

esinxe is a deterministic random field with a compatible random-access stream.
It is designed for procedural generation, reproducible simulations,
coordinate-based content, and partition-independent sampling.

It is not a cryptographic random number generator. Do not use it for passwords,
tokens, key generation, gambling, or any security-sensitive decision.

## Design

Algorithm v1 hashes a canonical structured key with FNV-1a 64, then finalizes
the hash with the same SplitMix64 mixer used by the historical stream. The
complete, frozen encoding is in `SPEC_V1.md`.

The compatible offset stream computes each value from:

```text
mix64(seed + offset * 0x9E3779B97F4A7C15)
```

That makes any offset independently addressable. `Next()` is a convenience
wrapper over an advancing offset. New code that has stable identifiers or
coordinates should prefer keyed calls, because adding an unrelated call cannot
shift their outputs.

Bounded ranges use rejection sampling to avoid modulo bias.

## Practical Uses

- Procedural terrain, chunk, room, and loot generation.
- Stable per-coordinate randomness.
- Stable loot, encounters, and fixtures addressed by structured identifiers.
- Distributed jobs whose results do not depend on worker count or scheduling.
- Deterministic randomized tests.
- Seeding other non-cryptographic generators.
- Repeatable simulations where random access is useful.

## Not Recommended For

- Cryptography or secrets.
- Gambling or money-related randomness.
- Adversarial systems.
- Scientific Monte Carlo work that requires a generator with published
  large-battery validation.
- Smooth terrain or texture noise without a separate interpolation layer.

## Reproducing The Smoke Analysis

Run:

```sh
python3 scripts/analyze_rng.py
```

For deeper validation before publishing strong statistical claims, run the raw
64-bit stream through external tools such as PractRand or TestU01.
