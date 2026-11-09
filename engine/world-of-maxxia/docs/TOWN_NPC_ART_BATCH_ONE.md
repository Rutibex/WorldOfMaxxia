# Phase 23 — Town NPC Art, Batch One

## Four finished service scenes

| Stable service ID | Speaker / setting | Artwork |
| --- | --- | --- |
| npc_tessa_bell | Tessa Bell / Silver Lantern tavern | Retained Phase 20 four-frame scene, unchanged image bytes and timing |
| npc_orro_vane | Orro Vane / Vane Forge | New forge interior, leather-aproned blacksmith, tongs/horseshoe, anvil, tool rack, brass pipes and coals |
| npc_sister_vale | Sister Vale / Temple of the Lantern | New ivory/teal shrine, healer, herbs, bandages, water bowls, sun relief and votive candles |
| npc_captain_brann | Captain Brann / Training Court | New sunlit courtyard, veteran trainer, practice sword, targets, dummies, weapon rack and red pennants |

Exactly three new actors are added. Each has a four-frame original full-colour painted pixel-art scene, packed as an 880×560 atlas (2×2 complete 440×280 frames). Faces, attire, architecture and props are specific to the speaker and service. Loops include a long resting hold, short blink/transition frames and a settling expression; Orro's coals, Vale's candles and Brann's pennants add small environmental variation. These full-scene frame loops include natural painted-background/pose variation, rather than interpolated skeletal animation.

Artwork and idle loops display above the existing service controls in the established scrolling parchment modal. Orro's image remains in buy/sell/identify/repair subpanels; Tessa's remains in banking, roster and recruit panels. No actor is substituted for the unillustrated guild/quest services reserved for batch two. Existing messages, prices, service requirements, targets, confirmation flow and hotkeys remain intact.

## Shared playback

`src/client/npc-scenes.ts` owns the stable mapping, accessible image descriptions, image URLs, per-frame duration tables, frame selection and DOM presentation helper. Dashboard uses it for all four scenes. Game boot preloads every required atlas; missing images fail through the existing loading error path.

Frame selection is cosmetic wall-clock presentation, independent of campaign time, turns, RNG and saves. Reduced-motion or hidden-document handling chooses the resting frame. Returning to the same service uses the same time-based phase, avoiding a restarted blink after each transaction. Within a scene, the helper only writes a new background position when the frame changes. Service transactions restore the previous modal scroll position after rerender so repeated actions remain usable with the illustrated header.

No save schema change: campaign v14, service NPC IDs, maps, progression, economy, inventory and roster rules remain unchanged. Existing town environment, interface, portraits and Tessa atlas remain byte-for-byte copies of Phase 22 assets. Title art-review links share a compact navigation row to accommodate the new gallery.

## Review and reproducibility

Choose **View NPC scenes** from the title. `npc-gallery.html` uses the production scene data and helpers and provides speaker selection, 1×/2× size, play/fixed-frame selection, freeze and reduced-motion controls. It reads no localStorage or campaign state and performs no service transactions. Runtime URLs, four-frame metadata and timing come from production source; the gallery is rebuilt by normal npm prebuild or the offline build.

Masters and exact built-in image-generation prompts are under `art-source/phase23-prompts.json` and `npc-*-loop-master.png`. `python3 scripts/prepare-npc-art.py` (Pillow) mechanically packs the three new atlases with nearest-neighbour scaling and preserves the original masters. Tessa's source/runtime files are retained.

`python3 scripts/render-npc-review.py` reads the production-generated JSON and packed runtime atlases, validates dimensions and unique cells, and writes a four-scene resting contact sheet, sixteen-frame contact sheet, JSON report and optional GIF previews. These are production-asset reviews, not browser screenshots or gameplay captures. Source package includes these files under docs/npc-review and docs/PHASE23_NPC_*.png.

## Verification

204 tests pass, including exact four-service mapping, all frame holds/wrap boundaries, unchanged Tessa timing, reduced-motion rest, atlas dimensions, accessible scene creation and correct-speaker frame updates. All sixteen runtime frame cells are unique and correctly sized; generated atlases and logical-size resting/frame reviews were inspected. Browser module/asset graphs, all compiled JS syntax, server byte-serving and clean-extracted ZIPs are checked during packaging.

Actual graphical browser/Phaser integration, modal scroll/focus behavior, service interaction with the rendered scenes, 1×/2× browser appearance and cross-browser playback remain unverified because the available cloud browser cannot reach the local server. The source uses the offline Node TypeScript-transform build; canonical npm/Vite and semantic TypeScript checking remain pending.

## Next batch

Phase 24 covers Pell Glass, Nera Salt, Aunt Vell and Iona Reed. If four unique new actors are required, split 24A (three guild scenes) and 24B (Iona's quest office) to retain the plan's three-new-actors-per-batch limit. This phase counts Tessa toward the completed first four scenes; do not regenerate her without a requested revision.
