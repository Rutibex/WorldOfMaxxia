# MP27 checkpoint

Illusions, perception and reusable sequence/alignment/combination puzzle controls are implemented. Engine 0.72.0; campaign format 18. See docs/MP27/AUTHORING.md and MP27-Validation-Results.md. Interactive/native acceptance remains open. Next: MP28 — Regional travel and encounter sites.

# MP26 checkpoint

Elevation, entry hazards and finite mutable routes are implemented. See docs/MP26/AUTHORING.md and MP26-Validation-Results.md. Engine 0.71.0; save format 18. Next: MP27. Interactive browser/native gates remain open.

# MP25 scenery conversion checkpoint

New packs author sprites in common environment profiles and semantic placements in native maps. Enemy art follows live encounter coordinates; hotspots reuse the renderer projection and normal simulation authorization. The original campaign retains its explicit legacy scenery adapter and DOM/boss VFX pending MP32. Save format remains 18, with visuals regenerated from campaign/scoped state.

# Current checkpoint: MP24

Scene selection now follows map environment IDs; original spatial material rules and door appearances are authored in the environment database. Original scene images are unchanged. Pack maps use qualified environment definitions with declared resource references. Legacy quest-linked props, caches and stair decorations remain an explicit project-only `legacyScenery` adapter for MP25/MP32. Gameplay save format remains 18.

The sections below retain historical conversion notes.

# Phase 34 → Maxxia Maker conversion register

MM01 table retained as extraction inventory. MM02 adds a schema/reader/manifest-selected compatibility boot; content tables, maps, art and save rules remain unconverted. See PROJECT_MANIFEST.md for the implemented boundary. Dependencies refer to master-plan phases. This is the extraction checklist, not an assertion of editable content.

