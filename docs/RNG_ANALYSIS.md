# RNG Analysis

esinxe is a deterministic random-access generator. It is designed for
procedural generation, reproducible simulations, and coordinate/index-based
randomness.

It is not a cryptographic random number generator. Do not use it for passwords,
tokens, key generation, gambling, or any security-sensitive decision.

## Design

The generator computes each value from:

```text
mix64(seed + offset * 0x9E3779B97F4A7C15)
```

That makes any offset independently addressable. `Next()` is a convenience
wrapper over an advancing offset; `NextAt(offset)` is the core feature.

Bounded ranges use rejection sampling to avoid modulo bias.

## Practical Uses

- Procedural terrain, chunk, room, and loot generation.
- Stable per-coordinate randomness.
- Deterministic randomized tests.
- Seeding other non-cryptographic generators.
- Repeatable simulations where random access is useful.

## Not Recommended For

- Cryptography or secrets.
- Gambling or money-related randomness.
- Adversarial systems.
- Scientific Monte Carlo work that requires a generator with published
  large-battery validation.

## Reproducing The Smoke Analysis

Run:

```sh
python3 scripts/analyze_rng.py
```

For deeper validation before publishing strong statistical claims, run the raw
64-bit stream through external tools such as PractRand or TestU01.
