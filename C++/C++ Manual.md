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

## Scoped fields, sampling, and prepared choices

`Random::Scope(const std::vector<Key>& prefix)` returns an independent field
with a copied typed prefix and the current seed snapshot. Nested scopes
concatenate prefixes; `field.Scope(prefix).Raw(keys)` equals
`field.Raw(prefix + keys)`. Reserved helper domains precede the entire prefix.
Keys own their UTF-8 or byte payloads, so later caller-buffer or parent changes
do not affect a scope. Scope creation validates keys. Prefixes affect keyed
methods; legacy `Next*` methods retain the same seed/offset sequence. A new
scope starts its independent stream at offset zero, even if the parent has
already advanced. Creating or using a scope does not advance its parent.

```cpp
auto terrain = field.Scope({Esinxecpp::Key::Utf8("terrain")});
auto sample = terrain.Sample(std::vector<int>{0,1,2,3,4}, 3);
auto prepared = terrain.PrepareWeightedChoice(
    std::vector<std::string>{"common", "rare", "disabled"},
    std::vector<std::uint64_t>{90, 10, 0});
const auto &picked = prepared.Choose({Esinxecpp::Key::Unsigned(7)});
```

`Sample(items, count, keys = {})` returns a vector containing the first `count`
positions of the complete descending Fisher-Yates permutation under domain
`sample-v1`. It copies input, keeps duplicate positions distinct, and produces
the same full permutation regardless of count. Count is `std::size_t` and must
not exceed input length. Invalid counts and keys throw `std::invalid_argument`,
including malformed string keys supplied with count zero.

`PrepareWeightedChoice(items, weights)` returns a
`PreparedWeightedChoice<T>` that copies the item vector, cumulative uint64
weights, seed, and prefix. Nonempty equal lengths, a nonzero total, and a total
no larger than `UINT64_MAX` are required. Invalid lengths or zero total throw
`std::invalid_argument`; total overflow throws `std::overflow_error`.
`prepared.Choose(keys = {})` uses binary search and returns the exact same
item as `WeightedChoice`, including when weights contain zeros. Later changes
to source vectors or field do not affect it. Vector elements use normal C++
copy semantics (pointees of pointer-valued items are not cloned). `Choose`
returns the stored vector's `const_reference`: a reference for ordinary element
types, valid while that object and element remain alive, and a Boolean value
for `std::vector<bool>`. `Random::Choose` and `Random::WeightedChoice` follow
the same return convention for their caller-owned vectors. `Sample` and
`Shuffle` also support `std::vector<bool>`. Prepared objects own their memory and can be
copied or moved using normal C++ value semantics. Keyed helpers and prepared
choices do not advance stream state.

## Stable-ID choice

`field.StableChoice(items, ids, keys)` ranks unique UTF-8 string IDs independently.
Items and IDs must have equal nonzero lengths; an empty individual ID is valid.
Reordering preserves the winning ID. Adding an ID changes only assignments it
wins; removing a nonwinner has no effect. No stream state changes. See the
[portable helper contract](../SPEC_HELPERS_V1.md) for score and tie rules.
