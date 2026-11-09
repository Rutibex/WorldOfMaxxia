# MP14 — Dialogue, NPC relationships and services

Runtime **0.59.0**; cumulative MP13 source. Gameplay save v18, instance envelope v2, scoped-state v1, roster v1 and transfer receipt v1 are unchanged. New NPC state uses the existing typed campaign scope.

## Play the Brass Counter

Start `Start-World-of-Maxxia.cmd` (Windows) or `sh start-world-of-maxxia.sh` (Linux/macOS). Node 22.18+ is required; Node 24.22.1 was used for verification. The browser distribution needs no npm install or external game service.

Open `/counter.html` on the printed server address, normally `http://localhost:3000/counter.html`. For the same adventure with its optional exported-stock provider enabled, open `/counter-composed.html`. The original Firstlight campaign and MP13 `/workshop.html` remain included.

1. Enter with the recommended party. Face the Counter Keeper and press Space/Interact, then **Talk**.
2. Ask what the workshop needs. This records a remembered fact. Offer respectful assistance to gain five attitude. The permit choice now becomes available; it requires both the fact and attitude 5.
3. You can instead refuse. The refusal node is terminal. Leave and speak again to reconsider; remembered facts and relationship changes remain.
4. Buy a Counter Tonic, or sell an unequipped accepted item. Shop stock is finite and saved. The exported Story Relic has the same shop tag but is deliberately ineligible, so it is absent from generic stock.
5. Leave, turn left and open the nearby Trade Token Box. Take its two tokens, turn back and speak again. The barter service trades one token for one tonic once per NPC. The screen states the items and gold exchanged.
6. Insulting the keeper lowers trust and can disable services. The one-time goodwill tribute restores attitude for its displayed gold price. You can obtain the permit through different sequences of questions and relationship changes.
7. Requesting the permit grants one item and runs an MP12 approval routine in the same transaction. Reopening the conversation cannot claim that keeper’s permit again.
8. The apprentice across the room reuses the same dialogue and service definitions but starts with attitude -5 and has independent facts, stock and claim guards.

Use the **Service adventurer** selector inside the conversation to choose the active hero receiving healing, training or purchases. Healing is unavailable at full HP; training requires earned XP, carried gold and any milestone attribute choice. This small social fixture does not award artificial training XP or injure characters to unlock those buttons; dedicated tests exercise successful healing/training and their failure paths.

The scenery/NPC figures are functional generic primitives. Final art for the release adventures remains later in the roadmap. Actual browser clicking and visual acceptance remain unverified on the build host because the cloud browser could not reach the local server. The headless source and built production playthroughs were executed successfully.

## Authoring and verification commands

From the cumulative source root:

```sh
npm run test:game
npm run check:mp14
npm ci
node --test toolkit/tests/*.test.mjs
node tools/maxxia.mjs validate examples/mp14/counter-pack --engine 0.59.0 --json
node tools/maxxia.mjs inspect examples/mp14/counter-pack --engine 0.59.0 --json
node tools/maxxia.mjs build examples/mp14/counter-pack --engine 0.59.0 --out examples/mp14/counter.maxxia-build.json --json
node tools/maxxia.mjs build examples/mp14/counter-pack --engine 0.59.0 --candidate examples/mp14/counter-extra --enable counter_extra --out examples/mp14/counter-composed.maxxia-build.json --json
npm run build:game
node --experimental-strip-types tools/run-mp14-scenario.mjs --production
node --experimental-strip-types tools/run-mp14-scenario.mjs --production --composed
npm run verify:game
npm run check:workspace
```

The offline browser build can use the shipped Phaser vendor modules and Node’s TypeScript transform without dependency installation. Strict typing uses the declared TypeScript 5.9.3 development dependency; install engine dependencies with `npm run setup:game` on a supported machine. The combined historical `npm run check` additionally invokes native .NET checks; browser/headless results do not certify those checks.

`tools/run-mp14-scenario.mjs` uses 39 ordinary commands, with no direct position/XP/HP edits: conversation, facts, refusal/reconsideration, buy/sell, real token pickup, barter, hostility, tribute, approval, a second NPC and actual campaign-instance reload. `--production` compares complete campaign/scoped state, RNG, messages and typed events against the built JavaScript. Both the core+main and core+main+optional-provider selections pass independently.

## Pack definitions and placement

The content catalogue now accepts `npc` and `dialogue` payload kinds, in addition to previous kinds. Register each payload in the existing content index with its references and visibility. The schemas are `toolkit/schemas/npc.schema.json` and `toolkit/schemas/dialogue.schema.json`; semantic graph/signature checks also run through the shared catalogue validator.

