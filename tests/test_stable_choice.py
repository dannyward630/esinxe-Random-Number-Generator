"""Stable candidate selection preserves unaffected existing assignments."""

import json
import unittest
from unittest.mock import patch

from test_esinxe import ROOT
from test_field_helpers import decode

import esinxe

VECTORS = json.loads((ROOT / "tests/stable-choice-v1.json").read_text(encoding="utf-8"))


class StableChoiceTests(unittest.TestCase):
    def test_shared_vectors_and_candidate_order(self):
        for row in VECTORS["cases"]:
            with self.subTest(case=row["id"]):
                field = esinxe.Random(int(row["seed"])).scope(*decode(row["prefix"]))
                ids = row["ids"]
                key = decode(row["keys"])
                self.assertEqual(field.stableChoice(ids, ids, *key), row["expectedId"])
                self.assertEqual(
                    field.stableChoice(ids[::-1], ids[::-1], *key), row["expectedId"]
                )
                self.assertEqual(field.index, 0)

    def test_adding_candidate_changes_only_assignments_to_it(self):
        field = esinxe.Random(42).scope("rooms")
        original = ["forest", "desert", "tundra"]
        additions = original + ["wetland"]
        moved = 0
        for index in range(512):
            old = field.stableChoice(original, original, index)
            new = field.stableChoice(additions, additions, index)
            if old != new:
                self.assertEqual(new, "wetland")
                moved += 1
            remaining = [item for item in additions if item != old]
            if new != old:
                self.assertEqual(field.stableChoice(remaining, remaining, index), new)
        self.assertGreater(moved, 0)
        self.assertLess(moved, 512)

    def test_validation_and_utf8_tie_break(self):
        field = esinxe.Random(1)
        for items, ids in [([], []), ([1], []), ([1, 2], ["same", "same"])]:
            with self.assertRaises(ValueError):
                field.stableChoice(items, ids)
        with self.assertRaises(TypeError):
            field.stableChoice([1], [1])
        with self.assertRaises(UnicodeError):
            field.stableChoice([1], ["\ud800"])
        with self.assertRaises(TypeError):
            field.stableChoice([1], ["valid"], True)
        with patch.object(esinxe.Random, "_field_raw", return_value=7):
            self.assertEqual(field.stableChoice([1, 2], ["\U00010000", "\ue000"]), 2)


if __name__ == "__main__":
    unittest.main()
