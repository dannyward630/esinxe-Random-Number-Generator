# C# Port

`Esinxecs1-0-0.cs` is a dependency-free source implementation for modern .NET.
Add the file to a project and use `Esinxecs.Random`.

## Quick Start

```csharp
var field = new Esinxecs.Random(12345);
ulong value = field.Raw(
    Esinxecs.Random.Key.String("terrain"),
    Esinxecs.Random.Key.I64(-4),
    Esinxecs.Random.Key.U64(9));
ulong height = field.At2D(-4, 9, "terrain");
```

Keys are created with `Key.I64`, `Key.U64`, `Key.String`, and `Key.Bytes`. The
keyed methods are `Raw`, `Int`, `Range`, `Float01`, `At2D`, `At3D`,
`ChanceRatio`, `Choose`, `Shuffle`, and `WeightedChoice`. Invalid input raises
an idiomatic .NET exception. Keyed calls do not alter stream position.

The historical `Next*` methods remain available as stream conveniences. See
[the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Test

```sh
./scripts/ci.sh
```

The root suite compiles and runs the C# conformance harness when `dotnet` is
installed. This generator is deterministic and non-cryptographic.
