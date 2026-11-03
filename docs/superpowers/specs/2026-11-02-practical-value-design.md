# Esinxe practical value

The user approved pursuing the assessment's roadmap as an active goal. Success
requires demonstrated application value and recorded comparisons, not merely new
APIs or larger feature counts. Preserve every existing v1 output and fixture.

Deliver a playable browser procedural world with deterministic terrain, stable
entity/room identifiers, and streamed chunks. Loading order and worker count must
not change core content. An independently addressed optional grass layer must not
change terrain, enemies, or loot. Export reproducible evidence and explain content
versioning: modifying the same rule/table intentionally may change its results.

Create reproducible scalar and batch workload benchmarks with canonical typed key
encoding, stable native hashing, and a documented counter-based candidate. Separate
per-object initialization, key hashing, and bulk generation rather than presenting
unlike operations as equivalent. Retain raw timings, checksums, seeds, interpreter,
platform, versions, and commit provenance. Evaluate a studied Philox candidate
against official known-answer vectors; keep it experimental unless evidence
supports a public v2. Never imply statistical certification from smoke tests.

Add a separately specified stable-ID choice helper using rendezvous ranking across
all advertised ports. It takes equal nonempty item/unique UTF-8 string ID lists.
Rank each candidate by the v1 keyed hash under reserved domain `stable-choice-v1`,
scope prefix, user keys, then that candidate ID as a string component. Highest
uint64 rank wins; tied ranks choose the lexicographically smallest UTF-8 ID bytes.
All keys and IDs are validated. Reordering candidates cannot change the winning ID;
adding one changes only winners claimed by that ID; removing a nonwinner has no
effect. This is unweighted and does not change choose/weightedChoice semantics.

Improve Python keyed batches as an optional acceleration convenience: `rawBatch`
accepts an iterable of component sequences and returns exactly repeated `raw`
results in order. Validate/encode complete inputs before returning output, copy
mutable data, preserve scope prefixes and stream position, and offer the same
fallback results without the native extension. Benchmark end-to-end encoding cost.

Improve adoption with verified installable wheel/npm artifacts and a browser
application integration. Keep runtime dependencies out of the core. Document
precise installation and verification steps; do not claim registry publication or
v2 quality that has not actually been demonstrated.

Implementation choice: begin with the browser game and Python benchmark/acceleration
because they provide immediately runnable evidence without requiring a proprietary
engine. Retain the other ports and their compatibility corpus. All delegated work
must use GPT-6 Luna with max reasoning, as explicitly required by the user.
