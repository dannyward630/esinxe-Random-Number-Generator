"""End-to-end keyed batch parity, validation, snapshots, and stream isolation."""

import unittest
from unittest.mock import patch

from test_esinxe import ROOT  # noqa: F401 - sets the source import path

import esinxe


class KeyedBatchTests(unittest.TestCase):
    def test_batches_match_scalar_keys_scopes_and_backends(self):
        rows = [
            (),
            ("",),
            (b"",),
            (esinxe.i64(-1), esinxe.u64(esinxe.MASK_64)),
            ("\U0001f30d\0\u96ea", b"\0\xff"),
            ("room", 42),
        ]
        native = esinxe._native
        for backend in (None, native):
            with patch.object(esinxe, "_native", backend):
                field = esinxe.Random(12345).scope("world", b"\0")
                field.NextRaw()
                control = esinxe.Random(12345)
                control.NextRaw()
                expected = [field.raw(*row) for row in rows]
                self.assertEqual(field.rawBatch(iter(rows)), expected)
                self.assertEqual(field.rawBatch([]), [])
                self.assertEqual(field.index, 1)
                self.assertEqual(field.NextRaw(), control.NextRaw())

    def test_validation_is_eager_and_copies_mutable_row_bytes(self):
        field = esinxe.Random(42)
        payload = bytearray(b"first")

        def rows():
            yield (payload,)
            payload[:] = b"other"
            yield (payload,)

        self.assertEqual(
            field.rawBatch(rows()), [field.raw(b"first"), field.raw(b"other")]
        )
        for rows in ([True], [None], [(True,)], [(1.5,)], [(1 << 64,)], [("\ud800",)]):
            with self.assertRaises((TypeError, ValueError, UnicodeError)):
                field.rawBatch(rows)
        self.assertEqual(field.index, 0)

    def test_native_entry_point_validates_immutable_encoded_rows(self):
        if esinxe._native is None:
            self.skipTest("native extension is not built")
        native = esinxe._native
        for seed in (-1, 1 << 64):
            with self.assertRaises(OverflowError):
                native.keyed_list(seed, b"", [])
        for prefix, rows in [
            (bytearray(b"x"), []),
            (b"", [bytearray(b"x")]),
            (b"", [None]),
        ]:
            with self.assertRaises(TypeError):
                native.keyed_list(1, prefix, rows)


if __name__ == "__main__":
    unittest.main()
