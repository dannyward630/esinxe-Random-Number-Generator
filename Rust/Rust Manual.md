# Rust Manual

Dependencies: Rust 2021 edition.

```rust
use esinxe::Random;

let mut rng = Random::new(12345);
println!("{}", rng.next());
println!("{}", rng.next_raw_at(1000));
```

Run tests with:

```sh
cd Rust
cargo test
```
