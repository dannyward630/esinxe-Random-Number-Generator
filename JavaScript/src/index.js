export const MASK_64 = (1n << 64n) - 1n;
export const UINT64_SIZE = 1n << 64n;
export const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
export const MAX_INT_VALUE = 1_000_000_000_000_000_000n;
const MAX_INT_THRESHOLD = (UINT64_SIZE - MAX_INT_VALUE) % MAX_INT_VALUE;

export function mix64(value) {
  value = BigInt(value) & MASK_64;
  value = ((value ^ (value >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK_64;
  value = ((value ^ (value >> 27n)) * 0x94D049BB133111EBn) & MASK_64;
  return (value ^ (value >> 31n)) & MASK_64;
}

function boundedRaw(value, maxValue) {
  maxValue = BigInt(maxValue);
  if (maxValue <= 0n) return 0n;

  const threshold = (UINT64_SIZE - maxValue) % maxValue;
  let nonce = 0n;
  while (value < threshold) {
    nonce += 1n;
    value = mix64(value + nonce * GOLDEN_GAMMA);
  }
  return value % maxValue;
}

function boundedMaxInt(value) {
  let nonce = 0n;
  while (value < MAX_INT_THRESHOLD) {
    nonce += 1n;
    value = mix64(value + nonce * GOLDEN_GAMMA);
  }
  return value % MAX_INT_VALUE;
}

export class Random {
  constructor(seed = Date.now()) {
    this.seed = BigInt(seed) & MASK_64;
    this.index = 0n;
    this.key = this.seed;
  }

  setSeed(seed) {
    this.seed = BigInt(seed) & MASK_64;
    this.index = 0n;
    this.key = this.seed;
  }

  SetSeed(seed) {
    this.setSeed(seed);
  }

  rawAt(offset) {
    return mix64(this.seed + BigInt(offset) * GOLDEN_GAMMA);
  }

  nextRawAt(offset) {
    return this.rawAt(offset);
  }

  NextRawAt(offset) {
    return this.nextRawAt(offset);
  }

  nextRaw() {
    const value = mix64(this.key);
    this.key = (this.key + GOLDEN_GAMMA) & MASK_64;
    this.index += 1n;
    return value;
  }

  NextRaw() {
    return this.nextRaw();
  }

  nextAt(offset) {
    return boundedMaxInt(this.rawAt(offset));
  }

  NextAt(offset) {
    return this.nextAt(offset);
  }

  next() {
    const value = boundedMaxInt(mix64(this.key));
    this.key = (this.key + GOLDEN_GAMMA) & MASK_64;
    this.index += 1n;
    return value;
  }

  Next() {
    return this.next();
  }

  nextMaxAt(offset, maxValue) {
    return boundedRaw(this.rawAt(offset), maxValue);
  }

  NextMaxAt(offset, maxValue) {
    return this.nextMaxAt(offset, maxValue);
  }

  nextMax(maxValue) {
    const value = boundedRaw(mix64(this.key), maxValue);
    this.key = (this.key + GOLDEN_GAMMA) & MASK_64;
    this.index += 1n;
    return value;
  }

  NextMax(maxValue) {
    return this.nextMax(maxValue);
  }

  nextMinMaxAt(offset, minValue, maxValue) {
    minValue = BigInt(minValue);
    maxValue = BigInt(maxValue);
    if (maxValue <= minValue) return null;
    return minValue + this.nextMaxAt(offset, maxValue - minValue);
  }

  NextMinMaxAt(offset, minValue, maxValue) {
    return this.nextMinMaxAt(offset, minValue, maxValue);
  }

  nextMinMax(minValue, maxValue) {
    minValue = BigInt(minValue);
    maxValue = BigInt(maxValue);
    let value = null;
    if (maxValue > minValue) {
      value = minValue + boundedRaw(mix64(this.key), maxValue - minValue);
    }
    this.key = (this.key + GOLDEN_GAMMA) & MASK_64;
    this.index += 1n;
    return value;
  }

  NextMinMax(minValue, maxValue) {
    return this.nextMinMax(minValue, maxValue);
  }

  nextList(length) {
    length = Math.max(0, Number(length));
    const values = new Array(length);
    for (let i = 0; i < length; i++) values[i] = this.next();
    return values;
  }

  NextList(length) {
    return this.nextList(length);
  }

  nextListMax(length, maxValue) {
    length = Math.max(0, Number(length));
    const values = new Array(length);
    for (let i = 0; i < length; i++) values[i] = this.nextMax(maxValue);
    return values;
  }

  NextListMax(length, maxValue) {
    return this.nextListMax(length, maxValue);
  }

  nextListMinMax(length, minValue, maxValue) {
    length = Math.max(0, Number(length));
    const values = new Array(length);
    for (let i = 0; i < length; i++) values[i] = this.nextMinMax(minValue, maxValue);
    return values;
  }

  NextListMinMax(length, minValue, maxValue) {
    return this.nextListMinMax(length, minValue, maxValue);
  }
}
