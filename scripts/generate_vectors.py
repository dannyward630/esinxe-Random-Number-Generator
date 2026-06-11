#!/usr/bin/env python3
"""Generate the canonical esinxe v1 conformance vectors."""

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import esinxe  # noqa: E402


def build_vectors():
    field = esinxe.Random(12345)
    mixed_key = (
        esinxe.i64(-1),
        esinxe.u64((1 << 64) - 1),
        "snowman \u2603",
        bytes.fromhex("0001ff"),
    )
    choices = ["forest", "desert", "tundra", "ocean"]
    weighted_items = ["common", "rare", "legendary"]
    weights = [80, 18, 2]

    return {
        "algorithm": "esinxe-v1",
        "packageVersion": esinxe.__version__,
        "seed": "12345",
        "cases": {
            "rawEmpty": str(field.raw()),
            "rawSignedPositive": str(field.raw(esinxe.i64(1))),
            "rawUnsignedPositive": str(field.raw(esinxe.u64(1))),
            "rawMixed": str(field.raw(*mixed_key)),
            "rawEmptyString": str(field.raw("")),
            "rawEmptyBytes": str(field.raw(b"")),
            "int100": str(field.int(100, *mixed_key)),
            "rangeSigned": str(field.range(-500, 500, *mixed_key)),
            "floatUpper53": str(field.raw(*mixed_key) >> 11),
            "at2D": str(field.at2D(-17, 42, "terrain/\u96ea")),
            "at2DNoNamespace": str(field.at2D(-17, 42)),
            "at3D": str(field.at3D(-17, 42, -(1 << 63), "caves")),
            "chanceRatio": field.chanceRatio(7, 23, *mixed_key),
            "choose": field.choose(choices, *mixed_key),
            "shuffle": field.shuffle(choices, *mixed_key),
            "weightedChoice": field.weightedChoice(
                weighted_items,
                weights,
                *mixed_key,
            ),
        },
        "invalidCases": [
            "int bound zero",
            "range with max <= min",
            "chance denominator zero",
            "empty choice",
            "negative weight",
            "zero total weight",
        ],
    }


def main():
    output = ROOT / "tests" / "vectors-v1.json"
    output.write_text(
        json.dumps(build_vectors(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(output)


if __name__ == "__main__":
    main()
