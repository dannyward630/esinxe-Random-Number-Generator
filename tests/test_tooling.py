"""Compiler/tool selection must work with Windows paths and UTF-8 sources."""

import os
import unittest
from pathlib import Path
from unittest.mock import patch

import test_esinxe


class ToolingTests(unittest.TestCase):
    def test_compiler_falls_back_to_gcc_without_cc(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CC", None)
            with patch(
                "shutil.which",
                side_effect=lambda name: "/tools/gcc" if name == "gcc" else None,
            ):
                self.assertEqual(test_esinxe.compiler_command("c"), ["/tools/gcc"])

    def test_compiler_honors_quoted_path_and_arguments(self):
        location = str(Path("compiler suite") / "gcc.exe")
        with patch.dict(os.environ, {"CC": f'"{location}" -DPORT=1'}):
            with patch(
                "shutil.which",
                side_effect=lambda name: name if name == location else None,
            ):
                self.assertEqual(
                    test_esinxe.compiler_command("c"), [location, "-DPORT=1"]
                )

    def test_missing_explicit_compiler_does_not_silently_fall_back(self):
        with patch.dict(os.environ, {"CXX": "missing-compiler"}):
            with patch("shutil.which", return_value=None):
                with self.assertRaises(FileNotFoundError):
                    test_esinxe.compiler_command("cpp")

    def test_generated_cpp_source_is_explicit_utf8(self):
        source = (
            '#include <iostream>\nint main(){ std::cout << u8"\\u2603"; }\n'
            '// \U0001f30d\n'
        )
        self.assertEqual(test_esinxe.compile_and_run("cpp", source), "\u2603")


if __name__ == "__main__":
    unittest.main()
