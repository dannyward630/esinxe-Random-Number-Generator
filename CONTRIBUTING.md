# Contributing

Thanks for helping make esinxe more dependable. Small fixes, clearer examples,
new tests, portability improvements, and documentation corrections are all
welcome.

## Compatibility Rules

Algorithm v1 outputs are permanent. A change that alters any v1 vector is not a
refactor: it is a new algorithm version and requires a separate specification,
vector file, and API opt-in.

When changing keyed behavior:

1. Update the Python reference implementation.
2. Update `scripts/generate_vectors.py` only when intentionally defining a new
   compatibility version.
3. Port the behavior to every supported language.
4. Add invalid-input and stream-isolation coverage.
5. Run the complete verification script.

Do not add cryptographic claims, floating cross-language weights, or smooth
noise behavior to the v1 core.

## Development Setup

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
cd JavaScript && npm ci && cd ..
```

The full suite also uses C/C++ compilers, Ruby, Node.js, Rust, Go, Java,
Kotlin, and .NET when available. Missing toolchains are reported explicitly.

## Verification

Run:

```sh
./scripts/ci.sh
```

For focused work:

```sh
python3 -m unittest discover -s tests
cd JavaScript && npm test && npm run typecheck
cargo test --manifest-path Rust/Cargo.toml
cd Go && go test ./...
```

## Pull Requests

- Keep each commit focused on one coherent change.
- Explain compatibility impact and test evidence.
- Add or update documentation for public API changes.
- Do not commit build products, virtual environments, `node_modules`, or
  generated native binaries.
- Link relevant issues when one exists.

By participating, you agree to follow the project
[Code of Conduct](CODE_OF_CONDUCT.md).
