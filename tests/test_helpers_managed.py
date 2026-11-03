"""Corpus-driven adapters: generated UTF-8 sources need no JSON runtime libraries."""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = json.loads((ROOT / "tests/conformance-v1.json").read_text(encoding="utf-8"))


def quoted(value, language):
    if value is None:
        return "nil" if language == "ruby" else "null"
    text = json.dumps(value, ensure_ascii=False)
    if language == "java":
        text = text.replace("\\u0000", "\\000")
    if language == "kotlin":
        text = text.replace("$", "\\$")
    return text


def key_expr(key, language):
    kind, value = key["type"], key["value"]
    api = {"csharp": "R.Key", "java": "Random.Key", "kotlin": "Key", "ruby": "Esinxe"}[
        language
    ]
    if kind == "string":
        return (
            quoted(value, language)
            if language == "ruby"
            else f"{api}.{'String' if language == 'csharp' else 'string'}({quoted(value, language)})"
        )
    if kind == "bytes":
        data = list(bytes.fromhex(value))
        if language == "ruby":
            return f'Esinxe.bytes([{",".join(map(str, data))}].pack("C*"))'
        if language == "java":
            payload = "new byte[]{" + ",".join(f"(byte){b}" for b in data) + "}"
        elif language == "csharp":
            payload = "new byte[]{" + ",".join(map(str, data)) + "}"
        else:
            payload = "byteArrayOf(" + ",".join(f"{b}.toByte()" for b in data) + ")"
        return f"{api}.{'Bytes' if language == 'csharp' else 'bytes'}({payload})"
    if language == "java":
        value = (
            f'Long.parseUnsignedLong("{value}")'
            if kind == "u64"
            else ("Long.MIN_VALUE" if value == "-9223372036854775808" else value + "L")
        )
    elif language == "csharp":
        value = (
            "long.MinValue"
            if value == "-9223372036854775808"
            else value + ("UL" if kind == "u64" else "L")
        )
    elif language == "kotlin":
        value = (
            "Long.MIN_VALUE"
            if value == "-9223372036854775808"
            else value + ("UL" if kind == "u64" else "L")
        )
    return f"{api}.{kind.upper() if language == 'csharp' else kind}({value})"


