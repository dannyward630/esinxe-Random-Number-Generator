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

func TestKeyedAPIConformsToV1Vectors(t *testing.T) {
	rng := New(12345)
	key := []Key{
		I64(-1),
		U64(^uint64(0)),
		String("snowman \u2603"),
		Bytes([]byte{0, 1, 255}),
	}
	expectedNext := rng.NextRawAt(0)
	if got := rng.Raw(); got != 1011603955933495094 {
		t.Fatalf("Raw empty: %d", got)
	}
	if got := rng.Raw(I64(1)); got != 8375777008512348728 {
		t.Fatalf("Raw signed: %d", got)
	}
	if got := rng.Raw(U64(1)); got != 3036097878260785046 {
		t.Fatalf("Raw unsigned: %d", got)
	}
	if got := rng.Raw(key...); got != 12374036822843504307 {
		t.Fatalf("Raw mixed: %d", got)
	}
	if got := rng.Raw(key...) >> 11; got != 6042010167404054 {
		t.Fatalf("Float upper 53 bits: %d", got)
	}
	if got, err := rng.Int(100, key...); err != nil || got != 7 {
		t.Fatalf("Int: %d/%v", got, err)
	}
	if got, err := rng.Range(-500, 500, key...); err != nil || got != -193 {
		t.Fatalf("Range: %d/%v", got, err)
	}
	namespace := "terrain/\u96ea"
	if got := rng.At2D(-17, 42, &namespace); got != 7642296274646480051 {
		t.Fatalf("At2D: %d", got)
	}
	if got := rng.At2D(-17, 42, nil); got != 12949904772278389126 {
		t.Fatalf("At2D no namespace: %d", got)
	}
	caves := "caves"
	if got := rng.At3D(-17, 42, -1<<63, &caves); got != 3469495484090590785 {
		t.Fatalf("At3D: %d", got)
	}
	if got, err := rng.ChanceRatio(7, 23, key...); err != nil || got {
		t.Fatalf("ChanceRatio: %v/%v", got, err)
	}
	if got, _ := Choose(rng, []string{"forest", "desert", "tundra", "ocean"}, key...); got != "ocean" {
		t.Fatalf("Choose: %s", got)
	}
	gotShuffle := Shuffle(rng, []string{"forest", "desert", "tundra", "ocean"}, key...)
	wantShuffle := []string{"forest", "ocean", "tundra", "desert"}
	for index := range wantShuffle {
		if gotShuffle[index] != wantShuffle[index] {
			t.Fatalf("Shuffle: %#v", gotShuffle)
		}
	}
	if got, _ := WeightedChoice(rng, []string{"common", "rare", "legendary"}, []uint64{80, 18, 2}, key...); got != "common" {
		t.Fatalf("WeightedChoice: %s", got)
	}
	if got := rng.NextRaw(); got != expectedNext {
		t.Fatalf("keyed calls advanced stream: %d", got)
	}
}

func TestKeyedAPIRejectsInvalidInputs(t *testing.T) {
	rng := New(0)
	if _, err := rng.Int(0); err == nil {
		t.Fatal("Int accepted zero bound")
	}
	if _, err := rng.Range(5, 5); err == nil {
		t.Fatal("Range accepted empty range")
	}
	if _, err := rng.ChanceRatio(1, 0); err == nil {
		t.Fatal("ChanceRatio accepted zero denominator")
	}
	if _, err := Choose[string](rng, nil); err == nil {
		t.Fatal("Choose accepted empty items")
	}
	if _, err := WeightedChoice(rng, []string{"x"}, []uint64{0}); err == nil {
		t.Fatal("WeightedChoice accepted zero total")
	}
}
