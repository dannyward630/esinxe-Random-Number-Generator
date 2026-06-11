import com.esinxe.Random;
import java.util.Arrays;

public final class EsinxeSmokeTest {
    private static final long[] FIRST = {
        540659726606785873L,
        454886589211414944L,
        778200017661327597L,
        205171434679333405L,
        248800117070709450L,
    };

    private static final String[] RAW = {
        "17540659726606785873",
        "2454886589211414944",
        "3778200017661327597",
        "2205171434679333405",
        "3248800117070709450",
    };

    public static void main(String[] args) {
        Random rng = new Random(12345L);
        for (int i = 0; i < FIRST.length; i++) {
            assertEquals(FIRST[i], rng.next(), "next " + i);
        }

        rng.setSeed(12345L);
        for (int i = 0; i < RAW.length; i++) {
            assertEquals(RAW[i], Long.toUnsignedString(rng.nextRawAt(i)), "raw " + i);
        }

        rng.setSeed(12345L);
        long[] bounded = {73, 44, 97, 5, 50};
        for (int i = 0; i < bounded.length; i++) {
            assertEquals(bounded[i], rng.nextMax(100), "bounded " + i);
        }

        rng.setSeed(12345L);
        long[] ranged = {73, 94, 97, 55, 50};
        for (int i = 0; i < ranged.length; i++) {
            assertEquals(ranged[i], rng.nextMinMax(50, 100), "ranged " + i);
        }

        Random.Key[] key = {
            Random.Key.i64(-1),
            Random.Key.u64(-1L),
            Random.Key.string("snowman \u2603"),
            Random.Key.bytes(new byte[] {0, 1, (byte) 255}),
        };
        rng.setSeed(12345L);
        long expectedNext = rng.nextRawAt(0);
        assertEquals("1011603955933495094", Long.toUnsignedString(rng.raw()), "raw empty");
        assertEquals(
            "8375777008512348728",
            Long.toUnsignedString(rng.raw(Random.Key.i64(1))),
            "raw signed");
        assertEquals(
            "3036097878260785046",
            Long.toUnsignedString(rng.raw(Random.Key.u64(1))),
            "raw unsigned");
        assertEquals("12374036822843504307", Long.toUnsignedString(rng.raw(key)), "raw mixed");
        assertEquals(6042010167404054L, rng.raw(key) >>> 11, "float upper 53 bits");
        assertEquals(7, rng.intValue(100, key), "keyed int");
        assertEquals(-193, rng.range(-500, 500, key), "keyed range");
        assertEquals(
            "7642296274646480051",
            Long.toUnsignedString(rng.at2D(-17, 42, "terrain/\u96ea")),
            "at2D");
        assertEquals(
            "12949904772278389126",
            Long.toUnsignedString(rng.at2D(-17, 42, null)),
            "at2D no namespace");
        assertEquals(
            "3469495484090590785",
            Long.toUnsignedString(rng.at3D(-17, 42, Long.MIN_VALUE, "caves")),
            "at3D");
        if (rng.chanceRatio(7, 23, key)) {
            throw new AssertionError("chance ratio vector failed");
        }
        assertEquals(
            "ocean",
            rng.choose(Arrays.asList("forest", "desert", "tundra", "ocean"), key),
            "choose");
        assertEquals(
            "[forest, ocean, tundra, desert]",
            rng.shuffle(Arrays.asList("forest", "desert", "tundra", "ocean"), key).toString(),
            "shuffle");
        assertEquals(
            "common",
            rng.weightedChoice(
                Arrays.asList("common", "rare", "legendary"),
                Arrays.asList(80L, 18L, 2L),
                key),
            "weighted");
        assertEquals(expectedNext, rng.nextRaw(), "keyed calls do not advance");
    }

    private static void assertEquals(long expected, long actual, String label) {
        if (expected != actual) {
            throw new AssertionError(label + ": got " + actual + ", want " + expected);
        }
    }

    private static void assertEquals(String expected, String actual, String label) {
        if (!expected.equals(actual)) {
            throw new AssertionError(label + ": got " + actual + ", want " + expected);
        }
    }
}
