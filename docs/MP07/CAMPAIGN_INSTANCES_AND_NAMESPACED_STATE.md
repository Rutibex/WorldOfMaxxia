# MP07 — Campaign instances and namespaced state

## Implementation boundary

MP07 is a playable campaign-instance layer above the existing MP06 project library and format-18 simulation. **It does not change format-18 payloads in place.** Instead each new instance is stored in a version-1 envelope with its own immutable launch receipt, bounded typed state, map/quest/combat/party snapshot, elapsed in-game minutes and saved RNG snapshot. The old `world-of-maxxia:campaign:v1:` keys and the existing v18 parser remain intact and available via the title screen's explicit **Legacy MP06 saves** option.

This is **not** MP08 portable character roster, MP09 move/copy transactions, MP10 pack upgrade migrations, or MP11–16 generic adventure script execution. Existing Firstlight quest, services, map and encounter state continue to live in the established simulation snapshot, isolated by instance. A new pack's typed flags/counters/collections are stored in the same instance envelope and have a reusable validation/mutation API for the later script engine. There is no pack-defined runtime script execution yet.

## Player workflow

1. Choose an adventure and enabled packs in MP06's library, then open the game title.
2. **Create new adventure** creates a fresh, independently named instance after party creation. Each new instance has its own auto/manual slots; a new adventure no longer overwrites the previous adventure's autosave.
3. At the title, choose an existing campaign instance from **Campaign instance**, then **Open selected campaign** / **Continue selected campaign** to resume its latest valid slot. Changing instances does not delete or mutate other instances.
4. Original MP06 saves remain a separate **Legacy MP06 saves (unchanged)** choice if they exist. Saving while in legacy mode continues to use the original format-18 slot storage. Export a legacy save and import it to create a new MP07 instance without rewriting the legacy source.
5. **Import portable save** validates a legacy v18 save or a compatible MP07 instance document, then creates a *new* instance after confirmation. Import never replaces the selected instance. **Export** from an MP07 instance includes its typed state and exact pack receipt.

There can be 16 instance entries per project/catalogue storage family. Corrupt or incompatible slots are described without deletion; damaged instance index/storage errors block new writes instead of silently resetting. A browser does not provide power-loss-proof multi-key transactions; a newly created instance's auto-slot is written before its index and rolled back on a failed index commit. Existing index records are never removed as part of this operation.

## Canonical storage and versioning

The existing project/catologue storage adapter (`projectCampaignStorage`) remains the **outer** namespace. MP07 uses keys *inside* that adapter:

- `world-of-maxxia:instance:mp07:index`: array of stable UUID-v4 instance headers, friendly names and timestamps.
- `world-of-maxxia:instance:mp07:<uuid>:auto|slot1|slot2|slot3`: version-1 `maxxia-campaign-instance` document.
- Each overwritten slot receives a `:backup` containing the exact previous bytes before the new save is committed.
- Historical `world-of-maxxia:campaign:v1:<slot>` keys are never touched by `CampaignInstanceStore`.

Every snapshot contains:

```json
{
  "format": "maxxia-campaign-instance",
  "version": 1,
  "id": "00000000-0000-4000-8000-000000000001",
  "name": "Example adventure",
  "createdAt": "2026-11-06T20:00:00.000Z",
  "savedAt": "2026-11-06T20:10:00.000Z",
  "identity": {
    "projectId": "project_world_of_maxxia",
    "adventureId": "firstlight",
    "rules": {"id":"core:rules:classic","version":"1.0.0"},
    "catalogueHash": "(64 lowercase hex characters or null for a non-library legacy launch)",
    "providers": [{"id":"core","version":"1.0.1"}]
  },
  "scoped": {"version":1,"campaign":{"flags":{},"counters":{},"collections":{}},"local":{}},
  "campaign": {"format":"world-of-maxxia-campaign","version":18,"...":"complete original state"}
}
```

**One authoritative clock and RNG:** the nested existing `campaign.elapsedMinutes`, `campaign.rollCount` and `campaign.rng` remain authoritative. They are captured on game-state snapshots and restored with `SeededRng.restore()`; MP07 deliberately does not add a second divergent time/RNG field to the wrapper. The legacy maps, doors, secrets, encounter state, services, inventory and quests are contained within the same snapshot. A typed local scope may coexist with that legacy state without changing current mechanics.

The receipt contains exact project/adventure IDs, the core rules profile, the ordered list of resolved provider ID+version pairs, and a digest. When extra packs are enabled, the digest covers the selected composed catalogue. For core-only selection it is a digest of the bundled **core pack's actual manifest/index/content**, not all unselected proof packs. Changed or missing providers block an instance's load without deleting its data. Explicit upgrade/missing-provider recovery belongs to MP10.

## Typed namespaced state API

`src/shared/rules/scoped-state.ts` exports `newScopedState`, `validateScopedState`, `readScopedValue` and pure `applyScopedAction`. It contains two scopes:

- `campaign`: information persistent across all maps in this one instance;
- `local[mapId]`: mutable information owned by an explicitly validated map in this same instance.

Values are typed and pack-qualified: `my_pack:flag:gate_open` → boolean; `my_pack:counter:pressure` → signed bounded integer; `my_pack:collection:found_clues` → ordered unique list of bounded identifier strings. State operations clone and validate; invalid actions/overflow do not mutate the original. Unknown maps, malformed keys, oversized collections, duplicate entries, non-finite counters and prototype-polluting identifiers are rejected. Definitions and scripts are not serialized in the state object and are never mutated through this API.

These generic state operations are intentionally not wired to Firstlight's bespoke story triggers. MP11–16 will route authored room, entity and quest logic through the common simulation/event boundary, using these typed operations. The current default quest state remains fully preserved in the nested legacy snapshot.

## Limits and remaining work

- One project with different enabled packs uses MP06's distinct outer catalogue namespace; changing packs does not hot-swap an active campaign.
- New instances inside the same selection have unique UUID-v4 identities and independent auto/manual save slots. No transparent merge, transfer or character sharing exists yet.
- 16 indexed instances per project/catalogue family; no in-game deletion operation yet. Export before clearing browser data.
- Individual campaign payloads remain subject to the original 256 KiB save limit; the bounded state/identity wrapper allows at most 40 KiB additional data. Storage quota errors are surfaced, not hidden.
- Browser-localStorage is not cloud storage; backups are per overwritten slot. Repeated `:backup` overwrites preserve the immediate prior revision, not a full version history.
- Browser/Chromium interactive acceptance and Windows native editor testing remain separate gates; Node headless and HTTP checks do not imply UI verification.

## Reproduction

```sh
node tools/build-mp06-catalogue.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/campaign-instances-mp07.test.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
npm run build:game
npm run verify:game
```
