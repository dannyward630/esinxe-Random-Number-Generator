package esinxe

import "testing"

func TestMatchesSharedVectors(t *testing.T) {
	first := []uint64{
		540659726606785873,
		454886589211414944,
		778200017661327597,
		205171434679333405,
		248800117070709450,
	}
	raw := []uint64{
		17540659726606785873,
		2454886589211414944,
		3778200017661327597,
		2205171434679333405,
		3248800117070709450,
	}

	rng := New(12345)
	for i, expected := range first {
		if got := rng.Next(); got != expected {
			t.Fatalf("Next %d: got %d, want %d", i, got, expected)
		}
	}

	rng.SetSeed(12345)
	for i, expected := range raw {
		if got := rng.NextRawAt(uint64(i)); got != expected {
			t.Fatalf("NextRawAt %d: got %d, want %d", i, got, expected)
		}
	}
}

func TestBoundedAndRangedVectors(t *testing.T) {
	bounded := New(12345)
	for i, expected := range []uint64{73, 44, 97, 5, 50} {
		if got := bounded.NextMax(100); got != expected {
			t.Fatalf("NextMax %d: got %d, want %d", i, got, expected)
		}
	}

	ranged := New(12345)
	for i, expected := range []uint64{73, 94, 97, 55, 50} {
		got, ok := ranged.NextMinMax(50, 100)
		if !ok || got != expected {
			t.Fatalf("NextMinMax %d: got %d/%v, want %d/true", i, got, ok, expected)
		}
	}
}
