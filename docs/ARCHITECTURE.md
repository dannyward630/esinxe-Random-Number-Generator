# Architecture

## Design Center

esinxe separates two models of deterministic randomness:

1. A stateless random field addressed by a seed and structured key.
2. A compatibility stream addressed by a seed and sequential offset.

The random field is the primary model for new software. It makes generated
content stable when work order, worker count, or unrelated features change.

## v1 Data Flow

```text
seed + typed key components
        |
        v
canonical binary encoding
        |
        v
64-bit FNV-1a accumulation
        |
        v
SplitMix64 finalizer
        |
        v
raw uint64
        |
        +--> upper 53 bits --> float01
        |
        +--> rejection sampling --> int/range/choice/weights
```

Coordinate and shuffle helpers add reserved domain components before hashing.
This prevents helper-internal keys from colliding with ordinary public key
sequences.

## Reference and Ports

The Python implementation in `src/esinxe/__init__.py` is the readable canonical
reference. `scripts/generate_vectors.py` emits the checked-in v1 vectors.
Every other language consumes or reproduces those values in its tests.

The C extension accelerates historical Python batch generation only. It does
not define keyed behavior and cannot change v1 outputs.

## Repository Layout

- `src/esinxe/`: Python package and optional native extension.
- `C/`, `C++/`, `C#/`, `Ruby/`: source-first ports.
- `JavaScript/`, `Rust/`, `Go/`, `JVM/`: modern language ports and tests.
- `tests/`: shared vectors and cross-language orchestration.
- `scripts/`: CI, analysis, benchmarking, and metadata checks.
- `demo/`: dependency-free browser field inspector.
- `docs/`: API, architecture, analysis, and language quick starts.

## Compatibility Boundaries

The following are algorithm commitments:

- key type tags and binary encoding;
- UTF-8 bytes without normalization;
- FNV constants and byte order;
- mixer constants and unsigned wrapping;
- rejection-sampling retry sequence;
- helper domains and key ordering; and
- Fisher-Yates iteration order.

Names, documentation, build tooling, and non-conformance convenience wrappers
may evolve without defining a new algorithm version.
