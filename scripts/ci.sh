#!/usr/bin/env sh
set -eu

python3 -m py_compile Python/Esinxepy1-0-0.py src/esinxe/__init__.py tests/test_esinxe.py
ruby -c Ruby/Esinxeruby1-0-0.rb
python3 -m unittest discover -s tests

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
python3 -m build --sdist --wheel --outdir "$tmpdir" >/dev/null
python3 -m twine check "$tmpdir"/*
