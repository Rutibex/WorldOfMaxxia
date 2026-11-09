# Phase 25 — Upper Cistern Dungeon Art

## Finished environment kit

Thirty-four original full-colour raster assets replace the Upper Cistern's provisional environment art. All packed textures/sprite cells are 128×128 with pixelated scaling and alpha-preserving sprite placement. Original generated masters and exact built-in prompts remain under art-source.

- Three wall families: fitted blue-grey limestone, damp mossy masonry, copper-pipe waterworks walls.
- Projected flagstone and drainage-grate floors plus a fitted-stone ribbed ceiling.
- Closed oak, iron pump-grate and bronze locked-door artwork; opened doors retain a transparent arch.
- Original silver mirror, brazier, glass-star pedestal and violet sun banner.
- Copper bell inscription, Moon plaque, glass chime diagram, copper waterwheel, cistern survey, echo pipes, ledger/tool-roll settings, lower stair and return stair.
- Sealed/open lower-stair variants; closed/empty-open chests; empty ledger niche and tool cloth after collection; revealed secret arch; spring and Moon Pool; spent needle/rune floor decals.

The materials follow the agreed green/blue stone and amber brass/copper palette. Wall families and grating are assigned deterministically by existing tile coordinates, not RNG. The thirteen authored prop IDs have explicit art bindings. Five treasure anchors are checked against the authoritative loot-cache table.

## State-driven visuals

| Existing persistent state | Rendered consequence |
| --- | --- |
| Closed/open door bits | Painted closed leaf or transparent opened arch; DDA collision/occlusion remains authoritative |
| Secret not revealed | Ordinary opaque regional masonry; no special crack/marker, arch or decal reveals the secret |
| Secret revealed | Existing grid passage becomes visible with a slid-stone/brass arch |
| Trap absent from triggeredTraps | No trap image is drawn |
| Trap triggered/disarmed | Recessed spent needle plate or extinguished rune is projected into the floor plane |
| Unclaimed/claimed cache ID | Closed chest or visibly empty opened chest |
| Ledger/tools recovered | Empty niche/cloth; seen-scene history keeps it empty even after turn-in removes the party's plot item |
| flag_upper_descent_ready | Lower stair crossbar removed in the open variant |
| Fountain used on current expedition day | Dimmed fountain with nearby “Spent today” feedback; artwork refreshes next day |

Ledger/tool/inscription text and interaction rules remain in the authored content and live UI. Generated imagery uses decorative marks rather than replacing the real clue text. Nearby props sharing a tile use deliberate composition offsets; these offsets are visual only. Treasure, plot items and traps retain their existing coordinates and interaction behavior.

## Rendering integration

`upper-art.ts` contains visual bindings and read-only presentation selectors. `upperArtState()` passes references to relevant saved arrays/flags without changing them. `upper-environment.ts` paints the 440×280 world view using the same camera basis and DDA as movement/perspective rules. Floor and ceiling sample actual material pixels; spent traps are overhead decals on the projected floor. Wall distances clip billboard columns. Draw order sorts furniture from far to near.

The game invokes this painter only for stable map ID map_diagnostic_galleries. Town and all earlier art are retained; lower-floor art belongs to Phase 26. The Upper Cistern's minimap stays owned by Dashboard's discovery-aware renderer instead of being repainted by the temporary all-map overview. No extra exploration is written.

Rendering writes no map, party, inventory, quest, clock, RNG, fountain-day or trap state. Campaign schema remains v14. Map rows, portal targets, secret locations, traps, door locks, quests, rewards and interactions remain unchanged. Combat rules/actors still use their established implementation; remaining enemy animation is covered by its scheduled art batches.

## Review and repeatability

Choose **Explore dungeon art** on the title. `upper-gallery.html` uses the production painter and authored map in isolation, with destinations, facings, grid movement, 1×/2× scaling, fresh/opened/completed state overrides. These controls are explicitly for review and never read or write adventure saves or complete real quests. The source's current game remains the place for campaign services, fights, pickups and travel.

Repack with `python3 scripts/prepare-upper-art.py` (Pillow). The offline build and npm prebuild generate the review modules/page from production source. Optional CPU QA: `node scripts/render-upper-review.mjs [path-to-@napi-rs/canvas]`; this development-only canvas module is not required to build or play. It renders all traversable tile/facing combinations for fresh and progressed states, verifies opaque output/input immutability, and writes a contact sheet/report and individual views.

## Verification and limits

212 tests pass. Focused checks cover all thirteen prop bindings, five authoritative cache anchors, thirty-four asset dimensions/alpha formats, wall occlusion, hidden secret/trap concealment, stair/chest state, quest turn-in persistence and daily fountain refresh. The production painter passed 1,008 CPU-canvas views with full opaque coverage and unchanged map/state. Generated masters and eight representative production-painter views were inspected; see docs/PHASE25_UPPER_RENDER_REVIEW.png, docs/UPPER_RENDER_CHECK.json and docs/upper-review/.

CPU view images are not browser/gameplay screenshots. Actual Phaser/browser integration, walking/pickups/travel with the new art, browser scale/focus/scroll, cross-browser appearance and complete graphical adventure playthrough remain unverified because the cloud browser cannot reach the local server. Semantic TypeScript checking and canonical npm/Vite rebuilding remain unverified with the available dependencies.

Next: Phase 26 — Dungeon level-two art for the Resonator Vault, including its depths kit, puzzle states, chamber and unique props.
