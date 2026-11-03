# Esinxe engineering evaluation — 2026-09-03

## Verdict

Esinxe has a useful design center: **a portable, deterministic random field for
procedural content**, with a legacy sequential API alongside it. Addressing a
value by `(seed, typed key)` is a practical advantage over assigning mutable
RNG streams to chunks, jobs, or features. Typed encoding, explicit domains,
integer weights, and a frozen algorithm contract are good choices.

I would keep developing it in that niche. I would not position it as a novel
cryptographic generator, a scientifically validated Monte Carlo engine, or a
source of provably independent/uniform values. The core combines FNV-1a and a
SplitMix64 finalizer; the valuable product work is the portable addressing API
and its compatibility guarantees, rather than a new underlying randomness
primitive.

Before this review, the implementation was stronger on ordinary examples than
on boundary behavior and release verification. Several real bugs passed the
existing tests. The fixes below improve that situation without changing the
frozen v1 encoding, mixer, domains, retry sequence, or existing golden vectors.

## Scope and baseline

- Reviewed GitHub `main` at `4455477aa1e5b5c9b0bbdeae19ac226d15fefd62`.
- The original local checkout was at `5eb808d`; the subsequent upstream commits
  were dependency/Actions updates. Many local files were cloud-offloaded and
  reads stalled, so all changes were made in a separate local clone on
  `codex/esinxe-evaluation-20260903`.
- Reviewed Python/native C, C, C++, C#, Ruby, JavaScript/TypeScript, Rust, Go,
  Java, Kotlin, the specification, tests, CI, packaging, and static demo tooling.
- Initial root test run: 29 tests passed with three skips (native extension,
  Go, and Kotlin were not yet built/on PATH). With existing toolchains selected
  and the extension built, the expanded suite runs without those skips.
- No remote push, release, registry publication, or change to the original
  cloud-backed checkout was performed.

## Findings fixed

Priorities describe practical engineering risk, not remote exploitability.

| Priority | Finding | Evidence and correction |
| --- | --- | --- |
| High | Native Python batches silently changed valid results | `NextListMax(3, 2**64)` returned `[0, 0, 0]`; negative bounds wrapped to large uint64 values. The native parser now rejects overflow, and the public wrapper handles full-width output and legacy non-positive bounds consistently with scalar/fallback paths. |
| High | Oversized legacy bounds could hang | Python's scalar call with `2**64 + 1` timed out; Python/Ruby's positive modulo threshold made acceptance impossible. Explicit bounds now reject impossible ranges. JavaScript also rejects oversized bounds and unsafe numeric inputs instead of silently reducing precision or output support. |
| High | C shuffle size arithmetic could corrupt memory | An isolated regression with `key_count = SIZE_MAX` terminated with SIGBUS before the fix. Allocation sizes, pointer arithmetic, and missing key buffers are checked before copying. Self-swaps no longer call overlapping `memcpy`. |
| High | Site builder could erase an arbitrary output directory | The previous script ran recursive deletion on its optional caller-supplied path. The replacement refuses repository roots/ancestors, symlinks, and unowned non-empty directories; writes only known outputs; and preserves unrelated files. |
| Medium | Malformed key encodings differed across ports | JS/JVM/C# encoders replaced invalid Unicode, Ruby/C++/Go accepted invalid UTF-8 paths, and JS/Ruby forged typed keys bypassed constructor range checks. These inputs now fail instead of silently aliasing another key. Valid non-BMP Unicode and embedded NUL cases are tested. Low-level C retains explicit caller preconditions. |
| Medium | Java wide signed stream ranges overflowed | Subtracting signed endpoints could overflow to a negative width, causing constant lower-bound output. Width calculation now uses the existing BigInteger reducer while preserving ordinary stream outputs. |
| Medium | C# keyed hashing depended on compiler overflow settings | Narrowing a shifted uint64 to byte failed under checked compilation. Truncation is now explicitly unchecked, and keyed C# tests compile with overflow checks enabled. |
| Medium | Packaged Rust tests were broken | `cargo package` succeeded, but testing the extracted crate failed because `include_str!` reached outside the crate to a monorepo fixture. Tests are self-contained, and CI now tests the extracted package rather than merely listing package contents. |
| Medium | Statistical guarantees exceeded the evidence | Unconditional "unbiased" wording and implied stream independence were not justified. Documentation now states the actual limitations, keeping the algorithm unchanged. |
| Low | Demo snippets could fail to compile or describe different input | Negative/oversized seeds produced invalid fixed-width literals, Java needed signed bit representation, and Rust does not accept JSON-style control escapes. Snippets now describe the rendered field's normalized seed/namespace with target-language literals. |

Relevant implementation and regression entry points:

