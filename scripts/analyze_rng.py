import argparse
import collections
import math
import os
import statistics
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

import esinxe


def main():
    parser = argparse.ArgumentParser(
        description="Deterministic RNG smoke diagnostics, not certification"
    )
    parser.add_argument("--samples", type=int, default=200000)
    args = parser.parse_args()
    if not 100 <= args.samples <= 1000000:
        parser.error("--samples must be in [100, 1000000]")
    seed = 123456789
    sample_size = args.samples
    rng = esinxe.Random(seed)
    values = [rng.NextRawAt(i) for i in range(sample_size)]
    print(f"dataset=stream seed={seed} samples={sample_size}")
    summarize(values)

    for label, make in (
        ("keyed-u64", lambda i: rng.raw(esinxe.u64(i))),
        ("keyed-grid", lambda i: rng.at2D(i % 257 - 128, i // 257 - 128, "terrain")),
    ):
        keyed = [make(i) for i in range(sample_size)]
        print(f"dataset={label} seed={seed} samples={sample_size}")
        summarize(keyed)
        print(f"sample_collisions={sample_size - len(set(keyed))}")

    # Unlike small bounds, this exercises deterministic rejection frequently.
    maximum = (1 << 63) + 1
    threshold = ((1 << 64) - maximum) % maximum
    bounded = [esinxe._bounded_raw(value, maximum) for value in values]
    counts = collections.Counter(value * 100 // maximum for value in bounded)
    expected = sample_size / 100
    chi_square = sum((counts[i] - expected) ** 2 / expected for i in range(100))
    print(
        f"high_retry_bound={maximum} first_rejections="
        f"{sum(value < threshold for value in values)} "
        f"bucket_chi_square={chi_square:.3f} df=99"
    )

    for bit in (0, 1, 31, 63):
        other = esinxe.Random(seed ^ (1 << bit))
        distances = [
            popcount(values[i] ^ other.NextRawAt(i))
            for i in range(min(sample_size, 50000))
        ]
        print(
            f"avalanche flip_bit={bit} "
            f"mean_hamming={statistics.mean(distances):.3f} "
            f"min={min(distances)} max={max(distances)}"
        )
    print(
        f"stream_collisions={sample_size - len(set(values))} "
        "(permutation invariant, not evidence of statistical quality)"
    )
    print(
        "Smoke diagnostics only: not a proof of uniformity, independence, or security."
    )


def summarize(values):
    sample_size = len(values)

    for buckets in (100, 1000):
        counts = collections.Counter(value % buckets for value in values)
        expected = sample_size / buckets
        chi_square = sum(
            ((counts[bucket] - expected) ** 2) / expected for bucket in range(buckets)
        )
        print(
            f"buckets={buckets} hit={len(counts)}/{buckets} "
            f"min={min(counts.values())} max={max(counts.values())} "
            f"chi_square={chi_square:.3f} df={buckets - 1}"
        )

    proportions = [
        sum((value >> bit) & 1 for value in values) / sample_size for bit in range(64)
    ]
    print(
        f"bit_balance min={min(proportions):.5f} "
        f"max={max(proportions):.5f} avg={statistics.mean(proportions):.5f}"
    )

    normalized = [value / (1 << 64) for value in values]
    print(f"serial_correlation_lag1={correlation(normalized[:-1], normalized[1:]):.6f}")


def popcount(value):
    return bin(value).count("1")


def correlation(xs, ys):
    mean_x = statistics.mean(xs)
    mean_y = statistics.mean(ys)
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    denominator_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
    denominator_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
    return numerator / (denominator_x * denominator_y)


if __name__ == "__main__":
    main()
