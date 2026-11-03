"""Compile Rust/Go checks generated directly from the shared conformance corpus.

Libraries and packaged crate tests remain self-contained and need no JSON parser.
No expected conformance values are duplicated in these adapters.
"""

import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS = json.loads((ROOT / "tests/conformance-v1.json").read_text(encoding="utf-8"))
STABLE = {
    row["id"]: row
    for row in json.loads(
        (ROOT / "tests/stable-choice-v1.json").read_text(encoding="utf-8")
    )["cases"]
}


def rust_bytes(data):
    return "&[" + ",".join(map(str, data)) + "]"


def rust_string(value):
    return "std::str::from_utf8(" + rust_bytes(value.encode("utf-8")) + ").unwrap()"


def rust_key(key):
    kind, value = key["type"], key["value"]
    if kind == "i64":
        return f"Key::I64({value}i64)"
    if kind == "u64":
        return f"Key::U64({value}u64)"
    if kind == "bytes":
        return "Key::Bytes(" + rust_bytes(bytes.fromhex(value)) + ")"
    return "Key::Str(" + rust_string(value) + ")"


def go_bytes(data):
    return "[]byte{" + ",".join(map(str, data)) + "}"


def go_string(value):
    return "string(" + go_bytes(value.encode("utf-8")) + ")"


def go_key(key):
    kind, value = key["type"], key["value"]
    if kind == "i64":
        return f"e.I64({value})"
    if kind == "u64":
        return f"e.U64({value})"
    if kind == "bytes":
        return "e.Bytes(" + go_bytes(bytes.fromhex(value)) + ")"
    return "e.String(" + go_string(value) + ")"


