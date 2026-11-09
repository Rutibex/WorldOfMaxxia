# Phase 28 — Enemy Animation, Batch Two

## Implementation goal

Finish exactly three additional ordinary enemy sprites without changing combat, map, progression or save state. This batch covers the existing authored Resonator Vault enemies `cistern_rat`, `sludge_leech` and `pipe_goblin`, as found in `src/shared/rules/combat.ts` and the game's vault encounters. Phase 27's first three atlas assets are unchanged.

## Sprite/clip contract

| Enemy | Sprite concept | Idle | Attack | Hurt | Death |
|---|---|---:|---:|---:|---:|
| `cistern_rat` | Low, grey-green cistern vermin, long tail, yellow eyes, lunging jaws | 6 | 4 | 2 | 4 |
| `sludge_leech` | Teal serpentine sludge body, segmented suckers, protruding tooth-ring maw | 6 | 4 | 2 | 4 |
| `pipe_goblin` | Verdigris-green goblin, bronze goggles, pipe/wrench, leather apron | 6 | 4 | 2 | 4 |

All three are original, deterministic 512×512 PNGs with 4 columns × 4 rows of transparent 128×128 sprite cells and bottom-centre anchoring. Frames 0–5: idle; 6–9: attack; 10–11: hurt; 12–15: death. Clip frame durations vary by enemy, not combat turns. Transparent areas are preserved; frames never change authoritative enemy coordinates.

`public/assets/art/enemies/{cistern-rat,sludge-leech,pipe-goblin}.png` are runtime sprite sheets. Matching master sheets and a JSON manifest live in `art-source/enemy-batch-two/`. To reproduce exactly, use Pillow and run `python3 scripts/prepare-enemy-art-batch-two.py`. These pixel-art sheets are authored through the documented deterministic vector/raster generator. They are not traced or copied from World of Xeen images.

## Live game integration

`src/client/art-production.ts` registers the three new atlases under existing kind IDs. The already-existing `CombatArt` creation and playback logic selects an atlas using the enemy kind; the same events that produce attack, damage and defeat in combat trigger the appropriate cosmetic animation. Dead actors remain in the overlay until their death clip finishes. Range 1/2/3, selected enemy highlight, pause and reduced motion are supported by the inherited actor implementation. No animation state is saved; HP/XP/gold/encounter states remain untouched.

The independent `enemy-gallery.html` reviews all six completed species. It includes a filter for batches one and two, per-monster state buttons, global state buttons, pause, reduced-motion and enlarged scale. Gallery state does not read or mutate campaign saves.

## QA, remaining work

Tests check all six registered existing IDs, three new 16-frame PNG atlas dimensions/alpha channels, clip timing and playback metadata, existing combat encounter placements, actor canvas reuse, targeting and distance scaling, attack/hurt/death queueing, and cleanup on death. The first-batch test suite still passes. Actual browser/Phaser visual interaction requires a manual or automated browser playtest before final release. Phase 29 finishes **Bell Wraith, Valve Sentinel and Bell-Heart Custodian**; do not expand this phase into new enemy content or UI changes.
