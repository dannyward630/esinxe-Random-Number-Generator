"""Install the real npm tarball outside the checkout; verify JS and TS clients."""

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONSUMER = """import { Random, i64 } from "esinxe";
const field = new Random(42).scope("world");
const items = ["forest", "desert", "tundra"] as const;
const selected: typeof items[number] = field.stableChoice(items, items, i64(-1));
const reversed = [...items].reverse();
if (selected !== field.stableChoice(reversed, reversed, i64(-1))) {
  throw Error("order drift");
}
if (field.index !== 0n) throw Error("stream changed");
const prepared = field.prepareWeightedChoice(items, [80, 18, 2]);
if (prepared.choose("loot") !== field.weightedChoice(items, [80, 18, 2], "loot")) {
  throw Error("prepared drift");
}
// @ts-expect-error selection preserves item types
const invalid: number = selected;
void invalid;
"""


def main():
    npm, node = shutil.which("npm"), shutil.which("node")
    if not npm or not node:
        raise SystemExit("node and npm are required")
    with tempfile.TemporaryDirectory(prefix="esinxe-npm-consumer-") as temporary:
        base = Path(temporary)
        subprocess.run(
            [npm, "pack", "--pack-destination", str(base)],
            cwd=ROOT / "JavaScript",
            check=True,
            timeout=120,
        )
        tarball = next(base.glob("*.tgz"))
        (base / "package.json").write_text(
            json.dumps({"name": "esinxe-consumer", "private": True, "type": "module"}),
            encoding="utf-8",
        )
        subprocess.run(
            [
                npm,
                "install",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                str(tarball),
            ],
            cwd=base,
            check=True,
            timeout=120,
        )
        client = base / "consumer.ts"
        client.write_text(CONSUMER, encoding="utf-8")
        compiler = ROOT / "JavaScript/node_modules/typescript/bin/tsc"
        subprocess.run(
            [
                node,
                str(compiler),
                "--strict",
                "--target",
                "ES2020",
                "--module",
                "NodeNext",
                "--moduleResolution",
                "NodeNext",
                str(client),
            ],
            cwd=base,
            check=True,
            timeout=120,
        )
        subprocess.run(
            [node, str(base / "consumer.js")], cwd=base, check=True, timeout=120
        )
    print("Installed npm tarball runtime and TypeScript consumer passed")


if __name__ == "__main__":
    main()
