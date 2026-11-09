# Phase 27 — Enemy Animation, Batch One

This batch completes the first three of the nine ordinary/boss enemy appearances in the original demo scope, retaining the Dust Imp approved in Phase 20 and introducing original **Stone Mite** and **Gallery Watcher** artwork. All gameplay remains inside the existing 440×280 first-person view, without a separate combat screen.

## Art and gameplay anchors

| Existing enemy kind | Existing locations | Sprite source | Idle | Attack | Hurt | Death |
|---|---|---|---|---|---|---|
| `dust_imp` | Upper Cistern entrance, patrol and sluice | Phase 20 original `dust-imp.png` | 8 frames | 3 frames | 1 frame | 4 frames |
| `stone_mite` | Upper Cistern entrance, pumps, sluice | New `enemies/stone-mite.png` | 6 frames | 4 frames | 2 frames | 4 frames |
| `gallery_watcher` | Upper Cistern east gallery, archive | New `enemies/gallery-watcher.png` | 6 frames | 4 frames | 2 frames | 4 frames |

All sprites are 512×512 PNG RGBA atlases in 4 columns × 4 rows of 128×128 cells. Drawn subjects retain a consistent bottom-centre anchor and each clip has an explicitly timed frame list. The two newly created creatures have distinct silhouettes (low stony six-legged vermin with cyan eyes; floating bronze/cobalt one-eyed sentry). Dust Imp artwork is carried forward byte-for-byte. These are original in-game assets, not copies of the Xeen reference sheets.

## Production integration

- `src/client/art-production.ts` exports `ANIMATED_ENEMY_ATLASES`, with per-species timing and frame sets; the Dust Imp has not been redesigned.
- `src/client/combat-art.ts` lazily uses those atlas images for species already registered; previous, unreplaced enemy glyphs remain visible for Phase 28/29 species.
- Attack animations play when the existing combat log reports an enemy attack; hurt/death animate according to actual HP changes. Dead actors survive live-list refresh until their death sequence completes; none of this delays damage, XP or loot rules.
- Enemy element nodes, IDs and targeting remain stable across UI refreshes. Selected actors have a consistent outline; range 1/2/3 uses an anchored 100%/85%/70% presentation size for the new sprite species.
- Reduced-motion uses the fixed first idle frame or last non-loop frame, with existing UI pause behaviour retained.
- No changes to enemy stats, encounters, IDs, combat rolls, save schema, quests, maps, the current RNG stream or inventory.

## Art inspection and reproducibility

`enemy-gallery.html` is linked from the title. It previews the same production animation atlas metadata and packed runtime images, with selectable Idle / Attack / Hurt / Death, a group state switch, pause, reduced-motion simulation and alternate scale. It cannot read/write saves or transact game state.

Original sprite masters and deterministic generation script are included under `art-source/enemy-batch-one/` and `scripts/prepare-enemy-art-batch-one.py`. Use the script to regenerate the new atlas files. The Dust Imp remains in its original Phase 20 master. `docs/PHASE27_ENEMY_ATLAS_REVIEW.png` is a static sprite review contact sheet, not a browser gameplay screenshot.

## Acceptance and pending QA

Automated tests cover all clip tables and atlas geometry, stable actor nodes, hit/death queuing, fallback for unfinished species and distance anchors; browser ESM/static asset checks cover the playable distribution. Game/renderer content and saves remain unchanged. An actual graphical campaign run through every first-floor encounter, different enemy combinations, browser scaling and browser audio state remains a recommended manual acceptance check if unavailable locally.

Next: **Phase 28 — Enemy animation, batch two**, three more ordinary enemy types, without changing combat rules or existing atlases.
