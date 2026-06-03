package com.esinxe;

public final class Random {
    public static final long GOLDEN_GAMMA = 0x9E3779B97F4A7C15L;
    public static final long MAX_INT_VALUE = 1_000_000_000_000_000_000L;

    private long seed;
    private long index;
    private long key;

    public Random(long seed) {
        setSeed(seed);
    }

    public static long mix64(long value) {
        value = (value ^ (value >>> 30)) * 0xBF58476D1CE4E5B9L;
        value = (value ^ (value >>> 27)) * 0x94D049BB133111EBL;
        return value ^ (value >>> 31);
    }

    private static long bounded(long value, long maxValue) {
        if (maxValue <= 0) {
            return 0;
        }
        long threshold = Long.remainderUnsigned(-maxValue, maxValue);
        long nonce = 0;
        while (Long.compareUnsigned(value, threshold) < 0) {
            nonce++;
            value = mix64(value + nonce * GOLDEN_GAMMA);
        }
        return Long.remainderUnsigned(value, maxValue);
    }

    public void setSeed(long seed) {
        this.seed = seed;
        this.index = 0;
        this.key = seed;
    }

    public void SetSeed(long seed) {
        setSeed(seed);
    }

    public long nextRawAt(long offset) {
        return mix64(seed + offset * GOLDEN_GAMMA);
    }

    public long NextRawAt(long offset) {
        return nextRawAt(offset);
    }

    public long nextRaw() {
        long value = mix64(key);
        key += GOLDEN_GAMMA;
        index++;
        return value;
    }

    public long NextRaw() {
        return nextRaw();
    }

    public long nextAt(long offset) {
        return bounded(nextRawAt(offset), MAX_INT_VALUE);
    }

    public long NextAt(long offset) {
        return nextAt(offset);
    }

    public long next() {
        long value = bounded(mix64(key), MAX_INT_VALUE);
        key += GOLDEN_GAMMA;
        index++;
        return value;
    }

    public long Next() {
        return next();
    }

    public long nextMaxAt(long offset, long maxValue) {
        return bounded(nextRawAt(offset), maxValue);
    }

    public long NextMaxAt(long offset, long maxValue) {
        return nextMaxAt(offset, maxValue);
    }

    public long nextMax(long maxValue) {
        long value = bounded(mix64(key), maxValue);
        key += GOLDEN_GAMMA;
        index++;
        return value;
    }

    public long NextMax(long maxValue) {
        return nextMax(maxValue);
    }

    public long nextMinMaxAt(long offset, long minValue, long maxValue) {
        if (maxValue <= minValue) {
            return minValue;
        }
        return minValue + nextMaxAt(offset, maxValue - minValue);
    }

    public long NextMinMaxAt(long offset, long minValue, long maxValue) {
        return nextMinMaxAt(offset, minValue, maxValue);
    }

    public long nextMinMax(long minValue, long maxValue) {
        long value = minValue;
        if (maxValue > minValue) {
            value = minValue + bounded(mix64(key), maxValue - minValue);
        }
        key += GOLDEN_GAMMA;
        index++;
        return value;
    }

    public long NextMinMax(long minValue, long maxValue) {
        return nextMinMax(minValue, maxValue);
    }
}
