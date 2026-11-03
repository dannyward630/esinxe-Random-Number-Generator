"""Compile native conformance programs directly from the shared typed corpus."""
import json
import unittest

from test_esinxe import ROOT, compile_and_run

CORPUS = json.loads((ROOT / "tests/conformance-v1.json").read_text(encoding="utf-8"))


def u64(value):
    return f"UINT64_C({value})"


def i64(value):
    return "INT64_MIN" if int(value) == -(1 << 63) else f"INT64_C({value})"


def literal(value):
    data = value.encode("utf-8")
    return '"' + ''.join(f"\\{byte:03o}" for byte in data) + '"'


def component(key, cpp):
    kind, value = key["type"], key["value"]
    if kind == "i64":
        return ("Key::Signed" if cpp else "EsinxeI64") + f"({i64(value)})"
    if kind == "u64":
        return ("Key::Unsigned" if cpp else "EsinxeU64") + f"({u64(value)})"
    data = value.encode("utf-8") if kind == "string" else bytes.fromhex(value)
    if cpp:
        if kind == "string":
            return f"Key::Utf8(std::string({literal(value)}, {len(data)}))"
        return "Key::Bytes({" + ','.join(map(str, data)) + "})"
    payload = '"' + ''.join(f"\\{byte:03o}" for byte in data) + '"'
    return f"{'EsinxeStringN' if kind == 'string' else 'EsinxeBytes'}({payload}, {len(data)})"


