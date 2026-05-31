import collections
import os
import shutil
import statistics
import subprocess
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_FIRST_VALUES = [
    540659726606785873,
    454886589211414944,
    778200017661327597,
    205171434679333405,
    248800117070709450,
]
EXPECTED_FIRST_RAW_VALUES = [
    17540659726606785873,
    2454886589211414944,
    3778200017661327597,
    2205171434679333405,
    3248800117070709450,
]


class PythonBehaviorTests(unittest.TestCase):
    def setUp(self):
        import esinxe

        self.module = esinxe

    def test_next_advances_and_next_at_matches(self):
        rng = self.module.Random(12345)
        self.assertEqual([rng.Next() for _ in range(5)], EXPECTED_FIRST_VALUES)

        rng.SetSeed(12345)
        self.assertEqual([rng.NextAt(i) for i in range(5)], EXPECTED_FIRST_VALUES)

    def test_set_seed_resets_sequence(self):
        rng = self.module.Random(12345)
        first = rng.Next()
        rng.Next()
        rng.SetSeed(12345)
        self.assertEqual(rng.Next(), first)

    def test_raw_values_are_public_and_random_accessible(self):
        rng = self.module.Random(12345)
        self.assertEqual([rng.NextRaw() for _ in range(5)], EXPECTED_FIRST_RAW_VALUES)

        rng.SetSeed(12345)
        self.assertEqual(
            [rng.NextRawAt(i) for i in range(5)],
            EXPECTED_FIRST_RAW_VALUES,
        )

    def test_legacy_python_file_reexports_package(self):
        # The historical filename is not importable as a module because of
        # hyphens, so load it by path and verify it exposes the package API.
        import importlib.util

        legacy = ROOT / "Python" / "Esinxepy1-0-0.py"
        spec = importlib.util.spec_from_file_location("esinxepy_legacy", legacy)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertEqual(module.Random(12345).Next(), EXPECTED_FIRST_VALUES[0])

    def test_ranges_are_lower_inclusive_upper_exclusive(self):
        rng = self.module.Random(12345)
        values = rng.NextListMinMax(1000, 50, 100)
        self.assertTrue(all(50 <= value < 100 for value in values))
        self.assertGreater(len(set(values)), 45)

    def test_distribution_smoke_for_100_buckets(self):
        rng = self.module.Random(1)
        values = rng.NextListMax(10000, 100)
        counts = collections.Counter(values)
        expected = len(values) / 100
        chi_square = sum(
            ((counts[bucket] - expected) ** 2) / expected
            for bucket in range(100)
        )

        self.assertEqual(len(counts), 100)
        self.assertLess(chi_square, 160)
        self.assertLess(abs(statistics.mean(values) - 49.5), 1.0)


