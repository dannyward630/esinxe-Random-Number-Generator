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

Bounded ranges use the frozen deterministic rejection/remixing procedure.

## Bounded Output Limitations

The initial rejection threshold resembles conventional unbiased reduction,
but a rejected esinxe word is deterministically remixed rather than replaced
with a fresh independent uniform draw. The usual rejection-sampling proof
therefore does not establish exact uniformity for this implementation. For
comparison, [Lemire's bounded-integer analysis](https://arxiv.org/html/1805.10941)
explicitly takes new random words from a uniform source after rejection.

There is also a direct counting limit: for a fixed bound, v1 maps each of
`2^64` possible initial words to exactly one result. Equal preimage counts for
all `m` results would require `m` to divide `2^64`. For other bounds, exact
uniformity under a uniform initial-word model is impossible, even with
deterministic retries. This argument does not measure the practical magnitude
of bias for particular keys, seeds, or bounds.

Small-bound smoke tests cannot certify the retry path: for a uniform initial
word and bound 100, only 16 of `2^64` initial words trigger rejection. Bounds
just above `2^63` exercise that path much more often. Both regimes deserve
tests. Algorithm-v1 outputs remain unchanged; a different reducer or a new
counter-based design would require a separately versioned algorithm.

## Independence and Collision Limits

All stream seeds are phase shifts of one full-period 64-bit permutation:
`golden_gamma` and both mixer multipliers are odd, and the xor-shift stages
are invertible. Thus no repeated raw word is possible within one complete
stream period. The no-collision smoke test checks implementation consistency,
not statistical quality, and different seeds are not independent streams.

Structured-key hashing compresses an unbounded key space into 64 bits, so hash
collisions are unavoidable. Reserved domains distinguish encoded inputs; they
do not make the hash collision-free. Neither avalanche nor bit-balance tests
prove statistical independence or resistance to adversarially chosen keys.

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
