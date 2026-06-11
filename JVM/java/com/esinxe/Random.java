package com.esinxe;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class Random {
    public static final long GOLDEN_GAMMA = 0x9E3779B97F4A7C15L;
    public static final long MAX_INT_VALUE = 1_000_000_000_000_000_000L;
    public static final long FNV_OFFSET_BASIS = 0xCBF29CE484222325L;
    public static final long FNV_PRIME = 0x100000001B3L;
    private static final byte[] V1_PREFIX =
        new byte[] {101, 115, 105, 110, 120, 101, 45, 118, 49, 0};
    private static final BigInteger TWO_64 = BigInteger.ONE.shiftLeft(64);

    public static final class Key {
        private final int tag;
        private final long integer;
        private final byte[] data;

        private Key(int tag, long integer, byte[] data) {
            this.tag = tag;
            this.integer = integer;
            this.data = data;
        }

        public static Key i64(long value) {
            return new Key(0x01, value, null);
        }

        public static Key u64(long bits) {
            return new Key(0x02, bits, null);
        }

        public static Key string(String value) {
            return new Key(0x03, 0, value.getBytes(StandardCharsets.UTF_8));
        }

        public static Key bytes(byte[] value) {
            return new Key(0x04, 0, Arrays.copyOf(value, value.length));
        }
    }

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

    private static BigInteger unsigned(long value) {
        BigInteger result = BigInteger.valueOf(value);
        return value < 0 ? result.add(TWO_64) : result;
    }

    private static BigInteger bounded(long value, BigInteger maxValue) {
        if (maxValue.signum() <= 0 || maxValue.compareTo(TWO_64) > 0) {
            throw new IllegalArgumentException("maxValue must be in [1, 2^64]");
        }
        if (maxValue.equals(TWO_64)) {
            return unsigned(value);
        }
        BigInteger threshold = TWO_64.subtract(maxValue).mod(maxValue);
        long current = value;
        long nonce = 0;
        while (unsigned(current).compareTo(threshold) < 0) {
            nonce++;
            current = mix64(current + nonce * GOLDEN_GAMMA);
        }
        return unsigned(current).mod(maxValue);
    }

    private static long fnvUpdate(long hash, byte[] bytes) {
        for (byte value : bytes) {
            hash = (hash ^ (value & 0xffL)) * FNV_PRIME;
        }
        return hash;
    }

    private static long fnvByte(long hash, int value) {
        return (hash ^ (value & 0xffL)) * FNV_PRIME;
    }

    private static long fnvLong(long hash, long value) {
        for (int shift = 0; shift < 64; shift += 8) {
            hash = fnvByte(hash, (int) (value >>> shift));
        }
        return hash;
    }

    private static long hashKey(long hash, Key key) {
        hash = fnvByte(hash, key.tag);
        if (key.tag == 0x01 || key.tag == 0x02) {
            return fnvLong(hash, key.integer);
        }
        hash = fnvLong(hash, key.data.length);
        return fnvUpdate(hash, key.data);
    }

    private long keyedRaw(String domain, Key... keys) {
        long hash = fnvUpdate(FNV_OFFSET_BASIS, V1_PREFIX);
        hash = fnvLong(hash, seed);
        if (domain != null) {
            byte[] bytes = domain.getBytes(StandardCharsets.US_ASCII);
            hash = fnvByte(hash, 0xF0);
            hash = fnvLong(hash, bytes.length);
            hash = fnvUpdate(hash, bytes);
        }
        for (Key component : keys) {
            hash = hashKey(hash, component);
        }
        return mix64(hash);
    }

    public long raw(Key... keys) {
        return keyedRaw(null, keys);
    }

    public long intValue(long maxValue, Key... keys) {
        if (maxValue <= 0) {
            throw new IllegalArgumentException("maxValue must be positive");
        }
        return bounded(raw(keys), maxValue);
    }

    public BigInteger intValue(BigInteger maxValue, Key... keys) {
        return bounded(raw(keys), maxValue);
    }

    public long range(long minValue, long maxValue, Key... keys) {
        if (maxValue <= minValue) {
            throw new IllegalArgumentException("maxValue must be greater than minValue");
        }
        BigInteger min = BigInteger.valueOf(minValue);
        BigInteger width = BigInteger.valueOf(maxValue).subtract(min);
        return min.add(bounded(raw(keys), width)).longValueExact();
    }

    public double float01(Key... keys) {
        return (double) (raw(keys) >>> 11) / (double) (1L << 53);
    }

    public long at2D(long x, long y, String namespace) {
        if (namespace == null) {
            return keyedRaw("at2d", Key.i64(x), Key.i64(y));
        }
        return keyedRaw("at2d", Key.i64(x), Key.i64(y), Key.string(namespace));
    }

    public long at3D(long x, long y, long z, String namespace) {
        if (namespace == null) {
            return keyedRaw("at3d", Key.i64(x), Key.i64(y), Key.i64(z));
        }
        return keyedRaw("at3d", Key.i64(x), Key.i64(y), Key.i64(z), Key.string(namespace));
    }

    public boolean chanceRatio(long numerator, long denominator, Key... keys) {
        if (denominator <= 0) {
            throw new IllegalArgumentException("denominator must be positive");
        }
        if (numerator <= 0) {
            return false;
        }
        if (numerator >= denominator) {
            return true;
        }
        return intValue(denominator, keys) < numerator;
    }

    public <T> T choose(List<T> items, Key... keys) {
        if (items.isEmpty()) {
            throw new IllegalArgumentException("items must not be empty");
        }
        return items.get((int) intValue(items.size(), keys));
    }

    public <T> List<T> shuffle(List<T> items, Key... keys) {
        List<T> values = new ArrayList<>(items);
        for (int position = values.size() - 1; position > 0; position--) {
            Key[] iterationKeys = Arrays.copyOf(keys, keys.length + 1);
            iterationKeys[keys.length] = Key.u64(position);
            int picked = (int) bounded(keyedRaw("shuffle", iterationKeys), position + 1);
            T value = values.get(position);
            values.set(position, values.get(picked));
            values.set(picked, value);
        }
        return values;
    }

    public <T> T weightedChoice(List<T> items, List<Long> weights, Key... keys) {
        if (items.isEmpty() || items.size() != weights.size()) {
            throw new IllegalArgumentException("items and weights must have the same non-zero length");
        }
        BigInteger total = BigInteger.ZERO;
        for (long weight : weights) {
            if (weight < 0) {
                throw new IllegalArgumentException("weights must be non-negative");
            }
            total = total.add(BigInteger.valueOf(weight));
        }
        if (total.signum() == 0 || total.compareTo(TWO_64) >= 0) {
            throw new IllegalArgumentException("total weight must be in [1, 2^64 - 1]");
        }
        BigInteger target = bounded(raw(keys), total);
        BigInteger running = BigInteger.ZERO;
        for (int position = 0; position < items.size(); position++) {
            running = running.add(BigInteger.valueOf(weights.get(position)));
            if (target.compareTo(running) < 0) {
                return items.get(position);
            }
        }
        throw new IllegalStateException("unreachable weighted choice");
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
