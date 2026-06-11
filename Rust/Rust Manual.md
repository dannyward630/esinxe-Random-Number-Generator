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

## Test

```sh
cargo fmt --manifest-path Rust/Cargo.toml --check
cargo test --manifest-path Rust/Cargo.toml
cargo clippy --manifest-path Rust/Cargo.toml --all-targets -- -D warnings
```

This generator is deterministic and non-cryptographic.
