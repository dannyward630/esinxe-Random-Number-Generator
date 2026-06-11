import os
import sys
import time


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

import esinxe


def main():
    sample_size = int(os.environ.get("ESINXE_BENCH_N", "500000"))
    print(f"native={esinxe._native is not None}")
    print(f"sample_size={sample_size}")
    print("[random-access]")
    bench("raw(u64(i))", sample_size, keyed_raw)
    bench("NextRawAt(i)", sample_size, next_raw_at)
    print("[sequential]")
    bench("NextRaw", sample_size, next_raw)
    bench("Next", sample_size, next_default)
    bench("NextMax(100)", sample_size, next_max100)
    print("[batch]")
    bench("NextList(N)", sample_size, list_default)
    bench("NextListMax(N,100)", sample_size, list_max100)


def bench(name, sample_size, fn):
    best = None
    best_result = None
    for _ in range(5):
        start = time.perf_counter()
        result = fn(sample_size)
        elapsed = time.perf_counter() - start
        if best is None or elapsed < best:
            best = elapsed
            best_result = result
    checksum = best_result & ((1 << 64) - 1)
    print(f"{name}: {best:.6f}s ({sample_size / best:,.0f}/s) checksum={checksum}")


def next_raw(sample_size):
    rng = esinxe.Random(12345)
    checksum = 0
    for _ in range(sample_size):
        checksum ^= rng.NextRaw()
    return checksum


def keyed_raw(sample_size):
    rng = esinxe.Random(12345)
    checksum = 0
    for index in range(sample_size):
        checksum ^= rng.raw(esinxe.u64(index))
    return checksum


def next_raw_at(sample_size):
    rng = esinxe.Random(12345)
    checksum = 0
    for index in range(sample_size):
        checksum ^= rng.NextRawAt(index)
    return checksum


def next_default(sample_size):
    rng = esinxe.Random(12345)
    checksum = 0
    for _ in range(sample_size):
        checksum ^= rng.Next()
    return checksum


def next_max100(sample_size):
    rng = esinxe.Random(12345)
    checksum = 0
    for _ in range(sample_size):
        checksum ^= rng.NextMax(100)
    return checksum


def list_default(sample_size):
    return sum(esinxe.Random(12345).NextList(sample_size))


def list_max100(sample_size):
    return sum(esinxe.Random(12345).NextListMax(sample_size, 100))


if __name__ == "__main__":
    main()
