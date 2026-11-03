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

## Scopes, sampling, and prepared choices

```java
Random terrain = field.scope(Random.Key.string("terrain"));
List<String> selected = terrain.sample(Arrays.asList("oak", "pine", "birch"), 2,
    Random.Key.u64(7));
Random.PreparedWeightedChoice<String> species = terrain.prepareWeightedChoice(
    Arrays.asList("oak", "pine", "birch"), Arrays.asList(80L, 18L, 2L));
String tree = species.choose(Random.Key.u64(7));
```

```kotlin
val terrain = field.scope(Key.string("terrain"))
val selected = terrain.sample(listOf("oak", "pine", "birch"), 2, Key.u64(7UL))
val species = terrain.prepareWeightedChoice(
    listOf("oak", "pine", "birch"), listOf(80UL, 18UL, 2UL))
val tree = species.choose(Key.u64(7UL))
```

`scope` snapshots the seed and copies the typed prefix, including byte buffers;
nested scopes concatenate prefixes. Helper domains precede the prefix. Each
scoped stream starts independently at its captured seed. Reseeding a field never
changes an existing scope or prepared choice.

`sample(items, count, keys...)` accepts an `int`/`Int` count in `[0, items.size]`,
copies the list, and takes the first count positions of a full descending
Fisher-Yates permutation with domain `sample-v1`. The full permutation is
independent of count, duplicates represent distinct positions, and keys are
validated even when the requested result is empty.

`prepareWeightedChoice` copies the items and cumulative weights once and returns
`Random.PreparedWeightedChoice<T>` in Java or `PreparedWeightedChoice<T>` in
Kotlin. Its `choose` binary search matches `weightedChoice`, including zero
weights. Both validate matching nonempty sequences and total in `[1, 2^64-1]`.
Java accepts nonnegative `List<Long>` weights, each at most `Long.MAX_VALUE`,
and accumulates with `BigInteger`; Kotlin accepts `List<ULong>`. Overflow is
rejected. Collection copying is shallow: contained item objects remain shared.

## Test

```sh
./scripts/ci.sh
```

The root test runs warning-clean Java and Kotlin conformance harnesses. This
generator is deterministic and non-cryptographic.

## Stable-ID choice

`field.stableChoice(items, ids, keys) (Java), field.stableChoice(items, ids, *keys) (Kotlin)` ranks unique UTF-8 string IDs independently.
Items and IDs must have equal nonzero lengths; an empty individual ID is valid.
Reordering preserves the winning ID. Adding an ID changes only assignments it
wins; removing a nonwinner has no effect. No stream state changes. See the
[portable helper contract](../SPEC_HELPERS_V1.md) for score and tie rules.
