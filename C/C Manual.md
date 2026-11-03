# C Port

`Esinxec1-0-0.h` contains the C99 keyed and instance APIs. Its inline functions
can be included safely from multiple translation units and depend only on the C
standard library. Compile `Esinxec1-0-0.c` as well only when using the legacy
process-wide wrappers.

## Quick Start

```c
#include "Esinxec1-0-0.h"

EsinxeKey keys[] = {
    EsinxeString("terrain"),
    EsinxeI64(-4),
    EsinxeU64(9)
};
uint64_t value = EsinxeRawV1(12345, keys, 3);
uint64_t height = EsinxeAt2DV1(12345, -4, 9, "terrain");
```

Compile an application using the legacy wrappers with:

```sh
cc -std=c11 app.c C/Esinxec1-0-0.c -o app
```

Use `EsinxeI64`, `EsinxeU64`, `EsinxeString`, and `EsinxeBytes` to build keys.
String and byte memory must remain valid for the duration of the call.
Collection helpers return indexes or shuffle caller-owned memory. Fallible
keyed functions return a success flag; index helpers return `SIZE_MAX`.

The complete v1 surface includes raw, bounded and ranged values, float output,
2D/3D coordinates, rational chance, choice, shuffle, and weighted choice.
`EsinxeRandom` and the `EsinxeNext*` functions provide the preferred compatible
stream API. Legacy global stream wrappers remain available from
`Esinxec1-0-0.c`; they share one process-wide state and are not thread-safe.

See [the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Test

The root test suite compiles the header with strict warnings in C99 mode,
checks multiple translation units, and compares the v1 vectors:

```sh
python3 -m unittest discover -s tests
```

This generator is deterministic and non-cryptographic.

## Scoped fields, sampling, and prepared choices

`EsinxeFieldV1` holds a seed and a typed prefix independently of stream state.
Initialize it with `EsinxeFieldInitV1(&field, seed)`. Create a child with
`EsinxeFieldScopeV1(&parent, keys, key_count, storage, capacity, &child)`.
`storage` must hold the entire concatenated parent and child prefix. Supply a
new buffer disjoint from both input key arrays; the function copies their key
metadata and snapshots the seed. Keep this buffer and all referenced string or
byte payloads alive and immutable for the lifetime of the child and any scopes
derived from it. C scopes borrow payloads; they do not allocate or need freeing.
Reseeding or replacing the parent field does not change a child.

```c
EsinxeFieldV1 world, terrain;
EsinxeKey prefix = EsinxeString("terrain"), storage[1];
EsinxeFieldInitV1(&world, 12345);
if (!EsinxeFieldScopeV1(&world, &prefix, 1, storage, 1, &terrain)) {
    /* Invalid keys or insufficient storage. */
}
uint64_t value = EsinxeFieldRawV1(&terrain, NULL, 0);
```

The scoped helpers are `EsinxeFieldRawV1`, `IntV1`, `RangeV1`, `Float01V1`,
`At2DV1`, `At3DV1`, `ChanceRatioV1`, `ChooseIndexV1`, `ShuffleV1`,
`SampleV1`, and `WeightedChoiceIndexV1` (each has the `EsinxeField` prefix).
Helper domains precede the stored prefix. Raw calls concatenate the stored
prefix and user keys. Integer and range calls return a success flag; choice
calls return `SIZE_MAX` on failure; chance returns `-1` on failure.
Raw, float, and coordinate calls require valid key/UTF-8 buffers, as do the
original low-level APIs. Fallible field calls validate typed keys and strict
UTF-8, including when a collection is empty or sample count is zero.

`EsinxeStringN(pointer, byte_length)` encodes an explicit-length UTF-8 string,
including embedded NUL. `EsinxeAt2DNV1` and `EsinxeAt3DNV1`, and their
`EsinxeFieldAt2DNV1`/`EsinxeFieldAt3DNV1` counterparts, also take an explicit
namespace byte length. A NULL namespace omits it (use length zero); a non-NULL
pointer with length zero supplies an empty namespace. Byte lengths exclude any
terminator; readable buffers must contain at least the stated length.

`EsinxeSampleV1(seed, source, length, item_size, count, output, keys, key_count)`
and `EsinxeFieldSampleV1(&field, ...)` copy the source, perform the complete
descending Fisher-Yates permutation under domain `sample-v1`, and copy its
first `count` elements into caller-owned output. Output must have space for
`count * item_size` bytes and be disjoint from source. Count is `size_t` and
must not exceed length; negative values converted to `size_t` are rejected
when they exceed length. Duplicate values remain distinct input positions.
These functions return zero on invalid input, size overflow, or allocation
failure; they leave source and output unchanged on failure. A zero count still
validates keys. Shuffle continues to permute caller memory in place.

`EsinxePreparedWeightedV1 prepared = {0};` creates an empty owning handle.
`EsinxePreparedWeightedInitV1(&prepared, &field, weights, length)` validates
nonempty uint64 weights with total in `[1, UINT64_MAX]`, copies cumulative
totals, and deeply copies the field prefix and payload bytes. It returns zero
on invalid input, overflow, or allocation failure, preserving an existing
prepared handle. Success replaces and frees an earlier preparation.
`EsinxePreparedWeightedChooseV1(&prepared, keys, key_count)` returns the same
index as weighted choice, using binary search and skipping zero weights.
Later field, prefix-buffer, and weight changes do not affect it. This C API
stores indexes rather than items; callers map indexes to their own collection.
Call `EsinxePreparedWeightedFreeV1(&prepared)` when finished (repeated free is
safe). Initialize before the first init/free; do not shallow-copy the owning
struct or directly alter its internals. All helpers preserve legacy streams.