A native map v2 entity can use:

```json
{
  "id": "my_pack:object:keeper",
  "name": "Keeper",
  "description": "The keeper waits behind the counter.",
  "x": 4,
  "y": 2,
  "kind": "npc",
  "npcId": "my_pack:npc:keeper"
}
```

Declare `my_pack:npc:keeper` in that map descriptor’s references. NPC placements obey the MP13 reach/visibility rules and use its generic renderer and interaction menu. NPC IDs name the persistent person: placing the same NPC identity in more than one place deliberately shares its relationship, stock and conversation state within that campaign. Different NPC IDs may reuse a dialogue but keep independent state. Campaign instances remain independent; NPC reputation/facts stay in campaign state rather than the portable character roster.

An NPC payload has this shape:

```json
{
  "format": "maxxia-authored-npc",
  "formatVersion": 1,
  "id": "my_pack:npc:keeper",
  "record": {
    "id": "my_pack:npc:keeper",
    "name": "Keeper",
    "dialogueId": "my_pack:dialogue:greeting",
    "initialAttitude": 0,
    "services": []
  }
}
```

The dialogue, fixed item and routine references used by NPC/dialogue payloads must match their descriptors. Required links whose optional provider is absent reject the selection rather than executing a dangling reference. Cross-pack links need a declared direct dependency and exported target. Exported NPC/dialogue definitions must preserve export closure for their referenced content. The optional stock provider demonstrates a different case: a generic shop query can discover eligible exports from any explicitly enabled pack without hardcoded item IDs.

## Dialogue graph

A dialogue payload is `{format:"maxxia-authored-dialogue",formatVersion:1,id,record:{id,entry,nodes}}`. A node contains `id`, `text`, `choices`, and optional `terminal`. Node IDs and choice IDs are lowercase local identifiers. IDs must be unique; next-node references must exist. Empty-choice nodes must be terminal, and terminal nodes have no choices. A choice has:

| Field | Meaning |
| --- | --- |
| `id`, `text`, `next` | Stable identity, visible label, and next node ID or null to end |
| `condition` | Typed, side-effect-free availability test |
| `unavailable` | `disable` (default) or `hide` when its condition/claim/cost requirements are unmet |
| `unavailableText` | Optional explanation for an unavailable choice |
| `once` | Persist a per-NPC claim guard when the choice succeeds |
| `effects` | Bounded list of relationship, fact, gold or item changes |
| `routine` | Optional MP12 `{routineId,args}` hook with exact scalar parameters |

Effects are `{op:"attitude",delta}`, `{op:"remember",fact}`, `{op:"forget",fact}`, `{op:"gold",delta}`, `{op:"give-item",itemId,count}`, or `{op:"take-item",itemId,count}`. Negative gold changes are payments. Item costs consume unequipped carried items from active heroes. Grants go to the selected conscious active hero. Rewards intended once should use `once:true` or an explicit persistent condition. Claim guards are per NPC, not automatically global across everyone sharing that dialogue.

A choice’s effects, item/gold costs, claim guard, cursor, one minute of time and routine hook commit together. Missing items, full inventory, a failed hook/trigger or an execution budget failure restores the entire prior campaign and scope. Expected unmet conditions return a blocked result; they do not spend time, money or RNG.

Graphs can contain player-driven cycles. One command takes one chosen edge; there are no automatically executing node-entry loops. Limits include 32 nodes, eight choices per node, 96 total choices, and 16 direct effects per choice. Existing MP07 state limits and MP12 nested routine/command/event budgets still apply.

## Conditions and remembered state

