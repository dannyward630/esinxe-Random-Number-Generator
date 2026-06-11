# Java and Kotlin Ports

The `JVM/` directory contains dependency-free source ports. Java uses signed
`long` bit patterns for uint64 values; use `Long.toUnsignedString` when
displaying raw values above `Long.MAX_VALUE`. Kotlin uses `ULong`.

## Java

```java
import com.esinxe.Random;

Random field = new Random(12345L);
long value = field.raw(
    Random.Key.string("terrain"),
    Random.Key.i64(-4),
    Random.Key.u64(9));
long height = field.at2D(-4, 9, "terrain");
```

## Kotlin

```kotlin
import com.esinxe.EsinxeRandom
import com.esinxe.Key

val field = EsinxeRandom(12345UL)
val value = field.raw(Key.string("terrain"), Key.i64(-4), Key.u64(9UL))
val height = field.at2D(-4, 9, "terrain")
```

Both ports expose explicit signed, unsigned, UTF-8 string, and byte keys. Their
keyed APIs include raw, bounded and ranged integers, float output, 2D/3D
coordinates, rational chance, choice, shuffle, and weighted choice. Invalid
inputs raise standard JVM exceptions and keyed calls do not alter stream state.
The `next*` methods and Java `Next*` aliases retain the compatible stream API.

See [the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Test

```sh
./scripts/ci.sh
```

The root test runs warning-clean Java and Kotlin conformance harnesses. This
generator is deterministic and non-cryptographic.
