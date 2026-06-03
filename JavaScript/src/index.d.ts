export declare const MASK_64: bigint;
export declare const UINT64_SIZE: bigint;
export declare const GOLDEN_GAMMA: bigint;
export declare const MAX_INT_VALUE: bigint;

export declare function mix64(value: bigint | number | string): bigint;

export declare class Random {
  seed: bigint;
  index: bigint;
  key: bigint;

  constructor(seed?: bigint | number | string);
  setSeed(seed: bigint | number | string): void;
  SetSeed(seed: bigint | number | string): void;
  rawAt(offset: bigint | number | string): bigint;
  nextRawAt(offset: bigint | number | string): bigint;
  NextRawAt(offset: bigint | number | string): bigint;
  nextRaw(): bigint;
  NextRaw(): bigint;
  nextAt(offset: bigint | number | string): bigint;
  NextAt(offset: bigint | number | string): bigint;
  next(): bigint;
  Next(): bigint;
  nextMaxAt(offset: bigint | number | string, maxValue: bigint | number | string): bigint;
  NextMaxAt(offset: bigint | number | string, maxValue: bigint | number | string): bigint;
  nextMax(maxValue: bigint | number | string): bigint;
  NextMax(maxValue: bigint | number | string): bigint;
  nextMinMaxAt(
    offset: bigint | number | string,
    minValue: bigint | number | string,
    maxValue: bigint | number | string
  ): bigint | null;
  NextMinMaxAt(
    offset: bigint | number | string,
    minValue: bigint | number | string,
    maxValue: bigint | number | string
  ): bigint | null;
  nextMinMax(minValue: bigint | number | string, maxValue: bigint | number | string): bigint | null;
  NextMinMax(minValue: bigint | number | string, maxValue: bigint | number | string): bigint | null;
  nextList(length: number): bigint[];
  NextList(length: number): bigint[];
  nextListMax(length: number, maxValue: bigint | number | string): bigint[];
  NextListMax(length: number, maxValue: bigint | number | string): bigint[];
  nextListMinMax(length: number, minValue: bigint | number | string, maxValue: bigint | number | string): Array<bigint | null>;
  NextListMinMax(length: number, minValue: bigint | number | string, maxValue: bigint | number | string): Array<bigint | null>;
}
