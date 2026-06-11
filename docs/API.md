# API Reference

This document describes the stable concepts shared by every port. Naming is
idiomatic per language; the semantics and v1 outputs are identical.

## Field Construction

Create a field from an unsigned 64-bit seed. Dynamic-language implementations
wrap negative seeds modulo `2^64`; statically typed ports accept their native
uint64 representation.

If no seed is supplied by a convenience constructor, the implementation may
use the current time. Reproducible software should always provide a seed.

## Structured Keys

| Concept | Python | JS/TS | Rust | Go | Java | Kotlin | C# | C++ | C | Ruby |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| signed int64 | `i64(x)` | `i64(x)` | `Key::I64(x)` | `I64(x)` | `Key.i64(x)` | `Key.i64(x)` | `Key.I64(x)` | `Key::Signed(x)` | `EsinxeI64(x)` | `Esinxe.i64(x)` |
| uint64 | `u64(x)` | `u64(x)` | `Key::U64(x)` | `U64(x)` | `Key.u64(x)` | `Key.u64(x)` | `Key.U64(x)` | `Key::Unsigned(x)` | `EsinxeU64(x)` | `Esinxe.u64(x)` |
| UTF-8 string | `str` | `string` | `Key::Str` | `String` | `Key.string` | `Key.string` | `Key.String` | `Key::Utf8` | `EsinxeString` | `String` |
| bytes | `bytes` | `Uint8Array` | `Key::Bytes` | `Bytes` | `Key.bytes` | `Key.bytes` | `Key.Bytes` | `Key::Bytes` | `EsinxeBytes` | `Esinxe.bytes` |

Positive signed and unsigned integers are different keys. Use explicit
constructors at persisted or cross-language boundaries.

## Keyed Operations

`raw(key...)`

Returns the full v1 uint64 value.

`int(max, key...)`

Returns an unbiased integer in `[0, max)`. `max` must be in
`[1, 2^64 - 1]`. Use `raw` for the complete uint64 domain.

`range(min, max, key...)`

Returns an unbiased integer in `[min, max)`. The interval must be non-empty and
its width must not exceed `2^64 - 1`.

`float01(key...)`

Maps the upper 53 bits of `raw` to an exactly specified value in `[0, 1)`.

`at2D(x, y, namespace?)` and `at3D(x, y, z, namespace?)`

Address signed coordinates using reserved domains. Omitting a namespace differs
from supplying an empty namespace.

`chanceRatio(numerator, denominator, key...)`

Returns a rational probability without cross-language floating-point ambiguity.
The denominator must be positive. Non-positive numerators are false;
numerators at least as large as the denominator are true.

`choose(items, key...)`

Selects one item. Empty collections are invalid.

`shuffle(items, key...)`

Returns a shuffled copy using deterministic Fisher-Yates. The input remains
unchanged.

`weightedChoice(items, integerWeights, key...)`

Selects using non-negative integer weights. Lengths must match, the collection
must not be empty, and the total must be in `[1, 2^64 - 1]`.

## Stream Operations

The compatibility stream provides sequential and offset APIs:

- `NextRaw` / `next_raw`: full uint64 stream output;
- `Next` / `next`: historical output in `[0, 10^18)`;
- `NextMax` / `next_max`: bounded stream output;
- `NextMinMax` / `next_min_max`: ranged stream output; and
- corresponding `At` methods for direct offset access.

Invalid-range behavior in historical stream APIs is retained for compatibility
and differs by port. New code should prefer the keyed APIs, whose invalid input
behavior is explicit.

## State Isolation

Keyed methods never advance or otherwise mutate the compatibility stream.
Calling a keyed method between two stream calls cannot change the next stream
value.

## Error Mapping

Ports use their idiomatic failure mechanism:

- Python, JavaScript, Ruby, Java, Kotlin, C#, and C++ raise exceptions.
- Rust returns `Result` or `Option`.
- Go returns `(value, error)` where validation can fail.
- C returns a success flag or `SIZE_MAX` for index helpers.

See [SPEC_V1.md](../SPEC_V1.md) for the byte-level compatibility contract.
