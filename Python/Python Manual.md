# Python Port

The maintained package lives in `src/esinxe`. Python 3.9 or newer is supported.
`Python/Esinxepy1-0-0.py` is retained as a compatibility import shim.

## Quick Start

```sh
python3 -m pip install -e .
```

```python
import esinxe

field = esinxe.Random(12345)
value = field.raw("terrain", esinxe.i64(-4), esinxe.u64(9))
height = field.at2D(-4, 9, "terrain")
loot = field.weightedChoice(["common", "rare"], [9, 1], "loot", esinxe.i64(-4))
```

Plain negative integers encode as signed keys and non-negative integers as
unsigned keys. Prefer `i64()` and `u64()` at persisted or cross-language
boundaries. Strings are UTF-8 and `bytes` values use the bytes key tag.

The complete keyed API is `raw`, `int`, `range`, `float01`, `at2D`, `at3D`,
`chanceRatio`, `choose`, `shuffle`, and `weightedChoice`. Invalid keyed inputs
raise `TypeError`, `ValueError`, or `OverflowError`. Keyed calls never advance
the stream.

The historical `Next*` stream methods remain available for sequential and
offset-based generation. See [the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Scoped fields and collection helpers

```python
terrain = field.scope("terrain", esinxe.i64(-4))
assert terrain.raw("height") == field.raw("terrain", esinxe.i64(-4), "height")
party = terrain.sample(["archer", "scout", "guardian"], 2, "party")
loot = terrain.prepareWeightedChoice(["common", "rare"], [9, 1])
assert loot.choose("room") == terrain.weightedChoice(["common", "rare"], [9, 1], "room")
```

Scopes copy mutable byte keys and snapshot seeds; nested scopes concatenate
prefixes. Prepared choices copy sequence structure and weights and retain the
seed/prefix at preparation. Later input mutation or reseeding cannot change their
choices. Sampling copies its input and selects positions without replacement;
counts must be integers from zero through the collection length.

Python wheels ship generic public stubs and `py.typed`. `sample` preserves the
item type in its output list; `choose` and prepared `choose` infer that type.
Run `python scripts/check_python_package.py` in the development environment to
verify installed wheel behavior and typing outside this checkout. The precise
portable semantics are in [the helper supplement](../SPEC_HELPERS_V1.md).

## Test

```sh
python3 -m unittest discover -s tests
```

This generator is deterministic and non-cryptographic.

## Stable-ID choice

For keyed bulk work, `field.rawBatch(rows)` returns a list equal to
`[field.raw(*row) for row in rows]`, preserving scope and stream position. Each
row is an iterable of typed components. Inputs are eagerly encoded, mutable
bytes copied, and prefix work reused. Bound batch sizes to limit memory. The
optional native extension and Python fallback return identical results.

`field.stableChoice(items, ids, *keys)` ranks unique UTF-8 string IDs independently.
Items and IDs must have equal nonzero lengths; an empty individual ID is valid.
Reordering preserves the winning ID. Adding an ID changes only assignments it
wins; removing a nonwinner has no effect. No stream state changes. See the
[portable helper contract](../SPEC_HELPERS_V1.md) for score and tie rules.
