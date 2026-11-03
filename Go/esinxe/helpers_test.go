package esinxe

import (
	"reflect"
	"testing"
)

func TestPreparedRepeatedBoundsAndMaximumTotal(t *testing.T) {
	field := New(123).Scope(String("weights"))
	for _, weights := range [][]uint64{{0, 0, 1, 0}, {1, 0, 0, 1}, {0, ^uint64(0) - 1, 1, 0}} {
		items := []int{0, 1, 2, 3}
		prepared, err := PrepareWeightedChoice(field, items, weights)
		if err != nil {
			t.Fatal(err)
		}
		for i := uint64(0); i < 200; i++ {
			expected, _ := WeightedChoice(field, items, weights, U64(i))
			if prepared.Choose(U64(i)) != expected {
				t.Fatal("prepared parity", weights, i)
			}
		}
	}
}

func TestScopeCopiesKeyData(t *testing.T) {
	key := Bytes([]byte{1, 2})
	field := New(42).Scope(key)
	reference := New(42).Scope(Bytes([]byte{1, 2}))
	key.data[0] = 9
	if field.Raw() != reference.Raw() {
		t.Fatal("scope retained caller key storage")
	}
}

func TestHelperSnapshots(t *testing.T) {
	root := New(42)
	bytes := []byte{1, 2}
	scoped := root.Scope(Bytes(bytes))
	reference := New(42).Scope(Bytes([]byte{1, 2}))
	nested := scoped.Scope(String("nested"))
	if nested.Raw(String("k")) != reference.Raw(String("nested"), String("k")) {
		t.Fatal("nested prefix")
	}
	items, weights := []string{"zero", "one", "two"}, []uint64{0, 1, 3}
	prepared, err := PrepareWeightedChoice(scoped, items, weights)
	if err != nil {
		t.Fatal(err)
	}
	bytes[0] = 9
	root.SetSeed(9)
	if scoped.Raw() != reference.Raw() {
		t.Fatal("seed/prefix snapshot")
	}
	items[1] = "changed"
	weights[1] = 0
	scoped.SetSeed(8)
	for i := uint64(0); i < 200; i++ {
		expected, _ := WeightedChoice(reference, []string{"zero", "one", "two"}, []uint64{0, 1, 3}, U64(i))
		if prepared.Choose(U64(i)) != expected {
			t.Fatal("prepared snapshot")
		}
	}
	if nested.NextRaw() != New(42).NextRaw() || root.NextRaw() != New(9).NextRaw() {
		t.Fatal("stream isolation")
	}
	values := []int{1, 1, 2, 3}
	full, _ := Sample(reference, values, len(values))
	for count := 0; count <= len(values); count++ {
		got, err := Sample(reference, values, count)
		if err != nil || !reflect.DeepEqual(got, full[:count]) {
			t.Fatal("sample prefix", count, got, err)
		}
	}
	for _, count := range []int{-1, 5} {
		if _, err := Sample(reference, values, count); err == nil {
			t.Fatal("invalid count")
		}
	}
	for _, weights := range [][]uint64{{0, 0}, {1}, {^uint64(0), 1}} {
		if _, err := PrepareWeightedChoice(reference, []int{1, 2}, weights); err == nil {
			t.Fatal("invalid weights")
		}
	}
}

func TestSampleRejectsInvalidKeyWithZeroCount(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Fatal("invalid key accepted")
		}
	}()
	Sample(New(0), []int{}, 0, Key{})
}
