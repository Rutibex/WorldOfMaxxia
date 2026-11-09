# MP25 — Scenery, sprites and animation contracts

**Workspace:** 0.25.0-mp25. **Engine:** 0.70.0. **Gameplay save:** 18.  
**By Michael Robinson.**

## What is implemented

All common scene profiles can now carry sprite definitions. Native maps place those sprites as decorations, prop replacements or semantic entity bindings. NPCs and monsters use the same atlas painter as scenery; enemy coordinates continue to come from authored encounters and the live simulation. Surface rendering remains the MP24 profile path.

The common sprite pass handles image sources, atlas rectangles, scale, pivots, facing, wall occlusion, depth ordering, state-driven clips and alpha-aware interaction hotspots. It also merges the existing procedural fallback props and ground items into its depth-sorted pass on maps using authored sprites. Original scenes without these bindings retain their established painter output.

Two independent core-only examples are included: `examples/mp25/brass-bell` and `examples/mp25/lantern-gallery`. They use distinct existing scenery, NPC and enemy images through identical code. Lantern Gallery is a presentation proof using Brass Bell's adventure mechanics; it is **not** the finished Lantern Market After Midnight adventure planned for MP31. Both examples retain temporary presentation assets pending final art production.

## Sprite definition

Place `sprites` alongside `materials` and optional `scene` in an environment profile's `record`. Sprite IDs are local to that profile. Resource IDs use the existing qualified resource-alias contract and must be declared in the environment descriptor's `references` array.

A complete two-source sprite definition, suitable for the existing chest images:

```json
{
  "id": "supply_chest",
  "sources": [
    { "resourceId": "bell:resource:crate_closed", "width": 128, "height": 128 },
    { "resourceId": "bell:resource:crate_open", "width": 128, "height": 128 }
  ],
  "frames": [
    { "source": 0, "x": 0, "y": 0, "width": 128, "height": 128 },
    { "source": 1, "x": 0, "y": 0, "width": 128, "height": 128 }
  ],
  "animations": [
    { "id": "idle", "frames": [0], "fps": 0, "loop": false },
    { "id": "closed", "frames": [0], "fps": 0, "loop": false },
    { "id": "open", "frames": [1], "fps": 0, "loop": false },
    { "id": "claimed", "frames": [1], "fps": 0, "loop": false }
  ],
  "defaultAnimation": "idle",
  "pivot": { "x": 0.5, "y": 0.95 },
  "fallback": "placeholder"
}
```

Each source declares the decoded image's exact pixel dimensions. A source may contain many atlas frames; `source` is its zero-based index. Rectangles must stay inside the declared source. Clips reference zero-based entries in `frames`, not source images. This supports both conventional sprite sheets and state variants stored in separate images.

An image ID reused by several definitions in one profile must declare consistent dimensions. The reader validates shapes, budgets and references; the renderer checks the actual decoded dimensions before drawing or sampling a hotspot.

## Static placements and semantic entity bindings

Native format-2 map records accept `spritePlacements`. For example, after adding the sprite above to the map's environment:

```json
{
  "id": "tools_visual",
  "spriteId": "supply_chest",
  "x": 3,
  "y": 9,
  "scale": 0.45,
  "facing": 2,
  "entityId": "bell:object:tools",
  "stateAnimations": {
    "closed": "closed",
    "open": "open",
    "claimed": "claimed"
  },
  "hotspot": { "x": 0.08, "y": 0.05, "width": 0.84, "height": 0.9 }
}
```

| Field | Contract |
|---|---|
| `id` | Unique local placement identifier, up to 48 characters. |
| `spriteId` | A sprite defined by this map's selected environment profile. |
| `x`, `y` | Authoritative map cell; bound placements must match their entity/prop cell. |
| `scale` | 0.1–3 world units of image height. Frame aspect ratio determines width. |
| `facing` | 0 north, 1 east, 2 south, 3 west. |
| `entityId` | Optional MP13 entity binding, including NPCs, containers, objects, doors or discovered secrets. |
| `propId` | Optional replacement for an existing prop; choose this or `entityId`, not both. |
| `animation` | Optional initial/default clip for an unchanging placement. |
| `stateAnimations` | Optional simulation-state → clip-name mapping. |
| `hotspot` | Optional normalized rectangle, permitted only for entity bindings. Defaults to the full frame. |
| `mount` | Optional `floor`/`wall`. Unbound wall scenery must explicitly use `wall` and occupy an authored wall/door cell. |

