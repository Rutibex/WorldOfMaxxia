# MP00 capability inventory

Inspected against the supplied MM19 source; no live-LLM feature exists or is needed for play.

| Area | Present | Limitation / next direction |
|---|---|---|
| Boot | Selected `.maxxia` project, manifest validation, independent project slots | One active database set, not composed packs |
| Content | External items/classes/actors/progression/spells/conditions/monsters/encounters/loot | Several behaviours are closed engine enums; records alone do not create arbitrary mechanics |
| Maps | Grid geometry, objects, named arrivals and transfers | No campaign-independent generic trigger layer yet |
| Environments | MM19 profiles, textures and tile materials | Original three illustrated maps retain bespoke renderers |
| Simulation | Seeded rules, combat, exploration, inventory and services | Campaign-specific state and scene hooks remain |
| Persistence | Version-18 campaign snapshots and slot export/import | Characters are not independent portable roster entities |
| Quests/NPCs | Original campaign quest and service systems | No general authored quest/dialogue graph contract yet |
| Tooling | Generated contracts, resource/map validators, tests and portable build | Needs pack scaffold/compose/inspect/simulate/package toolkit |
| Assets | Existing production images/audio and vendor Phaser modules | New example pack assets are planned; none generated in MP00 |
| Native editor | WinForms source and previous authoring tools retained | .NET/UI verification unresolved; deferred from new critical path |

See `MIGRATION_REGISTER.md` for actual source locations and target phases. Two proposed examples remain design specifications: Brass Bell Cistern and Lantern Market After Midnight.
