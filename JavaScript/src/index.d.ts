export declare const MASK_64: bigint;
export declare const UINT64_SIZE: bigint;
export declare const GOLDEN_GAMMA: bigint;
export declare const MAX_INT_VALUE: bigint;
export declare const FNV_OFFSET_BASIS: bigint;
export declare const FNV_PRIME: bigint;

export declare function mix64(value: bigint | number | string): bigint;
export type IntegerInput = bigint | number | string;
export type KeyComponent =
  | IntegerInput
  | string
  | Uint8Array
  | ArrayBuffer
  | { readonly esinxeType: "i64" | "u64"; readonly value: bigint };
export declare function i64(value: IntegerInput): KeyComponent;
export declare function u64(value: IntegerInput): KeyComponent;

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
  raw(...keys: KeyComponent[]): bigint;
  int(maxValue: IntegerInput, ...keys: KeyComponent[]): bigint;
  range(minValue: IntegerInput, maxValue: IntegerInput, ...keys: KeyComponent[]): bigint;
  float01(...keys: KeyComponent[]): number;
  at2D(x: IntegerInput, y: IntegerInput, namespace?: string): bigint;
  at3D(x: IntegerInput, y: IntegerInput, z: IntegerInput, namespace?: string): bigint;
  chanceRatio(
    numerator: IntegerInput,
    denominator: IntegerInput,
    ...keys: KeyComponent[]
  ): boolean;
  choose<T>(items: readonly T[], ...keys: KeyComponent[]): T;
  shuffle<T>(items: readonly T[], ...keys: KeyComponent[]): T[];
  weightedChoice<T>(
    items: readonly T[],
    integerWeights: readonly IntegerInput[],
    ...keys: KeyComponent[]
  ): T;
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
