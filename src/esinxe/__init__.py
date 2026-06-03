"""Deterministic random-access number generator."""

import time

try:
    from . import _native
except ImportError:  # pragma: no cover - exercised when extension is not built
    _native = None


__version__ = "1.0.4"
MASK_64 = (1 << 64) - 1
UINT64_SIZE = 1 << 64
GOLDEN_GAMMA = 0x9E3779B97F4A7C15
MAX_INT_VALUE = 10**18
MAX_INT_THRESHOLD = (UINT64_SIZE - MAX_INT_VALUE) % MAX_INT_VALUE


def _mix64(value):
    value &= MASK_64
    return _mix64_masked(value)


def _mix64_masked(value):
    value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & MASK_64
    value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & MASK_64
    return (value ^ (value >> 31)) & MASK_64


def _bounded_raw(value, maxvalue):
    if maxvalue <= 0:
        return 0
    threshold = (UINT64_SIZE - maxvalue) % maxvalue
    nonce = 0
    while value < threshold:
        nonce += 1
        value = _mix64(value + (nonce * GOLDEN_GAMMA))
    return value % maxvalue


def _bounded_max_int(value):
    nonce = 0
    while value < MAX_INT_THRESHOLD:
        nonce += 1
        value = _mix64(value + (nonce * GOLDEN_GAMMA))
    return value % MAX_INT_VALUE


class Random:
    """Deterministic random-access generator.

    Next() advances through the sequence. NextAt(offset) computes any value in
    the sequence directly without generating the values before it.
    """

    __slots__ = ("seed", "index", "_key")

    def __init__(self, seed=None):
        self.seed = int(time.time_ns() if seed is None else seed) & MASK_64
        self.index = 0
        self._key = self.seed

    def SetSeed(self, localseed):
        self.seed = int(localseed) & MASK_64
        self.index = 0
        self._key = self.seed

    def _raw_at(self, offset):
        return _mix64(self.seed + (int(offset) * GOLDEN_GAMMA))

    def _bounded_at(self, offset, maxvalue):
        maxvalue = int(maxvalue)
        return _bounded_raw(self._raw_at(offset), maxvalue)

    def _range_at(self, offset, minvalue, maxvalue):
        minvalue = int(minvalue)
        maxvalue = int(maxvalue)
        if maxvalue <= minvalue:
            return None
        return minvalue + self._bounded_at(offset, maxvalue - minvalue)

    def NextAt(self, offset):
        return _bounded_max_int(self._raw_at(offset))

    def NextRawAt(self, offset):
        return self._raw_at(offset)

    def NextRaw(self):
        key = self._key
        value = _mix64_masked(key)
        self._key = (key + GOLDEN_GAMMA) & MASK_64
        self.index += 1
        return value

    def Next(self):
        key = self._key
        value = _bounded_max_int(_mix64_masked(key))
        self._key = (key + GOLDEN_GAMMA) & MASK_64
        self.index += 1
        return value

    def NextMaxAt(self, offset, maxvalue):
        return self._bounded_at(offset, maxvalue)

    def NextMax(self, maxvalue):
        key = self._key
        value = _bounded_raw(_mix64_masked(key), int(maxvalue))
        self._key = (key + GOLDEN_GAMMA) & MASK_64
        self.index += 1
        return value

    def NextMinMaxAt(self, offset, minvalue, maxvalue):
        return self._range_at(offset, minvalue, maxvalue)

    def NextMinMax(self, minvalue, maxvalue):
        minvalue = int(minvalue)
        maxvalue = int(maxvalue)
        if maxvalue <= minvalue:
            value = None
        else:
            key = self._key
            value = minvalue + _bounded_raw(_mix64_masked(key), maxvalue - minvalue)
            self._key = (key + GOLDEN_GAMMA) & MASK_64
            self.index += 1
            return value
        self._key = (self._key + GOLDEN_GAMMA) & MASK_64
        self.index += 1
        return value

    def NextList(self, length):
        length = max(0, int(length))
        if _native is not None:
            values = _native.default_list(self._key, length)
            self._key = (self._key + (GOLDEN_GAMMA * length)) & MASK_64
            self.index += length
            return values
        key = self._key
        gamma = GOLDEN_GAMMA
        mask = MASK_64
        mix = _mix64_masked
        bounded = _bounded_max_int
        values = []
        append = values.append
        for _ in range(length):
            append(bounded(mix(key)))
            key = (key + gamma) & mask
        self._key = key
        self.index += length
        return values

    def NextListMax(self, length, maxvalue):
        length = max(0, int(length))
        maxvalue = int(maxvalue)
        if _native is not None:
            values = _native.bounded_list(self._key, length, maxvalue)
            self._key = (self._key + (GOLDEN_GAMMA * length)) & MASK_64
            self.index += length
            return values
        key = self._key
        gamma = GOLDEN_GAMMA
        mask = MASK_64
        mix = _mix64_masked
        bounded = _bounded_raw
        values = []
        append = values.append
        for _ in range(length):
            append(bounded(mix(key), maxvalue))
            key = (key + gamma) & mask
        self._key = key
        self.index += length
        return values

    def NextListMinMax(self, length, minvalue, maxvalue):
        length = max(0, int(length))
        minvalue = int(minvalue)
        maxvalue = int(maxvalue)
        if maxvalue <= minvalue:
            values = [None] * length
            self._key = (self._key + (GOLDEN_GAMMA * length)) & MASK_64
            self.index += length
            return values
        width = maxvalue - minvalue
        if _native is not None:
            values = _native.bounded_list(self._key, length, width)
            self._key = (self._key + (GOLDEN_GAMMA * length)) & MASK_64
            self.index += length
            return [minvalue + value for value in values]
        key = self._key
        gamma = GOLDEN_GAMMA
        mask = MASK_64
        mix = _mix64_masked
        bounded = _bounded_raw
        values = []
        append = values.append
        for _ in range(length):
            append(minvalue + bounded(mix(key), width))
            key = (key + gamma) & mask
        self._key = key
        self.index += length
        return values


__all__ = [
    "GOLDEN_GAMMA",
    "MASK_64",
    "MAX_INT_VALUE",
    "UINT64_SIZE",
    "Random",
    "__version__",
    "_mix64",
    "_mix64_masked",
]
