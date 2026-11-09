# MP13 — Generic objects, doors and interaction menus

Runtime **0.58.0**; cumulative MP12 source. Gameplay saves remain v18, campaign-instance envelope v2, scoped-state v1, roster/receipt v1. No destructive save conversion is introduced.

## Play the workshop

Start the browser distribution with `Start-World-of-Maxxia.cmd` on Windows, or `sh start-world-of-maxxia.sh` on Linux/macOS. Node 22.18+ is required; this release was checked with Node 24.22.1. The distribution needs no npm install and no external service.

Open the server’s printed address with `/workshop.html` appended, for example `http://localhost:3000/workshop.html`. This selects the included compiled pack through `?catalogue=mp13-proof/workshop.maxxia-build.json`. Choose the recommended party and enter the adventure. The page uses the pack title and pack entry point; its saves have their own resolved catalogue identity.

1. The locked workshop door is directly ahead. Press **Space/Interact** to open its action menu. Inspecting and opening menus do not spend time or roll dice.
2. Turn around. Face the nearby key box, press Interact, choose **Open**, then **Take contents**. Leave the menu. A real Workshop Key item is placed in the selected conscious hero’s inventory.
3. Turn back to the door. Use **Unlock with key**; the key is retained by this definition. Alternatively use **Pick lock** or **Force open**. Failed checks spend a minute and one food, retain their RNG result, and allow another attempt. Force also causes one HP injury and records local noise. Successful routes open the same doorway.
4. Walk through the door to the chest. Open it and take its contents once. The chest becomes an empty marker. Its claim flag survives re-entry and reload.
5. The gateway at the far side leads to the annex; its gateway returns to the workshop. These are existing map-transfer operations, not character-transfer receipts.
6. Back in the entrance room, use the lever near the key box. Its routine lights the maintenance signal, and its sprite changes position. It remains reusable.
7. Use **Search** while facing the concealed stash or the maintenance wall. A seeded WIS check can reveal the stash or a genuine secret passage. A hidden entity’s identity/description and sprite stay concealed until discovery.

The maps contain small generic scenery primitives for functional review, not final campaign art. Art production for the two finished example adventures remains later in the roadmap. Actual browser clicking and visual acceptance could not be completed on this host; the exact command sequence and campaign-instance reload were executed headlessly against both source and built production modules.

## Commands and verification

From the cumulative source root:

```sh
npm run test:game
npm run check:mp13
npm ci
node --test toolkit/tests/*.test.mjs
node tools/maxxia.mjs validate examples/mp13/workshop-pack --engine 0.58.0 --json
node tools/maxxia.mjs inspect examples/mp13/workshop-pack --engine 0.58.0 --json
node tools/maxxia.mjs build examples/mp13/workshop-pack --engine 0.58.0 --out examples/mp13/workshop.maxxia-build.json --json
npm run build:game
node --experimental-strip-types tools/run-mp13-scenario.mjs --production
npm run verify:game
npm run check:workspace
```

The offline build uses the shipped Phaser vendor modules and Node’s TypeScript transform when a TypeScript installation is unavailable. Strict checking requires TypeScript 5.9.3 (the engine’s declared development dependency). Install engine dependencies with `npm run setup:game` on a supported machine. The combined legacy `npm run check` also invokes native .NET checks; a passing browser/headless suite does not imply those native checks passed.

`tools/run-mp13-scenario.mjs` executes 39 normal gameplay commands: menu, key-box grant, key route, treasure claim, real map exit/re-entry, rejected second claim, reusable lever, and actual campaign-instance save/reload. `--production` compares full campaign/scoped state and event/message traces with the built JavaScript. It contains no direct party-position edits.

## Native map v2 pack payload

A new payload is:

```json
{
  "format": "maxxia-authored-map",
  "formatVersion": 2,
  "id": "my_pack:map:room",
  "record": {
    "id": "map_my_pack_room",
    "name": "Example room",
    "rows": ["#######", "#.....#", "#.....#", "#.....#", "#######"],
    "spawn": {"x": 3, "y": 2, "facing": 0},
    "doors": [],
    "props": [],
    "arrivals": [{"id": "arrival_start", "name": "Arrival", "x": 3, "y": 2, "facing": 0}],
    "entities": []
  }
}
```

The native runtime ID is exactly `map_` plus the pack-qualified ID with `:map:` replaced by `_`. Native grid budgets, sealed borders, door tiles and map/portal validation still apply. Register the payload as kind `map` in the content index and select its namespaced ID/arrival in the pack manifest’s entry. The runtime merges eligible native maps into the project registry without overrides and starts a new campaign at the root adventure’s named entry. Maps local to other packs are not implicitly installed; exported map dependencies must declare their references. Existing v1 map fixtures remain accepted as metadata and are not silently reinterpreted as native maps.

The JSON Schema is `toolkit/schemas/map-v2.schema.json`; geometry, entity links, routine signatures and composed references have additional shared semantic validation. The toolkit reports native v2 entry packs as playable. The included native pack declares minimum engine 0.58.0. Explicitly pass `--engine 0.58.0`; historical toolkit fixtures keep their older defaults for compatibility. Existing 0.50.0 direct-overlay fixtures remain loadable; other direct builds must match the current engine. The older library import contracts now recognize compiled versions through 0.58.0 while preserving the old selection hash path for older compatible enabled packs. Use the direct workshop launch above for this phase’s example rather than relying on the historical fixed adventure dropdown.

