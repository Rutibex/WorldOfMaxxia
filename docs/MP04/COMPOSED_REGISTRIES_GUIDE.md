# MP04 — Composed registries and cross-pack references

**Engine 0.50.0; toolkit 0.4.0-mp04; save format 18.** Resolved pack content can now enter the actual gameplay class, item and monster tables together. The original project remains a legacy base adapter; extracting it into a real core pack is MP05.

## Run the runtime proof

Extract the Browser ZIP, run `node server.mjs`, then open:

```
http://localhost:3000/?project=CatalogueProof.maxxia&catalogue=mp04-proof/catalogue.maxxia-build.json
```

The ordinary http://localhost:3000/ still opens the original campaign with its ordinary save slots. The proof uses the original town/dungeon maps and original production art. It adds two authored encounter placements in the town and offers both new Warden classes during custom-party creation. Class options display their pack namespace so identical display names can be distinguished.

Choose one Brass Warden and one Glass Warden in the six-person custom party. Brass starts with its own shield. Glass starts with its own blade and Brass's shield. The two nearby Guardian encounters use independently namespaced monsters, and their corpse rewards can contain the exported Brass shield. These are real inventory/combat rules, not metadata-only demonstrations.

The proof is a catalogue integration test on existing maps. It does not execute the pack's authored map/routine as a new standalone campaign. Generic pack adventure execution and the two finished example adventures remain later phases. Actual interactive browser acceptance is blocked on the validation host; see the report and shipped browser smoke script.

## What composes

| Payload kind | Authored format | Runtime use |
|---|---|---|
| class | `maxxia-authored-class` v1 | Existing class mechanics plus explicit starting equipment |
| item | `maxxia-authored-item` v1 | Existing inventory, equipment, charges/durability and effects |
| monster | `maxxia-authored-monster` v1 | Existing combat/AI, saving attributes, resistances and optional guaranteed item drop |
| resource | `maxxia-resource-alias` v1 | Namespaced image aliases, including cross-pack alias chains |
| map | MP02 authored map v1 | Graph/geometry/reference validation; generic execution still later |
| routine | MP02 authored routine v1 | Graph/action validation; generic execution still later |

Other selected kinds still fail explicitly. This phase does not create new class resource systems, arbitrary condition mechanics or new monster atlas formats. It makes independently authored records coexist using the current engine's supported mechanics. Spells, races and broader ability mechanics arrive in their planned phases.

Class/item/monster payloads wrap a single actual runtime record:

```json
{
  "format": "maxxia-authored-class",
  "formatVersion": 1,
  "id": "glass:class:warden",
  "record": {
    "id": "glass:class:warden",
    "name": "Warden"
  }
}
```

The snippet shows identity structure only; use the complete records in `examples/mp04` or the generated field reference for all required fields. Unknown fields and unsupported semantics fail. Runtime parsers accept legacy IDs and correctly typed namespaced IDs; one pack cannot define another pack's namespace.

## Typed references with real behaviour

- `record.starterEquipment` on a class maps melee/ranged/body/offhand to item IDs or null. The referenced item must exist, fit the slot and be permitted by the class's equipment tags. Normal character creation then mints/uses that starting equipment.
- `record.iconResourceId` on an authored item names a resource definition. It must bind to an image and resolves through the actual project's resource resolver.
- `record.guaranteedLootItemId` on a monster names an item. Normal corpse generation adds that item once, retaining the existing unique-item and already-created-corpse protections.
- `sourceResourceId` on a resource alias names another resource or an explicitly supported legacy `asset_...` image key. Legacy bindings are the temporary bridge to existing artwork; they are not an implicit cross-pack override mechanism.

Every namespaced payload reference must appear in that definition's descriptor reference list. The runtime compares actual references to declarations and enforces the same direct dependency/export/optional-guard rules. Extra declarations cannot hide a missing typed reference.

## Visibility, identity and export closure

Definitions retain permanent `pack:kind:name` IDs. Duplicate IDs, wrong owner/kind, missing providers, incompatible versions, private cross-pack targets, resource cycles and implicit overrides fail before installation. Identical display names are allowed and do not merge records.

The composed graph retains all selected definitions for validation and owner-aware lookup. Its `lookup(id, requester)` rejects foreign private definitions. The installed class/item/monster view contains exported definitions from every selected pack plus local definitions belonging to the active root. Private definitions from other roots do not appear in global creation choices.

For currently supported runtime records, an exported class/item/monster/resource must reference exported definitions, including references within its own pack. This additional executable-admission rule (`E_EXPORT_CLOSURE`) avoids exporting a character class whose required starting item disappears in another root's visible registry. Local map/routine references remain local as before. Visibility governs authoring and runtime lookup semantics; it is not confidentiality for files downloaded to a player's computer.

There is no last-loaded-wins policy. A pack definition colliding with a baseline record fails with `E_OVERRIDE`. A resource alias cannot replace an already present resolver ID. Explicit override support remains intentionally absent from the v1 contract.

