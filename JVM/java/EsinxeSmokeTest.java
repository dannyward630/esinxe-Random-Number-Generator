import com.esinxe.Random;

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
