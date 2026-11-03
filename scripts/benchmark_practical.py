"""Reproducible, stdlib-only benchmarks for practical keyed random workloads.

The hash and Philox implementations here are research candidates, not public
esinxe APIs.  In particular, the key-to-counter mapping is an experimental
choice.  See research/PRACTICAL_VALUE_BENCHMARK.md before interpreting results.
"""

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import struct
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import esinxe


MASK32 = (1 << 32) - 1
MASK64 = (1 << 64) - 1
FNV_OFFSET = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3
V1_PREFIX = b"esinxe-v1\0"

# Philox4x32-10 constants from the Random123 reference implementation.
PHILOX_M0 = 0xD2511F53
PHILOX_M1 = 0xCD9E8D57
PHILOX_W0 = 0x9E3779B9
PHILOX_W1 = 0xBB67AE85
PHILOX_DERIVE_PREFIX = b"esinxe-practical-philox4x32-10-map-v1\0"

DEFAULT_SEED = 20261102
DEFAULT_SAMPLES = 4000
DEFAULT_REPEATS = 5
DEFAULT_WARMUPS = 1


def _utc_now():
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _le64(value):
    return (int(value) & MASK64).to_bytes(8, "little")


def encode_component(component):
    """Encode one component using the readable, frozen v1 typed-key rules."""

    if isinstance(component, esinxe.Signed):
        return b"\x01" + _le64(component.value)
    if isinstance(component, esinxe.Unsigned):
        return b"\x02" + _le64(component.value)
    if isinstance(component, bool):
        raise TypeError("bool is not a v1 key type")
    if isinstance(component, int):
        if component < 0:
            if not -(1 << 63) <= component < (1 << 63):
                raise ValueError("signed key components must fit in int64")
            return b"\x01" + _le64(component)
        if component > MASK64:
            raise ValueError("unsigned key components must fit in uint64")
        return b"\x02" + _le64(component)
    if isinstance(component, str):
        data = component.encode("utf-8", "strict")
        return b"\x03" + _le64(len(data)) + data
    if isinstance(component, (bytes, bytearray, memoryview)):
        data = bytes(component)
        return b"\x04" + _le64(len(data)) + data
    raise TypeError("v1 keys must be signed/unsigned integers, UTF-8 strings, or bytes")


def encode_v1_key(seed, components):
    """Return v1's canonical key bytes without calling esinxe's private encoder."""

    encoded = bytearray(V1_PREFIX)
    encoded.extend(_le64(seed))
    for component in components:
        encoded.extend(encode_component(component))
    return bytes(encoded)


def _mix64(value):
    value &= MASK64
    value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & MASK64
    value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & MASK64
    return (value ^ (value >> 31)) & MASK64


def v1_raw_from_encoded(encoded):
    """Independent v1 reference stage: FNV-1a over bytes, then SplitMix64."""

    value = FNV_OFFSET
    for byte in encoded:
        value = ((value ^ byte) * FNV_PRIME) & MASK64
    return _mix64(value)


def blake2b64_from_encoded(encoded):
    return int.from_bytes(hashlib.blake2b(encoded, digest_size=8).digest(), "little")


def sha256_64_from_encoded(encoded):
    return int.from_bytes(hashlib.sha256(encoded).digest()[:8], "little")


def philox4x32_10(counter, key):
    """Philox4x32-10 primitive, kept separate from key mapping for KAT testing."""

    if len(counter) != 4 or len(key) != 2:
        raise ValueError("Philox4x32-10 needs four counter words and two key words")
    if any(not isinstance(word, int) or not 0 <= word <= MASK32 for word in counter):
        raise ValueError("counter words must be uint32 values")
    if any(not isinstance(word, int) or not 0 <= word <= MASK32 for word in key):
        raise ValueError("key words must be uint32 values")

    c0, c1, c2, c3 = counter
    k0, k1 = key
    for round_index in range(10):
        product0 = PHILOX_M0 * c0
        product1 = PHILOX_M1 * c2
        hi0, lo0 = product0 >> 32, product0 & MASK32
        hi1, lo1 = product1 >> 32, product1 & MASK32
        c0, c1, c2, c3 = (
            (hi1 ^ c1 ^ k0) & MASK32,
            lo1,
            (hi0 ^ c3 ^ k1) & MASK32,
            lo0,
        )
        if round_index != 9:
            k0 = (k0 + PHILOX_W0) & MASK32
            k1 = (k1 + PHILOX_W1) & MASK32
    return c0, c1, c2, c3


