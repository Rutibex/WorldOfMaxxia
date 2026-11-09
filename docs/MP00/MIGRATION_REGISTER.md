# MP00 migration register

All entries are identified work, not implemented pack functionality. MP00 intentionally leaves runtime source unchanged.

| ID | Current assumption | Source | Target | Replacement |
|---|---|---|---|---|
| M01 | Project loading replaces active databases | `engine/world-of-maxxia/src/client/project-boot.ts` | MP03–05 | Stage dependency resolution and compose immutable registries. |
| M02 | Global mutable definition registries | `engine/world-of-maxxia/src/shared/content/classes.ts` | MP04 | Install one validated catalogue per session; reject duplicate namespaced IDs. |
| M03 | Story-specific quest states and valve sequence | `engine/world-of-maxxia/src/shared/rules/quests.ts` | MP11–15; MP32 | Replace campaign assumptions with typed state/events and authored quests. |
| M04 | Town services and shop stock | `engine/world-of-maxxia/src/shared/rules/services.ts` | MP14; MP32 | Pack-defined NPC services and stock eligibility. |
| M05 | Map-ID renderer dispatch | `engine/world-of-maxxia/src/client/perspective-renderer.ts` | MP24–25 | Profiles choose presentation; preserve original art. |
| M06 | Scene triggers and validators in main | `engine/world-of-maxxia/src/client/main.ts` | MP13–16; MP32 | Authored triggers and shared scene validation. |
| M07 | Fixed class traits and prepared styles | `engine/world-of-maxxia/src/shared/content/classes.ts` | MP18–20 | Reusable resources, abilities and progression. |
| M08 | Closed condition and ward semantics | `engine/world-of-maxxia/src/shared/content/conditions.ts` | MP18 | Extensible typed condition/effect contracts. |
| M09 | Party embedded in campaign snapshots | `engine/world-of-maxxia/src/shared/rules/campaign.ts` | MP07–10 | Portable roster, revisioned snapshots, explicit transfer receipts. |
| M10 | Project-prefixed campaign slots | `engine/world-of-maxxia/src/client/project-boot.ts` | MP07–10 | Campaign instances distinct from character ownership and pack dependencies. |
| M11 | Plot-specific ground and pickup behaviour | `engine/world-of-maxxia/src/shared/rules/ground.ts` | MP13; MP21; MP32 | Placed entities, instance identity and one-time rewards. |
| M12 | Fixed NPC illustration/scene catalogue | `engine/world-of-maxxia/src/client/npc-scenes.ts` | MP14; MP25; MP32 | Pack NPC graphs and resource-bound appearances. |
| M13 | Original scene art selectors | `engine/world-of-maxxia/src/client/town-art.ts` | MP24–25 | Retain assets while replacing map-specific selectors. |
| M14 | Existing composed spell restrictions | `engine/world-of-maxxia/src/shared/content/spells.ts` | MP18–23 | Broaden shared target/effect vocabulary without unrestricted eval. |

## MP10 — Explicit catalogue adoption and old-data protection (6 November 2026)

- **MP09 → MP10:** Runtime 0.54.0 → 0.55.0; gameplay save v18, campaign instance v2, portable roster v1 and transfer-receipt v1 remain compatible. New *separate* MP10 journal v1.
- **Format-18 legacy saves:** remain v18 and are copied byte-for-byte into a new library scope only through explicit adoption; never silently rewritten, renamed or assigned portable UUIDs.
- **MP07 v1 instance saves:** are readable in the old scope and become roster-enabled v2 only in the new target scope after confirmed adoption. Old bytes remain untouched.
- **Pack upgrades:** preview exact old/new provider IDs/versions, full source catalogue identity and save counts. All source providers must remain available (with explicitly declared provider aliases if used); unknown mechanics, missing providers and old-namespace definition references block migration instead of being silently discarded.
- **Transfer protection:** complete source receipt ledger is retained byte-for-byte and migrated as a single ownership domain; pending receipts must recover before adoption; historic overwritten characters cannot reappear through old slots.
- **Failure behaviour:** full before/post images stage before a target journal is published; interrupted pending journal may resume only when exact destination bytes match staged expectations. Source library is never overwritten. Completed migration rollback is permitted only while destination saves are unchanged.
- **Unresolved:** interactive browser playthrough, rules-semantic compatibility for materially changed pack definitions, in-game pack-ID/definition-ID remapping, cross-project transfers, Windows editor checks, arbitrary per-instance merge. MP11 remains next.
