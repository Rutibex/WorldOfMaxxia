# Phase 22 — Bellwether Quay Town Environment Art

## Integrated kit

Twenty-seven runtime PNG assets: four building fronts, cobble paving, slate roofing, closed oak gate, blue service/gate door, open arch, harbour-sky panorama, eight service signs and nine landmarks. Materials are 128×128; the sky is 1320×440. Transparent props are packed to a fixed 128×128 registration with a ground baseline, preserving alpha. All generated masters and exact built-in image-generation prompts are retained under art-source.

The outdoor town painter replaces the diagnostic indoor masonry, ceiling, floor and generic mirror/brazier/crystal/banner shapes for every map_town view. Roof profiles, sky, distance shading, floor projection and sign/landmark projection use the existing camera basis and authoritative DDA wall distances. Every town prop is assigned explicitly by its existing ID, never by its former placeholder kind. Required images preload at boot, and missing ID coverage fails clearly rather than falling back to generic art.

## Spatial identity

| Existing town destination | Finished visual |
| --- | --- |
| Silver Lantern Tavern | Violet sign with silver lantern; welcoming timber/plaster district |
| Vane Forge | Anvil, tongs and fire sign; brick, iron, brass-pipe frontage |
| Temple of the Lantern | Ivory sun/votive sign and shrine stonework |
| Training Court | Crossed swords and target sign |
| School of Glass | Brass mirror sign; blue guild frontage and violet glass |
| Tide Shrine | Curling wave, blue bottles and ivory shrine district |
| Briar Hearth | Violet cauldron/briar sign with green flame |
| Cistern Office | Brass waterwheel and ledger sign |
| Old Foundry Walk | Brick chimney/manifold and brass valve pipes |
| River Steps | Stone steps and blue coping beside the dry channel |
| South Gate Notice | Framed oak notice board |
| Clock Arch | Stone/brass clock arch and hanging bell |
| Market Stalls | Blue-shuttered stall, striped canopy, fruit and crates |
| Firstlight Well | Stone well, slate canopy, brass crank and water |
| Cistern Stair | Stone cellar stair and blue arched door |
| Lantern Alley | Iron street lantern, amber glass and purple flowers |
| Survey Marker | Weathered stone and brass compass/arrow motif |

Generated signs use visual emblems rather than generated lettering. Nearby service names render as live text with a dark plaque and wall clipping. Doors reflect existing saved open/closed state; open gates retain a transparent painted arch. Opening a gate never creates a new tile or changes the collision rules. Roofs and sky are presentation only.

Building frontage assignment is deterministic by existing tile coordinates: guild/shrine colours in the northern district, ivory temple stone around the western shrine and forge materials in the eastern market/training district, with timber/plaster elsewhere. The map rows, objects, service anchors, travel targets and quest conditions are unchanged. Service signs/landmarks remain nonblocking decorative representations of their existing objects.

## Rendering and preservation

`src/client/town-art.ts` owns stable visual mappings and validates complete coverage. `src/client/town-environment.ts` is independent of Phaser and draws into a Canvas 2D context. `PerspectiveRenderer` calls it only for map_town; dungeon rendering retains its prior implementation for later art phases. Wall/door ray distances clip sprite columns, labels use the same occlusion test, and props sort from far to near. The renderer consumes no campaign RNG, advances no clock and writes no map/party/door/discovery state.

The town render path leaves the minimap to Dashboard's existing discovery-aware drawing; it no longer repaints the temporary diagnostic overview over that minimap. Town art does not reveal additional explored tiles.

## Review tools and repeatability

Choose **Explore town art** on the game title. `town-gallery.html` uses the same production painter and authored map, with all seventeen landmark/service destinations, four facings, grid movement, 1×/2× scaling and a review-only open-gate override. This isolated page does not read or write localStorage, campaign saves, quests or resources. Services and travel remain gameplay actions in the main game.

Repack assets: `python3 scripts/prepare-town-art.py` (Pillow). Build the town review with `node scripts/build-town-gallery.mjs`; both offline build and normal npm prebuild run gallery generation. The review copies stripped native modules from production source, keeping one town renderer implementation. Production game builds also import that same source.

Optional CPU visual QA: `node scripts/render-town-review.mjs [path-to-@napi-rs/canvas]`. This optional development dependency is not needed to build or play the browser package. It renders every traversable tile at all four facings for both gate variants, checks full opaque pixel coverage and state/map immutability, and writes the contact sheet plus JSON report. The committed review images were produced with this actual painter on a CPU canvas backend; they are not full-game/browser screenshots.

## Verification and remaining limits

200 automated tests pass. Twenty-seven asset sizes/alpha formats, seventeen explicit object mappings, deterministic district materials, intervening-wall occlusion and door-state rendering are covered. The production painter passed 784 all-tile/facing/gate view checks with full painted coverage, without changing map or grid state. Generated masters and eight representative production renders were visually inspected; reports/images are in docs.

Actual Phaser/browser integration, keyboard interaction, scaled appearance in-browser and a complete graphical adventure playthrough remain unverified because the available cloud browser cannot access the workspace's local server. CPU render coverage does not establish browser compatibility or gameplay balance. Semantic TypeScript checking and canonical npm/Vite build remain unverified in this environment.

Next: Phase 23 — Town NPC art, batch one. Count Tessa's existing scene toward four finished service scenes, adding at most three new animated actors. Reuse Phase 20's idle-loop workflow and the Phase 21 interface.
