# MP21 — Equipment, Artifacts and Crafting

**World of Maxxia 0.66.0 · Maxxia Maker 0.21.0-mp21 · 7 November 2026**

This phase extends the existing MP20 pack composition and MP18–19 effect engine, rather than inventing a second equipment subsystem. Canonical authored content remains JSON. All records below are in `examples/mp21/brass-bell/`; earlier MP17–MP20 packs stay in place. A complete package is in `Maxxia-Maker-MP21-Source.zip`, and a ready-to-run offline browser is in `World-of-Maxxia-MP21-Browser.zip`.

## New item properties

Standard authored item wrappers remain `maxxia-authored-item` with `formatVersion:1` and `record` of the shared item definition. MP21 adds optional fields:

| Field | Type and interpretation |
|---|---|
| `attunement` | boolean; requires explicit Identify then Attune before equipping/using |
| `equipRequirements` | `{minLevel?:integer,classIds?:string[],raceIds?:string[]}`; must pass all declared constraints |
| `passive` | `{attack?:integer,defense?:integer}`; bounded modifiers when equipped, using derived combat statistics |
| `curseOnEquip` / `curseOnUse` | boolean; sets `ItemInstance.cursed` on the specific physical instance |
| `maxCharges`, `effect`, `power`, `portability`, `slot` | Retained existing contracts; charged artifact use runs through the ordinary item operation |

`ItemInstance` now optionally stores `attuned` and `cursed` booleans. Three attuned instances per character at maximum. A bound/cursed item cannot be transferred, sold or dropped; a cursed equipped item cannot be removed until uncursed. The original temple service removes the per-instance curse as well as legacy curse state for the selected character. Inventory/save/roster migration accepts earlier instances without the new fields.

See `content/item_regulator_aegis.json` (passive +1 Defense, attunement, level-2 Bellwarden/Echo Sentinel, two charges of 4-minute ward), and `content/item_binding_ring.json` (curse-on-equip). Crafted resources are `content/item_brass_filament.json` and `content/item_silt_crystal.json`.

## Recipe and workshop contracts

A recipe has `format:'maxxia-authored-recipe'`, `formatVersion:1`, and qualified ID `bell:recipe:forge_aegis`. The `record` contains `id`, `name`, `description`, `station`, optional `minLevel`, `ingredients` and `results` (each array 1–8 `{itemId,count}` entries; counts 1–20). Valid stations are `field` and `workshop`. No recipes execute while combat is active.

Example:

```json
{
  "format":"maxxia-authored-recipe", "formatVersion":1,
  "id":"bell:recipe:forge_aegis",
  "record":{
    "id":"bell:recipe:forge_aegis", "name":"Forge Regulator Aegis",
    "description":"Bind brass and silt at an authored workshop.",
    "station":"workshop", "minLevel":2,
    "ingredients":[
      {"itemId":"bell:item:brass_filament","count":2},
      {"itemId":"bell:item:silt_crystal","count":1}
    ],
    "results":[{"itemId":"bell:item:regulator_aegis","count":1}]
  }
}
```

Mara the Trader now sells both forging ingredients in the MP21 Bell yard, so the materials can be obtained through normal pack-defined shop actions rather than being injected by a test. The map's optional `record.workshops` is an array (maximum 16) of `{id,x,y}` markers on walkable cells. A workshop recipe requires the party to stand on or directly beside a marker **in its current map**. Example `content/map_yard.json` defines `{"id":"yard_forge","x":4,"y":5}`. There is **no special-case recognition of `map_town` for crafting**. Field recipes may be used elsewhere outside combat.

Crafting is a `craft` simulation command with `request.recipeId` and optional `request.crafterId`. Ingredients must be in that living character's inventory, unequipped, unattuned and uncursed. A clone is modified only after validating recipe, station, level, and ingredients; all outputs must fit category and total inventory limits and unique-item policy. On failure no ingredients, XP, gold, RNG or campaign state are consumed. A successful craft creates ordinary item instances with stable IDs; repeated attempts do not bypass unique restrictions. Shared/plot item identities retain their separate portability rules.

## Catalogue and character portability

`recipe` is a new pack definition kind in the common/index contracts and the composed catalogue; every ingredient/output reference must resolve before a campaign starts. The exported Bell recipe and item definitions are present in both `mp21-proof/brass-bell.maxxia-build.json` and `mp21-proof/receiving.maxxia-build.json`. Roster exports preserve item charges, identification, attunement and curse flags. `campaign-bound` items remain in the original campaign's roster snapshot but are **omitted from character file exports**; imports reject them if manually forged into a portable file. Dependency/version checks apply to both receiving packs.

## Build and verification

```bash
node tools/build-mp21-catalogues.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/equipment-mp21.test.mjs
node --experimental-strip-types --test --test-concurrency=2 engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
node tools/generate-contracts.mjs --check
npm run build:game
node --experimental-strip-types tools/run-mp21-scenarios.mjs --production
npm run verify:game
node tools/verify-workspace.mjs
```

For the separate AJV-dependent authoring CLI, install the pinned npm dependencies using `npm ci` in an online environment before running `node tools/maxxia.mjs validate examples/mp21/brass-bell` or the toolkit-wide suite. This environment did not have those dependencies, so CLI pass is **not claimed**. The native Windows editor and interactive graphical browser were likewise not tested. Gameplay save format remains 18.

## Known scope boundaries

MP21 does not replace the existing historic town merchant/repair logic or make crafting a separate economic game. Scripted artifacts use the existing bounded effect engine and ordinary item activation; there is no arbitrary pack JavaScript execution. Monster decision making and companion rules remain MP22. The example pack uses temporary art as provided in the roadmap (final unique art is MP39–41).
