# MP12 — Conditions, actions and reusable routines

Runtime 0.57.0. Gameplay saves remain v18; campaign-instance envelope v2 and scoped-state v1 remain unchanged.

## Run the proof

From the cumulative source root, use Node 22.18+ (Node 24.22.1 was used for this release):

```sh
npm run test:game
npm run check:mp12
node --experimental-strip-types tools/routines-mp12.mjs examples/mp12/lever-routines.json --proof
npm ci
node tools/maxxia.mjs validate examples/mp12/lever-pack --json
node tools/maxxia.mjs build examples/mp12/lever-pack --out examples/mp12/lever-pack.maxxia-build.json --json
npm run build:game
npm run start:game
```

The browser distribution has its own Node launcher and needs no npm install. Open its printed local address, enter the adventure and close menus. Expand **Authored routine test bench (MP12)** beneath the game. Select `examples/mp12/lever-routines.json` (also included in the browser distribution's `examples` folder). Use routine ID `mp12:routine:lever`. Run arguments `{"lever":2}` for the recoverable wrong sequence; then `{"lever":1}` followed by `{"lever":2}`. The panel supplies the first party member as `owner` if omitted. Success grants one healing draught; repeating the action grants nothing. Campaign autosaves include the puzzle flags. Reload, re-enter and reimport the routine document to continue testing: definitions are content, not serialized executable save data.

This is an explicit authoring test bench. The fixture map records intended interactions, but generic placed-object activation/menus are MP13. This release does not claim a complete playable new adventure. Existing Firstlight gameplay remains available.

## Document and pack formats

A standalone routine document is `{version:1,routines:[{id,parameters,actions}]}`. IDs are `namespace:routine:name`; parameters map names to `string`, `number`, or `boolean`. Arguments require exact names/types; numbers are bounded safe integers. Strings are at most 2,048 characters. Each call owns fresh local variables; nested calls receive only explicit arguments.

A pack routine payload is `{format:"maxxia-authored-routine",formatVersion:2,id,parameters,actions}`. Register it in the existing content index with kind `routine`. The JSON Schema is `toolkit/schemas/routine-v2.schema.json`; semantic validation checks names, complexity and references. Version-1 `message`/`set_flag` routines remain accepted and are adapted to scoped namespaced state. The new example pack and compiled proof are in `examples/mp12/lever-pack` and `examples/mp12/lever-pack.maxxia-build.json`.

Calls must appear in the descriptor's references. Cross-pack calls require the existing direct dependency and exported target policy. This release rejects calls whose optional provider is absent rather than executing a dangling reference. Build separate available routines for such selections. Duplicate/private/missing references fail before installation. Composed routines install synchronously alongside existing content registries; the browser dispatcher uses this installed routine document unless the test bench explicitly imports a replacement document.

## Expressions and conditions

Expressions are literal strings/integers/booleans, `{param:"name"}`, `{variable:"name"}`, or queries. `{query:"state",address:{scope:"campaign"},kind:"flag",key:"pack:flag:name"}` reads a flag; `counter` and `collection` use corresponding typed keys. Local addresses add `mapId` and use `scope:"local"`. Missing fields default to false, zero, or empty collection. Invalid maps/keys fail. `{query:"has-item",item:"item_healing_draught"}` queries the owned party inventory.

Conditions are booleans, `{all:[...]}`, `{any:[...]}`, `{not:...}`, or `{op:"eq",left:expression,right:expression}`. Comparisons are `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `contains`. Ordered comparisons require numbers; equality requires matching scalar types; contains requires a collection and string. Boolean groups short-circuit deterministically.

## Actions

| op | Operands and effect |
| --- | --- |
| message | `text`: string expression; queued only on transaction success |
| set | `variable`, `value`: define or replace a call-local value |
| state | `address`, typed `key`, `kind`, `value`; flag writes, counter deltas, collection-add/remove |
| if | `condition`, `then` actions, optional `else` actions |
| call | `routine`, `args`: explicit expression-valued parameter map |
| repeat | `count` expression from 0 to 16 and `actions`; consumes shared budget |
| check | `target` integer and `variable`; seeded d20 >= target stores boolean |
| give-item | `owner`, `item`, `count` expressions; existing inventory capacity, instance IDs and validation apply |
| command | `command`: validated existing simulation command, with nested expression substitution |

Command adapters cover movement and authored portal interactions, combat/encounter engagement, inventory use/removal/transfer, loot, services and spells. They preserve existing rules and preconditions. They do not arbitrarily teleport or rewrite campaign state. Generic quest state uses scoped flags/counters/collections, for example `pack:flag:quest_complete`; full journal/objective/reward lifecycle is MP15. Character moves/copies remain MP09 receipt transactions and are not exposed as script map transfers. New combat effects/resources are MP18–19.

## Execution and failure contract

`dispatchSimulation(state,maps,{type:"routine",routineId,args},{routines,scoped})` returns a normal simulation result, plus the updated `scoped` document on success. Commit BOTH state and scoped together. `replaySimulation` carries scoped state between commands. The browser's adapter commits scoped state before autosave. Invalid documents/operands, missing routines, blocked command adapters, overflow, full inventory or execution limits return the original campaign and no scoped commit or successful messages/events. Expected failed checks return false for authored branching. A one-time reward uses a scoped claim flag and grant in the same transaction.

Limits: document 128 routines, 4,096 traversed JSON nodes and depth 24; routine actions 128 per sequence, 16 parameters, 32 local variables, 256 evaluated runtime steps, 32 calls and nesting depth 8. Routine calls and repeats share those budgets. Adapter commands share the enclosing 16-command cap; the MP11 128-event and trusted-trigger budgets still apply. Trusted engine triggers see committed staging results and remain within outer transaction rollback. No pack JavaScript, host/file/network API, timers or arbitrary property access is exposed.

## Verification and remaining acceptance

See `MP12-Validation-Results.md` for executed results. The production modules can be verified through `tools/verify-production-routines-mp12.mjs` without a browser. `tools/verify-browser-mp12.mjs` requires Playwright and Chromium and checks actual browser/headless equality. On this host Chromium launch failed because socket creation is prohibited; visual layout, test-bench clicking and manual save/reload acceptance remain unverified. Windows editor/.NET acceptance remains separate.

Next: MP13 — Generic objects, doors and interaction menus.
