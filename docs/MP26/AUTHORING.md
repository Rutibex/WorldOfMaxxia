# MP26 — Elevation, hazards and mutable routes

Engine 0.71.0 · Workspace 0.26.0-mp26 · Campaign format 18

MP26 adds finite authored terrain configurations to native maps. The independent Terrain Lab fixture demonstrates a changing maze, deployed bridge, pit, liquid, conveyor, teleporter, stepped elevation and a permanent recovery control. Ordinary doors retain their existing interaction and saved-state contracts.

## Authoring contract

Add `terrain` to a runtime GridMap, or `objects.terrain` in a map document. See `examples/mp26/terrain-lab` for complete executable records and `src/shared/project/terrain-contracts.ts` for exact types. Schemas are in `toolkit/schemas/map-v2.schema.json` and `routine-v2.schema.json`.

A definition has `version:1`, `initialConfigurationId`, `changeMinutes`, a `recovery:{x,y,entityId}` anchor, `configurations`, and directed `transitions:[{from,to}]`. A configuration has `id`, `name`, `cells`, and `blockedEdges`. Unspecified cells inherit the immutable base map. Configurations replace the entire overlay; they do not accumulate edits.

| Field | Bound or meaning |
| --- | --- |
| Configurations | 1–8, local lower-snake-case IDs, at most 32 characters |
| Cells / edges | At most 256 cells and 128 blocked edges per configuration |
| Transitions | At most 32 explicit directed changes |
| Cell kind | floor, wall, bridge, pit, liquid, conveyor, teleporter |
| Elevation | Integer −2 through 2; ordinary movement crosses at most one level |
| Extra minutes | 0–5 per entered cell; route change costs 1–10 minutes |
| Entry damage | 0–20 per conscious hero, only pit/liquid |
| Conveyor | Cardinal direction 0 north, 1 east, 2 south, 3 west |
| Pit / teleporter | Required fixed same-map destination; teleporter may set facing |
| Forced chain | At most eight entered cells including final landing; loops rejected |

Blocked edges are symmetric and affect collision, sight, reach and relevant attacks. Pit/liquid damage occurs on entry; waiting and menus do not repeat it. Forced movement adds a movement minute for each subsequent entry, plus authored cell minutes. A bridge is a stable cell and does not inherit a replaced pit's damage. No random roll chooses a landing.

## Changing and recovering routes

Use the simulation command:

```json
{"type":"terrain","configurationId":"shifted"}
```

Inside an ordinary authored routine:

```json
{"op":"command","command":{"type":"terrain","configurationId":"shifted"}}
```

The recovery anchor must contain an always-visible object with an onUse routine. Its routine must have no parameters and exactly one command selecting the initial configuration. This reset is available from the anchor independently of directed transition edges. Keep its return route free of locked doors. Spawn, recovery, named arrivals, portals and fixed authored objects are protected across configurations; encounter spawn positions must remain safe too.

Changes are rejected during combat/defeat, without a conscious hero, for unknown or unchanged configurations, if they embed the party or a living enemy, bury nonempty ground loot, or remove the party's safe return path to the anchor. Return-path search does not assume undiscovered secrets or unlocking sealed doors. It can open ordinary unlocked doors. Failed commands and failed forced paths roll back the whole transaction, including time, damage, flags and RNG. Death and expedition timing use existing rules after successful preflight.

Enemies avoid forced, damaging and slow terrain. Capability movement and teleport-style spells require safe landings and respect relevant boundaries. Intermediate forced cells do not automatically use objects or award rewards. Native traps process once per entered cell; final landing can trigger normal step travel.

## Persistence and compatibility

The optional map-state extension is `terrain:{version:1,configurationId:"shifted"}`. An absent extension means the authored initial configuration. Campaign format remains 18; unknown terrain versions/configuration IDs reject. No save is silently rewritten. Scope and instance restore retain the selected configuration, ordinary door state, and historical exploration even where a later configuration closes a visited floor cell. Explicit catalogue adoption rules still apply. Packs using terrain require engine 0.71.0 or newer.

## Presentation and limits

The common renderer draws procedural terrain markings, height-offset floor/sprite projections and a current-layout/elevation label. The map view shows discovered terrain and boundaries. This is bounded logical elevation, with no stacked rooms, continuous physics or arbitrary runtime geometry scripting. Existing image assets are reused; final example artwork remains a later phase. Native Windows terrain editing UI is not claimed here; author terrain through JSON and the toolkit.

## Build and inspect

Use Node 22.18 or newer and install locked root/engine dependencies. Run from the source root:

```sh
npm run build:mp26:catalogues
npm run check:mp26
npm run test:game
node --test toolkit/tests/*.test.mjs
npm run build:game
npm run run:mp26
npm run render:mp26
npm run verify:game
npm run check:workspace
python3 tools/package-mp26.py
python3 tools/verify-release-mp26.py
```

Strict offline TypeScript check: `node engine/world-of-maxxia/node_modules/typescript/bin/tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json`. Renderer proof needs the pinned root CPU Canvas dependency. Full outputs and nine production-render images are under `validation/MP26`; legacy pixel comparisons are under `validation/MP26-legacy`.

Start the browser server and open:

`index.html?project=projects/WorldOfMaxxia/project.json&catalogue=mp26-proof/terrain-lab.maxxia-build.json`

The same directory also contains `brass-bell.maxxia-build.json`, `lantern-gallery.maxxia-build.json`, and the receiving-catalogue proof. At the anchor, the recovery wheel restores the initial route; the nearby shift control deploys the bridge and changes the maze. The automated 29-command replay uses actual simulation commands and verifies save/reload, unsafe-reset refusal, hazards, height limits and recovery.

Next: MP27 — Illusions, perception and puzzle presentation.
