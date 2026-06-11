#!/usr/bin/env sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
output="${1:-$root/_site}"

rm -rf "$output"
mkdir -p "$output/demo" "$output/JavaScript/src"

cp "$root/demo/index.html" "$root/demo/app.js" "$root/demo/styles.css" "$output/demo/"
cp "$root/JavaScript/src/index.js" "$output/JavaScript/src/"
cp "$root/SPEC_V1.md" "$output/"

cat >"$output/index.html" <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url=demo/">
    <title>esinxe deterministic field inspector</title>
  </head>
  <body>
    <p><a href="demo/">Open the esinxe deterministic field inspector</a>.</p>
  </body>
</html>
EOF

touch "$output/.nojekyll"
printf 'Built static site at %s\n' "$output"
