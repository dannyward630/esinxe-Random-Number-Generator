# Verdant in three dimensions

## Intent

The user requests a thorough, visually fun 3D game. Make the existing survival
expedition a colorful low-poly third-person adventure, with a visible animated
explorer and a camera that makes exploration inviting. Keep popup menus and
preserve all existing saves, story discoveries, crafting and the seeded world.
The user has already authorized implementation, public push and merge.

## Approach

Use a pinned, self-hosted Three.js 0.187.0 WebGL2 renderer. A native WebGL engine
would divert effort from the game; a full external game engine would replace a
well-tested simulation and complicate static hosting. Procedural geometry avoids
asset downloads and makes every environment fit the same art direction. Keep a
selectable 2D compatibility view for devices without WebGL2. Default to 3D.

## Visual and interaction contract

- Raised, faceted terrain, distinct biome colors, dimensional trees/rocks/reeds,
  flowers, chests and original ruin silhouettes. Keep existing clear trails.
- Animated explorer with backpack/scarf and readable tool, swimming and jumping
  poses. Floating sentinels visibly telegraph attacks and react to hits.
- Soft sun shadows, sky gradient, rolling clouds, stars, dusk colors, warm fire,
  luminous beacon/crystals, ambient motes, bounded impact particles and wakes.
- Animated water with shore foam, submerged salvage and an underwater tint/fog.
  Air, stamina and last-shore recovery keep their tested behavior.
- Orbit with right-drag or Q/T; zoom with wheel or +/-; touch camera buttons;
  H resets. WASD is camera-relative, Space jumps on land/strokes in water,
  Shift dashes, and existing J/E/F/R actions remain. Touch includes Jump/Stroke.
- Real jump airtime and landing; low rocks can be cleared while tree trunks and
  unbooted mountains remain blocked. Vertical motion is transient, so v2/v3
  saves load on the ground without a migration that discards progress.
- M retains a readable overhead survey with landmark/biome markers. Building
  placement uses raycast terrain picking and a visible green/red world preview.
- Popup menus freeze physics/survival. Settings include view and quality choices.
  Reduced motion limits bob, camera easing and particles. WebGL failure offers
  the existing 2D view with controls adjusted to it.

## Engineering boundaries

Keep generator.js and original fixtures untouched. Horizontal x/y coordinates
remain the persistent world identity; Three uses x/z on the ground and y up.
Use chunk-local instanced geometry, bounded scene/particle caches, capped pixel
ratio, a shadow budget and disposal on eviction/reset. Self-host the vendor
modules and license through the guarded static-site builder. No CDN at runtime.

## Acceptance

Automated tests cover camera movement, terrain mapping, chunk meshes/resource
release, jump/obstacle/water/save behavior and site assets. Existing expedition,
worker invariance and full story tests pass. Browser-play the game in actual 3D:
walk/orbit/zoom/jump, harvest/craft/place, explore a water destination/dive,
encounter a sentinel, open/pause menus, use survey mode, resize to phone, and
check compatibility view. Inspect errors, rendering budgets and representative
screenshots. Review code, run CI, merge and verify deployed assets and gameplay.