class ModernHelperConformanceTests(unittest.TestCase):
    def run_checked(self, command, cwd):
        result = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=180,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    @unittest.skipUnless(shutil.which("cargo"), "cargo is unavailable")
    def test_rust_shared_helper_corpus(self):
        p = CORPUS["parameters"]
        blocks = []
        for row in CORPUS["cases"]:
            e = row["expected"]
            stable = STABLE[row["id"]]
            ids = ",".join(map(rust_string, stable["ids"]))
            indices = ",".join(map(str, range(len(stable["ids"]))))
            winner = stable["ids"].index(stable["expectedId"])
            keys = ",".join(map(rust_key, row["keys"]))
            prefix = ",".join(map(rust_key, row["prefix"]))
            ns = (
                "None"
                if row["namespace"] is None
                else "Some(" + rust_string(row["namespace"]) + ")"
            )
            blocks.append(f"""{{
                let mut root = Random::new({row["seed"]}u64);
                let mut field = root.scope(&[{prefix}]);
                let keys = &[{keys}];
                let items = [0usize, 1, 2, 3];
                let weights = [{",".join(value + "u64" for value in p["weights"])}];
                assert_eq!(field.raw(keys), {e["raw"]}u64);
                assert_eq!(field.int({p["bound"]}u64, keys).unwrap(), {e["int"]}u64);
                assert_eq!(field.range({p["min"]}i64, {p["max"]}i64, keys).unwrap(), {e["range"]}i64);
                assert_eq!((field.float01(keys) * ((1u64 << 53) as f64)) as u64, {e["floatUpper53"]}u64);
                assert_eq!(field.at_2d({p["x"]}i64, {p["y"]}i64, {ns}), {e["at2D"]}u64);
                assert_eq!(field.at_3d({p["x"]}i64, {p["y"]}i64, {p["z"]}i64, {ns}), {e["at3D"]}u64);
                assert_eq!(field.chance_ratio({p["numerator"]}, {p["denominator"]}, keys).unwrap(), {str(e["chanceRatio"]).lower()});
                let mut stable_items = [{indices}]; let mut stable_ids = [{ids}];
                assert_eq!(*field.stable_choice(&stable_items, &stable_ids, keys).unwrap(), {winner});
                stable_items.reverse(); stable_ids.reverse();
                assert_eq!(*field.stable_choice(&stable_items, &stable_ids, keys).unwrap(), {winner});
                stable_ids[1] = stable_ids[0];
                assert!(field.stable_choice(&stable_items, &stable_ids, keys).is_err());
                assert!(field.stable_choice::<u8>(&[], &[], keys).is_err());
                assert_eq!(*field.choose(&items, keys).unwrap(), {e["choose"]});
                assert_eq!(field.shuffle(&items, keys), {e["shuffle"]!r});
                assert_eq!(field.sample(&[0usize,1,2,3,4], {p["sampleCount"]}, keys).unwrap(), {e["sample"]!r});
                assert_eq!(*field.weighted_choice(&items, &weights, keys).unwrap(), {e["weightedChoice"]});
                assert_eq!(*field.prepare_weighted_choice(&items, &weights).unwrap().choose(keys), {e["weightedChoice"]});
                assert_eq!(field.next_raw(), Random::new({row["seed"]}u64).next_raw());
                assert_eq!(root.next_raw(), Random::new({row["seed"]}u64).next_raw());
            }}""")
        with tempfile.TemporaryDirectory(prefix="esinxe-rust-corpus-") as temporary:
            target = Path(temporary)
            (target / "src").mkdir()
            manifest = (
                '[package]\nname="esinxe-corpus-check"\nversion="0.0.0"\nedition="2021"\n'
                "[dependencies]\nesinxe={path=" + json.dumps(str(ROOT / "Rust")) + "}\n"
            )
            (target / "Cargo.toml").write_text(manifest, encoding="utf-8")
            (target / "src/main.rs").write_text(
                "use esinxe::{Key, Random};\nfn main() {\n" + "\n".join(blocks) + "\n}",
                encoding="utf-8",
            )
            self.run_checked(["cargo", "run", "--quiet", "--offline"], target)

    @unittest.skipUnless(shutil.which("go"), "go is unavailable")
    def test_go_shared_helper_corpus(self):
        p = CORPUS["parameters"]
        blocks = []
        for row in CORPUS["cases"]:
            e = row["expected"]
            stable = STABLE[row["id"]]
            ids = ",".join(map(go_string, stable["ids"]))
            indices = ",".join(map(str, range(len(stable["ids"]))))
            winner = stable["ids"].index(stable["expectedId"])
            keys = ",".join(map(go_key, row["keys"]))
            prefix = ",".join(map(go_key, row["prefix"]))
            namespace = (
                "var ns *string"
                if row["namespace"] is None
                else "nsValue := " + go_string(row["namespace"]) + "; ns := &nsValue"
            )
            blocks.append(f"""{{
                root := e.New({row["seed"]}); field := root.Scope({prefix}); keys := []e.Key{{{keys}}}
                {namespace}
                items := []int{{0,1,2,3}}; weights := []uint64{{{",".join(p["weights"])}}}
                same(field.Raw(keys...), uint64({e["raw"]}))
                bounded, err := field.Int({p["bound"]}, keys...); check(err); same(bounded, uint64({e["int"]}))
                ranged, err := field.Range({p["min"]}, {p["max"]}, keys...); check(err); same(ranged, int64({e["range"]}))
                same(uint64(field.Float01(keys...)*(1<<53)), uint64({e["floatUpper53"]}))
                same(field.At2D({p["x"]}, {p["y"]}, ns), uint64({e["at2D"]}))
                same(field.At3D({p["x"]}, {p["y"]}, {p["z"]}, ns), uint64({e["at3D"]}))
                chance, err := field.ChanceRatio({p["numerator"]}, {p["denominator"]}, keys...); check(err); same(chance, {str(e["chanceRatio"]).lower()})
                stableItems := []int{{{indices}}}; stableIds := []string{{{ids}}}
                stable, err := e.StableChoice(field, stableItems, stableIds, keys...); check(err); same(stable, {winner})
                for i,j := 0,len(stableIds)-1; i<j; i,j=i+1,j-1 {{ stableIds[i],stableIds[j]=stableIds[j],stableIds[i]; stableItems[i],stableItems[j]=stableItems[j],stableItems[i] }}
                stable, err = e.StableChoice(field, stableItems, stableIds, keys...); check(err); same(stable, {winner})
                stableIds[1]=stableIds[0]; _, err = e.StableChoice(field, stableItems, stableIds, keys...); if err==nil {{ panic("duplicate IDs accepted") }}
                choice, err := e.Choose(field, items, keys...); check(err); same(choice, {e["choose"]})
                same(e.Shuffle(field, items, keys...), []int{{{",".join(map(str, e["shuffle"]))}}})
                sample, err := e.Sample(field, []int{{0,1,2,3,4}}, {p["sampleCount"]}, keys...); check(err); same(sample, []int{{{",".join(map(str, e["sample"]))}}})
                weighted, err := e.WeightedChoice(field, items, weights, keys...); check(err); same(weighted, {e["weightedChoice"]})
                prepared, err := e.PrepareWeightedChoice(field, items, weights); check(err); same(prepared.Choose(keys...), {e["weightedChoice"]})
                same(field.NextRaw(), e.New({row["seed"]}).NextRaw()); same(root.NextRaw(), e.New({row["seed"]}).NextRaw())
            }}""")
        with tempfile.TemporaryDirectory(prefix="esinxe-go-corpus-") as temporary:
            target = Path(temporary)
            module = "github.com/dannyward630/esinxe-Random-Number-Generator/Go"
            (target / "go.mod").write_text(
                "module esinxe-corpus-check\n\ngo 1.22\nrequire "
                + module
                + " v0.0.0\nreplace "
                + module
                + " => "
                + json.dumps(str(ROOT / "Go"))
                + "\n",
                encoding="utf-8",
            )
            source = (
                'package main\nimport ("reflect"; "fmt"; e "' + module + '/esinxe")\n'
                "func check(err error) { if err != nil { panic(err) } }\n"
                'func same(a, b any) { if !reflect.DeepEqual(a,b) { panic(fmt.Sprintf("got %v expected %v", a,b)) } }\n'
                "func main() {\n" + "\n".join(blocks) + "\n}\n"
            )
            (target / "main.go").write_text(source, encoding="utf-8")
            self.run_checked(["go", "run", "."], target)


if __name__ == "__main__":
    unittest.main()