## Placed entity contract

Native maps accept an optional `entities` array (maximum 64). MM16 map-document import/adaptation preserves it under `objects.entities`. An entity’s stable ID is `pack:object:name`, with its mutable flags stored in the map’s local scope. Renaming an ID is a save/content migration, not a cosmetic edit.

| Field | Meaning |
| --- | --- |
| `id`, `name`, `description`, `x`, `y`, `kind` | Required identity, player-facing text, placement and kind |
| `kind` | `object`, `door`, `container`, or `secret` |
| `doorId` | Door entities link one existing grid door at the same cell; quest-sealed legacy doors cannot be managed this way |
| `secretId` | Secret entities link one existing secret wall at the same cell |
| `hidden`, `searchDC` | Optional discovery state/DC; secret walls start concealed through their grid state |
| `lock` | Optional `keyItemId`, `consumeKey`, `pickDC`, `forceDC`; unspecified routes are absent from the menu |
| `rewards` | Container-only list of one to eight `{itemId,count}` grants; all-or-nothing capacity/definition validation |
| `onUse` | Object-only `{routineId,args}`; executes an installed MP12 routine with exact scalar parameters |
| `appearance` | Optional selectors for `idle`, `used`, `closed`, `open`, `claimed` |

Appearance selectors are `mirror`, `brazier`, `crystal`, `banner`, `chest_closed`, `chest_open`, `lever_off`, `lever_on`, or `marker`. The generic renderer projects these through its existing depth buffer. Door appearance/collision uses its existing grid open state; secrets use the existing revealed-wall collision. Exported sprites/custom animation remain MP25.

Declare entity use-routine and pack-qualified key/reward IDs in the map descriptor’s references. Cross-pack references need their direct dependency and exported target. Declare native portal destination map references too. Optional absent routine/item/destination providers are rejected for these required entity links; author an available selection instead of leaving a dangling interaction. Legacy unqualified item IDs remain usable through the installed baseline; unknown items fail atomically when granted.

## Interaction semantics

The shared API is `interactionMenu(campaign, scoped, maps, optionalEntityId)` and the shared command is `{type:"object",entityId,action}`. `Grid/Interact` opens a typed interaction-menu event when discovered entities are within reach. Multiple entities appear together. Native text is rendered with textContent. Menus are recomputed after every action; the dispatcher rechecks reach, visibility, combat, key possession, capacity and object state. Disabled choices give a reason; sending a stale command cannot bypass its requirements.

Reach is the party’s cell or the facing adjacent cell. Ordinary objects cannot be reached through opaque terrain; door/secret entities must link the barrier in that adjacent cell. Combat or defeat blocks object actions. Read-only inspect and searches of already discovered objects succeed without mutations. Movement shortcuts are suspended while the native interaction dialog is open; Escape/Leave closes it.

| Action | Rules |
| --- | --- |
| Inspect | Descriptive text; no time, RNG or reward |
| Search | For a concealed target: d20 + best conscious, awake WIS modifier vs DC; ten minutes and one food per attempt |
| Open | Opens an unlocked door or container; one minute |
| Unlock with key | Party must carry the declared key; optional consumption requires an unequipped instance; unlocks and opens in one minute |
| Pick | d20 + best conscious, awake DEX modifier; one minute and one food; failure persists and can be retried |
| Force | d20 + best conscious, awake STR modifier; one minute and one food; each attempt injures the first living active member by one HP and increments entity-local noise |
| Close | Door only; party cannot occupy the doorway; the unlocked state persists |
| Take contents | Open, unclaimed container only; grants to the selected conscious member and marks claimed in one atomic transaction; one minute |
| Use | Runs the authored routine, marks used and spends one minute; reusable unless the routine’s own state branches change its outcome |

The standard Pick/Bash buttons route to reachable managed doors/containers. Standard Search attempts the first concealed reachable entity in stable ID order, one target per command. Repeat Search to retry or inspect further targets; when none remain, the legacy search path still handles older content. Successful discovery changes appearance and, for a secret wall, actual collision. Existing spells retain their existing lock-opening rules; no new spell/capability engine is introduced here.

Entity flags use the existing local scoped state: `<pack>:flag:<name>_found`, `_used`, `_opened`, `_unlocked`, `_claimed`; force noise is `<pack>:counter:<name>_noise`. Doors/secrets retain their authoritative grid topology. Multiple instances of the same adventure get independent values. Campaign and scoped state commit together; a failed hook, grant, event trigger or execution budget rolls both back, including time and RNG.

Routines attached to objects share MP12’s nested evaluation/command/event limits. Routine adapters cannot invoke object commands, preventing an object→routine→object cycle from starting a fresh transaction/budget. Use reusable routine calls inside a single object hook instead.

## Scope and remaining acceptance

This phase provides generic placed entities, action menus, lock routes, hidden discovery, containers and routine hooks. It does not replace Firstlight’s complete legacy quest/service handlers. Dialogue/relationships/services remain MP14; full quests and journal workflows MP15; timed encounters MP16; mechanics/capability expansion and final art retain later milestones.

See `MP13-Validation-Results.md`. Actual interactive browser/visual review remains unverified: the cloud browser could not reach the local server. Headless gameplay, pack CLI, strict typing, production-module equality, save/reload, offline build and HTTP checks were executed. Native Windows/.NET verification is a separate acceptance gate.

Next: **MP14 — Dialogue, NPC relationships and services**.
