# Port capabilities and input boundaries

All ten ports implement the frozen v1 keyed operations and the additive
[scope, sample, stable-ID and prepared-choice contract](../SPEC_HELPERS_V1.md). Existing
legacy stream behavior is retained, including differences described below.

For portable application data use explicit signed/unsigned keys, int64
coordinates/endpoints, uint64 seeds, bounds in `[1, 2^64-1]`, and nonnegative
integer weights with a total in `[1, 2^64-1]`. For ratio calls portable to every
signature, use `0 <= numerator <= denominator <= 2^63-1` with denominator positive.

| Port | Full-width integer behavior | Ratios and weights | Collections / errors |
| --- | --- | --- | --- |
| Python 3.9+ | Arbitrary-size ints; typed keys validate int64/uint64. Ranges may have arbitrary endpoints if width fits uint64. | Integer ratios; positive interior denominator must fit uint64. Weights reject bool/floats and validate uint64 total. | Sequence-based choose, iterable copy for shuffle/sample/preparation; exceptions. |
| JavaScript / TypeScript, Node 18+ | `bigint` for full precision; `number` must be a safe integer. Keyed results are bigint. | Integer bigint ratios/weights; uint64 total. | Arrays/iterable copies, generic declarations; exceptions. |
| C11 | Explicit int64/uint64; signed range endpoints. | Ratio arguments int64; uint64 weights. | Caller-owned buffers, index choices, success flags / `SIZE_MAX`; caller pointer/tag/UTF-8 preconditions. |
| C++17 | Explicit int64/uint64; signed range endpoints. | Ratio arguments int64; uint64 weights. | Vector collections, copied permutations/tables, selected const references (`vector<bool>` returns values); exceptions. |
| C# | `ulong` raw/bounds, `long` coordinates/ranges. | Ratio arguments long; ulong weights. Checked-build encoding is supported. | `IReadOnlyList<T>` inputs, copied lists/tables; exceptions. |
| Ruby | Arbitrary-size Integer; typed keys validate int64/uint64. | Integer ratios/weights, uint64 total. | Array collections; exceptions. |
| Rust 1.70+ | u64 raw/bounds and i64 keyed ranges/coordinates. | u64 ratio arguments and weights. Negative values cannot be passed. | Slices, owned scope/table data, cloned sample items; `Result`/`Option`. |
| Go 1.22+ | uint64 raw/bounds and int64 keyed ranges/coordinates. | uint64 ratio arguments/weights. Negative values cannot be passed. | Generic top-level collection helpers; errors. Invalid UTF-8/uninitialized Key panic where API has no error return. |
| Java 21 | Raw values are signed long bit patterns; use `Long.toUnsignedString`. Full uint64 bounds use the BigInteger overload. | Ratio arguments and each weight are nonnegative signed long; cumulative totals may reach uint64 max. | `List<T>` copies; exceptions. |
| Kotlin | ULong raw/bounds, Long coordinates/ranges. | Ratio arguments Long; individual and cumulative weights ULong. | `List<T>` copies; exceptions. Compiler used in CI: 2.3.21 on JDK 21. |

Scopes copy prefixes and snapshot seeds. Prepared choices copy sequence structure
and weights; item objects retain normal reference/value semantics. C is the
exception for scoped storage: it borrows immutable payload buffers, while its
prepared table owns a deep copy. See [the C manual](../C/C%20Manual.md) for the
initialization/free and storage non-overlap requirements.

## Names of the new operations

| Port | Scope | Sample | Prepared choice |
| --- | --- | --- | --- |
| Python | `field.scope(...)` | `field.sample(items, count, ...)` | `field.prepareWeightedChoice(items, weights).choose(...)` |
| JS/TS | `field.scope(...)` | `field.sample(items, count, ...)` | `field.prepareWeightedChoice(items, weights).choose(...)` |
| C | `EsinxeFieldScopeV1` | `EsinxeSampleV1` / `EsinxeFieldSampleV1` | `EsinxePreparedWeightedInitV1` / `EsinxePreparedWeightedChooseV1` / `EsinxePreparedWeightedFreeV1` |
| C++ | `field.Scope(...)` | `field.Sample(items, count, ...)` | `field.PrepareWeightedChoice(items, weights).Choose(...)` |
| C# | `field.Scope(...)` | `field.Sample(items, count, ...)` | `field.PrepareWeightedChoice(items, weights).Choose(...)` |
| Ruby | `field.scope(...)` | `field.sample(items, count, ...)` | `field.prepare_weighted_choice(items, weights).choose(...)` |
| Rust | `field.scope(...)` | `field.sample(items, count, ...)` | `field.prepare_weighted_choice(items, weights)?.choose(...)` |
| Go | `field.Scope(...)` | `esinxe.Sample(field, items, count, ...)` | `esinxe.PrepareWeightedChoice(field, items, weights)` then `.Choose(...)` |
| Java / Kotlin | `field.scope(...)` | `field.sample(items, count, ...)` | `field.prepareWeightedChoice(items, weights).choose(...)` |

Port manuals contain compilable call patterns and exact error/ownership rules.

Stable-ID choice uses `stableChoice(items, ids, keys...)` in Python/JS/Java/Kotlin,
`StableChoice` in C++/C#, `stable_choice` in Ruby/Rust, and the generic
`esinxe.StableChoice(field, items, ids, keys...)` in Go. Rust takes `&[&str]` IDs
and returns `Result<&T, &str>`. C exposes `EsinxeStableChoiceIndexV1` and
`EsinxeFieldStableChoiceIndexV1`, taking IDs as string-tagged `EsinxeKey` arrays
and returning an index or `SIZE_MAX`. It does not take an item buffer.

Python additionally provides `rawBatch(rows)` with native/fallback parity. Other
ports do not promise keyed batch APIs. This is separate from historical stream
batch helpers, which advance stream position.

## Compatibility streams

Python/JS/Ruby stream bounds can reach `2^64` for raw-word output. Larger widths
are rejected. Python's native and fallback batches match scalar results and state
advancement, including historical nonpositive bounds. Fixed-width ports retain
their native argument widths. Some historical invalid ranges return a sentinel
instead of raising; use keyed operations for new portable code.

Scoping does not create a new legacy stream. Different stream seeds are phase
shifts of the same cycle; they are not a guarantee of independent streams.
Neither the frozen reducer nor the new helpers promise exact uniformity for
arbitrary bounds. See [RNG analysis](RNG_ANALYSIS.md).

## Verification targets

The root suite generates native/JVM/Ruby/Go/Rust checks directly from
`tests/conformance-v1.json`; Python and JS read it directly. CI runs the complete
suite on Linux and Windows, Python 3.9/3.12/3.14, and the declared Node 18,
Rust 1.70, and Go 1.22 floors. Installed Python wheels are exercised outside the
checkout, including generic type inference and rejection of invalid typed calls.
Rust tests run from the extracted published-package layout. This is compatibility
evidence, not an external statistical-battery certification.
