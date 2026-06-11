package com.esinxe

const val GOLDEN_GAMMA: ULong = 0x9E3779B97F4A7C15UL
const val MAX_INT_VALUE: ULong = 1_000_000_000_000_000_000UL
const val FNV_OFFSET_BASIS: ULong = 0xCBF29CE484222325UL
const val FNV_PRIME: ULong = 0x100000001B3UL

private val v1Prefix = byteArrayOf(101, 115, 105, 110, 120, 101, 45, 118, 49, 0)

sealed class Key {
    data class I64(val value: Long) : Key()
    data class U64(val value: ULong) : Key()
    data class StringValue(val value: String) : Key()
    data class BytesValue(val value: ByteArray) : Key()

    companion object {
        fun i64(value: Long): Key = I64(value)
        fun u64(value: ULong): Key = U64(value)
        fun string(value: String): Key = StringValue(value)
        fun bytes(value: ByteArray): Key = BytesValue(value.copyOf())
    }
}

fun mix64(input: ULong): ULong {
    var value = input
    value = (value xor (value shr 30)) * 0xBF58476D1CE4E5B9UL
    value = (value xor (value shr 27)) * 0x94D049BB133111EBUL
    return value xor (value shr 31)
}

private fun bounded(initial: ULong, maxValue: ULong): ULong {
    require(maxValue > 0UL) { "maxValue must be positive" }
    val threshold = (0UL - maxValue) % maxValue
    var value = initial
    var nonce = 0UL
    while (value < threshold) {
        nonce += 1UL
        value = mix64(value + nonce * GOLDEN_GAMMA)
    }
    return value % maxValue
}

private fun fnvUpdate(initial: ULong, data: ByteArray): ULong {
    var hash = initial
    for (value in data) {
        hash = (hash xor value.toUByte().toULong()) * FNV_PRIME
    }
    return hash
}

private fun fnvByte(hash: ULong, value: Int): ULong =
    (hash xor value.toULong()) * FNV_PRIME

private fun fnvULong(initial: ULong, value: ULong): ULong {
    var hash = initial
    for (shift in 0 until 64 step 8) {
        hash = fnvByte(hash, ((value shr shift) and 0xffUL).toInt())
    }
    return hash
}

private fun hashKey(initial: ULong, key: Key): ULong {
    return when (key) {
        is Key.I64 -> fnvULong(fnvByte(initial, 0x01), key.value.toULong())
        is Key.U64 -> fnvULong(fnvByte(initial, 0x02), key.value)
        is Key.StringValue -> {
            val data = key.value.encodeToByteArray()
            fnvUpdate(fnvULong(fnvByte(initial, 0x03), data.size.toULong()), data)
        }
        is Key.BytesValue ->
            fnvUpdate(
                fnvULong(fnvByte(initial, 0x04), key.value.size.toULong()),
                key.value,
            )
    }
}

class EsinxeRandom(seed: ULong) {
    private var seed: ULong = seed
    private var index: ULong = 0UL
    private var key: ULong = seed

    private fun keyedRaw(keys: Array<out Key>, domain: String? = null): ULong {
        var hash = fnvUpdate(FNV_OFFSET_BASIS, v1Prefix)
        hash = fnvULong(hash, seed)
        if (domain != null) {
            val data = domain.encodeToByteArray()
            hash = fnvByte(hash, 0xF0)
            hash = fnvULong(hash, data.size.toULong())
            hash = fnvUpdate(hash, data)
        }
        for (component in keys) {
            hash = hashKey(hash, component)
        }
        return mix64(hash)
    }

    fun raw(vararg keys: Key): ULong = keyedRaw(keys)

    fun int(maxValue: ULong, vararg keys: Key): ULong =
        bounded(raw(*keys), maxValue)

    fun range(minValue: Long, maxValue: Long, vararg keys: Key): Long {
        require(maxValue > minValue) { "maxValue must be greater than minValue" }
        val width = maxValue.toULong() - minValue.toULong()
        return (minValue.toULong() + bounded(raw(*keys), width)).toLong()
    }

