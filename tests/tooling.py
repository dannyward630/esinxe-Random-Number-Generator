"""Portable subprocess helpers shared by compiler-based conformance tests."""

import os
import shlex
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def tool(name):
    resolved = shutil.which(name)
    if resolved is None:
        raise unittest.SkipTest(f"{name} is not installed")
    return resolved


def compiler_command(kind):
    variable = "CC" if kind == "c" else "CXX"
    override = os.environ.get(variable)
    if override:
        direct = shutil.which(override)
        tokens = (
            [direct]
            if direct
            else [
                part[1:-1] if part.startswith('"') and part.endswith('"') else part
                for part in shlex.split(override, posix=os.name != "nt")
            ]
        )
        executable = shutil.which(tokens[0]) if tokens else None
        if executable is None:
            raise FileNotFoundError(f"{variable} compiler not found: {override}")
        return [executable, *tokens[1:]]
    candidates = ("cc", "gcc", "clang") if kind == "c" else ("c++", "g++", "clang++")
    for candidate in candidates:
        executable = shutil.which(candidate)
        if executable is not None:
            return [executable]
    raise unittest.SkipTest(f"no {kind} compiler is installed (set {variable})")


def run_script(name, source, **kwargs):
    """Use a UTF-8 file so Windows command-line encoding cannot rewrite source."""

    suffix = {"ruby": ".rb", "python": ".py"}.get(name, ".txt")
    with tempfile.TemporaryDirectory(prefix="esinxe-source-") as temporary:
        path = Path(temporary) / ("source" + suffix)
        path.write_text(source, encoding="utf-8")
        kwargs.setdefault("cwd", ROOT)
        kwargs.setdefault("check", True)
        kwargs.setdefault("capture_output", True)
        kwargs.setdefault("encoding", "utf-8")
        kwargs.setdefault("timeout", 120)
        return subprocess.run([tool(name), str(path)], **kwargs)
