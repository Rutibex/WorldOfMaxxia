# Phase 29 — Enemy Animation Batch Three and Boss

## Deliverables and scope

Full final set: the original **Bell Wraith**, **Valve Sentinel**, and **Bell-Heart Custodian** 512×512 RGBA 4×4 animation sheets are integrated into their already-authored Resonator Vault combat encounters. Each has six idle, four attack, two hurt, and four death frames. This brings the roster to **nine animated enemy kinds** (all eight ordinary plus the boss). The Bell-Heart Custodian additionally has a separate 512×512 special sheet with four telegraph, four discharge and four recovery poses. All cells are 128×128; consistent bottom-center anchors and existing distance scaling are retained.

Existing enemy kinds, map and encounter coordinates, combat stats/damage/initiative, quest flags, rewards, time accounting, save version 14, and earlier town/dungeon/portrait/NPC assets remain unchanged. No new monsters or balance modifications.

## Boss animation contract

The visual presentation is event-driven: `CombatArt.observe()` listens for the **existing** rules messages:

- `BELL-HEART TELEGRAPH ...`: play four golden charging poses and show **CHARGING — BLOCK!**.
- `The Bell-Heart Custodian releases a thunderous resonant wave!`: play four cyan/white discharge poses and show **RESONANT WAVE**.
- `The Custodian cools and exposes its regulator core.`: show four recovery poses and **CORE EXPOSED**.

No visual timer advances the combat round or consumes HP/SP. Timing is cosmetic only; the combat engine retains its own three-round mechanic. The first warning remains queued if the actor node has not yet been rendered. Death overrides boss charge/discharge/recovery and stays visible until the death clip ends. Ordinary actors retain their prior attack/hurt/death queue timing. The boss’s special art uses a distinct image atlas; it does not overwrite the ordinary attack/hurt/death cells. Reduced-motion playback uses a static state pose.

## Artwork and review

- `public/assets/art/enemies/{bell-wraith,valve-sentinel,bell-heart,bell-heart-special}.png`
- `art-source/enemy-batch-three/*-master.png`, `asset-manifest.json`
- `scripts/prepare-enemy-art-batch-three.py`: deterministic Pillow regeneration of all four sheets.
- `docs/PHASE29_ENEMY_ATLAS_REVIEW.png`: full-sheet review, **not** a browser screenshot.
- `enemy-gallery.html`: all nine actors, batch filtering, normal clips, extra boss-only special clips, scaling, pause, reduced-motion.

## Verification and limitations

Focused tests verify 9/9 IDs, sprite integrity, all clip frame ranges, special atlas selection, state/event mapping, first-frame warning on actor creation, death precedence and cosmetic immutability. Existing regression tests were retained. A full in-browser battle, boss damage resolution, cross-browser timing and end-to-end adventure remain the release-phase acceptance tasks, not claims made by this phase.