## Optional integrations

Required and optional providers are resolved by MP03. When a provider is present, the runtime checks its target, kind, export status and actual value semantics. When an appropriately guarded provider is absent, inactive runtime fields are removed safely: starting gear becomes null, guaranteed loot is omitted and inactive icon/alias chains fall back to the existing generic item image. Undeclared or unguarded optional references fail instead of leaving a dangling ID in a live table.

An unavailable optional alias is not permission to ignore an unknown legacy asset or wrong resource kind. Missing nonoptional sources and resource cycles fail. No new art was generated in this phase; all proof aliases point to existing production images.

## Runtime boot and transaction boundary

The project boot sequence loads the current legacy item/class/monster databases, stages the optional compiled catalogue, commits composed tables, then loads encounter placements, loot and actors. Encounters can therefore refer to either pack's monster IDs, and actors/creation can use either pack's classes and items.

`?catalogue=<safe-site-relative-path>.maxxia-build.json` is an opt-in boot selection, not a beginner editing screen or a full pack-library UI. It accepts a compiled MP03/MP04 resolution build targeted exactly at engine 0.50.0. Requests use bounded HTTP reads (8 MiB maximum, 10-second fetch timeout), reject unsafe selections/redirects, and verify the compiled content digest, resolution digest, selected manifests/pins, document set and derived dependency order.

The browser revalidates the complete supported descriptor/payload graph independently of the authoring CLI. It does not assume that a file with a valid-looking hash has valid gameplay data. Checksums establish integrity/identity, not author trust. Compiled builds carry original ZIP provenance, but cannot independently attest those ZIP bytes without the original archives; exact archive verification remains the resolver/import boundary.

`RuntimeCatalogueSession` captures an immutable-copy base for reuse. Keep the same session when changing catalogues: successful stages compose against that original base, so stale add-ons are not retained. A failure leaves all three active tables and the session summary untouched. Concurrent stale stages cannot commit over newer requests. Read-only graph payloads and arrays are frozen; session summaries are defensive copies.

All item/class/monster readers finish before a synchronous three-table mutation interval. The commit has no asynchronous yield or external callbacks. This is an in-memory JavaScript transaction boundary, not a crash-durable disk transaction or hot campaign migration. Arbitrary record mutation, switching catalogues mid-combat and importing old dependency-bound characters are outside this phase.

## Persistence and compatibility

Save format remains 18. Headless acceptance covers namespaced class/equipment/inventory and both new monsters through the real serializer/parser. The original URL and its existing storage prefixes are unchanged.

A catalogue-selected boot adds project ID and full catalogue hash to its save namespace. Different pack selections/versions cannot accidentally reuse the same slots, and a failed load never overwrites a prior save. Changing versions currently gives a separate namespace rather than silently migrating a campaign. Explicit version/character migration remains MP07–10.

Old compiled MP03 examples target 0.49.0 and are historical artifacts. Rebuild source with the current toolkit (default target 0.50.0) for the new runtime overlay. The seven frozen MP01 metadata schemas and their fixtures remain unchanged; the generated legacy project engine-version constants now reflect 0.50.0.

## Authoring and proof commands

```
npm ci
npm --prefix engine/world-of-maxxia ci
node tools/maxxia.mjs validate examples/mp04/glass --candidate examples/mp04/brass --json
node tools/maxxia.mjs inspect examples/mp04/glass --candidate examples/mp04/brass --json
node tools/maxxia.mjs build examples/mp04/glass --candidate examples/mp04/brass --out examples/mp04/catalogue.maxxia-build.json --json
npm run check:mp04
npm run check:mp01
npm run check:game
npm run audit:mp04
```

The published proof build is also copied into `engine/world-of-maxxia/public/mp04-proof/` for actual browser boot. The browser project manifest and encounter files are there too. The cumulative source includes all proof source records, the build, exact lock and root ZIP.

`docs/MP04/GENERATED_REFERENCE.md` is generated from the frozen metadata schemas, six payload schemas and diagnostic vocabulary. Authored types in `toolkit/types.d.ts` are generated as well. Runtime validators additionally enforce existing bounded stats, slots, AI coverage and cross-reference semantics.

## Evidence and limits

The runtime suite has 502 tests, including 35 MP04 composition/boot/save/loot/privacy/rollback cases. The 117 tooling/resolver tests and frozen MP01 suite also pass. Asset provenance is audited against every original engine input; source changes are explicit, not silently treated as byte-identical to MP00.

The new browser smoke script exercises the real overlay, both class selections, gear, monster placements and save/resume, but Chromium cannot start on this host because its process socket operation is denied. No screenshot or interactive pass is claimed. Native .NET/Windows acceptance remains open; no updated editor executable is shipped.

Next: **MP05 — Core content extraction and legacy adapter**. Preserve the original art and save behaviour while replacing the remaining implicit base content with an explicit shared core pack.
