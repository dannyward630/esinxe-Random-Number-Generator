package esinxe

import "errors"

const (
	GoldenGamma    = uint64(0x9E3779B97F4A7C15)
	MaxIntValue    = uint64(1000000000000000000)
	FNVOffsetBasis = uint64(0xCBF29CE484222325)
	FNVPrime       = uint64(0x100000001B3)
)

var v1Prefix = []byte("esinxe-v1\x00")

type KeyKind byte

const (
	SignedKey KeyKind = iota + 1
	UnsignedKey
	StringKey
	BytesKey
)

type Key struct {
	kind  KeyKind
	value uint64
	data  []byte
}

func I64(value int64) Key {
	return Key{kind: SignedKey, value: uint64(value)}
}

func U64(value uint64) Key {
	return Key{kind: UnsignedKey, value: value}
}

func String(value string) Key {
	return Key{kind: StringKey, data: []byte(value)}
}

func Bytes(value []byte) Key {
	copyValue := append([]byte(nil), value...)
	return Key{kind: BytesKey, data: copyValue}
}

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

func fnvUpdate(hash uint64, data []byte) uint64 {
	for _, value := range data {
		hash ^= uint64(value)
		hash *= FNVPrime
	}
	return hash
}

func littleEndian64(value uint64) [8]byte {
	return [8]byte{
		byte(value),
		byte(value >> 8),
		byte(value >> 16),
		byte(value >> 24),
		byte(value >> 32),
		byte(value >> 40),
		byte(value >> 48),
		byte(value >> 56),
	}
}

func hashLength(hash uint64, length int) uint64 {
	encoded := littleEndian64(uint64(length))
	return fnvUpdate(hash, encoded[:])
}

func hashKey(hash uint64, key Key) uint64 {
	hash = fnvUpdate(hash, []byte{byte(key.kind)})
	if key.kind == SignedKey || key.kind == UnsignedKey {
		encoded := littleEndian64(key.value)
		return fnvUpdate(hash, encoded[:])
	}
	hash = hashLength(hash, len(key.data))
	return fnvUpdate(hash, key.data)
}

func keyedRaw(seed uint64, keys []Key, domain string) uint64 {
	hash := fnvUpdate(FNVOffsetBasis, v1Prefix)
	encodedSeed := littleEndian64(seed)
	hash = fnvUpdate(hash, encodedSeed[:])
	if domain != "" {
		hash = fnvUpdate(hash, []byte{0xF0})
		hash = hashLength(hash, len(domain))
		hash = fnvUpdate(hash, []byte(domain))
	}
	for _, key := range keys {
		hash = hashKey(hash, key)
	}
	return Mix64(hash)
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

func (r *Random) Raw(keys ...Key) uint64 {
	return keyedRaw(r.seed, keys, "")
}

func (r *Random) Int(maxValue uint64, keys ...Key) (uint64, error) {
	if maxValue == 0 {
		return 0, errors.New("maxValue must be positive")
	}
	return bounded(r.Raw(keys...), maxValue), nil
}

func (r *Random) Range(minValue int64, maxValue int64, keys ...Key) (int64, error) {
	if maxValue <= minValue {
		return 0, errors.New("maxValue must be greater than minValue")
	}
	width := uint64(maxValue) - uint64(minValue)
	offset := bounded(r.Raw(keys...), width)
	return int64(uint64(minValue) + offset), nil
}

func (r *Random) Float01(keys ...Key) float64 {
	return float64(r.Raw(keys...)>>11) / float64(uint64(1)<<53)
}

func (r *Random) At2D(x int64, y int64, namespace *string) uint64 {
	keys := []Key{I64(x), I64(y)}
	if namespace != nil {
		keys = append(keys, String(*namespace))
	}
	return keyedRaw(r.seed, keys, "at2d")
}

func (r *Random) At3D(x int64, y int64, z int64, namespace *string) uint64 {
	keys := []Key{I64(x), I64(y), I64(z)}
	if namespace != nil {
		keys = append(keys, String(*namespace))
	}
	return keyedRaw(r.seed, keys, "at3d")
}

func (r *Random) ChanceRatio(numerator uint64, denominator uint64, keys ...Key) (bool, error) {
	if denominator == 0 {
		return false, errors.New("denominator must be positive")
	}
	if numerator >= denominator {
		return true, nil
	}
	return bounded(r.Raw(keys...), denominator) < numerator, nil
}

func Choose[T any](r *Random, items []T, keys ...Key) (T, error) {
	var zero T
	if len(items) == 0 {
		return zero, errors.New("items must not be empty")
	}
	index := bounded(r.Raw(keys...), uint64(len(items)))
	return items[index], nil
}

func Shuffle[T any](r *Random, items []T, keys ...Key) []T {
	values := append([]T(nil), items...)
	for index := len(values) - 1; index > 0; index-- {
		iterationKeys := append(append([]Key(nil), keys...), U64(uint64(index)))
		picked := bounded(
			keyedRaw(r.seed, iterationKeys, "shuffle"),
			uint64(index+1),
		)
		values[index], values[picked] = values[picked], values[index]
	}
	return values
}

func WeightedChoice[T any](r *Random, items []T, weights []uint64, keys ...Key) (T, error) {
	var zero T
	if len(items) == 0 || len(items) != len(weights) {
		return zero, errors.New("items and weights must have the same non-zero length")
	}
	total := uint64(0)
	for _, weight := range weights {
		next := total + weight
		if next < total {
			return zero, errors.New("total weight overflows uint64")
		}
		total = next
	}
	if total == 0 {
		return zero, errors.New("total weight must be positive")
	}
	target := bounded(r.Raw(keys...), total)
	running := uint64(0)
	for index, weight := range weights {
		running += weight
		if target < running {
			return items[index], nil
		}
	}
	return zero, errors.New("unreachable weighted choice")
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
