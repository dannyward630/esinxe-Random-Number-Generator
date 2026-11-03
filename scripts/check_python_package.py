"""Build and test a wheel as an installed, typed consumer outside the checkout."""

import os
import subprocess
import sys
import tempfile
import venv
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

CONSUMER = """import esinxe

field = esinxe.Random(12345)
scoped = field.scope("terrain", esinxe.i64(-1))
value: int = scoped.raw("height")
assert value == field.raw("terrain", esinxe.i64(-1), "height")
items: list[str] = ["common", "rare", "legendary"]
sample: list[str] = scoped.sample(items, 2, "room")
assert len(sample) == len(set(sample)) == 2
prepared = scoped.prepareWeightedChoice(items, [80, 18, 2])
picked: str = prepared.choose("loot")
assert picked == scoped.weightedChoice(items, [80, 18, 2], "loot")
assert field.index == scoped.index == 0
"""

INVALID = """import esinxe

field = esinxe.Random(12345)
wrong: str = field.raw("key")
wrong_item: int = field.prepareWeightedChoice(["a"], [1]).choose("key")
field.sample(["a"], 1.5)
field.raw(1.5)
"""


def run(command, cwd, env):
    subprocess.run(command, cwd=cwd, env=env, check=True, timeout=300)


def main():
    clean_env = dict(os.environ)
    clean_env.pop("PYTHONPATH", None)
    with tempfile.TemporaryDirectory(prefix="esinxe-consumer-") as temporary:
        base = Path(temporary)
        run(
            [sys.executable, "-m", "build", "--wheel", "--outdir", str(base / "dist")],
            ROOT,
            clean_env,
        )
        wheel = next((base / "dist").glob("*.whl"))
        with zipfile.ZipFile(wheel) as archive:
            required = {"esinxe/__init__.pyi", "esinxe/py.typed"}
            if not required.issubset(archive.namelist()):
                raise AssertionError("wheel is missing public typing files")
        environment = base / "consumer-env"
        venv.EnvBuilder(with_pip=True).create(environment)
        executable = environment / (
            "Scripts/python.exe" if os.name == "nt" else "bin/python"
        )
        run(
            [str(executable), "-m", "pip", "install", "--no-deps", str(wheel)],
            base,
            clean_env,
        )
        client = base / "consumer.py"
        client.write_text(CONSUMER, encoding="utf-8")
        run([str(executable), str(client)], base, clean_env)
        mypy = [
            sys.executable,
            "-m",
            "mypy",
            "--strict",
            "--python-executable",
            str(executable),
        ]
        run([*mypy, str(client)], base, clean_env)
        invalid = base / "invalid.py"
        invalid.write_text(INVALID, encoding="utf-8")
        result = subprocess.run(
            [*mypy, str(invalid)],
            cwd=base,
            env=clean_env,
            capture_output=True,
            encoding="utf-8",
            timeout=120,
        )
        if result.returncode != 1 or result.stdout.count("error:") != 4:
            raise AssertionError(
                f"expected four consumer type errors:\n{result.stdout}\n{result.stderr}"
            )
        print(
            "installed Python wheel, generic inference, "
            "and four invalid-input type checks passed"
        )


if __name__ == "__main__":
    main()
