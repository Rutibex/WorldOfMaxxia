# MP15 — Quests, journals and endings

Runtime 0.60.0 · 6 November 2026 (America/Toronto)

MP15 adds authored quest graphs to module packs, persistent objectives and journal entries, once-only rewards and campaign epilogues. The Broken Sluice example runs three independent quests. Firstlight's existing main-stage counter and journal remain supported.

## Play the example

Build with `npm run build:game`, then `npm run start:game` and open `/sluice.html`. The browser ZIP is already built: run its platform launcher with Node 22.18 or newer and open the same page. Select the recommended party and enter. The party starts at (4,3), facing Keeper Edda at (4,2). Interact, then Talk.

Accept the sluice request. Inspect the mechanism at (3,3). The key box at (2,3) provides one way to satisfy the repair gate; respectful conversation with the spirit at (6,2) provides another. Edda offers repair, diversion, refusal and deliberate failure branches with distinct epilogues. The optional tool box is at (6,3), and the records box is at (4,5). Return tools to Edda; finish the independent records request in the journal. A lost tool roll has a failure exit. Main completion rewards can be claimed in the journal and supply enough XP for normal level-two training at Edda; training still costs gold and requires eligibility.

Use the dashboard Quest Journal command or Journal tab in the adventure workspace. Select a conscious active hero before claiming item rewards. Other adventure journal opens the legacy Firstlight journal. Ending review stays available; Continue allows exploration and optional requests after the main ending.

## Authoring contract

The complete source pack is `examples/mp15/sluice-pack`; the compiled catalogue is `examples/mp15/sluice.maxxia-build.json`. Quest source records use `toolkit/schemas/quest.schema.json`. The payload wrapper is `maxxia-authored-quest`, formatVersion 1, with matching `id` and `record.id`. Namespaced quest IDs identify immutable definitions; member IDs identify states, objectives, entries, transitions and rewards. Keep them stable across saves.

Each quest has `initial`, `states`, `objectives`, `journal`, `transitions` and `rewards`. State status is hidden, available, active, succeeded, refused or failed. Terminal states cannot have outgoing transitions. All declared states must be reachable. Only one campaign ending can be reached; ordinary quest endings may coexist. An ending has a title, text and campaign boolean. An ending presents an epilogue without deleting or resetting the adventure.

Objectives latch when their condition becomes true in an eligible state. Losing the key afterward does not erase discovery. Terminal objectives freeze. Transition and reward `requirements.all` lists required objective IDs; every group in `requirements.any` requires at least one objective from that group. The optional objective label is presentation metadata: gates always use explicit requirements. Rewards and transitions may also have conditions.

Journal records may be automatically revealed in listed states, linked from objectives/rewards by `journalId`, or linked from transitions by `journal`. Entries persist in reveal order without duplicates. The journal is a projection of saved progress, not a second quest authority. Reading it spends no time and consumes no RNG.

Manual transitions appear as journal decisions. NPC dialogue and object routines can invoke the same transitions through `{ "op": "quest", "action": "transition", "questId": "mp15:quest:broken_sluice", "transitionId": "accept" }`. A claim action instead uses `rewardId` and may select `heroId`. Direct simulation commands use type quest, action transition/claim/journal. `expectedState` can reject stale transition requests. Raw routine command adapters cannot recursively start quest transactions; use the dedicated operation.

Shared condition queries include `{ "query": "quest-state", "questId": "…" }`, `{ "query": "objective", "questId": "…", "objectiveId": "…" }` and `{ "query": "quest-claimed", "questId": "…", "rewardId": "…" }`. These work in routines, dialogue and quest conditions. Quest definitions cannot depend on routine parameters, local variables, NPC attitude or NPC-local facts; publish a scoped fact when that information must affect a quest.

## Rewards and persistence

Gold goes to party resources. XP goes to each active hero and does not automatically train a level. Item grants go to the selected conscious active hero. Costs consume eligible unequipped active-party inventory. A full bag, missing cost, invalid recipient or failed linked action rolls back the entire transaction, including reward guard and journal notes. A reward can be successfully claimed once; failed attempts remain retryable. No reward is granted merely by opening an ending or loading a save.

Progress lives in campaign-scoped keys: `pack:collection:q_<name>_state`, `_objectives`, `_journal`, and `pack:flag:q_<name>_reward_<rewardId>`. State collections contain the current member ID; objective and journal collections store IDs. Absent progress lazily uses the authored initial state. Corrupt or unknown progress is rejected without erasure. Gameplay save v18 and instance envelope v2 remain unchanged. Definition changes that affect saved IDs or meaning require an explicit MP10 migration; this phase does not silently adopt changed content.

Each document supports up to 32 live quests; each quest supports 16 states, 32 objectives, 64 journal records, 64 transitions and 16 rewards. IDs reserve room for scoped keys: quest names max31 characters, members max23. Refresh uses sorted quest IDs, at most32 fixed-point passes and4096 shared condition evaluations. A command cascade shares at most64 quest operations plus existing routine command/event caps. Quest bookkeeping defaults to zero minutes; transitions may specify0–60 minutes. An enclosing dialogue/object action retains its own time cost.

## Composition and checks

Quests support ordinary pack ownership, exports and declared cross-pack references. Root-owned definitions and their transitive dependencies are live; enabling a pack does not activate all its unreferenced exported quests. Quest/member/item links are validated before installation. Importing multiple independent quests does not merge them into a global stage number.

Run `node tools/maxxia.mjs validate examples/mp15/sluice-pack --engine 0.60.0`, `node tools/maxxia.mjs inspect examples/mp15/sluice-pack --engine 0.60.0`, `npm run check:mp15`, and `node --experimental-strip-types tools/run-mp15-scenarios.mjs --production` after building. The full runtime suite is `npm run test:game`; toolkit tests use `node --test toolkit/tests/*.test.mjs`. Strict offline client TypeScript configuration is `engine/world-of-maxxia/tsconfig.check-client-offline.json`.

This release delivers JSON authoring and native game journal/ending UI. WinForms quest forms and interactive browser visual acceptance are not verified here. Firstlight conversion remains incremental; no claim is made that its legacy quest handlers have all become module definitions. MP16 is the next roadmap phase.
