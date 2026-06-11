import collections
import json
import math
import os
import shutil
import statistics
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
V1_VECTORS = json.loads((ROOT / "tests" / "vectors-v1.json").read_text())
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

    def test_raw_bit_balance_smoke(self):
        rng = self.module.Random(123456789)
        values = [rng.NextRawAt(i) for i in range(50000)]
        proportions = [
            sum((value >> bit) & 1 for value in values) / len(values)
            for bit in range(64)
        ]

        self.assertLess(min(proportions), 0.51)
        self.assertGreater(max(proportions), 0.49)
        self.assertLess(max(abs(p - 0.5) for p in proportions), 0.012)

    def test_raw_avalanche_smoke(self):
        base = self.module.Random(123456789)
        flipped = self.module.Random(123456789 ^ (1 << 31))
        distances = [
            popcount(base.NextRawAt(i) ^ flipped.NextRawAt(i))
            for i in range(10000)
        ]

        self.assertLess(abs(statistics.mean(distances) - 32), 0.4)
        self.assertGreater(min(distances), 10)
        self.assertLess(max(distances), 54)

    def test_serial_correlation_smoke(self):
        rng = self.module.Random(123456789)
        values = [rng.NextRawAt(i) / (1 << 64) for i in range(50000)]
        self.assertLess(abs(correlation(values[:-1], values[1:])), 0.015)

    def test_no_raw_collisions_in_smoke_sample(self):
        rng = self.module.Random(123456789)
        values = [rng.NextRawAt(i) for i in range(100000)]
        self.assertEqual(len(values), len(set(values)))

    def test_native_extension_when_built_matches_python_contract(self):
        native = getattr(self.module, "_native", None)
        if native is None:
            self.skipTest("native extension is not built")

        rng = self.module.Random(12345)
        self.assertEqual(native.raw_list(12345, 5), EXPECTED_FIRST_RAW_VALUES)
        self.assertEqual(rng.NextList(5), EXPECTED_FIRST_VALUES)

    def test_v1_keyed_api_matches_canonical_vectors(self):
        field = self.module.Random(int(V1_VECTORS["seed"]))
        key = (
            self.module.i64(-1),
            self.module.u64((1 << 64) - 1),
            "snowman \u2603",
            bytes.fromhex("0001ff"),
        )
        cases = V1_VECTORS["cases"]

        self.assertEqual(str(field.raw()), cases["rawEmpty"])
        self.assertEqual(str(field.raw(self.module.i64(1))), cases["rawSignedPositive"])
        self.assertEqual(
            str(field.raw(self.module.u64(1))),
            cases["rawUnsignedPositive"],
        )
        self.assertNotEqual(cases["rawSignedPositive"], cases["rawUnsignedPositive"])
        self.assertEqual(str(field.raw(*key)), cases["rawMixed"])
        self.assertEqual(str(field.raw("")), cases["rawEmptyString"])
        self.assertEqual(str(field.raw(b"")), cases["rawEmptyBytes"])
        self.assertEqual(str(field.int(100, *key)), cases["int100"])
        self.assertEqual(str(field.range(-500, 500, *key)), cases["rangeSigned"])
        self.assertEqual(str(field.raw(*key) >> 11), cases["floatUpper53"])
        self.assertEqual(
            str(field.at2D(-17, 42, "terrain/\u96ea")),
            cases["at2D"],
        )
        self.assertEqual(str(field.at2D(-17, 42)), cases["at2DNoNamespace"])
        self.assertEqual(
            str(field.at3D(-17, 42, -(1 << 63), "caves")),
            cases["at3D"],
        )
        self.assertEqual(field.chanceRatio(7, 23, *key), cases["chanceRatio"])
        self.assertEqual(
            field.choose(["forest", "desert", "tundra", "ocean"], *key),
            cases["choose"],
        )
        self.assertEqual(
            field.shuffle(["forest", "desert", "tundra", "ocean"], *key),
            cases["shuffle"],
        )
        self.assertEqual(
            field.weightedChoice(
                ["common", "rare", "legendary"],
                [80, 18, 2],
                *key,
            ),
            cases["weightedChoice"],
        )

    def test_keyed_calls_do_not_advance_stream(self):
        expected = self.module.Random(12345)
        actual = self.module.Random(12345)
        actual.raw("chunk", self.module.i64(-2))
        actual.int(37, "loot")
        actual.at2D(-1, 2, "terrain")
        actual.shuffle([1, 2, 3, 4], "encounter")
        self.assertEqual(actual.index, 0)
        self.assertEqual(actual.NextRaw(), expected.NextRaw())

    def test_v1_key_validation_and_edge_cases(self):
        field = self.module.Random(0)
        with self.assertRaises(ValueError):
            field.int(0, "invalid")
        with self.assertRaises(ValueError):
            field.range(5, 5, "invalid")
        with self.assertRaises(ValueError):
            field.chanceRatio(1, 0, "invalid")
        with self.assertRaises(ValueError):
            field.choose([], "invalid")
        with self.assertRaises(ValueError):
            field.weightedChoice(["x"], [-1], "invalid")
        with self.assertRaises(ValueError):
            field.weightedChoice(["x"], [0], "invalid")
        with self.assertRaises(ValueError):
            self.module.i64(1 << 63)
        with self.assertRaises(ValueError):
            self.module.u64(1 << 64)
        with self.assertRaises(TypeError):
            field.raw(True)

        self.assertFalse(field.chanceRatio(0, 7, "certain"))
        self.assertTrue(field.chanceRatio(7, 7, "certain"))
        self.assertEqual(field.int(1 << 64, "full-width"), field.raw("full-width"))


