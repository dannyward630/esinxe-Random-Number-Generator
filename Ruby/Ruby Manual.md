# Ruby Port

`Esinxeruby1-0-0.rb` has no external dependencies. The primary type is
`Esinxe::Generator`; it deliberately avoids replacing Ruby's built-in
`Random`.

## Quick Start

```ruby
require_relative "Esinxeruby1-0-0"

field = Esinxe::Generator.new(12_345)
value = field.raw("terrain", Esinxe.i64(-4), Esinxe.u64(9))
height = field.at2D(-4, 9, "terrain")
```

Plain integers are inferred as signed when negative and unsigned otherwise.
Use `Esinxe.i64`, `Esinxe.u64`, and `Esinxe.bytes` for explicit key types.
Strings encode as UTF-8 keys.

The keyed methods are `raw`, `int`, `range`, `float01`, `at2D`, `at3D`,
`chanceRatio`, `choose`, `shuffle`, and `weightedChoice`. Invalid keyed inputs
raise Ruby exceptions and keyed calls never advance the stream.

The historical `Next`, `NextRaw`, and `NextArray` overloads remain available
for stream and offset access. See [the shared API reference](../docs/API.md)
and [the frozen algorithm specification](../SPEC_V1.md).

## Scopes, sampling, and prepared choices

```ruby
terrain = field.scope("terrain")
selected = terrain.sample(["oak", "pine", "birch"], 2, Esinxe.u64(7))
species = terrain.prepare_weighted_choice(["oak", "pine", "birch"], [80, 18, 2])
tree = species.choose(Esinxe.u64(7))
```

`scope(*keys)` snapshots the seed and typed prefix. Nested scopes concatenate
prefixes, and mutable strings and byte keys are copied through canonical
encoding. Helper domains precede the prefix. Each scoped stream begins at the
captured seed independently; reseeding one generator leaves other scopes and
prepared choices unchanged.

`sample(items, count, *keys)` requires an Integer count in `[0, items.length]`.
It copies the input and returns the first count positions of a full descending
Fisher-Yates permutation with domain `sample-v1`. Changing count preserves the
permutation's prefix. Duplicate values represent separate positions. Keys are
validated even when count is zero.

`prepare_weighted_choice(items, integer_weights)` returns an
`Esinxe::PreparedWeightedChoice`. It copies both sequences, validates matching
nonzero lengths, nonnegative Integer weights, and total in `[1, 2^64-1]` once.
`choose(*keys)` uses binary search and matches `weightedChoice`, including zero
weights. Contained item objects remain shared; sequence copying is shallow.

## Test

```sh
ruby -c Ruby/Esinxeruby1-0-0.rb
python3 -m unittest discover -s tests
```

This generator is deterministic and non-cryptographic.
