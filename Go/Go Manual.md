# Go Port

The module under `Go/` targets Go 1.22 or newer. The package import path is
`github.com/dannyward630/esinxe-Random-Number-Generator/Go/esinxe`.

## Quick Start

```go
field := esinxe.New(12345)
value := field.Raw(
    esinxe.String("terrain"),
    esinxe.I64(-4),
    esinxe.U64(9),
)
namespace := "terrain"
height := field.At2D(-4, 9, &namespace)
```

Use `I64`, `U64`, `String`, and `Bytes` to construct keys. Methods returning
validation errors use `(value, error)`. Generic `Choose`, `Shuffle`, and
`WeightedChoice` functions accept the field as their first argument.

The complete keyed API also includes `Int`, `Range`, `Float01`, `At3D`, and
`ChanceRatio`; keyed calls never alter stream state. `Next*` methods provide
the compatible stream API.

See [the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Scoped fields, sampling, and prepared weights

```go
terrain := field.Scope(esinxe.String("world"), esinxe.Bytes([]byte{1, 2}))
locations, err := esinxe.Sample(terrain, []string{"hill", "lake", "wood"}, 2, esinxe.String("region"))
encounters, err := esinxe.PrepareWeightedChoice(terrain, []string{"common", "rare"}, []uint64{80, 20})
encounter := encounters.Choose(esinxe.String("tile"), esinxe.I64(-4))
```

`Scope(prefix...)` snapshots the seed and copies typed prefix data. Nested
prefixes concatenate; raw calls equal the parent raw call with keys prepended.
Helper domains precede prefixes. Reseeding either field cannot change the
other, and each scope has an independent stream starting at offset zero.
Prefixes affect only keyed calls.

`Sample[T](field, items, count, keys...) ([]T, error)` copies the items, then
performs descending Fisher-Yates using `sample-v1` and returns the first count
positions. Count must be in `[0,len(items)]` and does not affect the full
permutation. Duplicate values occupy distinct positions. Invalid keys panic
even with count zero, matching the existing key-validation behavior.

`PrepareWeightedChoice[T](field, items, weights)` returns
`(*PreparedWeightedChoice[T], error)`. It copies both sequences into owned
items and cumulative weights, snapshots the field, and validates equal nonzero
lengths and a nonzero uint64 total with checked addition. Its `Choose(keys...)
T` method performs binary search and exactly matches `WeightedChoice`,
including zero weights. Generic APIs are top-level functions where Go methods
cannot introduce type parameters. Item copies use ordinary Go assignment;
objects referenced by item values remain shared. These keyed operations never
advance a stream and add no runtime dependencies.

## Test

```sh
cd Go
go test ./...
go vet ./...
```

This generator is deterministic and non-cryptographic.

## Stable-ID choice

`esinxe.StableChoice(field, items, ids, keys...)` ranks unique UTF-8 string IDs independently.
Items and IDs must have equal nonzero lengths; an empty individual ID is valid.
Reordering preserves the winning ID. Adding an ID changes only assignments it
wins; removing a nonwinner has no effect. No stream state changes. See the
[portable helper contract](../SPEC_HELPERS_V1.md) for score and tie rules.