    fun float01(vararg keys: Key): Double =
        (raw(*keys) shr 11).toDouble() / 9_007_199_254_740_992.0

    fun at2D(x: Long, y: Long, namespace: String? = null): ULong {
        val keys = mutableListOf<Key>(Key.i64(x), Key.i64(y))
        if (namespace != null) keys.add(Key.string(namespace))
        return keyedRaw(keys.toTypedArray(), "at2d")
    }

    fun at3D(x: Long, y: Long, z: Long, namespace: String? = null): ULong {
        val keys = mutableListOf<Key>(Key.i64(x), Key.i64(y), Key.i64(z))
        if (namespace != null) keys.add(Key.string(namespace))
        return keyedRaw(keys.toTypedArray(), "at3d")
    }

    fun chanceRatio(numerator: Long, denominator: Long, vararg keys: Key): Boolean {
        require(denominator > 0) { "denominator must be positive" }
        if (numerator <= 0) return false
        if (numerator >= denominator) return true
        return int(denominator.toULong(), *keys) < numerator.toULong()
    }

    fun <T> choose(items: List<T>, vararg keys: Key): T {
        require(items.isNotEmpty()) { "items must not be empty" }
        return items[int(items.size.toULong(), *keys).toInt()]
    }

    fun <T> shuffle(items: List<T>, vararg keys: Key): List<T> {
        val values = items.toMutableList()
        for (position in values.lastIndex downTo 1) {
            val iterationKeys = keys.toMutableList()
            iterationKeys.add(Key.u64(position.toULong()))
            val picked = bounded(
                keyedRaw(iterationKeys.toTypedArray(), "shuffle"),
                (position + 1).toULong(),
            ).toInt()
            val value = values[position]
            values[position] = values[picked]
            values[picked] = value
        }
        return values
    }

    fun <T> weightedChoice(
        items: List<T>,
        integerWeights: List<ULong>,
        vararg keys: Key,
    ): T {
        require(items.isNotEmpty() && items.size == integerWeights.size) {
            "items and weights must have the same non-zero length"
        }
        var total = 0UL
        for (weight in integerWeights) {
            val next = total + weight
            require(next >= total) { "total weight exceeds uint64" }
            total = next
        }
        require(total > 0UL) { "total weight must be positive" }
        val target = int(total, *keys)
        var running = 0UL
        for (position in items.indices) {
            running += integerWeights[position]
            if (target < running) return items[position]
        }
        error("unreachable weighted choice")
    }

    fun setSeed(seed: ULong) {
        this.seed = seed
        index = 0UL
        key = seed
    }

    fun nextRawAt(offset: ULong): ULong = mix64(seed + offset * GOLDEN_GAMMA)

    fun nextRaw(): ULong {
        val value = mix64(key)
        key += GOLDEN_GAMMA
        index += 1UL
        return value
    }

    fun nextAt(offset: ULong): ULong = bounded(nextRawAt(offset), MAX_INT_VALUE)

    fun next(): ULong {
        val value = bounded(mix64(key), MAX_INT_VALUE)
        key += GOLDEN_GAMMA
        index += 1UL
        return value
    }

    fun nextMaxAt(offset: ULong, maxValue: ULong): ULong =
        bounded(nextRawAt(offset), maxValue)

    fun nextMax(maxValue: ULong): ULong {
        val value = bounded(mix64(key), maxValue)
        key += GOLDEN_GAMMA
        index += 1UL
        return value
    }

    fun nextMinMaxAt(offset: ULong, minValue: ULong, maxValue: ULong): ULong? {
        if (maxValue <= minValue) return null
        return minValue + nextMaxAt(offset, maxValue - minValue)
    }

    fun nextMinMax(minValue: ULong, maxValue: ULong): ULong? {
        val value =
            if (maxValue <= minValue) null
            else minValue + bounded(mix64(key), maxValue - minValue)
        key += GOLDEN_GAMMA
        index += 1UL
        return value
    }
}
