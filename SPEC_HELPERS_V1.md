# Portable keyed helpers, revision 1

This additive specification uses [algorithm v1](SPEC_V1.md) unchanged. It defines
new public conveniences without altering any existing key encoding, mixer,
retry rule, helper result, stream, or frozen vector. The machine-readable cases
are [tests/conformance-v1.json](tests/conformance-v1.json); their independent
byte-level oracle is [scripts/generate_conformance.py](scripts/generate_conformance.py).

## Scoped fields

A field contains a uint64 seed and a sequence of typed prefix components.
An ordinary field has an empty prefix. `scope(prefix...)` creates an independent
field with the same seed and the existing prefix followed by the new components.
Nested scoping concatenates component sequences; it never hashes the prefix into
a new seed. Invalid components are rejected during scope construction.

`field.scope(a, b).raw(c)` MUST equal `field.raw(a, b, c)`. The same prefix
applies to bounded values, ranges, probabilities, choices, and weighted choices.
For coordinate and permutation helpers, the reserved domain precedes the entire
prefix: `domain || prefix || helper/user components`. This placement is part of
the contract. A namespace omitted from a coordinate call remains different from
an explicitly empty namespace.

Seed and prefix are snapshots. Later parent reseeding cannot change a child.
Mutable byte components are copied. C's low-level field instead borrows explicitly
documented immutable payload storage from the caller and copies key metadata into
caller-supplied storage. Its prepared table owns a deep prefix snapshot.

Scopes affect keyed operations only. Legacy streams still use the field's seed
and offset, so a newly scoped field's stream matches a fresh unscoped generator
with the same seed. A scoped generator can be reseeded independently while
retaining its prefix.

## Sampling without replacement

`sample(items, count, key...)` accepts an integer count in `[0, length]`.
Copy the collection and perform descending Fisher-Yates from `i = length - 1`
through `1`. For each iteration compute the bounded value with bound `i + 1`
from this message:

```text
reserved domain "sample-v1"
scope prefix components
caller key components
unsigned uint64 i
```

Swap positions `i` and the selected position. Return the first `count` elements
of the resulting permutation. The domain encoding uses the existing reserved
`f0 || uint64_le(length) || ASCII` format. It differs from `shuffle` so the two
helpers have independently addressed outcomes.

All counts for a given field/key share the same permutation: requesting two
elements equals taking the first two of the full-length sample. Input order is
unchanged. Equal input values occupy distinct positions and can both appear.
Zero count is valid, including for an empty collection; it still validates all
key components. Negative, oversized, fractional, and boolean counts are invalid
where those values can be represented by the port's count argument.

The simple full-permutation implementation takes O(n) storage and swaps. This
revision does not promise O(count) work or statistical independence.

## Prepared weighted choices

`prepareWeightedChoice(items, integerWeights)` validates the same nonzero equal
lengths, nonnegative weights, and total in `[1, 2^64 - 1]` as `weightedChoice`.
It snapshots the field seed/prefix, item sequence, and cumulative integer totals.
Element objects are shallowly copied; their identity or mutable contents are not
deeply frozen. Java retains its signed-long individual-weight input boundary.

`prepared.choose(key...)` computes `field.int(total, key...)` using that field
snapshot and returns the first item whose cumulative total is strictly greater
than the target. Use upper-bound binary search, including repeated totals from
zero weights. Every valid selection MUST equal `weightedChoice` on the original
field and sequences; preparation introduces no new randomness domain.

Preparation takes O(n) space/time; each selection searches O(log n) totals in
addition to the existing key hash. Calls never change any stream position.

C exposes an index-based table rather than storing opaque application objects.
Initialize its owning handle to zero, prepare/free according to the C manual,
and do not shallow-copy an owning handle. Lengths and tags in low-level C remain
caller preconditions; index helpers return `SIZE_MAX` on errors.

## Stable-ID choice

`stableChoice(items, ids, key...)` implements unweighted rendezvous selection.
Item and ID lists must have equal nonzero lengths. IDs are unique strict UTF-8
strings; an individual empty string is valid. Strings are compared and encoded
without Unicode normalization. Equal item values may have distinct IDs.

For each ID, compute the existing v1 hash/mix with this message:

```text
reserved domain "stable-choice-v1"
scope prefix components
caller key components
candidate ID as a string component
```

The greatest unsigned uint64 score wins. Exact score ties choose the smallest
ID by lexicographic UTF-8 byte order. Validate every ID and key, including for a
singleton list. Calls do not advance the stream. The shared independent oracle
and fixtures are `scripts/generate_stable_choice_vectors.py` and
`tests/stable-choice-v1.json`.

Reordering candidates preserves the winning ID. Adding a candidate changes only
assignments won by that new ID. Removing a nonwinner has no effect; removing the
winner promotes the highest-ranked remaining ID. Changing a candidate's ID is a
removal plus addition. Ordinary `choose` and `weightedChoice` keep their existing
semantics. No weighting or exact uniformity guarantee is introduced here.

Selection hashes every candidate (linear ranking work); C and C++ use quadratic
duplicate validation. For very large candidate sets, consider an application
index or a dedicated placement system rather than repeatedly scanning them.

## Python keyed batches

Python's `rawBatch(rows)` is an optional acceleration convenience. Each row is an
iterable of key components; text or bytes alone is not a row. It eagerly encodes
all rows and returns the corresponding `raw(*row)` values in order. Mutable byte
components are copied before advancing the input iterator. The scope prefix is
encoded once; native and fallback paths return identical v1 values and leave the
stream position unchanged. The complete encoded input and output occupy memory,
so callers should bound batch size. Other ports do not promise a batch API.

## Encoding and conformance

Strings are strict Unicode encoded as UTF-8. Valid embedded NUL characters are
part of the key, not terminators. C's `EsinxeStringN` and explicit-length namespace
helpers expose that encoding directly; the historical `EsinxeString` remains a
NUL-terminated convenience. Byte keys are distinct from string keys.

The new corpus includes multiple seeds, signed/unsigned limits, non-BMP Unicode,
empty string/bytes, embedded NUL namespaces, absent versus empty namespaces,
nested prefixes, zero weights, and bounds requiring multiple rejection retries.
All ten ports consume the same expectations. Invalid-input cases are exercised
where their native argument types can represent them; the per-port boundaries
are listed in [the capability matrix](docs/CAPABILITIES.md).
