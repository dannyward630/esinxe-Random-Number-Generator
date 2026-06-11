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

## Test

```sh
ruby -c Ruby/Esinxeruby1-0-0.rb
python3 -m unittest discover -s tests
```

This generator is deterministic and non-cryptographic.