Decorations omit a semantic binding. Entity/prop bindings are unique within a map and do not move their original targets. Entity-bound visuals suppress the duplicate generic entity billboard; prop-bound visuals replace that prop's generic drawing. Hidden entities produce neither a sprite nor a visual hotspot until discovered. The normal interaction menus remain available for search and reveal capabilities.

An entity's actual `idle`, `used`, `closed`, `open` or `claimed` state selects its clip. The renderer never grants an item, opens a door, advances a quest or spends resources when an animation ends.

Pivots are normalized: x=0 left, 0.5 centre, 1 right; y=0 top, 1 bottom. The pivot anchors at the projected cell centre and floor plane. Sprites are camera-facing billboards. Wall-mounted sprites and semantic door/secret visuals may paint their own opaque target cell, but an intervening wall still occludes them.

## Enemy bindings

Use `enemyAppearances` in the native map record:

```json
{
  "kindId": "bell:monster:silt_rat",
  "spriteId": "vermin",
  "scale": 0.9,
  "facing": 2,
  "stateAnimations": {
    "idle": "idle",
    "active": "active",
    "guarded": "guarded",
    "attack": "attack",
    "hurt": "hurt"
  }
}
```

Declare qualified monster IDs in the map descriptor's references. Existing stock monster IDs remain supported. This binding changes appearance only: encounters still author spawn locations and the simulation still owns movement, health, AI, rewards and target eligibility. One binding per monster kind per map applies to all its live instances, including summons of that kind.

Idle, active-turn and guarded states come from the current combat snapshot. Existing transient presentation events select short attack/hurt reactions when the corresponding clips exist; healing/guard/ward events do not masquerade as attacks. Missing reaction clips keep the normal state animation.

A `dead` mapping is optional. It renders a terminal clip only for enemies previously seen alive by that painter in the current map visit; dormant encounter placeholders do not appear as corpses. This visual history is transient and resets on map changes or reload. The examples keep existing corpse/ground-loot presentation rather than opting into an extra death billboard.

Bound enemies use the new canvas art and clickable projection. The existing combat target controls remain available. Unbound enemies keep the original CombatArt atlas/effect path. Original boss-specific animations and the complete DOM VFX layer have not been generalized here; attacks/hurt frames for bound enemies use the common presentation-event path.

## Facing, animation time and fallback

An optional `directionOffsets: [front, right, back, left]` array adds a frame-index offset for the sprite's facing relative to the viewer. With the party looking north and an actor facing south, the front offset is selected. Every clip frame plus every direction offset must reference an existing frame. Omit this array for nondirectional artwork.

Clip playback uses a bounded display clock. It does not read or consume campaign time, turns or RNG. State changes restart the selected clip once; looping clips repeat and nonlooping clips hold their last frame. Pausing freezes the display clock; resuming does not count paused time. A long render gap advances by at most one second. Reduced-motion mode holds each selected clip's first frame. Animation phase is deliberately not saved.

If a referenced image cannot be decoded/sampled or its decoded dimensions differ from the source contract, `fallback: "placeholder"` draws a visible diagnostic rectangle and retains the semantic hotspot. `fallback: "hide"` omits that visual/hotspot. Warnings are deduplicated in the console and exposed through `PerspectiveRenderer.spriteDiagnostics`. This fallback does **not** permit dangling resource IDs: missing providers, undeclared references and malformed atlas records are rejected during catalogue staging. `defaultAnimation` is the defined runtime fallback if a dynamic state has no matching clip.

Choose placeholder fallback for important interactive objects. A hidden fallback never removes the underlying keyboard/menu interaction, but should not become an adventure's only clue.

## Occlusion and input authorization