class NativeHelperTests(unittest.TestCase):
    def test_cpp_scopes_start_fresh_streams_without_advancing_parent(self):
        source = r'''
#include <cassert>
#include "C++/Esinxecpp1-0-0.h"
using namespace Esinxecpp;
int main() {
    Random root(42), control(42), fresh(42);
    for (int i = 0; i < 4; ++i) assert(root.NextRaw() == control.NextRaw());
    auto emptyScope = root.Scope({});
    auto prefixedScope = root.Scope({Key::Utf8("parent")});
    assert(emptyScope.NextRaw() == fresh.NextRaw());
    assert(prefixedScope.NextRaw() == Random(42).NextRaw());
    prefixedScope.NextRaw();
    auto nested = prefixedScope.Scope({Key::Utf8("child")});
    assert(nested.NextRaw() == Random(42).NextRaw());
    assert(nested.Raw() == Random(42).Raw({Key::Utf8("parent"),Key::Utf8("child")}));
    assert(root.NextRaw() == control.NextRaw());
    assert(prefixedScope.NextRaw() == Random(42).NextRawAt(2));
}
'''
        compile_and_run("cpp", source)

    def test_cpp_boolean_collections_preserve_values(self):
        source = r'''
#include <cassert>
#include <type_traits>
#include "C++/Esinxecpp1-0-0.h"
using namespace Esinxecpp;
int main() {
    Random field(42);
    auto scoped = field.Scope({Key::Utf8("boolean-values")});
    std::vector<bool> bits = {false,true,false,true,true};
    std::vector<int> numbers = {0,1,0,1,1};
    std::vector<uint64_t> weights = {0,80,18,2,0};
    auto prepared = scoped.PrepareWeightedChoice(bits, weights);
    static_assert(std::is_same_v<decltype(scoped.Choose(bits)), std::vector<bool>::const_reference>);
    static_assert(std::is_same_v<decltype(scoped.WeightedChoice(bits, weights)), std::vector<bool>::const_reference>);
    static_assert(std::is_same_v<decltype(prepared.Choose()), std::vector<bool>::const_reference>);
    static_assert(std::is_same_v<decltype(scoped.Choose(numbers)), const int &>);
    for (uint64_t index = 0; index < 100; ++index) {
        std::vector<Key> keys = {Key::Unsigned(index)};
        assert(scoped.Choose(bits, keys) == (scoped.Choose(numbers, keys) != 0));
        assert(scoped.WeightedChoice(bits, weights, keys) == (scoped.WeightedChoice(numbers, weights, keys) != 0));
        assert(prepared.Choose(keys) == (scoped.WeightedChoice(numbers, weights, keys) != 0));
        const auto shuffledBits = scoped.Shuffle(bits, keys);
        const auto shuffledNumbers = scoped.Shuffle(numbers, keys);
        for (size_t i = 0; i < bits.size(); ++i)
            assert(shuffledBits[i] == (shuffledNumbers[i] != 0));
        const auto sampledBits = scoped.Sample(bits, 3, keys);
        const auto sampledNumbers = scoped.Sample(numbers, 3, keys);
        for (size_t i = 0; i < sampledBits.size(); ++i)
            assert(sampledBits[i] == (sampledNumbers[i] != 0));
        assert(scoped.Sample(bits, 0, keys).empty());
    }
    bits.assign(5, false); weights.assign(5, 0); scoped.SetSeed(99);
    for (uint64_t index = 0; index < 100; ++index) {
        std::vector<Key> keys = {Key::Unsigned(index)};
        assert(prepared.Choose(keys) == (field.Scope({Key::Utf8("boolean-values")}).WeightedChoice(numbers, {0,80,18,2,0}, keys) != 0));
    }
}
'''
        compile_and_run("cpp", source)

    def test_c_shared_corpus(self):
        p = CORPUS["parameters"]
        lines = ['#include <assert.h>', '#include <limits.h>', '#include "C/Esinxec1-0-0.h"', 'int main(void) {']
        for case in CORPUS["cases"]:
            e = case["expected"]
            prefix = ','.join(component(k, False) for k in case["prefix"]) or 'EsinxeU64(0)'
            keys = ','.join(component(k, False) for k in case["keys"]) or 'EsinxeU64(0)'
            ns = 'NULL' if case["namespace"] is None else literal(case["namespace"])
            nslen = 0 if case["namespace"] is None else len(case["namespace"].encode("utf-8"))
            lines += ['{', f'EsinxeKey prefix[] = {{{prefix}}}, keys[] = {{{keys}}};',
                      'EsinxeKey storage[8]; EsinxeFieldV1 base, field;',
                      f'EsinxeFieldInitV1(&base, {u64(case["seed"])});',
                      f'assert(EsinxeFieldScopeV1(&base, prefix, {len(case["prefix"])}, storage, 8, &field));',
                      f'size_t nk = {len(case["keys"])}; uint64_t number; int64_t ranged;',
                      f'assert(EsinxeFieldRawV1(&field, keys, nk) == {u64(e["raw"])});',
                      f'assert(EsinxeFieldIntV1(&field, {u64(p["bound"])}, keys, nk, &number) && number == {u64(e["int"])});',
                      f'assert(EsinxeFieldRangeV1(&field, {i64(p["min"])}, {i64(p["max"])}, keys, nk, &ranged) && ranged == {i64(e["range"])});',
                      f'assert(EsinxeFieldFloat01V1(&field, keys, nk) * 9007199254740992.0 == (double){u64(e["floatUpper53"])});',
                      f'assert(EsinxeFieldAt2DNV1(&field, {i64(p["x"])}, {i64(p["y"])}, {ns}, {nslen}) == {u64(e["at2D"])});',
                      f'assert(EsinxeFieldAt3DNV1(&field, {i64(p["x"])}, {i64(p["y"])}, {i64(p["z"])}, {ns}, {nslen}) == {u64(e["at3D"])});',
                      f'assert(EsinxeFieldChanceRatioV1(&field, {p["numerator"]}, {p["denominator"]}, keys, nk) == {int(e["chanceRatio"])});',
                      f'assert(EsinxeFieldChooseIndexV1(&field, 4, keys, nk) == {e["choose"]});',
                      f'int items[] = {{0,1,2,3}}, source[] = {{0,1,2,3,4}}, sampled[{p["sampleCount"]}];',
                      'assert(EsinxeFieldShuffleV1(&field, items, 4, sizeof(int), keys, nk));',
                      *[f'assert(items[{i}] == {v});' for i, v in enumerate(e['shuffle'])],
                      f'assert(EsinxeFieldSampleV1(&field, source, 5, sizeof(int), {p["sampleCount"]}, sampled, keys, nk));',
                      *[f'assert(sampled[{i}] == {v});' for i, v in enumerate(e['sample'])],
                      'assert(source[0] == 0 && source[4] == 4);',
                      'uint64_t weights[] = {' + ','.join(u64(w) for w in p['weights']) + '};',
                      'EsinxePreparedWeightedV1 prepared = {0};',
                      'assert(EsinxePreparedWeightedInitV1(&prepared, &field, weights, 4));',
                      f'assert(EsinxeFieldWeightedChoiceIndexV1(&field, weights, 4, keys, nk) == {e["weightedChoice"]});',
                      'weights[1] = 0; EsinxeFieldInitV1(&field, 999);',
                      f'assert(EsinxePreparedWeightedChooseV1(&prepared, keys, nk) == {e["weightedChoice"]});',
                      'EsinxePreparedWeightedFreeV1(&prepared);', '}']
        lines += [C_INVARIANTS, 'return 0; }']
        compile_and_run("c", '\n'.join(lines))

    def test_cpp_shared_corpus(self):
        p = CORPUS["parameters"]
        lines = ['#include <cassert>', '#include <climits>', '#include "C++/Esinxecpp1-0-0.h"', 'using namespace Esinxecpp;', 'int main() {']
        for case in CORPUS["cases"]:
            e = case["expected"]
            keys = ','.join(component(k, True) for k in case['keys'])
            prefix = ','.join(component(k, True) for k in case['prefix'])
            ns = 'std::nullopt' if case['namespace'] is None else f'std::string({literal(case["namespace"])}, {len(case["namespace"].encode("utf-8"))})'
            lines += ['{', f'Random base({u64(case["seed"])}); auto field = base.Scope({{{prefix}}});',
                      f'std::vector<Key> keys = {{{keys}}};',
                      f'assert(field.Raw(keys) == {u64(e["raw"])});',
                      f'assert(field.Int({u64(p["bound"])}, keys) == {u64(e["int"])});',
                      f'assert(field.Range({i64(p["min"])}, {i64(p["max"])}, keys) == {i64(e["range"])});',
                      f'assert(field.Float01(keys) * 9007199254740992.0 == (double){u64(e["floatUpper53"])});',
                      f'assert(field.At2D({i64(p["x"])}, {i64(p["y"])}, {ns}) == {u64(e["at2D"])});',
                      f'assert(field.At3D({i64(p["x"])}, {i64(p["y"])}, {i64(p["z"])}, {ns}) == {u64(e["at3D"])});',
                      f'assert(field.ChanceRatio({p["numerator"]}, {p["denominator"]}, keys) == {str(e["chanceRatio"]).lower()});',
                      'std::vector<int> items = {0,1,2,3}, source = {0,1,2,3,4};',
                      f'assert(field.Choose(items, keys) == {e["choose"]});',
                      'assert(field.Shuffle(items, keys) == std::vector<int>({' + ','.join(map(str,e['shuffle'])) + '}));',
                      f'assert(field.Sample(source, {p["sampleCount"]}, keys) == std::vector<int>({{' + ','.join(map(str,e['sample'])) + '}));',
                      'assert(source == std::vector<int>({0,1,2,3,4}));',
                      'std::vector<uint64_t> weights = {' + ','.join(u64(w) for w in p['weights']) + '};',
                      'auto prepared = field.PrepareWeightedChoice(items, weights);',
                      f'assert(field.WeightedChoice(items, weights, keys) == {e["weightedChoice"]});',
                      'items.assign(4,99); weights.assign(4,0); field.SetSeed(999);',
                      f'assert(prepared.Choose(keys) == {e["weightedChoice"]});', '}']
        lines += [CPP_INVARIANTS, 'return 0; }']
        compile_and_run("cpp", '\n'.join(lines))


