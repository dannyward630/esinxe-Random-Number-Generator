# esinxe Algorithm v1

Status: frozen compatibility specification

esinxe v1 defines a deterministic, non-cryptographic random field. A field is
identified by an unsigned 64-bit seed. A structured key identifies a value
within that field. Implementations MUST return the same result for the same
seed, key, and helper in every supported language.

All arithmetic described below is unsigned 64-bit arithmetic modulo `2^64`
unless stated otherwise. This specification is permanent for algorithm v1.

## Security

esinxe is not a cryptographic random-number generator. Its output is
predictable from the seed and keys. Do not use it for secrets, tokens,
passwords, gambling, lotteries, or security decisions.

## Structured Key Encoding

The keyed hash starts with the FNV-1a 64 offset basis
`0xcbf29ce484222325`. Feed these bytes in order:

1. The ten-byte prefix `65 73 69 6e 78 65 2d 76 31 00`
   (`esinxe-v1` followed by NUL).
2. The field seed as eight little-endian bytes.
3. Each structured key component in order.

For every input byte, FNV-1a performs:

```text
hash = (hash XOR byte) * 0x00000100000001b3
```

Key components have these canonical encodings:

| Tag | Type | Payload |
| --- | --- | --- |
| `01` | signed integer | int64 two's-complement, little-endian |
| `02` | unsigned integer | uint64, little-endian |
| `03` | string | uint64 byte length, then strict UTF-8 bytes |
| `04` | bytes | uint64 byte length, then the bytes |

There is no implicit separator, terminator, normalization, or Unicode
case-folding. Empty strings and empty byte arrays are valid and remain
different because their tags differ.

Dynamic-language convenience APIs MAY infer a negative integer as signed and a
non-negative integer as unsigned. Conformance-sensitive code SHOULD use the
explicit signed and unsigned constructors because `signed(1)` and
`unsigned(1)` are intentionally different keys.

## Mixer

Finalize the FNV-1a hash using this exact SplitMix64 finalizer:

```text
z = (z XOR (z >> 30)) * 0xbf58476d1ce4e5b9
z = (z XOR (z >> 27)) * 0x94d049bb133111eb
z = z XOR (z >> 31)
```

`raw(key...)` is the resulting uint64.

## Domain Separation

Helpers that construct keys internally insert a reserved component before
their user-visible components:

```text
f0 || uint64_le(byte_length) || ASCII domain bytes
```

`f0` is reserved and cannot be emitted by a public key component. The v1
domains are `at2d`, `at3d`, and `shuffle`.

`at2D(x, y, namespace?)` hashes domain `at2d`, signed `x`, signed `y`, and the
optional namespace string. `at3D` does the same with signed `x`, `y`, and `z`.
Omitting a namespace is different from supplying an empty namespace.

## Unbiased Bounded Integers

For an upper bound `m` in `[1, 2^64 - 1]`, calculate:

```text
threshold = (2^64 - m) mod m
value = raw(key...)
nonce = 0
while value < threshold:
    nonce = nonce + 1
    value = mix64(value + nonce * 0x9e3779b97f4a7c15)
return value mod m
```

`int(max, key...)` returns `[0, max)`. `range(min, max, key...)` returns
`[min, max)` and supports signed endpoints provided the width does not exceed
`2^64 - 1`. Use `raw(key...)` when the full uint64 output domain is required.

`float01(key...)` is `(raw(key...) >> 11) / 2^53`. Implementations MUST use
the upper 53 bits and return a value in `[0, 1)`.

## Deterministic Helpers

- `chanceRatio(numerator, denominator, key...)` requires a positive
  denominator. It is false for `numerator <= 0`, true for
  `numerator >= denominator`, otherwise `int(denominator, key...) < numerator`.
- `choose(items, key...)` returns `items[int(length, key...)]`. Empty
  collections are errors.
- `shuffle(items, key...)` returns a copy and performs Fisher-Yates from
  `i = length - 1` through `1`. The selected position is the bounded value
  derived from domain `shuffle`, followed by the caller's key components,
  followed by unsigned `i`, with bound `i + 1`.
- `weightedChoice(items, integerWeights, key...)` requires equal non-zero
  lengths, non-negative integer weights, and a total in `[1, 2^64 - 1]`. Select
  `int(total, key...)`, then return the first item whose cumulative exclusive
  upper bound exceeds that value.

Floating weights and floating probability wrappers are outside the v1
conformance surface.

## Stream Compatibility

The historical `Next*` APIs use `mix64(seed + offset * golden_gamma)` and are
retained as stream conveniences. Calling any keyed API MUST NOT change the
stream seed, position, or next output.

## Guarantees and Non-Goals

v1 guarantees deterministic cross-language parity, random access, stable
partitioning, unbiased bounded integers, and no dependence on prior calls. It
does not guarantee secrecy, nondeterminism, a configurable period, Gaussian or
other scientific distributions, or spatial smoothness. Noise belongs in a
separate future module built on this keyed core.