MP12 routines and MP14 dialogue/services share one typed comparison/query implementation. Conditions support `all`, `any`, `not`, `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, and `contains`. Known incompatible operand types reject validation; conditions are bounded to 128 nodes and depth 16. Read-only query evaluation consumes no RNG or time.

| Expression | Value |
| --- | --- |
| literal string, integer or Boolean | Literal value |
| `{query:"state",address,kind,key}` | Existing campaign/local typed state |
| `{query:"has-item",item:"pack:item:id"}` | Whether an owned inventory instance exists |
| `{query:"gold"}` | Current carried party gold |
| `{query:"attitude"}` | This NPC’s current attitude (NPC context only) |
| `{query:"fact",fact:"purpose"}` | Whether this NPC remembers the named fact (NPC context only) |

Routine parameters/local variables retain their existing expression syntax. Dialogue/service conditions use scoped/NPC queries rather than unbound routine locals. NPC-context queries outside a conversation context fail explicitly. For example:

```json
{
  "all": [
    {"op":"eq", "left":{"query":"fact","fact":"purpose"}, "right":true},
    {"op":"gte", "left":{"query":"attitude"}, "right":5}
  ]
}
```

Attitude is initial metadata plus a persisted campaign counter, clamped to -100 through 100. Facts use the existing campaign collection. State keys are derived from the NPC identity: `<pack>:counter:<npc>_attitude`, `<pack>:collection:<npc>_facts`, and `<pack>:collection:<npc>_node`. Once-only choices use `<pack>:flag:<npc>_choice_<choice>`. Renaming identities or reordering stock/offers during an upgrade requires an explicit migration of their associated keys; catalogue adoption remains deliberate under MP10.

## Reusable services

Every service has a local `id`, `name`, `kind`, optional `condition`, and optional `minAttitude`. Service access is checked again for each command. Selecting a different service hero does not spend time. Successful service transactions spend one minute and settle the normal exploration clock.

| Kind | Authored fields and behaviour |
| --- | --- |
| `shop` | Explicit `stock:[{itemId,quantity,price?}]`; optional `generic:{tags,quantity,maxItems}`; `buybackPercent` from 0–50 |
| `healing` | `cost`, `amount`; heals the selected living injured hero up to its derived max HP; no charge for an unavailable/full-HP target |
| `training` | Uses the same canonical training primitive as Firstlight: XP threshold, gold cost, maximum level and milestone attribute selection |
| `tribute` | `cost`, `attitudeDelta`, optional `once`; pays displayed gold for the relationship change |
| `barter` | `offers:[{id,name,give,receive,costGold,once?,attitudeDelta?}]`; all inputs and outputs are one transaction |

Generic shop stock requires **all** specified tags and an item descriptor with **visibility exported and placement eligible**. Matching IDs sort deterministically and are capped by `maxItems`. An exported story relic with placement none is not admitted just because its tags match. Explicit fixed stock is deliberate placement. The stock counter is campaign/NPC/service-owned, starts lazily from the immutable definition and survives reload. Purchases cannot exceed remaining stock. Selling accepts only unequipped owned item types in that shop’s resolved stock policy and does not replenish finite stock in v1. A zero-value buyback is blocked.

Prices are shown before purchase. Barter menus show inputs, outputs and gold costs. Buy/sell quantities are integers 1–20 through the API; the initial browser UI trades one item per click. Full inventory or any failed output restores inputs, gold, stock counters and serial IDs. Shop state is not stored by mutating item definitions.

## Sessions and interruption

The shared command is `{type:"social",entityId,action,...}`. Actions are `talk`, `choose`, `leave`, `select-hero`, `buy`, `sell`, `heal`, `train`, `tribute`, `barter`. Choices/services carry the current `nodeId`; transactions also name their service and relevant item/offer/hero. All operands are validated at runtime. Direct commands cannot bypass reach, visibility, combat, funds, stock, relationship, cursor or claim checks.

Talk starts at the entry node, remembers meeting and opens the NPC menu without advancing time. Leave/Escape clears the cursor and preserves facts, attitude, stock and claims. Reopening after reload or interruption starts at entry; this phase does not automatically restore an open modal mid-sentence. Terminal nodes disable further choices/services until talking again. Combat, defeat or loss of reach interrupts access; stale commands are blocked. The UI reports the interruption and allows leaving. Selecting heroes and opening/closing menus do not trigger hidden clock ticks or random rolls.

NPC/dialogue routine hooks share MP12 limits. Routine adapters cannot invoke nested object/social transactions, preventing a dialogue→routine→dialogue cycle from restarting the transaction budget. Use bounded routine calls inside the hook.

## Scope and acceptance

This phase adds generic NPC dialogue, relationships and the five reusable service kinds. It does not replace every legacy Firstlight service/story handler. Full quest objectives/journals/endings remain MP15; timed encounters MP16; richer abilities/effects and final art retain their later milestones. New dialogue/shop content does not require branches keyed to the example pack’s ID.

See `MP14-Validation-Results.md` and `validation/MP14`. Automated checks pass, including main+core and composed example playthroughs and actual instance reload. Interactive browser/visual acceptance remains unverified because the cloud browser could not connect to the local test server. Native Windows/.NET acceptance remains separate.

Next: **MP15 — Quests, journals and endings**.
