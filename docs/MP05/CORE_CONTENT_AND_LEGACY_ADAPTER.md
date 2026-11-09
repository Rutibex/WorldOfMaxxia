# MP05 — Classic rules ownership and the Firstlight legacy adapter

**Implemented:** World of Maxxia MP05. **Engine interface:** 0.50.0 (MP04 catalogue-compatible). **Save format:** 18 (unchanged). **Next:** MP06 pack library and adventure selection.

## Design decision

MP01's v1 pack contract requires namespaced identifiers (`core:class:...`, `core:item:...`), while the shipped Firstlight campaign and format-18 saves use stable legacy identifiers (`myrmidon`, `item_dagger`, `bell_heart`, etc.). Reassigning these would break historical saves, spell lists, NPC equipment and quest/loot references. Do not introduce a silent ID renaming migration during MP05.

The **versioned classic rules profile**, `core:rules:classic` 1.0.0, is therefore delivered as an engine-shipped, core-owned runtime dataset with the existing stable IDs. The associated authoring core (`toolkit/core/`) carries a byte-identical runtime source mirror in `toolkit/core/runtime/database/`, and continues to participate in the frozen v1 dependency scheme. The authoring metadata provider is version **1.0.1** (incremented to prevent a same-version/fork collision with MP04's original `core@1.0.0` archive), while the rules profile itself remains `core:rules:classic` **1.0.0**. Its **normal content index remains the v1 authoring metadata/routine provider**, rather than duplicating shared rules under new qualified IDs. The current v1 pack compiler does not yet emit the core runtime dataset as authored normal `class`/`item`/`monster` records; that separation is explicit, not a false claim of universal pack support.

These shared files are now the authoritative baseline for the original campaign and MP04 catalogue proof. The original project database files remain as read-only provenance references, *not* as files loaded by the current Firstlight manifests. Generic generated projects and old unrelated manifests retain their prior behaviour until MP06/MP32 conversion.

## Ownership split

| Owned by shipped classic core | Owned by Firstlight compatibility adapter |
|---|---|
| 6 playable classes (`myrmidon`, `artificer`, `mutant`, `wizard`, `priest`, `witch`) | The original six actor seeds, portraits, starting party |
| 40 general items | 8 named story/special items |
| 2 general monsters (`dust_imp`, `stone_mite`) | 7 campaign monsters, including `bell_heart` |
| 36 spells and existing class spell access | 10 encounter groups/placements and quest-specific loot tables |
| 6 conditions | 4 ground pickups and map-specific quest state |
| Complete progression database | Original three map documents and named scenes |
| Existing rules code and action engine | Original town/cistern/vault environment/presentation and NPC services |

**Authoritative runtime files:** `engine/world-of-maxxia/public/core/classic/database/`.

**Legacy overlay:** `engine/world-of-maxxia/public/projects/WorldOfMaxxia/legacy/database/` and `.../legacy/adapter.json`.

**Core authoring mirror:** `toolkit/core/runtime/database/` and `toolkit/core/runtime/provenance.json`.

Original historical database files are retained at `public/projects/WorldOfMaxxia/database/`; actual rules ownership is controlled by the selected project manifests `WorldOfMaxxia.maxxia` and `CatalogueProof.maxxia`.

## Boot order and safeguards

1. Resolve the project manifest, map index, resources and environment profiles.
2. Load 40 core items, core progression, six classes, spells/conditions and two general monsters through the normal validated content database readers.
3. If and only if project identity is Firstlight (`project_world_of_maxxia`) or the MP04 catalogue proof, load `legacy/adapter.json` and the core provenance ledger. Refuse a project manifest pointing to another rules database. Verify each of six core database SHA-256 hashes, and each of the two legacy overlay database hashes before installation. Parse and validate the full candidate graph.
4. Stage 48 item and nine monster definitions, reject ID collisions, expected-set mismatches and dangling guaranteed-loot references. Only then synchronously install the two completed live registries. A failed stage leaves the two tables at their prior valid state; a failed initial boot does not start the game.
5. Stage the MP04 compiled optional catalogue, then encounter groups, loot and actor seeds. The catalogue's current save hash separation, compositional validation and resource alias rules remain unchanged.
6. Create a new campaign or load a save through the existing format-18 path. Firstlight project save keys and IDs have not changed.

The adapter's explicit two project identities are a compatibility boundary, not a general branch mechanism for arbitrary future adventures. Other modules must not emulate the legacy adapter to replace core definitions. Migration register below records how these remnants are removed when generic scripts and scene profiles land.

## Safe upgrades and save policy

- Save format **remains 18**. No rewrite or automatic migration is performed on load. Browser origin and storage keys remain stable for ordinary Firstlight saves; MP04 catalogue proof uses its existing namespaced/hashed slots.
- All original 48 item IDs, nine monster IDs, six class IDs, spell IDs, actor IDs, map IDs and encounter IDs remain unchanged.
- Do not delete the old Firstlight databases or art; they are parity fixtures and migration evidence. Original asset bytes are audited against MP00.
- Failed core/provenance verification is a hard error, not a silent fallback to bundled legacy content. Missing provider states in future portable-character saves are MP08–10 work, not silently implemented here.
- Checkpoints remain immutable during a running session. No hot-swapping or new character portability is claimed in MP05.

## Migration register — remaining compatibility points

| Current Firstlight behaviour | Replacement phase |
|---|---|
| Project selection from a fixed `.maxxia` entry | MP06 pack library and independent adventure choice |
| Shared campaign/session mutable state | MP07 |
| Ordinary characters bound to one campaign | MP08–10 |
| Scripted town/cistern/vault interaction, NPC services and quests | MP11–16, then MP32 removal |
| Fixed classes/traits/condition and spell interpretations | MP18–23 |
| Original map and scene identity-specific presentation | MP24–29, then MP32 removal |
| Authoring core runtime mirror versus immutable v1 metadata pack representation | Revisit during MP06 bootstrap and MP33 authoring kit; do not change frozen MP01 v1 contracts silently |
| Native WinForms editor build/visual checks | Separate noncritical native acceptance, not proven by browser tests |

## How to verify

```sh
node tools/check-mp05.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/core-legacy-mp05.test.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
npm run build:game
npm run audit:mp05
npm run verify:game
```

Run `npm run check:mp04` and `npm run check:mp01` in a supported environment with locked AJV/TypeScript dependencies installed; inherited results must not be represented as new passes when those packages are absent. The offline build uses the supplied Phaser vendor. Run browser smoke tests on a supported Chromium host; headless tests and HTTP file checks do not substitute for visuals.

Original game: `http://localhost:3000/`

MP04 two-pack proof on the MP05 rules split: `http://localhost:3000/?project=CatalogueProof.maxxia&catalogue=mp04-proof/catalogue.maxxia-build.json`

**MP05 exit:** The original Firstlight rules databases no longer serve as the boot source of shared classes/items/progression/spells/monsters. Full historical item/monster sets recompose through an explicit bounded adapter. Same IDs/data, old saves and MP04 proof pass headless regression. Generic standalone adventure execution remains MP06 onward.
