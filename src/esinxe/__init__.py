"""Versioned deterministic random fields and compatible stream generation."""

import time
from dataclasses import dataclass
from operator import index as integer_index

try:
    from . import _native
except ImportError:  # pragma: no cover - exercised when extension is not built
    _native = None


__version__ = "1.1.0"
MASK_64 = (1 << 64) - 1
UINT64_SIZE = 1 << 64
GOLDEN_GAMMA = 0x9E3779B97F4A7C15
MAX_INT_VALUE = 10**18
MAX_INT_THRESHOLD = (UINT64_SIZE - MAX_INT_VALUE) % MAX_INT_VALUE
FNV_OFFSET_BASIS = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3
V1_PREFIX = b"esinxe-v1\0"


@dataclass(frozen=True)
class Signed:
    """An explicitly signed 64-bit structured-key component."""

    value: int

    def __post_init__(self):
        value = _require_int(self.value, "signed key component")
        if not -(1 << 63) <= value < (1 << 63):
            raise ValueError("signed key components must fit in int64")
        object.__setattr__(self, "value", value)


@dataclass(frozen=True)
class Unsigned:
    """An explicitly unsigned 64-bit structured-key component."""

    value: int

    def __post_init__(self):
        value = _require_int(self.value, "unsigned key component")
        if not 0 <= value <= MASK_64:
            raise ValueError("unsigned key components must fit in uint64")
        object.__setattr__(self, "value", value)


def _require_int(value, name):
    if isinstance(value, bool):
        raise TypeError(f"{name} must be an integer, not bool")
    try:
        return integer_index(value)
    except TypeError as error:
        raise TypeError(f"{name} must be an integer") from error


def i64(value):
    return Signed(value)


def u64(value):
    return Unsigned(value)


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


def _fnv1a_update(hash_value, data):
    for byte in data:
        hash_value ^= byte
        hash_value = (hash_value * FNV_PRIME) & MASK_64
    return hash_value


def _le64(value):
    return (int(value) & MASK_64).to_bytes(8, "little")


def _encode_component(component):
    if isinstance(component, Signed):
        return b"\x01" + _le64(component.value)
    if isinstance(component, Unsigned):
        return b"\x02" + _le64(component.value)
    if isinstance(component, bool):
        raise TypeError("bool is not a v1 key type")
    if isinstance(component, int):
        if component < 0:
            return b"\x01" + _le64(Signed(component).value)
        return b"\x02" + _le64(Unsigned(component).value)
    if isinstance(component, str):
        data = component.encode("utf-8")
        return b"\x03" + _le64(len(data)) + data
    if isinstance(component, (bytes, bytearray, memoryview)):
        data = bytes(component)
        return b"\x04" + _le64(len(data)) + data
    raise TypeError(
        "v1 keys must be signed/unsigned integers, UTF-8 strings, or bytes"
    )


def _domain(name):
    data = name.encode("ascii")
    return b"\xF0" + _le64(len(data)) + data


def _keyed_raw(seed, components, domain=None):
    hash_value = FNV_OFFSET_BASIS
    hash_value = _fnv1a_update(hash_value, V1_PREFIX)
    hash_value = _fnv1a_update(hash_value, _le64(seed))
    if domain is not None:
        hash_value = _fnv1a_update(hash_value, _domain(domain))
    for component in components:
        hash_value = _fnv1a_update(hash_value, _encode_component(component))
    return _mix64_masked(hash_value)


class Random:
    """Deterministic random-access generator.

    Next() advances through the sequence. NextAt(offset) computes any value in
    the sequence directly without generating the values before it.
    """

    __slots__ = ("seed", "index", "_key")

    def __init__(self, seed=None):
        value = time.time_ns() if seed is None else _require_int(seed, "seed")
        self.seed = value & MASK_64
        self.index = 0
        self._key = self.seed

    def SetSeed(self, localseed):
        self.seed = _require_int(localseed, "seed") & MASK_64
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

    def raw(self, *key):
        """Return the v1 value for this seed and structured key."""

        return _keyed_raw(self.seed, key)

    def int(self, maxvalue, *key):
        """Return a keyed integer in ``[0, maxvalue)``."""

        maxvalue = _require_int(maxvalue, "maxvalue")
        if not 0 < maxvalue <= MASK_64:
            raise ValueError("maxvalue must be in [1, 2^64 - 1]")
        return _bounded_raw(self.raw(*key), maxvalue)

    def range(self, minvalue, maxvalue, *key):
        """Return a keyed integer in ``[minvalue, maxvalue)``."""

        minvalue = _require_int(minvalue, "minvalue")
        maxvalue = _require_int(maxvalue, "maxvalue")
        if maxvalue <= minvalue:
            raise ValueError("maxvalue must be greater than minvalue")
        width = maxvalue - minvalue
        if width > MASK_64:
            raise ValueError("range width must not exceed 2^64 - 1")
        return minvalue + self.int(width, *key)

    def float01(self, *key):
        """Return a keyed IEEE-754-compatible value in ``[0.0, 1.0)``."""

        return (self.raw(*key) >> 11) * (1.0 / (1 << 53))

    def at2D(self, x, y, namespace=None):
        components = [i64(x), i64(y)]
        if namespace is not None:
            components.append(str(namespace))
        return _keyed_raw(self.seed, components, "at2d")

    def at3D(self, x, y, z, namespace=None):
        components = [i64(x), i64(y), i64(z)]
        if namespace is not None:
            components.append(str(namespace))
        return _keyed_raw(self.seed, components, "at3d")

    def chanceRatio(self, numerator, denominator, *key):
        numerator = _require_int(numerator, "numerator")
        denominator = _require_int(denominator, "denominator")
        if denominator <= 0:
            raise ValueError("denominator must be positive")
        if numerator <= 0:
            return False
        if numerator >= denominator:
            return True
        return self.int(denominator, *key) < numerator

    def choose(self, items, *key):
        if not items:
            raise ValueError("items must not be empty")
        return items[self.int(len(items), *key)]

    def shuffle(self, items, *key):
        values = list(items)
        for index in range(len(values) - 1, 0, -1):
            picked = _bounded_raw(
                _keyed_raw(
                    self.seed,
                    (*key, u64(index)),
                    "shuffle",
                ),
                index + 1,
            )
            values[index], values[picked] = values[picked], values[index]
        return values

    def weightedChoice(self, items, integerWeights, *key):
        if not items or len(items) != len(integerWeights):
            raise ValueError("items and weights must have the same non-zero length")
        weights = [
            _require_int(weight, "weight")
            for weight in integerWeights
        ]
        if any(weight < 0 for weight in weights):
            raise ValueError("weights must be non-negative integers")
        total = sum(weights)
        if not 0 < total <= MASK_64:
            raise ValueError("total weight must be in [1, 2^64 - 1]")
        target = self.int(total, *key)
        running = 0
        for item, weight in zip(items, weights):
            running += weight
            if target < running:
                return item
        raise AssertionError("unreachable weighted choice")

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
    "FNV_OFFSET_BASIS",
    "FNV_PRIME",
    "GOLDEN_GAMMA",
    "MASK_64",
    "MAX_INT_VALUE",
    "UINT64_SIZE",
    "Random",
    "Signed",
    "Unsigned",
    "__version__",
    "_mix64",
    "_mix64_masked",
    "i64",
    "u64",
]
