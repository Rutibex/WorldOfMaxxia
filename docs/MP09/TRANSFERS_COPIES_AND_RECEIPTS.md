# MP09 — Transfers, copies and transfer receipts

## What is implemented

MP09 adds committed local transfers between two **saved campaign instances in the same active project and resolved catalogue**. Open the title screen's **Portable characters and transfers (MP09)** panel, select the source campaign, destination campaign, active character, and either Move or Copy. Both campaigns must have valid v2 autosaves, no active combat, and compatible installed providers; source must retain at least one active hero when moving.

**Move:** The arriving hero retains its permanent UUID and each owned item's UUID; all revisions increment. The destination assigns new `hero_arrival_*` and `stack_N` local simulation identifiers. Level, XP, HP/SP, awards, stats, conditions, known/readied spells, equipment, curses, charges, durability, ownership and identification are preserved. The source character and their items leave the source party entirely. Quest flags, regional map changes, encounters, party gold, food, bank balance, dropped loot and campaign-only plot objects remain in their original campaign. No new rewards or experience are granted by transfer itself.

**Copy:** Source state is byte-for-byte unchanged. A new hero and new item UUIDs are minted, revisions begin at 1, and the clone starts with a matching character and equipment state. It is a visibly separate playable branch; repeated intentional copies can be made with different receipt IDs. A retry of the **same transaction ID** returns the existing receipt without granting a second arrival.

## Full parties and reserves

The current rules still allow 1–6 *active* heroes. A destination already holding six active heroes requires the user to **explicitly bench** one. The benched hero is retained in the same campaign as an inactive roster member, complete with items, spells and progression. The title screen's **Manage reserve characters** panel swaps reserves into the active party without deleting or duplicating them. Each campaign's full roster is limited to 24 characters. Only active source heroes can depart; a benched hero must be reactivated first.

## Durable receipts and recovery

The gameplay save remains **v18**, the instance envelope **v2**, the portable roster **v1**. Receipts are stored separately in `world-of-maxxia:transfer:mp09:ledger`, with a bounded append-only history of 96. Receipts include mode, source/destination instances, old/new permanent hero IDs, source/destination revisions, status, timestamps and bench choice. The UI shows a history and exports the JSON ledger.

The coordinator validates both entire autosave snapshots, provider lock, character and item records, both resulting snapshots and inventory/party limits *before* making any game state changes. It stages four complete strings: source before, destination before, source after and destination after. Publishing a `pending` receipt is the durable prepare point. Recovery verifies the staged records against the receipt and only accepts unchanged preimages or already committed postimages; unknown divergent bytes are never overwritten. It checkpoints and commits **destination first**, then source, before marking the receipt complete and dropping temporary stage files. Existing source and destination autosave bytes are retained under their usual `:backup` keys. Interrupted operations can be resumed idempotently from the pending receipt.

Completed receipts enforce the most recent owner and minimum destination revision of every moved hero or copied branch. Older manual saves remain byte-preserved but cannot reactivate moved-away heroes, lose imported copies or rewind ownership. Ordinary saves also compare character membership with the current authoritative autosave, preventing stale tabs from re-minting heroes after moves. All actions fail closed on incompatible or damaged receipts.

These protections operate within the browser-local save library. Exported character files, whole browser profiles and intentionally edited local storage are user-controlled; **there is no tamper-proof anti-cheat guarantee**. The MP08 external-character JSON staging vault remains inspection-only and is not itself a committed move or import-to-party function.

## API

- `CampaignInstanceStore.transferCharacter({mode,sourceInstanceId,destinationInstanceId,portableId,benchId?,id?})` executes a move/copy. Supply the same UUID `id` to retry idempotently.
- `CampaignInstanceStore.recoverTransfers()` finishes pending checkpoints when possible and refuses divergent snapshots.
- `CampaignInstanceStore.getTransferReceipts()` lists the history; `getInstanceAuto(id)` returns a validated snapshot.
- `CampaignInstanceStore.swapReserve(instanceId,reserveId,activeId)` swaps an inactive hero and an active hero safely.
- `readTransferLedger(storage)` and `assertTransferOwnership(snapshot,storage)` provide receipt checks for tests and migration development.

## Testing and acceptance

Try A→B→A move, move retry using the same receipt ID, independent copy, destination bench and recovery, older source and destination slot rewinds, stale autosave from an existing tab, and interruption after destination commit. Relevant headless checks are in `tests/transfer-receipts-mp09.test.mjs`. Run the full game suite, strict offline TypeScript, offline build, and HTTP distribution verifier; see `MP09-Validation-Results.md`.

## Boundary and next phase

- **Only two instances with matching exact resolved project/catalogue identity** are transferable in MP09. Cross-catalogue version migration and different executable adventure projects are not yet supported; independent fully playable packs are planned for MP11–17 and migration support for MP10. MP06's Brass/Glass entries are composition fixtures rather than fully independent adventures.
- A campaign-instance v1 save needs an explicit v2 save before transfer. No automatic rewrite of historical save slots is performed.
- The source must retain one active hero. The ledger is bounded to 96 receipts and needs a future archive strategy that preserves ownership.
- Actual interactive Chromium UI acceptance and native Windows editor validation remain separate unverified platform gates.

**Next:** MP10 — Save versions, upgrades and dependency removal. Preserve transaction receipts, old checkpoints and portable identity during migrations.
