package com.esinxe

const val GOLDEN_GAMMA: ULong = 0x9E3779B97F4A7C15UL
const val MAX_INT_VALUE: ULong = 1_000_000_000_000_000_000UL

fun mix64(input: ULong): ULong {
    var value = input
    value = (value xor (value shr 30)) * 0xBF58476D1CE4E5B9UL
    value = (value xor (value shr 27)) * 0x94D049BB133111EBUL
    return value xor (value shr 31)
}

private fun bounded(initial: ULong, maxValue: ULong): ULong {
    if (maxValue == 0UL) return 0UL

    val threshold = (0UL - maxValue) % maxValue
    var value = initial
    var nonce = 0UL
    while (value < threshold) {
        nonce += 1UL
        value = mix64(value + nonce * GOLDEN_GAMMA)
    }
    return value % maxValue
}

class EsinxeRandom(seed: ULong) {
    private var seed: ULong = seed
    private var index: ULong = 0UL
    private var key: ULong = seed

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

    fun nextMaxAt(offset: ULong, maxValue: ULong): ULong = bounded(nextRawAt(offset), maxValue)

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
        val value = if (maxValue <= minValue) null else minValue + bounded(mix64(key), maxValue - minValue)
        key += GOLDEN_GAMMA
        index += 1UL
        return value
    }
}