C_INVARIANTS = r'''
{
    EsinxeRandom stream, control; EsinxeInit(&stream, 42); EsinxeInit(&control, 42);
    EsinxeFieldV1 base, a, b; EsinxeFieldInitV1(&base, stream.seed);
    EsinxeKey p = EsinxeString("a"), q = EsinxeI64(-1), sa[1], sb[2], all[2];
    assert(EsinxeFieldScopeV1(&base, &p, 1, sa, 1, &a));
    assert(EsinxeFieldScopeV1(&a, &q, 1, sb, 2, &b));
    all[0] = p; all[1] = q;
    assert(EsinxeFieldRawV1(&b, NULL, 0) == EsinxeRawV1(42, all, 2));
    uint64_t rejected; int64_t rejected_range;
    assert(!EsinxeFieldIntV1(&b, 0, NULL, 0, &rejected));
    assert(!EsinxeFieldRangeV1(&b, 1, 1, NULL, 0, &rejected_range));
    assert(EsinxeFieldChanceRatioV1(&b, 1, 0, NULL, 0) == -1);
    assert(EsinxeFieldChooseIndexV1(&b, 0, NULL, 0) == SIZE_MAX);
    assert(!EsinxeFieldScopeV1(&b, &q, 1, sa, 1, &a));
    EsinxeFieldInitV1(&base, 99);
    assert(EsinxeFieldRawV1(&b, NULL, 0) == EsinxeRawV1(42, all, 2));
    int source[3] = {7,7,9}, full[3], short_sample[1];
    assert(EsinxeFieldSampleV1(&b, source, 3, sizeof(int), 3, full, NULL, 0));
    assert(EsinxeFieldSampleV1(&b, source, 3, sizeof(int), 1, short_sample, NULL, 0));
    assert(full[0] == short_sample[0]);
    assert(!EsinxeFieldSampleV1(&b, source, 3, sizeof(int), 4, full, NULL, 0));
    assert(!EsinxeFieldSampleV1(&b, source, 3, sizeof(int), SIZE_MAX, full, NULL, 0));
    EsinxeKey invalid = EsinxeStringN("\xff", 1);
    assert(!EsinxeFieldSampleV1(&b, source, 3, sizeof(int), 0, NULL, &invalid, 1));
    assert(!EsinxeFieldSampleV1(&b, source, 3, SIZE_MAX, 0, NULL, NULL, 0));
    assert(EsinxeFieldSampleV1(&b, NULL, 0, sizeof(int), 0, NULL, NULL, 0));
    assert(!EsinxeFieldSampleV1(&b, source, 3, sizeof(int), 0, NULL, NULL, 1));
    uint64_t zero[] = {0,0}, over[] = {UINT64_MAX,1}, only[] = {0,1,0};
    EsinxePreparedWeightedV1 prepared = {0};
    assert(!EsinxePreparedWeightedInitV1(&prepared, &b, zero, 2));
    assert(!EsinxePreparedWeightedInitV1(&prepared, &b, over, 2));
    assert(EsinxePreparedWeightedInitV1(&prepared, &b, only, 3));
    for (uint64_t i = 0; i < 100; ++i) {
        EsinxeKey k = EsinxeU64(i);
        assert(EsinxePreparedWeightedChooseV1(&prepared, &k, 1) == 1);
    }
    assert(EsinxePreparedWeightedChooseV1(&prepared, &invalid, 1) == SIZE_MAX);
    EsinxePreparedWeightedFreeV1(&prepared); EsinxePreparedWeightedFreeV1(&prepared);
    unsigned char mutable_prefix[] = {1,2};
    EsinxeKey borrowed = EsinxeBytes(mutable_prefix, 2), borrowed_storage[1];
    EsinxeFieldV1 copied;
    /* A separate root avoids relying on mutable borrowed scope storage. */
    EsinxeFieldInitV1(&base, 42);
    assert(EsinxeFieldScopeV1(&base, &borrowed, 1, borrowed_storage, 1, &copied));
    uint64_t varied[] = {0,80,18,2,0};
    assert(EsinxePreparedWeightedInitV1(&prepared, &copied, varied, 5));
    size_t expected[100];
    for (uint64_t i = 0; i < 100; ++i) {
        EsinxeKey k = EsinxeU64(i);
        expected[i] = EsinxeFieldWeightedChoiceIndexV1(&copied, varied, 5, &k, 1);
        assert(EsinxePreparedWeightedChooseV1(&prepared, &k, 1) == expected[i]);
    }
    EsinxeFieldInitV1(&copied, 999); mutable_prefix[0] = 99;
    borrowed_storage[0] = EsinxeU64(123); varied[1] = 0;
    for (uint64_t i = 0; i < 100; ++i) {
        EsinxeKey k = EsinxeU64(i);
        assert(EsinxePreparedWeightedChooseV1(&prepared, &k, 1) == expected[i]);
    }
    uint64_t maximum[] = {UINT64_MAX,0};
    assert(EsinxePreparedWeightedInitV1(&prepared, &base, maximum, 2));
    assert(EsinxePreparedWeightedChooseV1(&prepared, NULL, 0) == 0);
    assert(!EsinxePreparedWeightedInitV1(&prepared, &base, zero, 2));
    assert(EsinxePreparedWeightedChooseV1(&prepared, NULL, 0) == 0);
    EsinxePreparedWeightedFreeV1(&prepared);
    assert(EsinxeNextRaw(&stream) == EsinxeNextRaw(&control));
    assert(EsinxeAt2DNV1(1,2,3,"a\0b",3) != EsinxeAt2DV1(1,2,3,"a"));
}
'''

