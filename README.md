# esinxe Random Number Generator

esinxe is a deterministic, random-access number generator for Python, C#,
C++, C, and Ruby.

Version 1.0.1

Author: Danny Ward

The original idea was to generate value `y` directly from key `x`, instead of
advancing a generator through every previous value. That is still the design:
`NextAt(n)` computes the nth value from the current seed immediately, which is
useful for procedural generation, chunked worlds, repeatable simulations, and
other cases where you need stable randomness at an arbitrary coordinate.

This version replaces the old floating-point `e^sin(x^e)` prototype with a
64-bit integer mixing function. That makes the generator deterministic across
languages, avoids floating-point drift, and gives a much healthier distribution
for practical non-cryptographic use.

This is not a cryptographic random number generator. Do not use it for
passwords, tokens, key generation, gambling, or security-sensitive decisions.

## API

- `SetSeed(seed)` resets the seed and sequence index.
- `Next()` returns the next value and advances the sequence.
- `NextAt(offset)` returns the value at `offset` without advancing.
- `NextRaw()` returns the next raw 64-bit value and advances the sequence.
- `NextRawAt(offset)` returns the raw 64-bit value at `offset`.
- `NextMax(maxvalue)` returns `0 <= value < maxvalue`.
- `NextMaxAt(offset, maxvalue)` returns `0 <= value < maxvalue`.
- `NextMinMax(minvalue, maxvalue)` returns `minvalue <= value < maxvalue`.
- `NextMinMaxAt(offset, minvalue, maxvalue)` returns a ranged value at `offset`.
- List/array helpers return consecutive values and advance when no explicit
  offset is supplied.

## Testing

Run the included smoke and statistical tests with:

```sh
python3 -m unittest discover -s tests
```

Or run the full local CI check:

```sh
./scripts/ci.sh
```

## Python package

The Python implementation can be installed locally:

```sh
python3 -m pip install -e .
```

Then import it with:

```python
import esinxe

rng = esinxe.Random(12345)
print(rng.NextAt(1000))
```

The historical `Python/Esinxepy1-0-0.py` file remains as a compatibility shim.
