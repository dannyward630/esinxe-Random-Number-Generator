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

## Scopes, sampling, and prepared choices

```csharp
var terrain = field.Scope(Esinxecs.Random.Key.String("terrain"));
var selected = terrain.Sample(new[] { "oak", "pine", "birch" }, 2,
    Esinxecs.Random.Key.U64(7));
var species = terrain.PrepareWeightedChoice(
    new[] { "oak", "pine", "birch" }, new ulong[] { 80, 18, 2 });
string tree = species.Choose(Esinxecs.Random.Key.U64(7));
```

`Scope(params Key[])` snapshots the seed and typed prefix; nested scopes append
keys. Key byte arrays and prefix arrays are copied. Helpers place their reserved
domain before the prefix. Scoped streams start independently at the captured
seed and keyed calls never advance them; reseeding one field leaves others alone.

`Sample(items, int count, params Key[])` copies the input, runs the full descending
Fisher-Yates permutation with domain `sample-v1`, then returns its first `count`
positions. Count must be in `[0, items.Count]`; invalid keys are rejected even at
zero. Duplicate values represent separate positions and changing count preserves
the permutation's prefix.

`PrepareWeightedChoice` returns `Random.PreparedWeightedChoice<T>`. It copies the
item sequence and cumulative weights, validates equal nonzero lengths and a
nonzero uint64 total, and snapshots the field. `Choose` uses binary search and
matches `WeightedChoice`, including zero weights. Weights are `ulong`; overflow
raises `OverflowException`, including in projects with checked arithmetic.
Item objects themselves are shared; collection copying is shallow.

## Test

```sh
./scripts/ci.sh
```

The root suite compiles and runs the C# conformance harness when `dotnet` is
installed. This generator is deterministic and non-cryptographic.