class CrossLanguageSmokeTests(unittest.TestCase):
    def test_javascript_matches_reference_values(self):
        if shutil.which("node") is None:
            self.skipTest("node is not installed")
        subprocess.run(
            ["npm", "test"],
            cwd=ROOT / "JavaScript",
            check=True,
            text=True,
            capture_output=True,
        )

    def test_rust_matches_reference_values(self):
        if shutil.which("cargo") is None:
            self.skipTest("cargo is not installed")
        subprocess.run(
            ["cargo", "test", "--quiet"],
            cwd=ROOT / "Rust",
            check=True,
            text=True,
            capture_output=True,
        )

    def test_go_matches_reference_values_when_available(self):
        if shutil.which("go") is None:
            self.skipTest("go is not installed")
        subprocess.run(
            ["go", "test", "./..."],
            cwd=ROOT / "Go",
            check=True,
            text=True,
            capture_output=True,
        )

    def test_java_matches_reference_values(self):
        if shutil.which("javac") is None or shutil.which("java") is None:
            self.skipTest("java is not installed")
        with tempfile.TemporaryDirectory() as tmpdir:
            subprocess.run(
                [
                    "javac",
                    "-d",
                    tmpdir,
                    str(ROOT / "JVM" / "java" / "com" / "esinxe" / "Random.java"),
                    str(ROOT / "JVM" / "java" / "EsinxeSmokeTest.java"),
                ],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
            )
            subprocess.run(
                ["java", "-cp", tmpdir, "EsinxeSmokeTest"],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
            )

    def test_kotlin_matches_reference_values_when_available(self):
        if shutil.which("kotlinc") is None:
            self.skipTest("kotlinc is not installed")
        with tempfile.TemporaryDirectory() as tmpdir:
            jar = Path(tmpdir) / "esinxe-kotlin-test.jar"
            subprocess.run(
                [
                    "kotlinc",
                    str(ROOT / "JVM" / "kotlin" / "Esinxe.kt"),
                    str(ROOT / "JVM" / "kotlin" / "EsinxeSmokeTest.kt"),
                    "-include-runtime",
                    "-d",
                    str(jar),
                ],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
            )
            subprocess.run(
                ["java", "-jar", str(jar)],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
            )

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

    def test_c_header_matches_v1_keyed_vectors(self):
        source = textwrap.dedent(
            r"""
            #include <inttypes.h>
            #include <stdio.h>
            #include "C/Esinxec1-0-0.h"

            int main(void)
            {
                const unsigned char bytes[] = {0, 1, 255};
                EsinxeKey keys[] = {
                    EsinxeI64(-1),
                    EsinxeU64(UINT64_MAX),
                    EsinxeString("snowman \xE2\x98\x83"),
                    EsinxeBytes(bytes, 3)
                };
                const char *items[] = {"forest", "desert", "tundra", "ocean"};
                uint64_t weights[] = {80, 18, 2};
                uint64_t integer;
                int64_t ranged;

                EsinxeIntV1(12345, 100, keys, 4, &integer);
                EsinxeRangeV1(12345, -500, 500, keys, 4, &ranged);
                EsinxeShuffleV1(12345, items, 4, sizeof(items[0]), keys, 4);
                printf("%" PRIu64 "\n", EsinxeRawV1(12345, keys, 4));
                printf("%" PRIu64 "\n", integer);
                printf("%" PRId64 "\n", ranged);
                printf("%" PRIu64 "\n",
                    EsinxeAt2DV1(12345, -17, 42, "terrain/\xE9\x9B\xAA"));
                printf("%" PRIu64 "\n",
                    EsinxeAt3DV1(12345, -17, 42, INT64_MIN, "caves"));
                printf("%" PRIu64 "\n", EsinxeRawV1(12345, keys, 4) >> 11);
                printf("%d\n", EsinxeChanceRatioV1(12345, 7, 23, keys, 4));
                printf("%zu\n", EsinxeChooseIndexV1(12345, 4, keys, 4));
                printf("%s,%s,%s,%s\n", items[0], items[1], items[2], items[3]);
                printf("%zu\n",
                    EsinxeWeightedChoiceIndexV1(12345, weights, 3, keys, 4));
                return 0;
            }
            """
        )
        lines = compile_and_run("c", source).splitlines()
        cases = V1_VECTORS["cases"]
        self.assertEqual(lines[0], cases["rawMixed"])
        self.assertEqual(lines[1], cases["int100"])
        self.assertEqual(lines[2], cases["rangeSigned"])
        self.assertEqual(lines[3], cases["at2D"])
        self.assertEqual(lines[4], cases["at3D"])
        self.assertEqual(lines[5], cases["floatUpper53"])
        self.assertEqual(lines[6], "1" if cases["chanceRatio"] else "0")
        self.assertEqual(
            ["forest", "desert", "tundra", "ocean"][int(lines[7])],
            cases["choose"],
        )
        self.assertEqual(lines[8].split(","), cases["shuffle"])
        self.assertEqual(
            ["common", "rare", "legendary"][int(lines[9])],
            cases["weightedChoice"],
        )

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

    def test_cpp_header_matches_v1_keyed_vectors(self):
        source = textwrap.dedent(
            r"""
            #include <cstdint>
            #include <iostream>
            #include <string>
            #include <vector>
            #include "C++/Esinxecpp1-0-0.h"

            int main()
            {
                using namespace Esinxecpp;
                Random rng(12345);
                std::vector<Key> keys = {
                    Key::Signed(-1),
                    Key::Unsigned(UINT64_MAX),
                    Key::Utf8("snowman \xE2\x98\x83"),
                    Key::Bytes({0, 1, 255})
                };
                std::cout << rng.Raw(keys) << "\n";
                std::cout << rng.Int(100, keys) << "\n";
                std::cout << rng.Range(-500, 500, keys) << "\n";
                std::cout << rng.At2D(-17, 42, "terrain/\xE9\x9B\xAA") << "\n";
                std::cout << rng.At3D(-17, 42, INT64_MIN, "caves") << "\n";
                std::cout << (rng.Raw(keys) >> 11) << "\n";
                std::cout << rng.ChanceRatio(7, 23, keys) << "\n";
                std::cout << rng.Choose(
                    std::vector<std::string>{"forest", "desert", "tundra", "ocean"},
                    keys) << "\n";
                auto shuffled = rng.Shuffle(
                    std::vector<std::string>{"forest", "desert", "tundra", "ocean"},
                    keys);
                for (std::size_t i = 0; i < shuffled.size(); i++)
                {
                    if (i > 0) std::cout << ",";
                    std::cout << shuffled[i];
                }
                std::cout << "\n";
                std::cout << rng.WeightedChoice(
                    std::vector<std::string>{"common", "rare", "legendary"},
                    std::vector<std::uint64_t>{80, 18, 2},
                    keys) << "\n";
                return 0;
            }
            """
        )
        lines = compile_and_run("cpp", source).splitlines()
        cases = V1_VECTORS["cases"]
        self.assertEqual(lines[:5], [
            cases["rawMixed"],
            cases["int100"],
            cases["rangeSigned"],
            cases["at2D"],
            cases["at3D"],
        ])
        self.assertEqual(lines[5], cases["floatUpper53"])
        self.assertEqual(lines[6], "1" if cases["chanceRatio"] else "0")
        self.assertEqual(lines[7], cases["choose"])
        self.assertEqual(lines[8].split(","), cases["shuffle"])
        self.assertEqual(lines[9], cases["weightedChoice"])

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

    def test_ruby_matches_v1_keyed_vectors(self):
        script = textwrap.dedent(
            """
            load 'Ruby/Esinxeruby1-0-0.rb'
            rng = Esinxe::Generator.new(12345)
            key = [
              Esinxe.i64(-1),
              Esinxe.u64((1 << 64) - 1),
              "snowman \\u2603",
              Esinxe.bytes("\\x00\\x01\\xff")
            ]
            puts rng.raw(*key)
            puts rng.int(100, *key)
            puts rng.range(-500, 500, *key)
            puts rng.at2D(-17, 42, "terrain/\\u96ea")
            puts rng.at3D(-17, 42, -(1 << 63), "caves")
            puts rng.raw(*key) >> 11
            puts rng.chanceRatio(7, 23, *key) ? 1 : 0
            puts rng.choose(%w[forest desert tundra ocean], *key)
            puts rng.shuffle(%w[forest desert tundra ocean], *key).join(",")
            puts rng.weightedChoice(%w[common rare legendary], [80, 18, 2], *key)
            """
        )
        result = subprocess.run(
            ["ruby", "-e", script],
            cwd=ROOT,
            check=True,
            text=True,
            capture_output=True,
        )
        lines = result.stdout.splitlines()
        cases = V1_VECTORS["cases"]
        self.assertEqual(lines[:5], [
            cases["rawMixed"],
            cases["int100"],
            cases["rangeSigned"],
            cases["at2D"],
            cases["at3D"],
        ])
        self.assertEqual(lines[5], cases["floatUpper53"])
        self.assertEqual(lines[6], "1" if cases["chanceRatio"] else "0")
        self.assertEqual(lines[7], cases["choose"])
        self.assertEqual(lines[8].split(","), cases["shuffle"])
        self.assertEqual(lines[9], cases["weightedChoice"])

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

    def test_csharp_matches_v1_keyed_vectors_when_dotnet_is_available(self):
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
                    using E = Esinxecs.Random;

                    class Program
                    {
                        static void Main()
                        {
                            var rng = new E(12345);
                            var key = new[] {
                                E.Key.I64(-1),
                                E.Key.U64(ulong.MaxValue),
                                E.Key.String("snowman \\u2603"),
                                E.Key.Bytes(new byte[] {0, 1, 255})
                            };
                            Console.WriteLine(rng.Raw(key));
                            Console.WriteLine(rng.Int(100, key));
                            Console.WriteLine(rng.Range(-500, 500, key));
                            Console.WriteLine(rng.At2D(-17, 42, "terrain/\\u96ea"));
                            Console.WriteLine(rng.At3D(-17, 42, long.MinValue, "caves"));
                            Console.WriteLine(rng.Raw(key) >> 11);
                            Console.WriteLine(rng.ChanceRatio(7, 23, key) ? 1 : 0);
                            Console.WriteLine(rng.Choose(
                                new[] {"forest", "desert", "tundra", "ocean"},
                                key));
                            Console.WriteLine(string.Join(",", rng.Shuffle(
                                new[] {"forest", "desert", "tundra", "ocean"},
                                key)));
                            Console.WriteLine(rng.WeightedChoice(
                                new[] {"common", "rare", "legendary"},
                                new ulong[] {80, 18, 2},
                                key));
                        }
                    }
                    """
                )
            )
            (tmp / "EsinxeV1.csproj").write_text(
                textwrap.dedent(
                    """
                    <Project Sdk="Microsoft.NET.Sdk">
                      <PropertyGroup>
                        <OutputType>Exe</OutputType>
                        <TargetFramework>net8.0</TargetFramework>
                        <Nullable>enable</Nullable>
                        <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
                      </PropertyGroup>
                    </Project>
                    """
                ).strip()
            )
            env = os.environ.copy()
            env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
            result = subprocess.run(
                [dotnet, "run", "--project", str(tmp / "EsinxeV1.csproj")],
                cwd=ROOT,
                check=True,
                text=True,
                capture_output=True,
                env=env,
            )
            lines = result.stdout.splitlines()
            cases = V1_VECTORS["cases"]
            self.assertEqual(lines[:5], [
                cases["rawMixed"],
                cases["int100"],
                cases["rangeSigned"],
                cases["at2D"],
                cases["at3D"],
            ])
            self.assertEqual(lines[5], cases["floatUpper53"])
            self.assertEqual(lines[6], "1" if cases["chanceRatio"] else "0")
            self.assertEqual(lines[7], cases["choose"])
            self.assertEqual(lines[8].split(","), cases["shuffle"])
            self.assertEqual(lines[9], cases["weightedChoice"])


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


def popcount(value):
    return bin(value).count("1")


def correlation(xs, ys):
    mean_x = statistics.mean(xs)
    mean_y = statistics.mean(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
    denominator_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
    return numerator / (denominator_x * denominator_y)


if __name__ == "__main__":
    unittest.main()