The same map/camera DDA clips both sprite columns and hotspots. Sprite layers sort far-to-near with a stable ID tie-break. A hotspot must lie inside the painted frame, normalized hotspot rectangle, a wall-visible column and a source pixel with alpha at least 16/255. An opaque nearer decoration blocks click-through; transparent pixels expose layers behind them.

Browser pointer coordinates are mapped from the actual scaled game canvas into the 440×280 viewport. Clicking an entity re-queries the normal interaction menu for that entity. A visible object can remain out of reach, and capability costs/LOS/requirements remain authoritative. Clicking an enemy uses the existing validated combat-target command. Normal keyboard and button menus still work. Clicks and animation frames do not bypass the simulation boundary.

## Limits and compatibility

- Up to 64 sprites per profile; 1–8 sources per sprite; 1–256 rectangles; 1–16 clips with 1–64 frame indices; 0–24 fps.
- Each source dimension is 1–4096 pixels. Distinct sources within one profile share a 16-megapixel declared decoded-image budget.
- Up to 128 static placements and 32 enemy-kind bindings per map. The painter limits a frame to 512 instances and reports excess instances.
- Scale and pivots are presentation only; they do not change reach, collision or elevation. Mutable routes/elevation remain MP26.
- Profile and native-map schemas, catalogue reference validation and map-document import/adaptation support these fields. Unknown sprite/clip bindings fail before gameplay.
- Gameplay save format remains 18. The existing campaign-instance wrapper stores object scoped state; loaded state regenerates visuals. Atlas phase, hit rectangles and pixel caches are transient.
- Original project `legacyScenery` adapters remain explicit. Removing all original campaign-specific selectors is still MP32 work.
- The examples reuse existing images. NPCs are illustrated panel billboards in this proof, rather than newly cut-out character art. Distinct final example art remains MP39–41.

## Build and verify

From the cumulative source root with Node 22.18+:

```sh
npm ci
npm --prefix engine/world-of-maxxia ci
node tools/build-mp25-catalogues.mjs
node tools/maxxia.mjs validate examples/mp25/brass-bell --engine 0.70.0
node tools/maxxia.mjs validate examples/mp25/lantern-gallery --engine 0.70.0
node --experimental-strip-types --test engine/world-of-maxxia/tests/sprites-mp25.test.mjs toolkit/tests/mp25.test.mjs
node --experimental-strip-types --test --test-concurrency=2 engine/world-of-maxxia/tests/*.test.mjs
node --experimental-strip-types --test toolkit/tests/*.test.mjs
node engine/world-of-maxxia/node_modules/typescript/bin/tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
npm run build:game
node --experimental-strip-types tools/run-mp25-scenarios.mjs --production
node tools/run-mp25-render-proof.mjs
npm run verify:game
npm run check:workspace
```

The CPU render proof imports the actual compiled production modules, loads real images, verifies both independent packs, atlas changes, six visible entity/enemy hotspots and container appearance after a real campaign-instance reload with scoped state. PNGs and hashes are recorded under `validation/MP25`.

For a direct MP24 comparison, run `node tools/run-mp25-legacy-proof.mjs --baseline /path/to/World-of-Maxxia-MP24-Browser`. The recorded check passed 48 exact original-scene comparisons and 48 renamed-map comparisons. Without `--baseline`, the tool still verifies renaming and profile variation.

## Browser demonstration

Run the browser launcher and open:

- `/index.html?project=projects/WorldOfMaxxia/project.json` — original campaign.
- `/index.html?project=projects/WorldOfMaxxia/project.json&catalogue=mp25-proof/brass-bell.maxxia-build.json` — cumulative Brass Bell with authored scenery/NPC/enemy art.
- `/index.html?project=projects/WorldOfMaxxia/project.json&catalogue=mp25-proof/lantern-gallery.maxxia-build.json` — independent appearance fixture with distinct images.

Review scaled-canvas clicks, touch, door/wall occlusion, open/claim transitions, NPC clips, enemy targeting and pause/reduced-motion behaviour. The release host's known Chromium socket restriction remains an unresolved interactive browser gate; CPU Canvas evidence does not prove the actual UI or GPU path. Native Windows/.NET editor acceptance also remains unverified.

**Next phase: MP26 — Elevation, hazards and mutable routes.**
