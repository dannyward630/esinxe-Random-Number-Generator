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