def corpus_source(language):
    lines, expected = [], []
    for case in CORPUS["cases"]:
        seed = case["seed"]
        prefix = ",".join(key_expr(k, language) for k in case["prefix"])
        keys = ",".join(key_expr(k, language) for k in case["keys"])
        ns = quoted(case["namespace"], language)
        if language == "csharp":
            lines += [
                "{",
                f"var r = new R({seed}UL).Scope({prefix});",
                f"R.Key[] k = new R.Key[]{{{keys}}};",
            ]
            calls = [
                "r.Raw(k)",
                "r.Int(9223372036854775809UL,k)",
                "r.Range(long.MinValue,long.MaxValue,k)",
                "(ulong)(r.Float01(k)*9007199254740992.0)",
                f"r.At2D(-17,42,{ns})",
                f"r.At3D(-17,42,long.MinValue,{ns})",
                "r.ChanceRatio(7,23,k).ToString().ToLowerInvariant()",
                "r.Choose(new[]{0,1,2,3},k)",
                'string.Join(",",r.Shuffle(new[]{0,1,2,3},k))',
                'string.Join(",",r.Sample(new[]{0,1,2,3,4},3,k))',
                "r.WeightedChoice(new[]{0,1,2,3},new ulong[]{0,80,18,2},k)",
                "r.PrepareWeightedChoice(new[]{0,1,2,3},new ulong[]{0,80,18,2}).Choose(k)",
            ]
            lines += [f"Console.WriteLine({call});" for call in calls] + ["}"]
        elif language == "java":
            lines += [
                "{",
                f'Random r = new Random(Long.parseUnsignedLong("{seed}")).scope({prefix});',
                f"Random.Key[] k = new Random.Key[]{{{keys}}};",
            ]
            calls = [
                "Long.toUnsignedString(r.raw(k))",
                'r.intValue(new BigInteger("9223372036854775809"),k)',
                "r.range(Long.MIN_VALUE,Long.MAX_VALUE,k)",
                "(long)(r.float01(k)*9007199254740992.0)",
                f"Long.toUnsignedString(r.at2D(-17,42,{ns}))",
                f"Long.toUnsignedString(r.at3D(-17,42,Long.MIN_VALUE,{ns}))",
                "r.chanceRatio(7,23,k)",
                "r.choose(Arrays.asList(0,1,2,3),k)",
                'r.shuffle(Arrays.asList(0,1,2,3),k).toString().replaceAll("[\\[\\] ]", "")',
                'r.sample(Arrays.asList(0,1,2,3,4),3,k).toString().replaceAll("[\\[\\] ]", "")',
                "r.weightedChoice(Arrays.asList(0,1,2,3),Arrays.asList(0L,80L,18L,2L),k)",
                "r.prepareWeightedChoice(Arrays.asList(0,1,2,3),Arrays.asList(0L,80L,18L,2L)).choose(k)",
            ]
            # Avoid Java regular expression escaping in generated source.
            calls = [
                c.replace(
                    '.replaceAll("[\\[\\] ]", "")',
                    '.replace("[", "").replace("]", "").replace(" ", "")',
                )
                for c in calls
            ]
            lines += [f"System.out.println({call});" for call in calls] + ["}"]
        elif language == "kotlin":
            lines += [
                "run {",
                f"val r = EsinxeRandom({seed}UL).scope({prefix})",
                f"val k = arrayOf<Key>({keys})",
            ]
            calls = [
                "r.raw(*k)",
                "r.int(9223372036854775809UL,*k)",
                "r.range(Long.MIN_VALUE,Long.MAX_VALUE,*k)",
                "(r.float01(*k)*9007199254740992.0).toULong()",
                f"r.at2D(-17,42,{ns})",
                f"r.at3D(-17,42,Long.MIN_VALUE,{ns})",
                "r.chanceRatio(7,23,*k)",
                "r.choose(listOf(0,1,2,3),*k)",
                'r.shuffle(listOf(0,1,2,3),*k).joinToString(",")',
                'r.sample(listOf(0,1,2,3,4),3,*k).joinToString(",")',
                "r.weightedChoice(listOf(0,1,2,3),listOf(0UL,80UL,18UL,2UL),*k)",
                "r.prepareWeightedChoice(listOf(0,1,2,3),listOf(0UL,80UL,18UL,2UL)).choose(*k)",
            ]
            lines += [f"println({call})" for call in calls] + ["}"]
        else:
            lines += [
                f"r = Esinxe::Generator.new({seed}).scope({prefix})",
                f"k = [{keys}]",
            ]
            calls = [
                "r.raw(*k)",
                "r.int(9223372036854775809,*k)",
                "r.range(-9223372036854775808,9223372036854775807,*k)",
                "(r.float01(*k)*9007199254740992).to_i",
                f"r.at2D(-17,42,{ns})",
                f"r.at3D(-17,42,-9223372036854775808,{ns})",
                "r.chanceRatio(7,23,*k)",
                "r.choose([0,1,2,3],*k)",
                'r.shuffle([0,1,2,3],*k).join(",")',
                'r.sample([0,1,2,3,4],3,*k).join(",")',
                "r.weightedChoice([0,1,2,3],[0,80,18,2],*k)",
                "r.prepare_weighted_choice([0,1,2,3],[0,80,18,2]).choose(*k)",
            ]
            lines += [f"puts({call})" for call in calls]
        for name in (
            "raw",
            "int",
            "range",
            "floatUpper53",
            "at2D",
            "at3D",
            "chanceRatio",
            "choose",
            "shuffle",
            "sample",
            "weightedChoice",
            "weightedChoice",
        ):
            value = case["expected"][name]
            expected.append(
                ",".join(map(str, value))
                if isinstance(value, list)
                else str(value).lower()
                if isinstance(value, bool)
                else str(value)
            )
    return "\n".join(lines), expected


