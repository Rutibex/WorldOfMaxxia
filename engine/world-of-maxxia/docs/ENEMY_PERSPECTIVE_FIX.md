# Phase 31.1 — Enemy perspective and occlusion

## Fixed behavior

- Enemy feet follow the environment floor projection: y = H/2 + H/(2 × depth). A monster three tiles away stands nearer the horizon than one in the adjacent tile; its billboard dimensions scale inversely with depth.
- Horizontal positions come from world coordinates and the same camera basis/field of view used by the wall painter. Removing another monster does not recenter the remaining monster.
- Every projected sprite column is tested against the wall/door DDA depth buffer. Fully occluded enemies are hidden; partially exposed enemies show only the exposed columns. Closed doors, sealed corners and unrevealed secret walls use the existing isOpaque rules. Opening a door reveals the enemy normally.
- The same projection/occlusion applies in exploration and combat. There is no active-combat visibility bypass.
- Enemy projection updates with the same interpolated pose as the scenery during movement and turning. Existing authored animation frames play within the clipped billboard; additional DOM lunge/scaling transforms no longer push sprites through occluders.
- Labels are suppressed when their center is behind an occluder. Death animations retain spatial clipping. Spell/impact anchors use projected enemy positions.

## Scope

The existing enemy illustrations, audio, map content, combat calculations, target-selection rules and save schema v14 are preserved. This is a rendering hotfix, not Phase 32's wider interface audit.

## Reported locations

Upper Cistern at (12,5), facing north: the archive watcher is at depth 3 on the right and is partially hidden by the corner. Its floor anchor is y≈186.7 in the 280px viewport, rather than the bottom edge.

Upper Cistern at (12,10), facing south: the southern imp is hidden by the intervening closed door. Both exploration and active-combat rendering apply that occlusion.