| Domain | Current authoritative locations | Assumptions/work to extract | Target phase(s) |
| --- | --- | --- | --- |
| Project startup | client/main.ts; shared/content/manifest.ts; public/content/foundation.json | Named maps/assets, exact class count/version/room | MM02, MM04 |
| Resources | public/assets/; client/*-art.ts; art-production.ts; npc-scenes.ts | Named paths, portrait indices, animation metadata | MM05, MM08, MM22–23 |
| Items | shared/content/items.ts; rules/inventory.ts; rules/ground.ts | Definition table vs instance state, categories/charges/durability | MM06, MM15 |
| Classes | shared/content/party.ts; rules/party.ts; creation.ts | Class ID union, equipment ID/class checks, growth | MM07–09 |
| Actors/party | shared/content/party.ts; rules/creation.ts; client/creation-screen.ts | Starter records, portrait 0–11, party-size constraints | MM08 |
| Progression | rules/party.ts; rules/services.ts; rules/noncaster.ts | Max level 5, XP curve, prepared bonus class checks | MM09 |
| Spells | rules/magic.ts; combat.ts; client/spellbook-* | Definitions, spell-ID conditionals, learning | MM10–12 |
| Conditions/effects | rules/party.ts; magic.ts; combat.ts | Supported condition/effect enums, duration/scaling | MM11–12 |
| Monsters | rules/combat.ts ENEMY_KINDS | Statistics, actions, resistance, rewards | MM13 |
| Encounters | rules/combat.ts ENCOUNTER_SEEDS; campaign.ts | Definition/placement/instance separation | MM14 |
| Loot/ground | rules/ground.ts PLOT_GROUND and inspect*Scene paths | Plot grants, exact item identities, corpse persistence | MM15 |
| Map geometry | rules/grid.ts; public/content/{town,galleries,vault}.json | # . D rows, 64×64, sealed perimeter | MM16–17 |
| Registry/transfers | rules/campaign.ts | 2–20 map count, portals, start map | MM04, MM18 |
| Environments | client/perspective-renderer.ts; town/upper/vault-environment.ts and *-art.ts | Map-ID dispatch, authored placements, specialized layers | MM19–21 |
| Audio | client/audio.ts; audio-plan.ts; midi.ts; public/assets/audio/manifest.json | Named map/boss music selection and cues | MM23 |
| Events | rules/expedition.ts; grid.ts; quests.ts; services.ts | Reach/order semantics; best thief; hardcoded interaction routes | MM24–31 |
| Quests | rules/quests.ts; campaign.ts | Named stages/flags, valve sequence, endings, validators | MM27, MM32–34 |
| Shops/services | rules/services.ts TOWN_SERVICES; client/town-service-screen.ts | Named NPCs, offerings and prices | MM29, MM32 |
| Saves | rules/campaign.ts; saves/campaign-store.ts; per-domain migrate/validate functions | Format 18, fixed prefix, exact registry, specific gate/boss invariants | MM35–36 |
| Presentation/system | client/presentation.ts; dashboard.ts; ui-art.ts; index.html; style.css | Title/terms/theme bindings | MM39 |
| Packaging/exports | server.mjs; scripts/build-offline.mjs; package.mjs; package-zips.py | Fixed Phase 34 names; HTTP origin required; vendor dependency | MM40–44 |

Preserve existing interfaces through adapters until all callers migrate. Never delete a hardcoded path until a representative parity scenario exercises its replacement. Adding a new name/ID must work without registering that name/ID in runtime source.

## Save migration inventory

Campaign format is world-of-maxxia-campaign; current campaign version 18. campaign.ts owns the top-level chain and delegates validation/migration to domain modules (party/combat/magic/inventory/expedition/services/quests/thievery/ground). campaign-store.ts handles slot envelope/import/export and corruption backups. No branch in this chain is removed or rewritten in MM01. Inspect the concrete current code before later migration work; build representative fixtures first.

## MM02 original task scope (now implemented)

Read manifest.ts, main.ts startup, package versions and master-plan sections 4.2/4.5. Define a general manifest without moving the three maps yet. Add cross-language good/bad fixtures and clear unsupported-version errors. Retain legacy default boot until MM04. Do not turn MM02 into all-content extraction.


## Preserved top-level migration chain

Source: engine/world-of-maxxia/src/shared/rules/campaign.ts, upgradeCampaign. Shape checks can reject malformed candidates; the table describes valid historical inputs, not a promise to accept arbitrary documents.

| From → to | Existing transformation |
| --- | --- |
| 1 → 2 | Add initial combat state if absent |
| 2 → 3 | Add default prepared combat setup to valid old characters |
| 3 → 4 | Initialize magic from party roster |
| 4 → 5 | Version-only advancement |
| 5 → 6 | Add per-character item curse records when absent |
| 6 → 7 | Version-only advancement |
| 7 → 8 | Initialize item-instance inventory; reject nonempty reserved old entries |
| 8 → 9 | Initialize registry secrets, expedition and services |
| 9 → 10 | Initialize services |
| 10 → 11 | Upgrade authored town geometry/position/exploration and quest ledger |
| 11 → 12 | Upgrade upper-cistern geometry/state and merge initial encounters |
| 12 → 13 | Add vault map/encounters and valve/ending quest fields |
| 13 → 14 | Version-only advancement |
| 14 → 15 | Add inventory backpack sort map |
| 15 → 16 | Reassign backpack slots and preserve configured ordering |
| 16 → 17 | Initialize thievery state |
| 17 → 18 | Migrate ground/legacy drops and materialize unclaimed encounter rewards |

Slot storage preserves corrupt originals, keeps backups before overwrite, and accepts campaign text or supported slot envelopes. New Maker project identities and migration requirements remain future work in MM35–36.


## MM03 next tasks

Implement C# document workspace, dirty tracking, safe save/backup/conflict detection, undo/redo commands and project open/close behavior on top of ProjectModel. Keep manifest reading separate from gameplay. Preserve unknown fields during edits. Do not begin dynamic map discovery before MM04.
