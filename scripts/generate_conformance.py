"""Independent byte-level oracle for the portable conformance corpus.

This module deliberately imports no esinxe implementation. Existing v1 vector
files are never read or rewritten by this generator.
"""

import json
import struct
from pathlib import Path

MASK = (1 << 64) - 1
SIZE = 1 << 64
GAMMA = 0x9E3779B97F4A7C15
ROOT = Path(__file__).resolve().parents[1]


def mix(word):
    word = ((word ^ (word >> 30)) * 0xBF58476D1CE4E5B9) & MASK
    word = ((word ^ (word >> 27)) * 0x94D049BB133111EB) & MASK
    return word ^ (word >> 31)


def component(kind, value):
    return {"type": kind, "value": str(value)}


def message(seed, keys, domain=None):
    data = b"esinxe-v1\0" + struct.pack("<Q", seed)
    if domain is not None:
        text = domain.encode("ascii")
        data += b"\xf0" + struct.pack("<Q", len(text)) + text
    for key in keys:
        kind, value = key["type"], key["value"]
        if kind == "i64":
            data += b"\x01" + struct.pack("<q", int(value))
        elif kind == "u64":
            data += b"\x02" + struct.pack("<Q", int(value))
        else:
            payload = value.encode("utf-8") if kind == "string" else bytes.fromhex(value)
            data += bytes([3 if kind == "string" else 4])
            data += struct.pack("<Q", len(payload)) + payload
    return data


def raw(seed, keys, domain=None):
    word = 0xCBF29CE484222325
    for byte in message(seed, keys, domain):
        word = ((word ^ byte) * 0x100000001B3) & MASK
    return mix(word)


def bounded(word, maximum):
    threshold = SIZE % maximum
    nonce = 0
    while word < threshold:
        nonce += 1
        word = mix((word + nonce * GAMMA) & MASK)
    return word % maximum


def permutation(seed, keys, length, domain):
    values = list(range(length))
    for index in range(length - 1, 0, -1):
        picked = bounded(raw(seed, [*keys, component("u64", index)], domain), index + 1)
        values[index], values[picked] = values[picked], values[index]
    return values


def build_corpus():
    rows = []
    inputs = [
        ("empty-zero", 0, [], [], None),
        ("empty-one", 1, [], [], ""),
        ("signed-positive", 12345, [], [component("i64", 1)], "terrain"),
        ("unsigned-positive", 12345, [], [component("u64", 1)], "terrain"),
        ("limits-nul", MASK, [], [component("i64", -(1 << 63)), component("u64", MASK), component("string", "a\0b"), component("bytes", "0001ff")], "a\0b"),
        ("unicode-scope", 1 << 63, [component("string", "terrain")], [component("string", "\U0001f30d\u96ea"), component("u64", 0)], ""),
        ("nested-scope", 42, [component("string", "world"), component("i64", -1), component("bytes", "00ff")], [component("string", ""), component("bytes", "")], None),
        ("mixed-reference", 12345, [], [component("i64", -1), component("u64", MASK), component("string", "snowman \u2603"), component("bytes", "0001ff")], "terrain/\u96ea"),
    ]
    for label, seed, prefix, keys, namespace in inputs:
        combined = prefix + keys
        word = raw(seed, combined)
        coordinates = [component("i64", -17), component("i64", 42)]
        coordinates3 = [*coordinates, component("i64", -(1 << 63))]
        if namespace is not None:
            coordinates.append(component("string", namespace))
            coordinates3.append(component("string", namespace))
        target = bounded(word, 100)
        expected = {
            "raw": str(word),
            "int": str(bounded(word, (1 << 63) + 1)),
            "range": str(-(1 << 63) + bounded(word, MASK)),
            "floatUpper53": str(word >> 11),
            "at2D": str(raw(seed, prefix + coordinates, "at2d")),
            "at3D": str(raw(seed, prefix + coordinates3, "at3d")),
            "chanceRatio": bounded(word, 23) < 7,
            "choose": bounded(word, 4),
            "shuffle": permutation(seed, combined, 4, "shuffle"),
            "sample": permutation(seed, combined, 5, "sample-v1")[:3],
            "weightedChoice": 1 if target < 80 else 2 if target < 98 else 3,
        }
        rows.append({"id": label, "seed": str(seed), "prefix": prefix, "keys": keys, "namespace": namespace, "expected": expected})
    return {
        "schema": "esinxe-conformance-v1",
        "parameters": {"bound": str((1 << 63) + 1), "min": str(-(1 << 63)), "max": str((1 << 63) - 1), "x": "-17", "y": "42", "z": str(-(1 << 63)), "numerator": "7", "denominator": "23", "weights": ["0", "80", "18", "2"], "sampleCount": 3},
        "cases": rows,
        "invalidCases": ["int-bound-zero", "range-equal-endpoints", "chance-denominator-zero", "empty-choice", "zero-total-weight", "weight-total-overflow", "sample-count-exceeds-length", "sample-negative-count", "malformed-unicode", "typed-integer-overflow"],
    }


if __name__ == "__main__":
    destination = ROOT / "tests/conformance-v1.json"
    destination.write_text(json.dumps(build_corpus(), indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(destination)
