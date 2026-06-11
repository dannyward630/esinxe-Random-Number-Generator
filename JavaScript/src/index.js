export const MASK_64 = (1n << 64n) - 1n;
export const UINT64_SIZE = 1n << 64n;
export const GOLDEN_GAMMA = 0x9E3779B97F4A7C15n;
export const MAX_INT_VALUE = 1_000_000_000_000_000_000n;
export const FNV_OFFSET_BASIS = 0xCBF29CE484222325n;
export const FNV_PRIME = 0x100000001B3n;
const MAX_INT_THRESHOLD = (UINT64_SIZE - MAX_INT_VALUE) % MAX_INT_VALUE;
const V1_PREFIX = new TextEncoder().encode("esinxe-v1\0");
const encoder = new TextEncoder();

function integer(value, name, allowString = false) {
  if (allowString && typeof value === "string" && /^[-+]?\d+$/.test(value)) {
    return BigInt(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${name} numbers must be safe integers; use bigint for larger values`);
    }
    return BigInt(value);
  }
  if (typeof value !== "bigint") {
    throw new TypeError(`${name} must be a bigint or integer number`);
  }
  return value;
}

export function i64(value) {
  value = integer(value, "signed key component");
  if (value < -(1n << 63n) || value >= (1n << 63n)) {
    throw new RangeError("signed key components must fit in int64");
  }
  return Object.freeze({ esinxeType: "i64", value });
}

export function u64(value) {
  value = integer(value, "unsigned key component");
  if (value < 0n || value > MASK_64) {
    throw new RangeError("unsigned key components must fit in uint64");
  }
  return Object.freeze({ esinxeType: "u64", value });
}

export function mix64(value) {
  value = integer(value, "value", true) & MASK_64;
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

function le64(value) {
  value = BigInt(value) & MASK_64;
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return bytes;
}

function lengthPrefixed(tag, data) {
  const encoded = new Uint8Array(9 + data.length);
  encoded[0] = tag;
  encoded.set(le64(data.length), 1);
  encoded.set(data, 9);
  return encoded;
}

function encodeComponent(component) {
  if (component?.esinxeType === "i64") {
    const encoded = new Uint8Array(9);
    encoded[0] = 0x01;
    encoded.set(le64(component.value), 1);
    return encoded;
  }
  if (component?.esinxeType === "u64") {
    const encoded = new Uint8Array(9);
    encoded[0] = 0x02;
    encoded.set(le64(component.value), 1);
    return encoded;
  }
  if (typeof component === "bigint" || typeof component === "number") {
    return encodeComponent(integer(component, "key component") < 0n ? i64(component) : u64(component));
  }
  if (typeof component === "string") {
    return lengthPrefixed(0x03, encoder.encode(component));
  }
  if (component instanceof Uint8Array) {
    return lengthPrefixed(0x04, component);
  }
  if (component instanceof ArrayBuffer) {
    return lengthPrefixed(0x04, new Uint8Array(component));
  }
  throw new TypeError("v1 keys must be signed/unsigned integers, UTF-8 strings, or bytes");
}

function fnvUpdate(hash, bytes) {
  for (const byte of bytes) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & MASK_64;
  }
  return hash;
}

function domainBytes(name) {
  return lengthPrefixed(0xf0, encoder.encode(name));
}

function keyedRaw(seed, keys, domain = null) {
  let hash = fnvUpdate(FNV_OFFSET_BASIS, V1_PREFIX);
  hash = fnvUpdate(hash, le64(seed));
  if (domain !== null) hash = fnvUpdate(hash, domainBytes(domain));
  for (const key of keys) hash = fnvUpdate(hash, encodeComponent(key));
  return mix64(hash);
}

export class Random {
  constructor(seed = Date.now()) {
    this.seed = integer(seed, "seed", true) & MASK_64;
    this.index = 0n;
    this.key = this.seed;
  }

  setSeed(seed) {
    this.seed = integer(seed, "seed", true) & MASK_64;
    this.index = 0n;
    this.key = this.seed;
  }

  SetSeed(seed) {
    this.setSeed(seed);
  }

  rawAt(offset) {
    return mix64(this.seed + integer(offset, "offset", true) * GOLDEN_GAMMA);
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

  raw(...keys) {
    return keyedRaw(this.seed, keys);
  }

  int(maxValue, ...keys) {
    maxValue = integer(maxValue, "maxValue");
    if (maxValue <= 0n || maxValue > MASK_64) {
      throw new RangeError("maxValue must be in [1, 2^64 - 1]");
    }
    return boundedRaw(this.raw(...keys), maxValue);
  }

  range(minValue, maxValue, ...keys) {
    minValue = integer(minValue, "minValue");
    maxValue = integer(maxValue, "maxValue");
    const width = maxValue - minValue;
    if (width <= 0n || width > MASK_64) {
      throw new RangeError("range width must be in [1, 2^64 - 1]");
    }
    return minValue + this.int(width, ...keys);
  }

  float01(...keys) {
    return Number(this.raw(...keys) >> 11n) / 2 ** 53;
  }

  at2D(x, y, namespace) {
    const keys = [i64(x), i64(y)];
    if (namespace !== undefined && namespace !== null) keys.push(String(namespace));
    return keyedRaw(this.seed, keys, "at2d");
  }

  at3D(x, y, z, namespace) {
    const keys = [i64(x), i64(y), i64(z)];
    if (namespace !== undefined && namespace !== null) keys.push(String(namespace));
    return keyedRaw(this.seed, keys, "at3d");
  }

  chanceRatio(numerator, denominator, ...keys) {
    numerator = integer(numerator, "numerator");
    denominator = integer(denominator, "denominator");
    if (denominator <= 0n) throw new RangeError("denominator must be positive");
    if (numerator <= 0n) return false;
    if (numerator >= denominator) return true;
    return this.int(denominator, ...keys) < numerator;
  }

  choose(items, ...keys) {
    if (items.length === 0) throw new RangeError("items must not be empty");
    return items[Number(this.int(items.length, ...keys))];
  }

  shuffle(items, ...keys) {
    const values = Array.from(items);
    for (let index = values.length - 1; index > 0; index--) {
      const picked = Number(
        boundedRaw(keyedRaw(this.seed, [...keys, u64(index)], "shuffle"), BigInt(index + 1))
      );
      [values[index], values[picked]] = [values[picked], values[index]];
    }
    return values;
  }

  weightedChoice(items, integerWeights, ...keys) {
    if (items.length === 0 || items.length !== integerWeights.length) {
      throw new RangeError("items and weights must have the same non-zero length");
    }
    const weights = integerWeights.map((weight) => integer(weight, "weight"));
    if (weights.some((weight) => weight < 0n)) {
      throw new RangeError("weights must be non-negative");
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0n);
    if (total <= 0n || total > MASK_64) {
      throw new RangeError("total weight must be in [1, 2^64 - 1]");
    }
    const target = this.int(total, ...keys);
    let running = 0n;
    for (let index = 0; index < items.length; index++) {
      running += weights[index];
      if (target < running) return items[index];
    }
    throw new Error("unreachable weighted choice");
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
    minValue = integer(minValue, "minValue", true);
    maxValue = integer(maxValue, "maxValue", true);
    if (maxValue <= minValue) return null;
    return minValue + this.nextMaxAt(offset, maxValue - minValue);
  }

  NextMinMaxAt(offset, minValue, maxValue) {
    return this.nextMinMaxAt(offset, minValue, maxValue);
  }

  nextMinMax(minValue, maxValue) {
    minValue = integer(minValue, "minValue", true);
    maxValue = integer(maxValue, "maxValue", true);
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
