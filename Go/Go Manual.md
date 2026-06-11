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

## Test

```sh
cd Go
go test ./...
go vet ./...
```

This generator is deterministic and non-cryptographic.
