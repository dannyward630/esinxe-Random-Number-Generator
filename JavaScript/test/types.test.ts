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
