# Rust Port

The crate under `Rust/` targets Rust 1.70 or newer and has no dependencies.

## Quick Start

```rust
use esinxe::{Key, Random};

let field = Random::new(12345);
let keys = [Key::Str("terrain"), Key::I64(-4), Key::U64(9)];
let value = field.raw(&keys);
let height = field.at_2d(-4, 9, Some("terrain"));
```

`Key::I64`, `Key::U64`, `Key::Str`, and `Key::Bytes` model the canonical key
types. `int`, `range`, and `chance_ratio` return `Result`; collection helpers
return `Option` where validation can fail. `shuffle` returns an owned copy.

The keyed API also includes `float01`, `at_3d`, `choose`, and
`weighted_choice`, and it never changes stream state. The established
`next*` methods remain available for stream use; `Random` also implements
`Iterator<Item = u64>`.

See [the shared API reference](../docs/API.md) and
[the frozen algorithm specification](../SPEC_V1.md).

## Scoped fields, sampling, and prepared weights

```rust
let terrain = field.scope(&[Key::Str("world"), Key::Bytes(&[1, 2])]);
let locations = terrain.sample(&["hill", "lake", "wood"], 2, &[Key::Str("region")]).unwrap();
let encounters = terrain.prepare_weighted_choice(&["common", "rare"], &[80, 20]).unwrap();
let encounter = encounters.choose(&[Key::Str("tile"), Key::I64(-4)]);
```

`scope(&prefix)` snapshots the seed and owns the encoded typed prefix, so it
does not borrow caller buffers. Nested scopes concatenate prefixes. Raw calls
equal the parent raw call with keys prepended; helper domains precede prefixes.
Scopes have independent streams starting at offset zero, and reseeding either
field cannot change the other. Prefixes affect only keyed calls.

`sample<T: Clone>(&items, count: usize, &keys)` returns `Result<Vec<T>, &str>`
and copies the items before a descending Fisher-Yates permutation using
`sample-v1`. A count above the length is an error; negative counts are excluded
by `usize`. The first `count` positions are returned, and count does not affect
the permutation. Duplicate values occupy distinct positions.

`prepare_weighted_choice<T: Clone>(&items, &weights)` returns
`Result<PreparedWeightedChoice<T>, &str>`. It clones the items, retains owned
cumulative weights and the field snapshot, and validates equal nonzero lengths
and a nonzero uint64 total with checked addition. `choose(&keys) -> &T` uses
binary search and exactly matches `weighted_choice`, including zero weights.
Item ownership follows `T::clone` (for example, cloning `Rc` retains sharing).
These keyed operations never advance any stream. All tests inside the crate
remain self-contained for packaged use; root tests generate additional checks
directly from the shared conformance JSON without library dependencies.

## Test

```sh
cargo fmt --manifest-path Rust/Cargo.toml --check
cargo test --manifest-path Rust/Cargo.toml
cargo clippy --manifest-path Rust/Cargo.toml --all-targets -- -D warnings
```

This generator is deterministic and non-cryptographic.

## Stable-ID choice

`field.stable_choice(&items, &ids, &keys)?` ranks unique UTF-8 string IDs independently.
Items and IDs must have equal nonzero lengths; an empty individual ID is valid.
Reordering preserves the winning ID. Adding an ID changes only assignments it
wins; removing a nonwinner has no effect. No stream state changes. See the
[portable helper contract](../SPEC_HELPERS_V1.md) for score and tie rules.
