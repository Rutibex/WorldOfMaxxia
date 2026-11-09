> Historical Phase 20 checkpoint. Phase 21 completes all twelve portraits and interface art; see FINAL_INTERFACE_AND_PORTRAIT_ART.md for current coverage.

# Phase 20 — Art Production Proof

## Visual contract

Full-colour original fantasy raster artwork, using DOS-era painted characters, bold silhouettes, rich shading and deliberate pixel clusters. These game assets are full colour; Hexmaster Classic's black-and-white book-interior rule does not apply. Xeen screenshots and the supplied monster sheets are visual/timing references, not distributed game assets. No Xeen image bytes are included.

Retain the logical 640×400 dashboard and 440×280 world viewport. Nearest-neighbour texture sampling and image-rendering:pixelated preserve pixel edges. Do not change input hit areas or stretch the dashboard aspect ratio. Runtime portrait states are exactly 58×70. NPC scene frames are 440×280. Dust Imp cells are 128×128 in a 512×512 transparent atlas, row major; fixed cell registration prevents animation reflow. Reference ground anchor is (64,123), with natural small pose variation; do not trim frames independently.

Palette anchors: midnight #101923, slate #405056, warm ochre #b18a43, amber #edc57d, turquoise #69bdc7, violet #64487d, parchment #e3cfaa. These are art-direction anchors, not a strict indexed colour limit. Warm interiors oppose cool harbour shadows; creatures have readable eyes and strong edge contrast. Town environment art later uses welcoming saturation, cistern green/amber, depths violet/brass.

## Integrated production proofs

- Dust Imp, existing `dust_imp` kind ID: 8 idle ×145 ms, 3 attack ×125 ms, 1 hurt ×210 ms, 4 death ×160 ms. Idle loops; action clips complete then return to idle. Death retains the actor after it leaves the living-target list and removes it after collapse. Existing hit-point bars and selection feedback stay available. Other eight enemy kinds remain provisional.
- Tessa Bell, existing `npc_tessa_bell` at (4,11): original complete Silver Lantern scene appears within the existing service modal and its banking/roster subpanels. A four-frame loop holds the first frame 2300 ms, half-blink 120 ms, closed blink 120 ms, then smiling frame 1060 ms. All existing service transactions remain in the same panel below the art; scrolling may be needed. This phase does not redesign services into the viewport/right-pane layout.
- Portrait index 5, selection 6: original Witch, normal/hurt/afflicted/dead. Existing HP/condition rules select the state; default Witch, custom creation and character inspection share the artwork. Eleven other portrait selections remain provisional.

## Animation architecture

`art-production.ts` owns frame sequences and durations. `combat-art.ts` keeps actors keyed by stable enemy instance ID. Status refreshes and target changes reuse nodes. Presentation derives hurt/death from before/after HP. Attack cues recognize existing combat feedback messages beginning with the exact kind name followed by “hits” or “misses”; if message wording changes, update this adapter or introduce structured feedback events. Simultaneous rules outcomes queue cosmetic clips; they never delay turns, consume RNG or alter campaign state. Queues are bounded and preserve a pending death. Quick Fight can advance mechanics faster than playback.

Animation is cosmetic and intentionally absent from saves. Loading/importing/starting a game clears transient actors. Map changes clear old actors. Reduced-motion uses a fixed idle frame or final action pose and fixes the tavern at open eyes. A paused-light setting also fixes monster frames; clips still expire so presentation cannot block play. Background tabs do not advance game rules.

`public/art-proof.html` is a separate non-mutating review surface, linked from the title. It shows the actual production assets at logical size or 2×, with selectable monster clips, reduced-motion and freeze controls. It is an asset review, not evidence of a completed gameplay run.

## Repeatable asset workflow

1. Keep full generated masters and prompts under `art-source/`.
2. Use `python3 scripts/prepare-art.py` (Pillow) to crop uniform cells and resize with nearest-neighbour; no recolouring or repainting.
3. `node scripts/build-offline.mjs` copies public assets and compiles source with installed TypeScript, or Node's built-in TypeScript transform if unavailable. Canonical `npm ci && npm run build` remains the preferred release build when dependencies are available.
4. Missing required runtime proof images are checked by the boot loader. Do not silently substitute placeholders for a broken production pack.
5. Check artwork at 1× and 2×, three-target composition, target selection, hurt/death timing, service scrolling, all portrait conditions, save/reload, and reduced-motion.

Perspective guide SVGs under `art-source/templates` use the existing renderer's CAMERA_PLANE=0.66. They describe camera-space tile depths, horizon y=140 and wall height 280/depth. The renderer remains authoritative for ray hit distance and wall occlusion. These guides support later environment painting; no environment kit is marked complete here.

## Scope and review status

The original generated masters and their packed logical-size versions were visually inspected. The logical-scale review PNG documents legibility without pretending to be a gameplay screenshot. Frame sizes, animation state transitions, asset serving, module references and regression rules are checked automatically. Interactive Chromium QA is still pending: the available cloud browser cannot reach this workspace's local server (ERR_CONNECTION_REFUSED). No claim of visual browser approval, cross-browser compatibility or complete graphical playthrough is made.

Proof work counts toward Phase 21 portraits, Phase 23 Tessa and Phase 27 Dust Imp; do not recreate them unless visual review requests a revision.
