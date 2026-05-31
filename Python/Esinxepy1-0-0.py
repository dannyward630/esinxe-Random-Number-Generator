import time


MASK_64 = (1 << 64) - 1
GOLDEN_GAMMA = 0x9E3779B97F4A7C15
MAX_INT_VALUE = 10**18


def _mix64(value):
    value &= MASK_64
    value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & MASK_64
    value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & MASK_64
    return (value ^ (value >> 31)) & MASK_64


class Random:
    """Deterministic random-access generator.

    Next() advances through the sequence. NextAt(offset) computes any value in
    the sequence directly without generating the values before it.
    """

    def __init__(self, seed=None):
        self.seed = int(time.time_ns() if seed is None else seed) & MASK_64
        self.index = 0

    def SetSeed(self, localseed):
        self.seed = int(localseed) & MASK_64
        self.index = 0

    def _raw_at(self, offset):
        return _mix64(self.seed + (int(offset) * GOLDEN_GAMMA))

    def _bounded_at(self, offset, maxvalue):
        maxvalue = int(maxvalue)
        if maxvalue <= 0:
            return 0
        return self._raw_at(offset) % maxvalue

    def _range_at(self, offset, minvalue, maxvalue):
        minvalue = int(minvalue)
        maxvalue = int(maxvalue)
        if maxvalue <= minvalue:
            return None
        return minvalue + self._bounded_at(offset, maxvalue - minvalue)

    def NextAt(self, offset):
        return self._bounded_at(offset, MAX_INT_VALUE)

    def Next(self):
        value = self.NextAt(self.index)
        self.index += 1
        return value

    def NextMaxAt(self, offset, maxvalue):
        return self._bounded_at(offset, maxvalue)

    def NextMax(self, maxvalue):
        value = self.NextMaxAt(self.index, maxvalue)
        self.index += 1
        return value

    def NextMinMaxAt(self, offset, minvalue, maxvalue):
        return self._range_at(offset, minvalue, maxvalue)

    def NextMinMax(self, minvalue, maxvalue):
        value = self.NextMinMaxAt(self.index, minvalue, maxvalue)
        self.index += 1
        return value

    def NextList(self, length):
        length = max(0, int(length))
        values = [self.NextAt(self.index + i) for i in range(length)]
        self.index += length
        return values

    def NextListMax(self, length, maxvalue):
        length = max(0, int(length))
        values = [self.NextMaxAt(self.index + i, maxvalue) for i in range(length)]
        self.index += length
        return values

    def NextListMinMax(self, length, minvalue, maxvalue):
        length = max(0, int(length))
        values = [
            self.NextMinMaxAt(self.index + i, minvalue, maxvalue)
            for i in range(length)
        ]
        self.index += length
        return values
