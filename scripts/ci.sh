#!/usr/bin/env sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$root"

local_tools="$HOME/.local/share/esinxe-toolchains"
if ! command -v go >/dev/null 2>&1 && [ -x "$local_tools/go/bin/go" ]; then
  PATH="$local_tools/go/bin:$PATH"
fi
if ! command -v kotlinc >/dev/null 2>&1 && [ -x "$local_tools/kotlinc/bin/kotlinc" ]; then
  PATH="$local_tools/kotlinc/bin:$PATH"
fi
export PATH

python3 scripts/check_repo.py
if command -v ruff >/dev/null 2>&1; then
  ruff check .
else
  echo "Skipping Python lint: ruff not found"
fi
python3 -m py_compile \
  Python/Esinxepy1-0-0.py \
  src/esinxe/__init__.py \
  examples/distributed_jobs.py \
  examples/procedural_world.py \
  scripts/generate_vectors.py \
  tests/test_esinxe.py
python3 scripts/generate_vectors.py >/dev/null
git diff --exit-code -- tests/vectors-v1.json
ruby -c Ruby/Esinxeruby1-0-0.rb
node --check demo/app.js
node --test JavaScript/test/*.test.js
(cd JavaScript && npm run typecheck && npm audit && npm pack --dry-run >/dev/null)
if command -v cargo >/dev/null 2>&1; then
  cargo fmt --manifest-path Rust/Cargo.toml --check
  cargo test --manifest-path Rust/Cargo.toml --quiet
  cargo clippy --manifest-path Rust/Cargo.toml --all-targets -- -D warnings
  cargo package --manifest-path Rust/Cargo.toml --allow-dirty --no-verify --list \
    >/dev/null
else
  echo "Skipping Rust tests: cargo not found"
fi
if command -v go >/dev/null 2>&1; then
  gofmt_diff="$(mktemp)"
  gofmt -d Go/esinxe/esinxe.go Go/esinxe/esinxe_test.go >"$gofmt_diff"
  if [ -s "$gofmt_diff" ]; then
    cat "$gofmt_diff"
    rm -f "$gofmt_diff"
    echo "Go formatting check failed"
    exit 1
  fi
  rm -f "$gofmt_diff"
  (cd Go && go test ./...)
  (cd Go && go vet ./...)
else
  echo "Skipping Go tests: go not found"
fi
if command -v javac >/dev/null 2>&1 && command -v java >/dev/null 2>&1; then
  tmp_java_dir="$(mktemp -d)"
  javac -Xlint:all -Werror -d "$tmp_java_dir" \
    JVM/java/com/esinxe/Random.java \
    JVM/java/EsinxeSmokeTest.java
  java -cp "$tmp_java_dir" EsinxeSmokeTest
  rm -rf "$tmp_java_dir"
else
  echo "Skipping Java tests: javac/java not found"
fi
if command -v kotlinc >/dev/null 2>&1; then
  tmp_kotlin_jar="$(mktemp -t esinxe-kotlin-test).jar"
  kotlinc JVM/kotlin/Esinxe.kt JVM/kotlin/EsinxeSmokeTest.kt -include-runtime -d "$tmp_kotlin_jar"
  java -jar "$tmp_kotlin_jar"
  rm -f "$tmp_kotlin_jar"
else
  echo "Skipping Kotlin tests: kotlinc not found"
fi
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck scripts/*.sh
else
  echo "Skipping shell lint: shellcheck not found"
fi
python3 setup.py build_ext --inplace >/dev/null
python3 -m unittest discover -s tests
PYTHONPATH=src python3 examples/procedural_world.py >/dev/null
PYTHONPATH=src python3 examples/distributed_jobs.py >/dev/null
python3 scripts/analyze_rng.py
./scripts/build_site.sh >/dev/null

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
python3 -m build --sdist --wheel --outdir "$tmpdir" >/dev/null
python3 -m twine check "$tmpdir"/*
python3 -m pip check
if command -v pip-audit >/dev/null 2>&1; then
  pip-audit . --progress-spinner off
else
  echo "Skipping Python dependency audit: pip-audit not found"
fi
