# Phase 24 — Town NPC Art, Batch Two

## Complete town cast

This delivery completes all eight authored service/quest scenes. Four original scenes join the retained first batch:

| Stable service ID | Speaker / destination | Scene identity |
| --- | --- | --- |
| npc_pell_glass | Pell Glass / School of Glass | Blue/violet study, silver-streaked wizard, spectacles, crystal lens, prisms, mirrors and spellbook |
| npc_nera_salt | Nera Salt / Tide Shrine | Sea-lit chapel, tide-priest, blue echo bottle, water basin, shells, wave relief and harbour window |
| npc_aunt_vell | Aunt Vell / Briar Hearth | Elderly witch, plum hat, cauldron, briar garlands, herbs, violet bottles and green fire |
| npc_iona_reed | Iona Reed / Cistern Office | Practical keeper, brass-bound ledger, regulator component, pipe diagrams, gauges, valve wheel and bell |

Production was divided internally into batch 24A (three guild actors) and 24B (Iona alone), then packaged together. No batch exceeded the plan's three-new-actor limit. Each new speaker has a unique appearance, scene composition and four-frame idle loop. The existing Tessa, Orro, Vale and Brann images/timings remain unchanged.

Atlases are 880×560 with four complete 440×280 cells. New atlas packing strips the central source-divider gutter before nearest-neighbour resizing, preventing separator lines from appearing at runtime frame edges. Generated masters remain unmodified. Long resting holds, brief blink/transition frames, settling expressions and small glints/reflections/flame changes follow the established service-scene style. Natural painted-background/pose variation remains part of these full-scene loops.

## Integration

All eight destinations use the existing shared NPC presentation helpers. The three guild scenes remain attached to their own speaker while changing students and buying spells. Iona's scene accompanies quest acceptance, progress and ending-choice dialogue using her existing stable ID. Existing dialogue, plot items, ending requirements, prices, currency transactions, spell requirements, player selections and service hotkeys are unchanged.

Boot-time validation compares the full scene registry with the authored town services. Missing/extra IDs, a scene bound to the wrong speaker, shared image URLs or invalid frame timings fail clearly. Every atlas preloads through the existing loading path. Unknown IDs have no scene fallback, preventing accidental wrong-speaker artwork.

Playback remains cosmetic, independent of campaign RNG and clock. Reduced-motion/hidden-document handling uses resting frames. Existing service scroll retention and the compact title art-review links are carried forward. Save format remains v14; no map, service coordinate, quest, roster, inventory, spell or economy rule changes.

## Review and repeatability

**View NPC scenes** on the title now shows the complete eight-person cast. The gallery uses production metadata and playback helpers, with speaker selection, 1×/2× size, fixed frames, freeze and reduced motion. It does not access localStorage or perform gameplay transactions. The town, interface and Phase 20 animation-review pages remain available.

Exact built-in generation prompts are grouped by internal batch in `art-source/phase24-prompts.json`. Original masters are `npc-pell-loop-master.png`, `npc-nera-loop-master.png`, `npc-vell-loop-master.png` and `npc-iona-loop-master.png`. Repack this batch with `python3 scripts/prepare-npc-art-batch-two.py` (Pillow); the first batch retains its existing packing script. Rebuild galleries with npm prebuild or `node scripts/build-offline.mjs`.

`python3 scripts/render-npc-review.py` inspects all eight production atlases and thirty-two runtime cells, produces checksums/duration report, and writes the current Phase 24 resting and frame contact sheets plus GIF reviews. Source includes `docs/PHASE24_NPC_REVIEW.png`, `docs/PHASE24_NPC_FRAMES.png`, `docs/NPC_ART_CHECK.json` and `docs/npc-review/`. These are actual runtime-asset previews, not browser/gameplay screenshots.

## Verification and limits

206 tests pass. All eight scene mappings, atlas dimensions, frame boundaries, timing wrap, resting/reduced-motion behavior, accessible speaker identity and DOM frame updates are checked. Complete-registry validation rejects missing, mismatched and duplicate-image definitions. Each guild and quest destination has its own URL and matching speaker name. All thirty-two runtime cells are distinct within their atlas; original masters and packed resting/frame views were inspected.

Module/asset graphs, compiled JS syntax, full-site HTTP serving, ZIP integrity and clean-extracted browser packaging are checked. Existing rules, content, first-batch NPCs, town art, portraits, UI and fonts are compared against Phase 23 for byte preservation.

Actual graphical browser/Phaser integration, guild/quest interaction with the rendered scenes, modal focus/scroll, 1×/2× browser appearance and cross-browser playback remain unverified because the cloud browser cannot reach the local HTTP server. Semantic TypeScript checking and canonical npm/Vite rebuilding remain pending in this environment. No full graphical adventure playthrough is claimed.

Next: Phase 25 — Dungeon level-one art. Replace the Upper Cistern's provisional environment kit with finished masonry, doors, stairs, chests, traps, secrets and quest props, preserving mechanics and saves.
