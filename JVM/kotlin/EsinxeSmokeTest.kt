import com.esinxe.EsinxeRandom

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
}
