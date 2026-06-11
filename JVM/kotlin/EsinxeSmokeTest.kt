import com.esinxe.EsinxeRandom
import com.esinxe.Key

fun main() {
    val first = listOf(
        540659726606785873UL,
        454886589211414944UL,
        778200017661327597UL,
        205171434679333405UL,
        248800117070709450UL,
    )
    val raw = listOf(
        "17540659726606785873",
        "2454886589211414944",
        "3778200017661327597",
        "2205171434679333405",
        "3248800117070709450",
    )

    val rng = EsinxeRandom(12345UL)
    first.forEachIndexed { index, expected ->
        check(rng.next() == expected) { "next $index failed" }
    }

    rng.setSeed(12345UL)
    raw.forEachIndexed { index, expected ->
        check(rng.nextRawAt(index.toULong()).toString() == expected) { "raw $index failed" }
    }

    rng.setSeed(12345UL)
    listOf(73UL, 44UL, 97UL, 5UL, 50UL).forEachIndexed { index, expected ->
        check(rng.nextMax(100UL) == expected) { "bounded $index failed" }
    }

    rng.setSeed(12345UL)
    listOf(73UL, 94UL, 97UL, 55UL, 50UL).forEachIndexed { index, expected ->
        check(rng.nextMinMax(50UL, 100UL) == expected) { "ranged $index failed" }
    }

    val key = arrayOf(
        Key.i64(-1),
        Key.u64(ULong.MAX_VALUE),
        Key.string("snowman \u2603"),
        Key.bytes(byteArrayOf(0, 1, -1)),
    )
    rng.setSeed(12345UL)
    val expectedNext = rng.nextRawAt(0UL)
    check(rng.raw() == 1011603955933495094UL)
    check(rng.raw(Key.i64(1)) == 8375777008512348728UL)
    check(rng.raw(Key.u64(1UL)) == 3036097878260785046UL)
    check(rng.raw(*key) == 12374036822843504307UL)
    check((rng.raw(*key) shr 11) == 6042010167404054UL)
    check(rng.int(100UL, *key) == 7UL)
    check(rng.range(-500, 500, *key) == -193L)
    check(rng.at2D(-17, 42, "terrain/\u96ea") == 7642296274646480051UL)
    check(rng.at2D(-17, 42) == 12949904772278389126UL)
    check(rng.at3D(-17, 42, Long.MIN_VALUE, "caves") == 3469495484090590785UL)
    check(!rng.chanceRatio(7, 23, *key))
    check(rng.choose(listOf("forest", "desert", "tundra", "ocean"), *key) == "ocean")
    check(
        rng.shuffle(listOf("forest", "desert", "tundra", "ocean"), *key) ==
            listOf("forest", "ocean", "tundra", "desert"),
    )
    check(
        rng.weightedChoice(
            listOf("common", "rare", "legendary"),
            listOf(80UL, 18UL, 2UL),
            *key,
        ) == "common",
    )
    check(rng.nextRaw() == expectedNext) { "keyed calls advanced the stream" }
}
