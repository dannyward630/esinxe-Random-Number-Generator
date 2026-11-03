"""Generate stable-choice expectations using the independent byte oracle."""

import json
from pathlib import Path

from generate_conformance import build_corpus, component, raw

ROOT = Path(__file__).resolve().parents[1]


def build_vectors():
    cases = []
    for index, row in enumerate(build_corpus()["cases"]):
        ids = (
            ["common", "rare", "legendary"]
            if index % 2 == 0
            else ["", "a\0b", "\u96ea", "\U0001f30d"]
        )
        scores = {
            candidate: raw(
                int(row["seed"]),
                row["prefix"] + row["keys"] + [component("string", candidate)],
                "stable-choice-v1",
            )
            for candidate in ids
        }
        winner = min(
            ids, key=lambda candidate: (-scores[candidate], candidate.encode("utf-8"))
        )
        cases.append(
            {
                "id": row["id"],
                "seed": row["seed"],
                "prefix": row["prefix"],
                "keys": row["keys"],
                "ids": ids,
                "expectedId": winner,
                "scores": {candidate: str(scores[candidate]) for candidate in ids},
            }
        )
    return {"schema": "esinxe-stable-choice-v1", "cases": cases}


if __name__ == "__main__":
    path = ROOT / "tests/stable-choice-v1.json"
    path.write_bytes(
        (json.dumps(build_vectors(), indent=2, ensure_ascii=True) + "\n").encode(
            "utf-8"
        )
    )
    print(path)
