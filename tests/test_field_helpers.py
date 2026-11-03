"""Portable fixtures and public helper contracts for the Python reference."""

import importlib.util
import json
import unittest

from test_esinxe import ROOT

import esinxe

CORPUS = json.loads((ROOT / "tests/conformance-v1.json").read_text(encoding="utf-8"))


def decode(keys):
    constructors = {"i64": esinxe.i64, "u64": esinxe.u64}
    return tuple(
        constructors[key["type"]](int(key["value"]))
        if key["type"] in constructors
        else bytes.fromhex(key["value"])
        if key["type"] == "bytes"
        else key["value"]
        for key in keys
    )


class FieldHelperTests(unittest.TestCase):
    def test_fixture_files_preserve_lf_bytes(self):
        for name in ("vectors.json", "vectors-v1.json", "conformance-v1.json"):
            with self.subTest(file=name):
                self.assertNotIn(b"\r", (ROOT / "tests" / name).read_bytes())

    def test_reference_and_helpers_consume_shared_corpus(self):
        for row in CORPUS["cases"]:
            with self.subTest(case=row["id"]):
                root = esinxe.Random(int(row["seed"]))
                field = root.scope(*decode(row["prefix"]))
                key = decode(row["keys"])
                expected = row["expected"]
                self.assertEqual(str(field.raw(*key)), expected["raw"])
                self.assertEqual(str(field.int((1 << 63) + 1, *key)), expected["int"])
                self.assertEqual(
                    str(field.range(-(1 << 63), (1 << 63) - 1, *key)), expected["range"]
                )
                self.assertEqual(str(field.raw(*key) >> 11), expected["floatUpper53"])
                self.assertEqual(
                    field.float01(*key), int(expected["floatUpper53"]) / (1 << 53)
                )
                self.assertEqual(
                    str(field.at2D(-17, 42, row["namespace"])), expected["at2D"]
                )
                self.assertEqual(
                    str(field.at3D(-17, 42, -(1 << 63), row["namespace"])),
                    expected["at3D"],
                )
                self.assertEqual(
                    field.chanceRatio(7, 23, *key), expected["chanceRatio"]
                )
                self.assertEqual(field.choose(list(range(4)), *key), expected["choose"])
                self.assertEqual(
                    field.shuffle(list(range(4)), *key), expected["shuffle"]
                )
                self.assertEqual(
                    field.sample(list(range(5)), 3, *key), expected["sample"]
                )
                prepared = field.prepareWeightedChoice(list(range(4)), [0, 80, 18, 2])
                self.assertEqual(prepared.choose(*key), expected["weightedChoice"])
                self.assertEqual(
                    field.weightedChoice(list(range(4)), [0, 80, 18, 2], *key),
                    prepared.choose(*key),
                )
                self.assertEqual(root.index, 0)
                self.assertEqual(field.index, 0)
                self.assertEqual(field.NextRaw(), root.NextRaw())

    def test_corpus_oracle_is_reproducible_without_reference_import(self):
        spec = importlib.util.spec_from_file_location(
            "corpus_oracle", ROOT / "scripts/generate_conformance.py"
        )
        oracle = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(oracle)
        self.assertEqual(oracle.build_corpus(), CORPUS)

    def test_scope_is_snapshot_and_nested_prefixes_are_equivalent(self):
        field = esinxe.Random(12345)
        source = bytearray(b"terrain")
        scoped = field.scope(source).scope(esinxe.i64(-1))
        expected = field.raw(b"terrain", esinxe.i64(-1), "height")
        source[0] = 0
        field.SetSeed(999)
        self.assertEqual(scoped.raw("height"), expected)
        self.assertEqual(
            scoped.raw("height"),
            esinxe.Random(12345).scope(b"terrain", esinxe.i64(-1)).raw("height"),
        )
        scoped.SetSeed(42)
        self.assertEqual(
            scoped.raw("height"),
            esinxe.Random(42).raw(b"terrain", esinxe.i64(-1), "height"),
        )
        with self.assertRaises(TypeError):
            field.scope(True)
        with self.assertRaises(UnicodeError):
            field.scope("\ud800")

    def test_sample_prefix_count_validation_and_input_preservation(self):
        field = esinxe.Random(42).scope("loot")
        source = ["a", "b", "c", "d", "e"]
        full = field.sample(source, len(source), "room")
        self.assertCountEqual(full, source)
        self.assertEqual(field.sample(source, 3, "room"), full[:3])
        self.assertEqual(source, ["a", "b", "c", "d", "e"])
        self.assertEqual(field.sample([], 0), [])
        self.assertEqual(field.sample(["a", "a"], 2).count("a"), 2)
        for count in (-1, 6):
            with self.assertRaises(ValueError):
                field.sample(source, count)
        for count in (True, 1.5):
            with self.assertRaises(TypeError):
                field.sample(source, count)
        with self.assertRaises(TypeError):
            field.sample([], 0, True)
        self.assertEqual(field.index, 0)

    def test_prepared_weights_snapshot_zero_weights_and_overflow(self):
        field = esinxe.Random(42).scope("loot")
        items = ["never", "common", "rare", "never-again"]
        weights = [0, 80, 18, 0]
        prepared = field.prepareWeightedChoice(items, weights)
        expected = [field.weightedChoice(items, weights, i) for i in range(64)]
        items[:] = ["changed"]
        weights[:] = [1]
        field.SetSeed(999)
        self.assertEqual([prepared.choose(i) for i in range(64)], expected)
        for bad_items, bad_weights in [
            ([], []),
            ([1], []),
            ([1], [0]),
            ([1], [-1]),
            ([1, 2], [esinxe.MASK_64, 1]),
        ]:
            with self.assertRaises(ValueError):
                field.prepareWeightedChoice(bad_items, bad_weights)
        for invalid in (True, 1.5):
            with self.assertRaises(TypeError):
                field.prepareWeightedChoice([1], [invalid])
        with self.assertRaises(TypeError):
            prepared.choose(True)


if __name__ == "__main__":
    unittest.main()