def philox_setup_from_encoded(encoded):
    """Map arbitrary typed keys to Philox's 128-bit counter and 64-bit key.

    BLAKE2b-192 is applied to a mapping-domain prefix and canonical v1 bytes.
    Its first 16 bytes, interpreted as four little-endian uint32s, form the
    counter; its final 8 bytes form the two little-endian uint32 key words.
    """

    digest = hashlib.blake2b(
        PHILOX_DERIVE_PREFIX + encoded,
        digest_size=24,
    ).digest()
    return struct.unpack("<4I", digest[:16]) + struct.unpack("<2I", digest[16:])


def philox64_from_setup(setup):
    counter = setup[:4]
    key = setup[4:]
    words = philox4x32_10(counter, key)
    return words[0] | (words[1] << 32)


def philox64_from_encoded(encoded):
    return philox64_from_setup(philox_setup_from_encoded(encoded))


def terrain_rows(samples):
    """A row-major local terrain scan with explicit signed world coordinates."""

    return [
        (esinxe.i64((index % 256) - 128), esinxe.i64((index // 256) - 32), "height")
        for index in range(samples)
    ]


def entity_loot_rows(samples):
    """Stable entity IDs with independent, explicitly addressed loot rolls."""

    return [
        (
            "entity",
            "ent-{:08x}-7f3a-4c20".format(index),
            "loot",
            esinxe.u64(index % 4),
        )
        for index in range(samples)
    ]


WORKLOADS = {
    "terrain_coordinates": {
        "builder": terrain_rows,
        "scope": ("practical-benchmark-v1", "terrain"),
        "description": (
            "One height lookup per signed tile coordinate in a row-major scan; "
            "x spans -128..127 and y advances from -32."
        ),
    },
    "entity_loot_ids": {
        "builder": entity_loot_rows,
        "scope": ("practical-benchmark-v1", "entity-loot"),
        "description": (
            "One loot draw per stable string entity ID with a uint64 roll slot "
            "cycling over four separately addressed draws."
        ),
    },
}


def _checksum_u64(values):
    digest = hashlib.sha256()
    for value in values:
        digest.update((int(value) & MASK64).to_bytes(8, "little"))
    return digest.hexdigest()


def _checksum_setup(values):
    digest = hashlib.sha256()
    for setup in values:
        digest.update(struct.pack("<6I", *setup))
    return digest.hexdigest()


def _checksum_encoded(values):
    digest = hashlib.sha256()
    for value in values:
        digest.update(len(value).to_bytes(8, "little"))
        digest.update(value)
    return digest.hexdigest()


def _measure(fn, repeats, warmups, checksum, units):
    def one_sample(kind, index):
        started_at = _utc_now()
        start = time.perf_counter_ns()
        output = fn()
        elapsed_ns = time.perf_counter_ns() - start
        ended_at = _utc_now()
        output_checksum = checksum(output)
        return {
            "kind": kind,
            "index": index,
            "started_at_utc": started_at,
            "ended_at_utc": ended_at,
            "elapsed_ns": elapsed_ns,
            "units": units,
            "units_per_second": (units * 1_000_000_000 / elapsed_ns)
            if elapsed_ns
            else None,
            "checksum_sha256": output_checksum,
        }

    warmup_samples = [one_sample("warmup", index) for index in range(warmups)]
    samples = [one_sample("timed", index) for index in range(repeats)]
    checksums = {sample["checksum_sha256"] for sample in warmup_samples + samples}
    if len(checksums) != 1:
        raise RuntimeError("benchmark output changed between repeated runs")
    timed_ns = [sample["elapsed_ns"] for sample in samples]
    return {
        "warmup_timings": warmup_samples,
        "raw_timings": samples,
        "summary_ns": {
            "min": min(timed_ns),
            "median": sorted(timed_ns)[len(timed_ns) // 2],
            "max": max(timed_ns),
        },
        "output_checksum_sha256": samples[0]["checksum_sha256"],
    }


def _raw_scalar(rows, seed, scope):
    rng = esinxe.Random(seed).scope(*scope)
    return [rng.raw(*row) for row in rows]


def _raw_batch(rows, seed, scope):
    rng = esinxe.Random(seed).scope(*scope)
    batch = getattr(rng, "rawBatch", None)
    if not callable(batch):
        return None
    return list(batch(iter(rows)))


def _encode_rows(seed, scope, rows):
    prefix = tuple(scope)
    return [encode_v1_key(seed, prefix + tuple(row)) for row in rows]


def _git_metadata():
    def git(*args):
        try:
            result = subprocess.run(
                ["git", *args],
                cwd=str(ROOT),
                check=False,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
            )
        except OSError:
            return None
        return result.stdout.strip() if result.returncode == 0 else None

    status = git("status", "--porcelain")
    return {
        "head": git("rev-parse", "HEAD"),
        "dirty": bool(status),
        "status_porcelain": status.splitlines() if status else [],
        "git_version": git("--version"),
    }


def _sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _source_hashes():
    paths = [
        Path(__file__),
        ROOT / "src" / "esinxe" / "__init__.py",
        ROOT / "src" / "esinxe" / "_native.c",
        ROOT / "SPEC_V1.md",
        ROOT / "docs" / "RNG_ANALYSIS.md",
    ]
    native_module = getattr(esinxe, "_native", None)
    native_path = getattr(native_module, "__file__", None)
    if native_path:
        paths.append(Path(native_path))
    return {
        str(path.relative_to(ROOT))
        if path.is_relative_to(ROOT)
        else path.name: _sha256_file(path)
        for path in paths
        if path.is_file()
    }


def _optional_version(distribution):
    try:
        return importlib.metadata.version(distribution)
    except importlib.metadata.PackageNotFoundError:
        return None


def _environment():
    native_module = getattr(esinxe, "_native", None)
    return {
        "python_version": sys.version,
        "python_implementation": platform.python_implementation(),
        "python_executable": sys.executable,
        "esinxe_version": getattr(esinxe, "__version__", "unknown"),
        "native_extension_loaded": native_module is not None,
        "native_extension_path": getattr(native_module, "__file__", None),
        "numpy_version_if_installed": _optional_version("numpy"),
        "platform": platform.platform(),
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor() or None,
        "cpu_count": os.cpu_count(),
        "hashlib_algorithms_available": sorted(hashlib.algorithms_available),
    }


def _candidate_records(seed, scope, rows, encoded, repeats, warmups):
    record = {}
    record["esinxe_raw_scalar"] = _measure(
        lambda: _raw_scalar(rows, seed, scope),
        repeats,
        warmups,
        _checksum_u64,
        len(rows),
    )

    batch_output = _raw_batch(rows, seed, scope)
    if batch_output is None:
        record["esinxe_raw_batch"] = {
            "status": "unavailable",
            "reason": "Random.rawBatch is not present in this checkout",
        }
    else:
        scalar_output = _raw_scalar(rows, seed, scope)
        if batch_output != scalar_output:
            raise RuntimeError("rawBatch disagrees with repeated scalar raw calls")
        record["esinxe_raw_batch"] = _measure(
            lambda: _raw_batch(rows, seed, scope),
            repeats,
            warmups,
            _checksum_u64,
            len(rows),
        )

    record["blake2b_64_end_to_end"] = _measure(
        lambda: [
            blake2b64_from_encoded(encode_v1_key(seed, tuple(scope) + tuple(row)))
            for row in rows
        ],
        repeats,
        warmups,
        _checksum_u64,
        len(rows),
    )
    record["sha256_64_end_to_end"] = _measure(
        lambda: [
            sha256_64_from_encoded(encode_v1_key(seed, tuple(scope) + tuple(row)))
            for row in rows
        ],
        repeats,
        warmups,
        _checksum_u64,
        len(rows),
    )
    record["philox4x32_10_end_to_end"] = _measure(
        lambda: [
            philox64_from_encoded(encode_v1_key(seed, tuple(scope) + tuple(row)))
            for row in rows
        ],
        repeats,
        warmups,
        _checksum_u64,
        len(rows),
    )

    stage = {
        "encoding_only": _measure(
            lambda: _encode_rows(seed, scope, rows),
            repeats,
            warmups,
            _checksum_encoded,
            len(rows),
        ),
        "per_object_setup": {
            "esinxe_v1": {
                "status": "not_applicable",
                "reason": "v1 keyed draws are stateless; there is no per-key generator to initialize",
            },
            "blake2b_64": {
                "status": "not_applicable",
                "reason": "the hash wrapper consumes canonical bytes directly per output",
            },
            "sha256_64": {
                "status": "not_applicable",
                "reason": "the hash wrapper consumes canonical bytes directly per output",
            },
            "philox4x32_10": _measure(
                lambda: [philox_setup_from_encoded(item) for item in encoded],
                repeats,
                warmups,
                _checksum_setup,
                len(encoded),
            ),
        },
    }

    prepared_philox = [philox_setup_from_encoded(item) for item in encoded]
    stage["bulk_generation_from_prepared_keys"] = {
        "esinxe_v1_spec_reference": _measure(
            lambda: [v1_raw_from_encoded(item) for item in encoded],
            repeats,
            warmups,
            _checksum_u64,
            len(encoded),
        ),
        "blake2b_64": _measure(
            lambda: [blake2b64_from_encoded(item) for item in encoded],
            repeats,
            warmups,
            _checksum_u64,
            len(encoded),
        ),
        "sha256_64": _measure(
            lambda: [sha256_64_from_encoded(item) for item in encoded],
            repeats,
            warmups,
            _checksum_u64,
            len(encoded),
        ),
        "philox4x32_10": _measure(
            lambda: [philox64_from_setup(item) for item in prepared_philox],
            repeats,
            warmups,
            _checksum_u64,
            len(prepared_philox),
        ),
    }
    return {"end_to_end": record, "stages": stage}


def run_benchmark(
    samples=DEFAULT_SAMPLES,
    repeats=DEFAULT_REPEATS,
    warmups=DEFAULT_WARMUPS,
    seed=DEFAULT_SEED,
):
    if samples < 1:
        raise ValueError("samples must be positive")
    if repeats < 1:
        raise ValueError("repeats must be positive")
    if warmups < 0:
        raise ValueError("warmups must not be negative")

    started_at = _utc_now()
    workload_records = {}
    for name, spec in WORKLOADS.items():
        rows = spec["builder"](samples)
        scope = spec["scope"]
        encoded = _encode_rows(seed, scope, rows)
        outputs = _candidate_records(seed, scope, rows, encoded, repeats, warmups)
        workload_records[name] = {
            "description": spec["description"],
            "sample_count": samples,
            "scope_prefix": list(scope),
            "key_shape": "typed key components; terrain uses i64/i64/string, entities use string/string/string/u64",
            **outputs,
        }

    finished_at = _utc_now()
    return {
        "schema_version": 1,
        "recorded_at_utc": started_at,
        "finished_at_utc": finished_at,
        "config": {
            "seed": seed & MASK64,
            "samples_per_workload": samples,
            "timed_repeats": repeats,
            "warmup_repeats": warmups,
            "timing_clock": "time.perf_counter_ns",
            "numpy_runtime_dependency": False,
            "optional_numpy_philox_measurement": "omitted; this run does not compare NumPy's variant4x64 to Philox4x32",
        },
        "provenance": {
            "candidate_sources": [
                "https://github.com/DEShawResearch/random123/blob/main/include/Random123/philox.h",
                "https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors",
                "https://docs.python.org/3/library/hashlib.html",
            ],
            "git": _git_metadata(),
            "environment": _environment(),
            "source_sha256": _source_hashes(),
        },
        "workloads": workload_records,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        help="JSON output path (default: research/results with UTC name)",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=DEFAULT_SAMPLES,
        help="objects per workload (default: %(default)s)",
    )
    parser.add_argument(
        "--repeats",
        type=int,
        default=DEFAULT_REPEATS,
        help="timed repetitions (default: %(default)s)",
    )
    parser.add_argument(
        "--warmups",
        type=int,
        default=DEFAULT_WARMUPS,
        help="warmup repetitions (default: %(default)s)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help="fixed reproducible uint64 seed (default: %(default)s)",
    )
    args = parser.parse_args(argv)

    result = run_benchmark(args.samples, args.repeats, args.warmups, args.seed)
    output = args.output
    if output is None:
        stamp = result["recorded_at_utc"].replace(":", "").replace("-", "")
        stamp = stamp.replace("T", "-").replace("Z", "")
        output = (
            ROOT / "research" / "results" / ("practical-benchmark-" + stamp + ".json")
        )
    elif not output.is_absolute():
        output = ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print("output={}".format(output))
    print(
        "seed={} samples={} repeats={} warmups={}".format(
            args.seed & MASK64, args.samples, args.repeats, args.warmups
        )
    )
    for name, workload in result["workloads"].items():
        print("[{}]".format(name))
        for candidate, measurement in workload["end_to_end"].items():
            if measurement.get("status") == "unavailable":
                print("{}: unavailable".format(candidate))
                continue
            times = [item["elapsed_ns"] for item in measurement["raw_timings"]]
            median_s = sorted(times)[len(times) // 2] / 1_000_000_000
            print(
                "{}: median={:.6f}s checksum={}".format(
                    candidate, median_s, measurement["output_checksum_sha256"][:16]
                )
            )


if __name__ == "__main__":
    main()
