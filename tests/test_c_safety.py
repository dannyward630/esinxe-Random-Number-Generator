"""Memory-safety regressions for the source-first C port."""

import unittest

from test_esinxe import compile_and_run


class CShuffleSafetyTests(unittest.TestCase):
    def test_shuffle_rejects_overflow_and_missing_keys(self):
        source = r"""
#include <assert.h>
#include "C/Esinxec1-0-0.h"
int main(void) {
    unsigned char items[2] = {1, 2};
    EsinxeKey key = EsinxeU64(1);
    assert(!EsinxeShuffleV1(1, items, 2, 1, &key, SIZE_MAX));
    assert(!EsinxeShuffleV1(1, items, 2, 1, &key,
                          SIZE_MAX / sizeof(EsinxeKey)));
    assert(!EsinxeShuffleV1(1, items, 2, SIZE_MAX, &key, 1));
    assert(!EsinxeShuffleV1(1, items, 2, 1, NULL, 1));
    assert(items[0] == 1 && items[1] == 2);
    assert(EsinxeShuffleV1(1, NULL, 0, 0, NULL, 0));
    for (uint64_t seed = 0; seed < 100; seed++) {
        assert(EsinxeShuffleV1(seed, items, 2, 1, NULL, 0));
        assert(items[0] + items[1] == 3);
    }
    return 0;
}
"""
        compile_and_run("c", source)
