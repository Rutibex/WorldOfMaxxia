# MP08 — Portable roster and item instances

## Purpose and version contract

World of Maxxia retains the verified **gameplay save v18** format, including all map, party, combat, inventory, magic, quest, RNG and time state. MP08 adds a **campaign-instance envelope v2**, whose `roster` is a separately validated `maxxia-portable-roster` v1 snapshot. MP07 envelope v1 and legacy MP06/gameplay-v18 saves remain readable; old raw saves are **not modified on read**. The first explicit save of an older MP07 instance writes a v2 envelope and backs up the original slot.

The roster is a portable mirror of the campaign's character and inventory state, not a second combat simulator. Every character has a UUID-v4 `portableId` and a monotonically increasing `revision` for changed snapshots; every inventory stack or unique item also has a permanent UUID and its own revision. Existing `hero_*` and `stack_N` IDs remain untouched as local simulation keys. Characters preserve abilities, class, level, XP, HP/SP, attributes, resistance, conditions, age, portrait, heritage, advancement awards, prepared combat setup and all equipment slots. Their spellbook preserves known/readied spells and worn-item curses. Item instances preserve definition, owner, count, charges, durability, identification, equipped slot and backpack position.

The authoritative v18 inventory owns items; a roster record is **invalid** if an item or equipped character differs from that authoritative snapshot. This guards against a mismatched or forged roster envelope. Each slot's v2 envelope contains its roster as an export/recovery checkpoint, so loading an older manual slot restores the matching historical character and equipment revisions. A separate local-storage record `world-of-maxxia:roster:mp08:<instanceUUID>:<characterUUID>` also tracks the latest successful known revision. That record is a recoverable index only: the validated campaign snapshot remains authoritative, and a failed independent cache write cannot invalidate a committed save. Earlier revisions remain in historical save slots, not a general revision-history database.

## Provenance and missing providers

For pack-qualified definition IDs (such as `brass:item:shield`), a record includes its full definition ID, origin pack ID, exact installed version and resolved catalogue hash. Unqualified classic classes/items are owned by `core`, except the eight named Firstlight-only items from the frozen legacy adapter, which are identified as `firstlight` version `legacy-adapter-v1`. The adapter is permitted only for its two previously declared project identities. The record does not grant permission to silently replace global rules or mix different catalogue versions.

Standalone portable character JSON can be exported from an active MP08 campaign and inspected/imported into a **staging vault** using the title-screen controls. `inspectPortableCharacter` returns missing provider/version requirements; it never deletes the payload when a provider is unavailable. A stage import preserves the original UUID and bytes semantically, refuses overwriting an existing UUID with different content, and never equips or inserts a character into the active campaign. There is no in-game character move/copy operation in MP08. **MP09** will define transfer receipts, source checkpointing, copy identity, destination insertion, rollback and duplicate-reward protections.

Unlike character possessions, **party-level gold, shared food, bank balance, campaign-only plot objects and quest flags are not character-owned portable belongings**. They remain in campaign v18 state. World-space loot, corpses and campaign-scoped quest artifacts are not silently swept into portable character records. Future transfer rules must explicitly decide eligibility, including plot-bound equipment.

## Programmatic authoring APIs

- `captureRoster(campaign, identity, instanceId, previous?)`: create deterministic-content records with stable UUID identities and advancing revisions; validate against the live campaign before persistence.
- `validateRoster(snapshot, campaign, identity, instanceId)`: reject duplicate or mismatched identities, provider/version drift, missing item representations, mismatched class/equipment and oversized data.
- `CampaignInstanceStore.getRosterSnapshot()`: obtain a clone of the currently loaded roster.
- `CampaignInstanceStore.exportCharacter(portableId)`: produce standalone `maxxia-portable-character` v1 JSON.
- `inspectPortableCharacter(json, identity)`: obtain the original record plus provider-availability diagnostics without applying the record to a game.
- `PortableRosterVault.importText(json, identity)`: stage an inspected character without replacing a different record at the same permanent ID. `exportText(id)` retrieves the staged record.

## Launch and verification

1. Use the packaged offline browser launcher or serve `dist/` with `server.mjs`. Do **not** open `index.html` from the filesystem.
2. Create a new campaign. Fight, collect items, change equipment and save. Your character and equipment UUIDs persist through ordinary saves and reloads.
3. Return to the title; open **Portable characters (MP08)**. Choose a hero and export that hero's JSON record. You may import an existing character record into the staging vault, with missing-provider diagnostics if applicable.
4. Use an MP07 format-1 instance. Reading it does not overwrite the original; explicitly saving upgrades the selected slot to v2 while backing up the previous bytes.
5. Run `npm run check:mp08`, `npm run test:game`, `tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json`, `npm run build:game`, `npm run verify:game` from the cumulative source root (where locked toolchains are installed, or the offline build path is available).

## Known limits

- MP08 does not add live transfer, copy, shared roaming parties or import-to-party. These are **MP09** work.
- Save-compatible v1 instances gain permanent portable IDs on first MP08 activation; IDs are persisted on explicit v2 save. Re-opening an unsaved v1 file can regenerate those not-yet-committed IDs.
- The portable index stores the latest observed revision, not a history of arbitrary edits or an anti-cheat authority. A manual-slot rewind restores that slot's earlier revision. MP09 must treat that as a divergent timeline when designing receipts.
- A staged file referencing an absent provider is preserved, not playable. MP10 will implement explicit pack upgrades/missing-provider recovery.
- Existing party and inventory rules still limit which classes and items can be instantiated; MP18–23 generalize mechanics. MP11–16 add authored adventure action engines; these are not part of MP08.
- Native Windows editor and actual human browser playthrough remain separate unverified acceptance checks.
