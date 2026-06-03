#!/usr/bin/env sh
set -eu

python3 -m py_compile Python/Esinxepy1-0-0.py src/esinxe/__init__.py tests/test_esinxe.py
ruby -c Ruby/Esinxeruby1-0-0.rb
node --test JavaScript/test/*.test.js
if command -v cargo >/dev/null 2>&1; then
  (cd Rust && cargo test --quiet)
else
  echo "Skipping Rust tests: cargo not found"
fi
if command -v go >/dev/null 2>&1; then
  (cd Go && go test ./...)
else
  echo "Skipping Go tests: go not found"
fi
if command -v javac >/dev/null 2>&1 && command -v java >/dev/null 2>&1; then
  tmp_java_dir="$(mktemp -d)"
  javac -d "$tmp_java_dir" JVM/java/com/esinxe/Random.java JVM/java/EsinxeSmokeTest.java
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
python3 setup.py build_ext --inplace >/dev/null
python3 -m unittest discover -s tests

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
python3 -m build --sdist --wheel --outdir "$tmpdir" >/dev/null
python3 -m twine check "$tmpdir"/*
