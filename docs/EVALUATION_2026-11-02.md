# Review completion — November 2, 2026

Completed the follow-up to [the earlier evaluation](EVALUATION_2026-09-03.md),
including the approved additions. All changes preserve algorithm v1, existing
stream values, and the exact original vector-file bytes.

- Fixed Windows compiler/launcher discovery and Unicode source handling. Tests
  now run directly, without the external diagnostic adaptations used in review.
- Added scoped typed prefixes, deterministic sample-v1 permutations, and
  prepared weighted-choice tables in all ten ports. Seed/key/container snapshots,
  zero weights, overflow, empty results, invalid keys, and stream isolation are
  covered by shared expectations and targeted tests.
- Added explicit-length C strings/coordinate namespaces, Python generic stubs
  and `py.typed`, installed-wheel consumer/type checks, and minimum-runtime CI.
- Added an independently generated language-neutral corpus. Both original v1
  vector files remain unchanged; generators now write UTF-8 LF bytes explicitly
  so Windows regeneration cannot alter their line endings.
- Corrected C++ `vector<bool>` proxy swaps and dangling selected references.
  Boolean selections return values; ordinary selections retain const references.
- Corrected C++ scope construction to start its independent stream at offset zero,
  matching the other object-based ports even when the parent stream has advanced.
- Kept the package version at 1.1.0 with changes recorded under Unreleased.
  This task merges repository source; it does not publish registry releases.

Local validation on Windows:

| Check | Result |
| --- | --- |
| Complete root unittest suite | 65 passed, no skips |
| JavaScript tests / TypeScript declarations | 20 passed / typecheck passed |
| C / C++ | Strict C11/C++17 shared corpus, safety, Boolean proxy, and advanced-parent scope regressions passed |
| Java / Kotlin / C# / Ruby | All shared corpus adapters passed; Java strict warnings and C# checked arithmetic included |
| Rust | Tests, formatting, and warning-free Clippy passed; Rust 1.70 tests and extracted package passed |
| Go | Tests, vet, and generated corpus adapter passed on Go 1.27.3 |
| Python installed wheel | Runtime consumer, generic inference, and four expected type-error checks passed outside checkout |
| Repository / lint / site | Metadata, links, Ruff, diff whitespace, and guarded site build passed |

Toolchains included Python 3.11.9, Node on the existing host, MSVC for the Python
extension, GCC/G++, Java 21, Kotlin 2.3.21, Ruby 3.4, .NET, Rust stable/1.70, and
an isolated Go installation. Go and Kotlin archives were checked against their
official published SHA-256 values. Node 18, Go 1.22, Python 3.9/3.12/3.14, and
fresh Linux/Windows images are additionally configured in hosted CI; a configured
job is not itself a claim that it has passed. Hosted status is checked before merge.

An independent code review found the two C++ issues above; each gained a failing
regression and was corrected before integration. It also detected Windows newline
rewriting, which is now covered by an explicit fixture-byte check. No new
PractRand/TestU01 certification is claimed; the narrower statistical guarantees
from the earlier hardening remain in force.

See [the helper contract](../SPEC_HELPERS_V1.md),
[capability matrix](CAPABILITIES.md), and port manuals for the public behavior.
