# Java / Kotlin Manual

Dependencies: a JVM. Java can be compiled with `javac`; Kotlin requires
`kotlinc`.

## Java

```java
import com.esinxe.Random;

Random rng = new Random(12345L);
System.out.println(rng.next());
System.out.println(Long.toUnsignedString(rng.nextRawAt(1000L)));
```

## Kotlin

```kotlin
import com.esinxe.EsinxeRandom

val rng = EsinxeRandom(12345UL)
println(rng.next())
println(rng.nextRawAt(1000UL))
```

The Java implementation exposes raw 64-bit values as `long`; use
`Long.toUnsignedString(value)` when displaying unsigned raw values greater than
`Long.MAX_VALUE`.
