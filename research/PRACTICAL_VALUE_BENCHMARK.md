# Practical keyed workload evaluation — Windows

Run `python scripts/benchmark_practical.py --samples 8192 --repeats 7 --output research/results/final-windows-8192.json`.
Raw individual timings, source hashes, environment, git state, setup segments,
timestamps, seed, and checksums are retained in the JSON. These are local Python
key-lookup workloads modeled on terrain coordinates and entity loot addresses;
they are not a whole-game rendering benchmark or a cross-language speed ranking.

| End-to-end candidate | Terrain, median seconds | Entity/loot, median seconds |
| --- | ---: | ---: |
| esinxe scalar | 0.143441 | 0.195764 |
| esinxe native keyed batch | 0.015618 | 0.023421 |
| BLAKE2b-64 stable wrapper | 0.035244 | 0.045181 |
| SHA256 truncated stable wrapper | 0.039898 | 0.048438 |
| Experimental Philox4x32-10 mapping | 0.116462 | 0.125348 |

Batch/scalar checksums match exactly. This run measured about 9.2x terrain and
8.4x entity throughput improvements from batching, including row encoding.
Timing depends on host, interpreter, workload, and allocation. There are no CI
timing thresholds and no claim that native Philox would have these Python timings.
The hash wrappers use C-backed hashlib, whereas the experimental Philox rounds
are Python code; that implementation difference limits conclusions about algorithms.

The Philox primitive matches the three official
[Random123 known-answer vectors](https://github.com/DEShawResearch/random123/blob/main/tests/kat_vectors).
Its experimental mapping uses BLAKE2b-192 to derive a 128-bit counter and 64-bit
key from canonical typed bytes. Passing primitive vectors does not validate that
mapping statistically. The harness separately records encoding, setup and prepared
generation costs. It does not measure NumPy's different 4x64 variant.

Decision so far: retain v1 and prioritize the measured native batching benefit.
Keep the opt-in research candidate outside the public core. These observations do
not justify a public v2 compatibility promise. Before adopting one, compare compiled
Philox with a carefully specified key/counter layout across ports, validate
structured-key patterns with external batteries, and measure real application cost.
The prototype remains explicitly selectable in the benchmark, never a silent
replacement for existing output.

The final run was recorded from clean commit `6e94c52`; the result JSON was
written outside the checkout before being copied into this report's commit.
[Final measurements](results/final-windows-8192.json),
[initial 8192-key measurements](results/windows-8192.json), and
[initial 1000-key measurements](results/initial-windows.json) are retained.
The initial runs intentionally record their dirty state and exact source hashes.

The [browser-exported application proof](results/verdant-browser-evidence.json)
records 18 matching configurations over 25 chunks. A Node regression check
recomputes that exact fingerprint using the current generator, preventing the
saved proof from silently drifting from the example. The browser world is a
separate application demonstration; its rendering speed is not benchmarked here.