- [Python batches](../src/esinxe/__init__.py#L343),
  [native bound parsing](../src/esinxe/_native.c), and
  [backend parity regressions](../tests/test_regressions.py).
- [C shuffle](../C/Esinxec1-0-0.h), [C safety regressions](../tests/test_c_safety.py),
  and [cross-language boundary checks](../tests/test_conformance_boundaries.py).
- [key validation regressions](../tests/test_key_validation.py),
  [guarded site builder](../scripts/build_site.py), and
  [Rust package verification](../scripts/check_rust_package.py).

## What the statistical evidence does — and does not — say

The expanded analysis now examines the primary keyed API, not only the legacy
stream. For seed `123456789`, 200,000 samples per dataset produced:

| Dataset | Bit-one proportions, min–max | Lag-1 correlation | 100-bucket chi-square, 99 df |
| --- | --- | ---: | ---: |
| Legacy raw stream | 0.49679–0.50196 | 0.000291 | 120.187 |
| Keyed unsigned indices | 0.49638–0.50223 | -0.000254 | 99.741 |
| Keyed coordinate grid | 0.49699–0.50226 | 0.003126 | 87.438 |

No collisions appeared in either keyed sample. Seed-bit flips in the stream
averaged approximately 31.98–32.02 changed output bits. A bound of
`2**63 + 1` triggered first-word rejection 99,856 times in 200,000 samples;
its 100-bucket chi-square was 109.231. This actually exercises the retry path,
unlike a bound of 100, whose initial rejection set contains only 16 uint64 words.

There is no obvious defect in these aggregate diagnostics. That is deliberately
not a certification, a hypothesis-test battery, or a demonstration of
independence. Larger samples, multiple seeds, adversarial keys, bit-order
variants, and external batteries remain necessary for stronger claims.

Two structural limits matter:

1. **The bounded reducer cannot be exactly uniform over uniformly selected
   initial 64-bit words for arbitrary bounds.** It deterministically maps
   `2**64` initial words to `m` results, so equal preimage counts require `m`
   to divide `2**64`. Retrying by remixing the same word does not add an
   independent random draw. Conventional rejection-sampling analysis assumes a
   uniform source supplying new draws; see
   [Lemire, Fast Random Integer Generation in an Interval](https://arxiv.org/html/1805.10941).
   The counting argument is this review's analysis of esinxe, not a claim that
   the paper analyzed this repository. It does not quantify practical bias.
2. **Different stream seeds are phase shifts of one permutation.** Adding an
   odd gamma visits every uint64 state, and the mixer is invertible. Every seed
   therefore addresses the same cycle at another position. Absence of raw
   stream collisions is an implementation invariant, not statistical evidence.

These limits are documented in [RNG_ANALYSIS.md](RNG_ANALYSIS.md). Silently
replacing the reducer or mixer would violate the project's strongest promise:
stable results. A substantially different design belongs in opt-in algorithm v2.

## Validation performed

- Full `scripts/ci.sh`: successful, with ShellCheck explicitly skipped because
  it is not installed. Metadata checks, Ruff, source compilation, golden-vector
  regeneration/no-diff, language suites, TypeScript type checking, Rust
  formatting/Clippy/package tests, Go formatting/vet, Java strict compilation,
  Kotlin, Python/native tests, examples, diagnostics, and site build completed.
- Root unittest suite: **45 tests, no skips**, including nested language checks.
- JavaScript: **8 tests**, including portable demo literal tests.
- Additional native Python boundary/reference checks passed on **3.12.13 and
  3.13.15**, alongside the primary **3.9** environment. Python 3.14 was not
  tested locally.
- Focused C/C++ runs with AddressSanitizer and UndefinedBehaviorSanitizer:
  **4 tests passed**, including shuffle overflow and canonical key vectors.
- Independent byte-encoding oracle: 256 seed/key combinations. Additional
  JS/Python comparisons cover large retry-heavy bounds and full signed ranges;
  C/Python comparisons cover embedded NUL strings and large bounds.
- Python source distribution and wheel built and passed Twine checks.
  `pip check` passed. npm audit and the project dependency audit reported no
  known vulnerabilities. The package declares no runtime Python dependencies;
  this does not mean every development tool or compiler has been audited.
- The system Python 3.9 audit tools emitted their pre-existing LibreSSL warning.
  The isolated development environment needed a pip upgrade for modern editable
  installation; the contributor setup now includes that step.
- Existing algorithm-v1 golden vectors are unchanged. No hosted CI, registry
  install, interactive browser walkthrough, PractRand, or TestU01 run is claimed.

## Next priorities

1. **Build a broader portable conformance corpus.** The new boundary tests are
   a meaningful improvement, but several ports still rely on hardcoded happy-
   path constants. Add language-neutral valid/invalid fixtures for every helper,
   full numeric limits, Unicode, and retry-heavy bounds, without deriving every
   expected answer solely from one implementation.
2. **Publish an honest per-port capability matrix.** The byte-level core is
   portable, but wrapper surfaces differ: signed versus unsigned ratio limits,
   Java's per-weight signed-long limit, C's in-place shuffle and pointer
   preconditions, and legacy invalid-range behavior. Do not claim identical
   accepted-input domains until these distinctions are explicitly covered.
3. **Validate quality before expanding positioning.** Run reproducible external
   batteries on both stream and structured-key patterns, with recorded tool
   versions, sample sizes, seeds, and results. Keep any stronger next-generation
   design separate from v1.
4. **Improve release ergonomics.** Add packaged-consumer tests for every registry
   format, test documented minimum runtimes, and automate checked-build and
   sanitizer lanes. Do not publish merely because smoke tests pass.

Bottom line: the procedural-content use case is credible and the compatibility
discipline is worth preserving. The corrected implementation is more dependable,
but statistical claims should remain narrower than the marketing term "RNG"
might suggest.