class ManagedHelpers(unittest.TestCase):
    def run_checked(self, args, **kwargs):
        result = subprocess.run(
            args, cwd=ROOT, text=True, encoding="utf-8", capture_output=True, **kwargs
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout.splitlines()

    def test_ruby_corpus(self):
        if not shutil.which("ruby"):
            self.skipTest("ruby is not installed")
        body, expected = corpus_source("ruby")
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "helpers.rb"
            source.write_text(
                "# encoding: UTF-8\nload "
                + quoted(str(ROOT / "Ruby/Esinxeruby1-0-0.rb"), "ruby")
                + "\n"
                + body
                + "\n"
                + RUBY_EDGES,
                encoding="utf-8",
            )
            self.assertEqual(self.run_checked(["ruby", str(source)]), expected)

    def test_java_corpus(self):
        if not shutil.which("javac") or not shutil.which("java"):
            self.skipTest("java is not installed")
        body, expected = corpus_source("java")
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "Helpers.java"
            source.write_text(
                "import com.esinxe.Random; import java.util.*; import java.math.BigInteger;\npublic class Helpers { public static void main(String[] args) {\n"
                + body
                + "\n"
                + JAVA_EDGES
                + '\n} static void check(boolean ok) {if(!ok) throw new AssertionError();} static void bad(Runnable f) {try{f.run();}catch(RuntimeException e){return;}throw new AssertionError("expected failure");}}',
                encoding="utf-8",
            )
            self.run_checked(
                [
                    "javac",
                    "-encoding",
                    "UTF-8",
                    "-Xlint:all",
                    "-Werror",
                    "-d",
                    directory,
                    str(ROOT / "JVM/java/com/esinxe/Random.java"),
                    str(source),
                ]
            )
            self.assertEqual(
                self.run_checked(["java", "-cp", directory, "Helpers"]), expected
            )

    def test_csharp_corpus(self):
        dotnet = shutil.which("dotnet")
        if not dotnet:
            self.skipTest("dotnet is not installed")
        body, expected = corpus_source("csharp")
        with tempfile.TemporaryDirectory() as directory:
            tmp = Path(directory)
            shutil.copyfile(ROOT / "C#/Esinxecs1-0-0.cs", tmp / "Random.cs")
            (tmp / "Program.cs").write_text(
                "using System; using System.Collections.Generic; using R = Esinxecs.Random;\nclass Program { static void Main() {\n"
                + body
                + "\n"
                + CSHARP_EDGES
                + '\n} static void Check(bool ok) {if(!ok) throw new Exception("assertion");} static void Bad(Action f) {try{f();}catch(ArgumentException){return;}catch(OverflowException){return;}throw new Exception("expected failure");}}',
                encoding="utf-8",
            )
            (tmp / "Helpers.csproj").write_text(
                '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors><CheckForOverflowUnderflow>true</CheckForOverflowUnderflow></PropertyGroup></Project>',
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
            self.run_checked(
                [dotnet, "build", str(tmp / "Helpers.csproj"), "--nologo", "-v:q"],
                env=env,
            )
            self.assertEqual(
                self.run_checked(
                    [dotnet, str(tmp / "bin/Debug/net8.0/Helpers.dll")], env=env
                ),
                expected,
            )

    def test_kotlin_corpus(self):
        compiler = shutil.which("kotlinc") or shutil.which("kotlinc.bat")
        if not compiler:
            self.skipTest("kotlinc is not installed")
        body, expected = corpus_source("kotlin")
        with tempfile.TemporaryDirectory() as directory:
            tmp = Path(directory)
            (tmp / "Helpers.kt").write_text(
                "import com.esinxe.*\nfun main() {\n"
                + body
                + "\n"
                + KOTLIN_EDGES
                + '\n}\nfun bad(f: () -> Unit) {try {f()} catch(e: IllegalArgumentException) {return} catch(e: java.nio.charset.CharacterCodingException) {return}; error("expected failure")}',
                encoding="utf-8",
            )
            self.run_checked(
                [
                    compiler,
                    str(ROOT / "JVM/kotlin/Esinxe.kt"),
                    str(tmp / "Helpers.kt"),
                    "-include-runtime",
                    "-d",
                    str(tmp / "helpers.jar"),
                ]
            )
            self.assertEqual(
                self.run_checked(["java", "-jar", str(tmp / "helpers.jar")]), expected
            )


RUBY_EDGES = """
def check(ok); raise "assertion" unless ok; end
def bad; begin; yield; rescue ArgumentError, TypeError, RangeError, EncodingError; return; end; raise "expected failure"; end
r = Esinxe::Generator.new(42)
bytes = "abc".b; prefix = Esinxe.bytes(bytes)
s = r.scope(prefix).scope("nested")
baseline = s.raw("key"); bytes.replace("xyz"); prefix[1].replace("xyz")
check(s.raw("key") == baseline)
check(s.raw("key") == Esinxe::Generator.new(42).raw(Esinxe.bytes("abc"),"nested","key"))
items = [0,1,2,3]; weights = [0,80,18,2]
p = s.prepare_weighted_choice(items,weights)
100.times { |i| check(p.choose(i) == s.weightedChoice(items,weights,i)) }
saved = p.choose("key"); items.replace([9]); weights.replace([1]); s.SetSeed(99); r.SetSeed(100)
check(p.choose("key") == saved)
check(Esinxe::Generator.new(42).scope("x").NextRaw == Esinxe::Generator.new(42).NextRaw)
r = Esinxe::Generator.new(42); a = [0,1,2,3,4]; copy = a.dup
check(r.sample(a,2,"k") == r.sample(a,5,"k").take(2)); check(a == copy)
check(r.sample([],0).empty?)
check(r.sample([1,1,1],2).length == 2)
bad { r.int(0) }; bad { r.range(1,1) }; bad { r.chanceRatio(1,0) }; bad { r.choose([]) }
bad { r.sample(a,-1) }; bad { r.sample(a,6) }; bad { r.sample(a,1.5) }; bad { r.sample([],0,Object.new) }
bad { r.prepare_weighted_choice([],[]) }; bad { r.prepare_weighted_choice([1],[0]) }; bad { r.prepare_weighted_choice([1,2],[Esinxe::Mask64,1]) }; bad { r.prepare_weighted_choice([1],[-1]) }; bad { r.prepare_weighted_choice([1],[1.5]) }
"""

JAVA_EDGES = """
Random r = new Random(42); byte[] bytes = {1,2}; Random.Key[] prefix = {Random.Key.bytes(bytes)};
Random s = r.scope(prefix).scope(Random.Key.string("nested")); long baseline = s.raw(); bytes[0]=9; prefix[0]=Random.Key.u64(8);
check(s.raw()==baseline); check(s.raw()==new Random(42).raw(Random.Key.bytes(new byte[]{1,2}),Random.Key.string("nested")));
List<Integer> items = new ArrayList<>(Arrays.asList(0,1,2,3)); List<Long> weights = new ArrayList<>(Arrays.asList(0L,80L,18L,2L));
Random.PreparedWeightedChoice<Integer> p = s.prepareWeightedChoice(items,weights);
for(int i=0;i<100;i++) check(p.choose(Random.Key.u64(i)).equals(s.weightedChoice(items,weights,Random.Key.u64(i))));
int saved=p.choose(); items.clear(); weights.clear(); s.setSeed(99); r.setSeed(100); check(p.choose()==saved);
check(new Random(42).scope(Random.Key.string("x")).nextRaw()==new Random(42).nextRaw());
List<Integer> a=Arrays.asList(0,1,2,3,4); check(r.sample(a,2).equals(r.sample(a,5).subList(0,2))); check(a.equals(Arrays.asList(0,1,2,3,4)));
check(r.sample(Arrays.asList(1,1,1),2).size()==2); bad(()->r.intValue(0)); bad(()->r.range(1,1)); bad(()->r.chanceRatio(1,0)); bad(()->r.choose(Collections.emptyList()));
List<Long> maxWeights=Arrays.asList(Long.MAX_VALUE,Long.MAX_VALUE,1L); check(r.prepareWeightedChoice(Arrays.asList(0,1,2),maxWeights).choose().equals(r.weightedChoice(Arrays.asList(0,1,2),maxWeights)));
check(r.sample(Collections.emptyList(),0).isEmpty()); bad(()->r.sample(a,-1)); bad(()->r.sample(a,6)); bad(()->r.sample(Collections.emptyList(),0,(Random.Key)null));
bad(()->r.prepareWeightedChoice(Collections.emptyList(),Collections.emptyList())); bad(()->r.prepareWeightedChoice(Arrays.asList(1),Arrays.asList(0L))); bad(()->r.prepareWeightedChoice(Arrays.asList(1,2,3),Arrays.asList(Long.MAX_VALUE,Long.MAX_VALUE,2L))); bad(()->r.prepareWeightedChoice(Arrays.asList(1),Arrays.asList(-1L)));
"""

CSHARP_EDGES = """
var r0 = new R(42); byte[] bytes = {1,2}; R.Key[] prefix = {R.Key.Bytes(bytes)};
var s0 = r0.Scope(prefix).Scope(R.Key.String("nested")); ulong baseline = s0.Raw(); bytes[0]=9; prefix[0]=R.Key.U64(8);
Check(s0.Raw()==baseline); Check(s0.Raw()==new R(42).Raw(R.Key.Bytes(new byte[]{1,2}),R.Key.String("nested")));
var items0 = new List<int>{0,1,2,3}; var weights0 = new List<ulong>{0,80,18,2}; var prepared = s0.PrepareWeightedChoice(items0,weights0);
for(ulong i=0;i<100;i++) Check(prepared.Choose(R.Key.U64(i))==s0.WeightedChoice(items0,weights0,R.Key.U64(i)));
int saved=prepared.Choose(); items0.Clear(); weights0.Clear(); s0.SetSeed(99); r0.SetSeed(100); Check(prepared.Choose()==saved);
Check(new R(42).Scope(R.Key.String("x")).NextRaw()==new R(42).NextRaw());
var a = new[]{0,1,2,3,4}; Check(string.Join(",",r0.Sample(a,2))==string.Join(",",r0.Sample(a,5).GetRange(0,2))); Check(string.Join(",",a)=="0,1,2,3,4");
Check(r0.Sample(new[]{1,1,1},2).Count==2); Bad(()=>r0.Int(0)); Bad(()=>r0.Range(1,1)); Bad(()=>r0.ChanceRatio(1,0)); Bad(()=>r0.Choose(Array.Empty<int>()));
Check(r0.PrepareWeightedChoice(new[]{0,1},new[]{0UL,ulong.MaxValue}).Choose()==1);
Check(r0.Sample(Array.Empty<int>(),0).Count==0); Bad(()=>r0.Sample(a,-1)); Bad(()=>r0.Sample(a,6)); Bad(()=>r0.Sample(Array.Empty<int>(),0,new R.Key[]{null!}));
Bad(()=>r0.PrepareWeightedChoice(Array.Empty<int>(),Array.Empty<ulong>())); Bad(()=>r0.PrepareWeightedChoice(new[]{1},new ulong[]{0})); Bad(()=>r0.PrepareWeightedChoice(new[]{1,2},new[]{ulong.MaxValue,1UL}));
"""

KOTLIN_EDGES = """
val r0=EsinxeRandom(42UL); val bytes=byteArrayOf(1,2); val prefix=Key.BytesValue(bytes)
val s0=r0.scope(prefix).scope(Key.string("nested")); val baseline=s0.raw(); bytes[0]=9
check(s0.raw()==baseline); check(s0.raw()==EsinxeRandom(42UL).raw(Key.bytes(byteArrayOf(1,2)),Key.string("nested")))
val items0=mutableListOf(0,1,2,3); val weights0=mutableListOf(0UL,80UL,18UL,2UL); val p=s0.prepareWeightedChoice(items0,weights0)
for(i in 0..100) check(p.choose(Key.u64(i.toULong()))==s0.weightedChoice(items0,weights0,Key.u64(i.toULong())))
val saved=p.choose(); items0.clear(); weights0.clear(); s0.setSeed(99UL); r0.setSeed(100UL); check(p.choose()==saved)
check(EsinxeRandom(42UL).scope(Key.string("x")).nextRaw()==EsinxeRandom(42UL).nextRaw())
val a=listOf(0,1,2,3,4); check(r0.sample(a,2)==r0.sample(a,5).take(2)); check(a==listOf(0,1,2,3,4)); check(r0.sample(emptyList<Int>(),0).isEmpty())
check(r0.sample(listOf(1,1,1),2).size==2); bad {r0.int(0UL)}; bad {r0.range(1,1)}; bad {r0.chanceRatio(1,0)}; bad {r0.choose(emptyList<Int>())}
check(r0.prepareWeightedChoice(listOf(0,1),listOf(0UL,ULong.MAX_VALUE)).choose()==1)
bad {r0.sample(a,-1)}; bad {r0.sample(a,6)}; bad {r0.sample(emptyList<Int>(),0,Key.StringValue("\\uD800"))}
bad {r0.prepareWeightedChoice(emptyList<Int>(),emptyList<ULong>())}; bad {r0.prepareWeightedChoice(listOf(1),listOf(0UL))}; bad {r0.prepareWeightedChoice(listOf(1,2),listOf(ULong.MAX_VALUE,1UL))}
"""
