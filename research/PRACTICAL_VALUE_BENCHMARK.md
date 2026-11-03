# Practical keyed workload evaluation — initial Windows run

Run `python scripts/benchmark_practical.py --samples 8192 --repeats 7 --output research/results/windows-8192.json`.
Raw individual timings, source hashes, environment, git state, setup segments,
timestamps, seed, and checksums are retained in the JSON. These are local Python
key-lookup workloads modeled on terrain coordinates and entity loot addresses;
they are not a whole-game rendering benchmark or a cross-language speed ranking.

| End-to-end candidate | Terrain, median seconds | Entity/loot, median seconds |
| --- | ---: | ---: |
| esinxe scalar | 0.141116 | 0.191002 |
| esinxe native keyed batch | 0.015469 | 0.022950 |
| BLAKE2b-64 stable wrapper | 0.034968 | 0.045361 |
| SHA256 truncated stable wrapper | 0.040246 | 0.048938 |
| Experimental Philox4x32-10 mapping | 0.113976 | 0.122571 |

Batch/scalar checksums match exactly. This run measured about 9.1x terrain and
8.3x entity throughput improvements from batching, including row encoding.
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
