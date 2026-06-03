package esinxe

const (
	GoldenGamma = uint64(0x9E3779B97F4A7C15)
	MaxIntValue = uint64(1000000000000000000)
)

func Mix64(value uint64) uint64 {
	value = (value ^ (value >> 30)) * 0xBF58476D1CE4E5B9
	value = (value ^ (value >> 27)) * 0x94D049BB133111EB
	return value ^ (value >> 31)
}

func bounded(value uint64, maxValue uint64) uint64 {
	if maxValue == 0 {
		return 0
	}
	threshold := -maxValue % maxValue
	nonce := uint64(0)
	for value < threshold {
		nonce++
		value = Mix64(value + nonce*GoldenGamma)
	}
	return value % maxValue
}

type Random struct {
	seed  uint64
	index uint64
	key   uint64
}

func New(seed uint64) *Random {
	return &Random{seed: seed, key: seed}
}

func (r *Random) SetSeed(seed uint64) {
	r.seed = seed
	r.index = 0
	r.key = seed
}

func (r *Random) NextRawAt(offset uint64) uint64 {
	return Mix64(r.seed + offset*GoldenGamma)
}

func (r *Random) NextRaw() uint64 {
	value := Mix64(r.key)
	r.key += GoldenGamma
	r.index++
	return value
}

func (r *Random) NextAt(offset uint64) uint64 {
	return bounded(r.NextRawAt(offset), MaxIntValue)
}

func (r *Random) Next() uint64 {
	value := bounded(Mix64(r.key), MaxIntValue)
	r.key += GoldenGamma
	r.index++
	return value
}

func (r *Random) NextMaxAt(offset uint64, maxValue uint64) uint64 {
	return bounded(r.NextRawAt(offset), maxValue)
}

func (r *Random) NextMax(maxValue uint64) uint64 {
	value := bounded(Mix64(r.key), maxValue)
	r.key += GoldenGamma
	r.index++
	return value
}

func (r *Random) NextMinMaxAt(offset uint64, minValue uint64, maxValue uint64) (uint64, bool) {
	if maxValue <= minValue {
		return minValue, false
	}
	return minValue + r.NextMaxAt(offset, maxValue-minValue), true
}

func (r *Random) NextMinMax(minValue uint64, maxValue uint64) (uint64, bool) {
	value := minValue
	ok := false
	if maxValue > minValue {
		value = minValue + bounded(Mix64(r.key), maxValue-minValue)
		ok = true
	}
	r.key += GoldenGamma
	r.index++
	return value, ok
}
