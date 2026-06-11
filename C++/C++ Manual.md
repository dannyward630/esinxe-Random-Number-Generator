# C++ Port

`Esinxecpp1-0-0.h` is a C++17, header-only implementation using only the
standard library.

## Quick Start

```cpp
#include "Esinxecpp1-0-0.h"

Esinxecpp::Random field(12345);
std::vector<Esinxecpp::Key> keys{
    Esinxecpp::Key::Utf8("terrain"),
    Esinxecpp::Key::Signed(-4),
    Esinxecpp::Key::Unsigned(9)
};
auto value = field.Raw(keys);
auto height = field.At2D(-4, 9, "terrain");
```

`Key::Signed`, `Key::Unsigned`, `Key::Utf8`, and `Key::Bytes` make key types
explicit. The keyed methods are `Raw`, `Int`, `Range`, `Float01`, `At2D`,
`At3D`, `ChanceRatio`, `Choose`, `Shuffle`, and `WeightedChoice`. Invalid input
raises a standard exception. Collection-returning methods produce copies, and
keyed calls do not change stream state.

The historical `Next*` methods remain as compatible stream conveniences. See
[the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Test

```sh
python3 -m unittest discover -s tests
```

The root tests compile with C++17 and strict warnings. This generator is
deterministic and non-cryptographic.