class CrossLanguageSmokeTests(unittest.TestCase):
    def test_c_header_compiles_and_matches_reference_values(self):
        source = textwrap.dedent(
            """
            #include <stdio.h>
            #include "C/Esinxec1-0-0.h"

            int main(void)
            {
                SetSeed(12345);
                for (int i = 0; i < 5; i++)
                {
                    printf("%llu %llu\\n",
                        (unsigned long long)Next(),
                        (unsigned long long)NextRawAt(i));
                }
                return 0;
            }
            """
        )
        output = compile_and_run("c", source)
        pairs = parse_int_pairs(output)
        self.assertEqual([pair[0] for pair in pairs], EXPECTED_FIRST_VALUES)
        self.assertEqual([pair[1] for pair in pairs], EXPECTED_FIRST_RAW_VALUES)

    def test_cpp_header_compiles_and_matches_reference_values(self):
        source = textwrap.dedent(
            """
            #include <iostream>
            #include "C++/Esinxecpp1-0-0.h"

            int main()
            {
                Esinxecpp::Random rng;
                rng.SetSeed(12345);
                for (int i = 0; i < 5; i++)
                {
                    std::cout << rng.Next() << " " << rng.NextRawAt(i) << "\\n";
                }
                return 0;
            }
            """
        )
        output = compile_and_run("cpp", source)
        pairs = parse_int_pairs(output)
        self.assertEqual([pair[0] for pair in pairs], EXPECTED_FIRST_VALUES)
        self.assertEqual([pair[1] for pair in pairs], EXPECTED_FIRST_RAW_VALUES)

    def test_ruby_matches_reference_values(self):
        script = textwrap.dedent(
            """
            load 'Ruby/Esinxeruby1-0-0.rb'
            rng = Esinxe::Generator.new
            rng.SetSeed(12345)
            5.times { |i| puts "#{rng.Next} #{rng.NextRawAt(i)}" }
            """
        )
        result = subprocess.run(
            ["ruby", "-e", script],
            cwd=ROOT,
            check=True,
            text=True,
            capture_output=True,
        )
        pairs = parse_int_pairs(result.stdout)
        self.assertEqual([pair[0] for pair in pairs], EXPECTED_FIRST_VALUES)
        self.assertEqual([pair[1] for pair in pairs], EXPECTED_FIRST_RAW_VALUES)

    def test_csharp_matches_reference_values_when_dotnet_is_available(self):
        dotnet = shutil.which("dotnet") or str(Path.home() / ".dotnet" / "dotnet")
        if not Path(dotnet).exists():
            self.skipTest("dotnet is not installed")

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            (tmp / "Esinxecs1-0-0.cs").write_text(
                (ROOT / "C#" / "Esinxecs1-0-0.cs").read_text()
            )
            (tmp / "Program.cs").write_text(
                textwrap.dedent(
                    """
                    using System;

                    class Program
                    {
                        static void Main()
                        {
                            var rng = new Esinxecs.Random();
                            rng.SetSeed(12345);
                            for (var i = 0; i < 5; i++)
                            {
                                Console.WriteLine($"{rng.Next()} {rng.NextRawAt((ulong)i)}");
                            }
                        }
                    }
                    """
                )
            )
            (tmp / "EsinxeSmoke.csproj").write_text(
                textwrap.dedent(
                    """
                    <Project Sdk="Microsoft.NET.Sdk">
                      <PropertyGroup>
                        <OutputType>Exe</OutputType>
                        <TargetFramework>net8.0</TargetFramework>
                        <ImplicitUsings>enable</ImplicitUsings>
                        <Nullable>enable</Nullable>
                      </PropertyGroup>
                    </Project>
                    """
                ).strip()
            )
            env = os.environ.copy()
            env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
            result = subprocess.run(
                [dotnet, "run", "--project", str(tmp / "EsinxeSmoke.csproj")],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
                env=env,
            )
            pairs = parse_int_pairs(result.stdout)
            self.assertEqual([pair[0] for pair in pairs], EXPECTED_FIRST_VALUES)
            self.assertEqual([pair[1] for pair in pairs], EXPECTED_FIRST_RAW_VALUES)


def compile_and_run(kind, source):
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        suffix = ".c" if kind == "c" else ".cpp"
        source_path = tmp / f"main{suffix}"
        output_path = tmp / "esinxe-test"
        source_path.write_text(source)
        compiler = "cc" if kind == "c" else "c++"
        standard = "-std=c11" if kind == "c" else "-std=c++17"
        command = [
            compiler,
            standard,
            "-Wall",
            "-Wextra",
            "-Werror",
            f"-I{ROOT}",
            str(source_path),
            "-o",
            str(output_path),
        ]
        subprocess.run(command, cwd=ROOT, check=True, capture_output=True, text=True)
        result = subprocess.run(
            [str(output_path)],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout


def parse_int_lines(output):
    return [int(line) for line in output.splitlines() if line.strip()]


def parse_int_pairs(output):
    return [
        tuple(int(part) for part in line.split())
        for line in output.splitlines()
        if line.strip()
    ]


if __name__ == "__main__":
    unittest.main()
