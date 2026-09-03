"""Boundary regressions not exercised by the original happy-path vectors."""

import os
import subprocess
import sys
import unittest
from unittest.mock import patch

from test_esinxe import ROOT

import esinxe


class StreamBoundaryTests(unittest.TestCase):
    def test_native_and_fallback_batches_match_scalar_boundaries(self):
        native = esinxe._native
        for backend in (None, native):
            for maximum in (-1, 0, 1, 100, (1 << 63) + 1, (1 << 64) - 1, 1 << 64):
                with self.subTest(native=backend is not None, maximum=maximum):
                    with patch.object(esinxe, "_native", backend):
                        batch = esinxe.Random(12345)
                        scalar = esinxe.Random(12345)
                        expected = [scalar.NextMax(maximum) for _ in range(20)]
                        self.assertEqual(batch.NextListMax(20, maximum), expected)
                        self.assertEqual(batch.NextRaw(), scalar.NextRaw())
                        batch.SetSeed(12345)
                        scalar.SetSeed(12345)
                        minimum = -(1 << 63)
                        expected = [
                            scalar.NextMinMax(minimum, minimum + (1 << 64))
                            for _ in range(20)
                        ]
                        self.assertEqual(
                            batch.NextListMinMax(20, minimum, minimum + (1 << 64)),
                            expected,
                        )
                        self.assertEqual(batch.NextRaw(), scalar.NextRaw())

    def test_oversized_python_bounds_fail_without_hanging_or_advancing(self):
        # A subprocess timeout prevents a regression from hanging the test runner.
        script = """
import esinxe
for backend in (None, esinxe._native):
    esinxe._native = backend
    for method, args in [
        ('NextMax', (2**64 + 1,)),
        ('NextMaxAt', (0, 2**64 + 1)),
        ('NextMinMax', (-2**63, 2**63 + 1)),
        ('NextMinMaxAt', (0, -2**63, 2**63 + 1)),
        ('NextListMax', (2, 2**64 + 1)),
        ('NextListMinMax', (2, -2**63, 2**63 + 1)),
    ]:
        rng = esinxe.Random(12345)
        try:
            getattr(rng, method)(*args)
        except ValueError:
            assert rng.index == 0
            assert rng.NextRaw() == esinxe.Random(12345).NextRaw()
        else:
            raise AssertionError(method + ' accepted an oversized bound')
"""
        subprocess.run(
            [sys.executable, "-c", script],
            cwd=ROOT,
            check=True,
            timeout=5,
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONPATH": str(ROOT / "src")},
        )

    def test_native_entry_point_does_not_truncate_bounds(self):
        if esinxe._native is None:
            self.skipTest("native extension is not built")
        for bound in (-1, 1 << 64, (1 << 64) + 1):
            with self.subTest(bound=bound):
                with self.assertRaises(OverflowError):
                    esinxe._native.bounded_list(12345, 3, bound)
