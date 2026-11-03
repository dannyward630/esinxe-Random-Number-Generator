"""Independent encoding oracle and differential tests beyond the small vectors."""

import json
import struct
import subprocess
import unittest

from test_esinxe import ROOT, compile_and_run

import esinxe


def oracle(seed, index):
    # Build the byte message without any of the implementation's encoding helpers.
    payload = (
        b"esinxe-v1\0"
        + struct.pack("<Q", seed)
        + b"\x01"
        + struct.pack("<q", -index)
        + b"\x02"
        + struct.pack("<Q", (1 << 64) - 1 - index)
        + b"\x03"
        + struct.pack("<Q", 4)
        + "🌍".encode()
    )
    mask = (1 << 64) - 1
    value = 0xCBF29CE484222325
    for byte in payload:
        value = ((value ^ byte) * 0x100000001B3) & mask
    value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & mask
    value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & mask
    return value ^ (value >> 31)


class ConformanceBoundaryTests(unittest.TestCase):
    def test_python_encoding_against_independent_byte_oracle(self):
        for seed in (0, 1, (1 << 63), (1 << 64) - 1):
            rng = esinxe.Random(seed)
            for index in range(64):
                self.assertEqual(
                    rng.raw(
                        esinxe.i64(-index), esinxe.u64((1 << 64) - 1 - index), "🌍"
                    ),
                    oracle(seed, index),
                )

    def test_javascript_multi_seed_large_bound_parity(self):
        script = r"""
import { Random, i64, u64 } from './JavaScript/src/index.js';
const rows = [];
for (const seed of [0n, 1n, 1n << 63n, (1n << 64n) - 1n]) {
  const rng = new Random(seed);
  for (let i = 0n; i < 64n; i++) {
    const key = [i64(-i), u64((1n << 64n) - 1n - i), "🌍"];
    rows.push([rng.raw(...key), rng.int((1n << 63n) + 1n, ...key),
               rng.range(-(1n << 63n), (1n << 63n) - 1n, ...key)].map(String));
  }
}
console.log(JSON.stringify(rows));
"""
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
        expected = []
        for seed in (0, 1, 1 << 63, (1 << 64) - 1):
            rng = esinxe.Random(seed)
            for index in range(64):
                key = (esinxe.i64(-index), esinxe.u64((1 << 64) - 1 - index), "🌍")
                expected.append(
                    list(
                        map(
                            str,
                            (
                                oracle(seed, index),
                                rng.int((1 << 63) + 1, *key),
                                rng.range(-(1 << 63), (1 << 63) - 1, *key),
                            ),
                        )
                    )
                )
        self.assertEqual(json.loads(result.stdout), expected)

    def test_c_embedded_nul_and_large_bound_parity(self):
        source = r"""
#include <inttypes.h>
#include <stdio.h>
#include "C/Esinxec1-0-0.h"
int main(void) {
    const char text[] = {'a', 0, 'b'};
    EsinxeKey key = {ESINXE_KEY_STRING, 0, (const unsigned char *)text, 3};
    for (uint64_t seed = 0; seed < 64; seed++) {
        uint64_t bounded;
        int64_t ranged;
        EsinxeIntV1(seed, (UINT64_C(1) << 63) + 1, &key, 1, &bounded);
        EsinxeRangeV1(seed, INT64_MIN, INT64_MAX, &key, 1, &ranged);
        printf("%" PRIu64 " %" PRIu64 " %" PRId64 "\n",
            EsinxeRawV1(seed, &key, 1), bounded, ranged);
    }
}
"""
        rows = [
            list(map(int, line.split()))
            for line in compile_and_run("c", source).splitlines()
        ]
        expected = []
        for seed in range(64):
            rng = esinxe.Random(seed)
            expected.append(
                [
                    rng.raw("a\0b"),
                    rng.int((1 << 63) + 1, "a\0b"),
                    rng.range(-(1 << 63), (1 << 63) - 1, "a\0b"),
                ]
            )
        self.assertEqual(rows, expected)

    def test_stream_seeds_are_phase_shifts_not_independent_streams(self):
        first = esinxe.Random(12345)
        shifted = esinxe.Random(12345 + 7 * esinxe.GOLDEN_GAMMA)
        self.assertEqual(
            [first.NextRawAt(i + 7) for i in range(64)],
            [shifted.NextRawAt(i) for i in range(64)],
        )
