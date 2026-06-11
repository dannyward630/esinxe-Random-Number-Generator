# Language Quick Starts

Every example below addresses the same v1 random field. Explicit signed and
unsigned key constructors are recommended whenever cross-language parity is a
compatibility requirement.

## Python

```python
import esinxe

field = esinxe.Random(12345)
height = field.at2D(-4, 9, "terrain")
loot = field.weightedChoice(
    ["common", "rare", "legendary"],
    [80, 18, 2],
    "loot",
    esinxe.i64(-4),
    esinxe.i64(9),
)
```

## JavaScript and TypeScript

```javascript
import { Random, i64 } from "./src/index.js";

const field = new Random(12345n);
const height = field.at2D(-4, 9, "terrain");
const loot = field.weightedChoice(
  ["common", "rare", "legendary"],
  [80, 18, 2],
  "loot", i64(-4), i64(9)
);
```

## Rust

```rust
use esinxe::{Key, Random};

let field = Random::new(12345);
let height = field.at_2d(-4, 9, Some("terrain"));
let loot = field.weighted_choice(
    &["common", "rare", "legendary"],
    &[80, 18, 2],
    &[Key::Str("loot"), Key::I64(-4), Key::I64(9)],
);
```

## Go

```go
field := esinxe.New(12345)
namespace := "terrain"
height := field.At2D(-4, 9, &namespace)
loot, err := esinxe.WeightedChoice(
    field,
    []string{"common", "rare", "legendary"},
    []uint64{80, 18, 2},
    esinxe.String("loot"), esinxe.I64(-4), esinxe.I64(9),
)
```

## Java

```java
Random field = new Random(12345L);
long height = field.at2D(-4, 9, "terrain");
String loot = field.weightedChoice(
    List.of("common", "rare", "legendary"),
    List.of(80L, 18L, 2L),
    Random.Key.string("loot"),
    Random.Key.i64(-4),
    Random.Key.i64(9));
```

## Kotlin

```kotlin
val field = EsinxeRandom(12345UL)
val height = field.at2D(-4, 9, "terrain")
val loot = field.weightedChoice(
    listOf("common", "rare", "legendary"),
    listOf(80UL, 18UL, 2UL),
    Key.string("loot"), Key.i64(-4), Key.i64(9),
)
```

## C#

```csharp
var field = new Esinxecs.Random(12345);
ulong height = field.At2D(-4, 9, "terrain");
string loot = field.WeightedChoice(
    new[] {"common", "rare", "legendary"},
    new ulong[] {80, 18, 2},
    Esinxecs.Random.Key.String("loot"),
    Esinxecs.Random.Key.I64(-4),
    Esinxecs.Random.Key.I64(9));
```

## C++

```cpp
Esinxecpp::Random field(12345);
auto keys = std::vector<Esinxecpp::Key>{
    Esinxecpp::Key::Utf8("loot"),
    Esinxecpp::Key::Signed(-4),
    Esinxecpp::Key::Signed(9),
};
auto height = field.At2D(-4, 9, "terrain");
auto loot = field.WeightedChoice(
    std::vector<std::string>{"common", "rare", "legendary"},
    std::vector<std::uint64_t>{80, 18, 2},
    keys);
```

## C

C collection helpers return an index or operate on a caller-owned array.

```c
EsinxeKey keys[] = {
    EsinxeString("loot"),
    EsinxeI64(-4),
    EsinxeI64(9)
};
uint64_t weights[] = {80, 18, 2};
uint64_t height = EsinxeAt2DV1(12345, -4, 9, "terrain");
size_t loot_index =
    EsinxeWeightedChoiceIndexV1(12345, weights, 3, keys, 3);
```

## Ruby

```ruby
field = Esinxe::Generator.new(12345)
height = field.at2D(-4, 9, "terrain")
loot = field.weightedChoice(
  %w[common rare legendary],
  [80, 18, 2],
  "loot", Esinxe.i64(-4), Esinxe.i64(9)
)
```

The historical stream APIs remain available in every port. Keyed calls are
stateless and never change the next stream value.