CPP_INVARIANTS = r'''
{
    Random base(42), control(42);
    std::vector<Key> prefix = {Key::Bytes({1,2})};
    auto a = base.Scope(prefix); prefix[0].data[0] = 99;
    auto b = a.Scope({Key::Signed(-1)});
    assert(b.Raw() == base.Raw({Key::Bytes({1,2}),Key::Signed(-1)}));
    base.SetSeed(99);
    assert(b.Raw() == Random(42).Raw({Key::Bytes({1,2}),Key::Signed(-1)}));
    bool bad = false;
    try { b.Int(0); } catch (const std::invalid_argument &) { bad = true; }
    assert(bad); bad = false;
    try { b.Range(1,1); } catch (const std::invalid_argument &) { bad = true; }
    assert(bad); bad = false;
    try { b.ChanceRatio(1,0); } catch (const std::invalid_argument &) { bad = true; }
    assert(bad); bad = false;
    try { b.Choose(std::vector<int>{}); } catch (const std::invalid_argument &) { bad = true; }
    assert(bad);
    std::vector<int> items = {7,7,9};
    assert(b.Sample(items,1)[0] == b.Sample(items,3)[0]);
    bool failed = false;
    try { b.Sample(items,4); } catch (const std::invalid_argument &) { failed = true; }
    assert(failed); failed = false;
    try { b.Sample(items, static_cast<size_t>(-1)); } catch (const std::invalid_argument &) { failed = true; }
    assert(failed); failed = false;
    try { b.Sample(items,0,{Key::Utf8(std::string("\xff",1))}); }
    catch (const std::invalid_argument &) { failed = true; }
    assert(failed); failed = false;
    try { b.PrepareWeightedChoice(items,{0,0,0}); }
    catch (const std::invalid_argument &) { failed = true; }
    assert(failed); failed = false;
    try { b.PrepareWeightedChoice(items,{UINT64_MAX,1,0}); }
    catch (const std::overflow_error &) { failed = true; }
    assert(failed); failed = false;
    try { b.PrepareWeightedChoice(items,{1}); }
    catch (const std::invalid_argument &) { failed = true; }
    assert(failed);
    auto prepared = b.PrepareWeightedChoice(std::vector<int>{0,1,2},{0,1,0});
    for (uint64_t i=0; i<100; ++i) assert(prepared.Choose({Key::Unsigned(i)}) == 1);
    std::vector<int> labels = {0,1,2,3,4};
    std::vector<uint64_t> varied = {0,80,18,2,0};
    auto variedPrepared = b.PrepareWeightedChoice(labels, varied);
    for (uint64_t i=0; i<100; ++i) {
        auto k = std::vector<Key>{Key::Unsigned(i)};
        assert(variedPrepared.Choose(k) == b.WeightedChoice(labels, varied, k));
    }
    auto maximum = b.PrepareWeightedChoice(std::vector<int>{0,1},{UINT64_MAX,0});
    assert(maximum.Choose() == 0);
    assert(a.NextRaw() == control.NextRaw());
}
'''
