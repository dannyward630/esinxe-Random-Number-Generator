import { Random, i64, u64, type KeyComponent } from "../src/index.js";

const field = new Random(12345n);
const keys: KeyComponent[] = [
  i64(-1),
  u64((1n << 64n) - 1n),
  "snowman \u2603",
  new Uint8Array([0, 1, 255]),
];

const raw: bigint = field.raw(...keys);
const bounded: bigint = field.int(100, ...keys);
const ranged: bigint = field.range(-500, 500, ...keys);
const unit: number = field.float01(...keys);
const coordinate: bigint = field.at3D(-17, 42, -(1n << 63n), "caves");
const chance: boolean = field.chanceRatio(7, 23, ...keys);
const choice: string = field.choose(["forest", "desert"], ...keys);
const shuffled: string[] = field.shuffle(["forest", "desert"], ...keys);
const weighted: string = field.weightedChoice(
  ["common", "rare"],
  [80, 20],
  ...keys
);

void [raw, bounded, ranged, unit, coordinate, chance, choice, shuffled, weighted];

const readonlyItems = [{ name: "a" }, { name: "b" }] as const;
const readonlyWeights = [0n, 1n] as const;
const scoped: Random = field.scope(new Uint8Array([1]).buffer, ...keys);
const sampled: Array<(typeof readonlyItems)[number]> = scoped.sample(readonlyItems, 1, ...keys);
const prepared = scoped.prepareWeightedChoice(readonlyItems, readonlyWeights);
const selected: (typeof readonlyItems)[number] = prepared.choose(...keys);
// @ts-expect-error sampling preserves item types
const invalidSample: number[] = sampled;
// @ts-expect-error prepared selection preserves item types
const invalidChoice: number = selected;
if (false) {
  // @ts-expect-error counts are integer numbers, not bigint
  scoped.sample(readonlyItems, 1n);
}
void [sampled, selected, invalidSample, invalidChoice];
