# MP10 — Save versions, upgrades and dependency removal

**Runtime:** 0.55.0 · **Gameplay format:** 18 · **Instance envelope:** 1 readable, 2 written · **Portable roster:** 1 · **MP09 transfer ledger:** 1 · **Upgrade journal:** 1.

## Why this phase exists

MP06–09 intentionally pin every campaign to the exact project, adventure, shared-rules profile and resolved pack catalogue. A changed pack version/hash creates a different browser-local save scope. Removing a provider must never make the corresponding hero or inventory vanish, and accepting a new catalogue must never silently rewrite the player's original save. MP10 adds an explicit, reversible-at-the-commit-point catalogue adoption operation.

## User workflow

1. On the module library screen, select the desired new compatible pack configuration. To replace an installed provider bundle, disable that pack, remove the old bundle **without deleting its browser saves**, import the new bundle, enable it and launch the selected adventure. The current MP06 library permits one installed definition of a given pack ID at a time.
2. At the game title screen, open **Save upgrades and pack dependency recovery (MP10)** and select the old catalogue. The pane finds saved instance-index keys under the current project's previous catalogue prefixes.
3. Select **Preview migration**. It reports the instance/slot counts, transfer receipts, character records, provider version/hash changes, missing providers and structural blockers. A blocked preview makes **Adopt** unavailable; the source remains fully intact.
4. If structurally eligible, confirm **Adopt previewed upgrade**. This reads and validates every participating source save, stages exact byte copies and new snapshots, publishes a recoverable transaction journal, then writes the new library. It never edits the old scope.
5. If interrupted, select **Recover interrupted upgrade** on the new catalogue title screen. A pending journal blocks ordinary campaign-instance loading until recovered. When completed, the migrated campaigns appear under their same instance IDs and can be opened normally.
6. **Undo unchanged upgrade** is possible only while every destination file still matches the committed migration. If any migrated save has new progress, rollback refuses to remove it. The old catalogue always retains its original independent save library.

**Browser persistence:** Keep the same browser profile, origin and local storage. Back up exported save/character/transfer files. Private browsing, browser storage cleanup, origin changes and quota restrictions can remove or block local data; the browser does not provide server-side backup.

## What is preserved

- Complete original per-instance autosave and manual-slot bytes remain in their original catalogue scope. All authored map state, explored cells, quests, RNG, time, flags/counters/collections, inventory and conditions are retained in migrated snapshots.
- Roster UUIDs and portable item UUIDs survive a migration. Definition provenance is rebound to the **explicit selected destination identity**; revisions advance on changed records. Legacy v1 snapshots are upgraded to v2 snapshots in the new scope. Original v1 files remain unchanged.
- All complete MP09 transfer receipts are copied **byte-for-byte**, as a single library-wide ownership ledger; pending receipts block adoption. Historical slots which conflict with receipt ownership remain preserved but inaccessible as playable rewinds.
- Legacy format-18 campaign-slot envelopes, when present in the old scoped storage, are copied byte-for-byte, checked for v18 readability but **not** reinterpreted or silently inserted as new character identities. The ordinary legacy reader restores them.
- Missing providers block adoption conservatively, including unused previously enabled providers. Their original character records, equipment and provenance remain opaque **inside the old source catalogue** until that exact provider selection is restored. Standalone imported character files can be staged/inspected without converting or erasing their original provider identity.

## Explicit provider rename aliases

The pure authoring/runtime API accepts `PackRenameAlias[]` with `{from:'old_pack',to:'new_pack'}`. This is a **declared identity alias only**, not a semantic rewrite. It permits a rename when source gameplay contains no old-namespace class/item/spell IDs; if such IDs appear the preview blocks migration and calls for an explicit future reference-mapping procedure. The current title-screen panel does **not** provide an alias editor. Undeclared automatic pack renaming or last-loaded-wins resolution is forbidden.

## Safety and compatibility rules

- The source and destination must identify the **same project, adventure and rules profile**. This is not an arbitrary cross-adventure character transfer (that remains subject to MP09's exact-catalogue restriction).
- Every original provider must be available under its declared ID or a valid explicit alias. All live class, item and spell definitions are validated against the destination runtime before any migration is committed. Unknown effects/changed mechanics are **not** automatically reconciled. Structural eligibility does **not** guarantee semantic compatibility; authors must review release notes and the player's explicit confirmation is required.
- Adoption is only permitted into an **empty target instance library**, with no receipt ledger or previous upgrade journal. It never merges two existing progress histories. The library currently caps instances at 16 and uses four save slots; the migration holds complete staged postimages plus byte-for-byte preimages, so browser quota failure may block an upgrade without losing source data.
- Both parties of a transfer and all of their receipts must migrate together; there is no per-hero downgrade or per-instance receipt detachment.
- Migrated save copies can coexist with their untouched originals as **separate branches in different catalogue namespaces**. This is not tamper-proof anti-cheat across exported files.
- An interrupted commit resumes only if destination keys still match the exact expected staged postimages or are empty. Divergent data is not overwritten. In a failed migration, recover the pending journal first; do not manually clear intermediate keys.

## Campaign-bound versus exportable items

The five original Firstlight plot items (`PLOT_ITEMS`) are owned by the **campaign quest ledger**, not by a portable character. Their possession/quest-resolution flags remain within the source adventure. Other physical item definitions may declare `"portability":"campaign-bound"` or `"portability":"exportable"`; the default for an installed ordinary item is `exportable`. Transfers reject explicitly campaign-bound equipment. Unknown definitions are never assumed portable. This policy does not cause random loot/spawn eligibility: that still follows pack export and placement rules.

## API notes

`src/shared/saves/catalogue-upgrades.ts` exports `previewCatalogueUpgrade()` and `CatalogueUpgradeCoordinator` (`preview()`, `adopt(preview.token)`, `recover()`, `rollback()`). Pass source/target `StorageLike` views obtained through `projectCampaignStorage`, a valid map registry and exact original/current `InstanceIdentity` records. The SHA-256 preview token binds the exact source raw bytes, catalogue identities and alias declarations. Internally, the journal lives at `world-of-maxxia:upgrade:mp10:journal` **within the target scoped storage**. Staged before/after files are retained there to support recovery. Do not directly manipulate them through gameplay or content scripts.

## Version matrix and planned follow-up

| Source | Destination | Handling |
|---|---|---|
| Format-18 legacy gameplay envelope | Same compatible runtime | Legacy reader validates/restores; during adoption exact envelope bytes are copied, never rewritten |
| MP07 instance envelope v1 | MP10 envelope v2 | Explicit adoption upgrades into a new snapshot with a validated portable roster |
| MP08–09 instance envelope v2 | MP10 envelope v2 | Structural validate, rebind source provenance, retain UUIDs and ledger |
| Different catalogue with unavailable provider | None | Refuse gameplay adoption, preserve opaque raw source and staged character records |
| Different adventure or rules profile | None | Refuse; dedicated content/rules adaptation is outside MP10 |

MP11 follows with a shared simulation command/event boundary. Genuine independently authored adventure execution and imported staged characters joining gameplay remain separate future work. Browser Chromium interaction and native Windows editor compilation were not verified on this host; see the validation report.
