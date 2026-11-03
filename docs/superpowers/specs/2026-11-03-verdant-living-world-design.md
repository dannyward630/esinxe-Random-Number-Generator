# Verdant: the drowned signal

Status: proposed design, awaiting user approval. This is a substantial playable
expansion of the existing browser game, rather than a commercial-scale survival
game. The user wants both expedition and survival/crafting: freedom to do their
own thing, mysterious paths, interesting places, discoveries, and exotic stories.
The exact systems below are proposed implementation choices, not prior approvals.

## Experience

You wake beside a broken signal beacon in an overgrown archipelago. Something
under the island still answers it. Gather, build a small camp, make useful tools,
and venture into distinct ruins when you feel prepared. Recovered inscriptions
tell conflicting stories about who built the signal and why it was silenced.
Restoring it provides an optional story resolution; the world remains playable.

Three approaches were considered. A pure relic expedition gives strong direction
but little ownership. A survival/crafting sandbox gives ownership but can become
aimless resource grinding. Relaxed discovery removes much of the risk/reward.
The user chose expedition plus survival/crafting. We will combine a modest
survival sandbox with optional authored mysteries in a seeded procedural world.

## Playable scope

- Continuous WASD/arrow movement, normalized diagonals, hold-to-move touch controls,
  short dash, smooth camera, immediate collision and interaction feedback. Input
  must respond on the next simulation update, independently of keyboard repeat.
- Health, energy, berries/food and a gradual day/night cycle. Night changes enemy
  activity and visibility; hunger/energy should encourage preparation without
  constant eating. No permanent loss of story discoveries. Defeat returns you to
  the starting beacon camp with a clear message and a recoverable resource cost.
  Built campfires provide recovery/safe rest, but do not move the respawn anchor.
  Pause when hidden.
- Harvest trees, rocks and berries. Resource nodes have clear depletion states.
  Inventory has counts and named recipes, rather than an ever-growing loot string.
- A compact set of useful crafts: axe (harvesting and clearing), campfire
  (safe recovery/cooking), lantern (night visibility), bridge (crossing a short
  water gap), and a dash/survey upgrade earned through exploration. Recipes show
  costs and an explicit reason if crafting is unavailable. No decorative-only
  crafting tree, equipment durability treadmill, or repeated click-to-grind loops.
- Place campfires and bridges with a preview, valid placement checks, and no
  charge for a rejected placement. Explain controls at the point of use.
- Three seeded, distinct story landmarks: a drowned observatory, a glass grove,
  and an ash archive. Each has a recognizable silhouette, a local encounter or
  hazard, a discovery reward, and a short original journal entry. Local clues
  lead toward the next discovery, but the player can visit them in any order.
  Major story sites remain reachable for every seed through deliberate trail/
  clearing rules; a site cannot depend on a random bridge or item spawning.
- A broken central beacon accepts the three recovered sigils. Its activation
  changes the environment and reveals a final story fragment; exploration and
  crafting continue afterwards. Journal and compass give direction without
  requiring the player to follow a mandatory quest marker at every step.
- Sentinels patrol, notice nearby players, telegraph attacks, pursue briefly,
  and disengage. Player pulse/attack and dash have cooldowns, readable impact,
  knockback, and forgiving interaction ranges. Camp is a safe place to recover.
- Wind/grass motion, water ripples, fireflies or rain, day/night lighting,
  footstep/pickup/hit particles, distinct player/resource/enemy/landmark shapes,
  and small contextual messages. Optional synthesized sound begins only after
  a user gesture and can be muted. Reduced-motion support limits shake/flashes.
- Local save/resume for seed, content version, inventory, tools, structures,
  harvested nodes and discoveries. New expedition has an explicit reset action.
  Storage failures must not stop play. Save data belongs to its seed/version.

## Presentation

Keep Canvas and the existing dependency-free browser deployment. Give the game
the primary screen area. Show health, energy, day/time and current contextual
interaction in a compact HUD. Inventory/crafting/journal are clearly labeled
panels; touch users can reach all actions. Move technical seed/worker/order/
fingerprint/proof controls into an optional field-lab panel. Keep those controls
available to demonstrate esinxe, but do not let them dominate the game screen.

## Responsiveness and architecture

Separate the pure game simulation from drawing, input, audio and persistence.
Use a fixed simulation step with a capped accumulator and smooth rendering.
Clear input on blur; do not fast-forward combat after a hidden tab resumes.
Use tile/entity maps for collision and nearby interaction queries, not repeated
whole-world flatMap scans. Reuse cached chunk backgrounds and generate only
missing chunks through a persistent worker pool; publish chunks incrementally.
Bound caches and particles. Active AI is limited to the nearby simulation area.
Maintain stable entity identities when chunks unload and reload. Generation
errors should show actionable status while the existing world remains usable.

Terrain, resource placement, landmark layouts and initial encounters are seeded
content. Time, combat, player actions, collected resources, and placed structures
are mutable session state. A reproducibility proof compares generated content,
not wall-clock-dependent live state. The current esinxe algorithm/library APIs
and original v1 fixtures must stay unchanged. Increment application content
version for intentional changes and refresh browser evidence with current rules.
Do not present the old world fingerprint as evidence of the new content.

## Verification and acceptance

Pure tests cover diagonal speed, movement collision, dash cooldown and collision,
interaction range, attack windup/invulnerability, resource/recipe accounting,
placement validation, day/night transitions, defeat/recovery, optional story
progression, save round trips and corrupt/old saves. Check site reachability and
unique landmark IDs across representative seeds and negative coordinates.

Retain actual 0/1/4-worker and order/grass isolation checks. Verify that adjacent
chunk transitions reuse already-generated content and do not block input or
discard player state. Keep a finite cache and active-enemy bound. Test Node 18
and the generated Pages file set, including all new module dependencies.

Play-test an actual browser: move continuously, dash, harvest, craft and place,
fight or evade, discover lore, save/reload and resume, and complete the optional
beacon path. Check desktop and narrow touch layout, keyboard focus, pause/blur,
error messages, sound mute, and reduced-motion behavior. Record concrete frame/
input observations on the test machine; do not promise universal 60 FPS.
Publish via a tested PR and verify the live Pages deployment after merging,
under the user's standing push/merge authorization.

## Research used

[Celeste & Forgiveness](https://www.mattmakesgames.com/articles/celeste_and_forgiveness/index.html)
describes timing and positioning allowances that favor player intent. We adapt
the principle to dash input, interaction radius and recovery, not Celeste's jump
mechanics. [Designing Game Feel](https://arxiv.org/abs/2011.09201) distinguishes
physical tuning, amplification/feedback, and support for intended actions. Our
design applies all three; effects alone cannot supply goals, discoveries or
interesting choices. The particular story and sandbox loop are design proposals,
not research-proven guarantees of fun, and must be judged by play-testing.

## Limits and builder decisions

No multiplayer, backend accounts, external art/audio dependencies, infinite
crafting tree, complex building editor, procedural AI-written lore, or claim of
full simulation determinism across different player input timing. Exact costs,
timers, encounter counts, sprite detail and concise original lore are tuning
choices for implementation and play-testing. Avoid adding new systems if the
specified loop needs better balance or clearer feedback instead.
