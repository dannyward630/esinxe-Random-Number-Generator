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

## Test

```sh
python3 -m unittest discover -s tests
```

This generator is deterministic and non-cryptographic.
