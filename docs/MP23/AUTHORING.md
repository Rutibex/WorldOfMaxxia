# MP23 — Exploration abilities and physical interactions

**Cumulative Maxxia Maker workspace:** 0.23.0-mp23. **Engine:** 0.68.0. **Save:** 18 (unchanged).  
**Original author credit:** By Michael Robinson.

## Purpose and scope

MP23 generalizes physical interaction through capability tags on placed objects and bounded providers on class-granted abilities and carried items. It preserves MP13 key/pick/force/search and MP12 object routines, creates no dynamic JavaScript execution, and operates through the MP11 transaction/simulation boundary. Only authored map entities and outcomes are affected.

### New authoring fields

- An MP13 placed `entity` may carry `capabilities`: 1–8 methods, each `{ "id", "label", "tag", "outcome", "minutes" }`. IDs and tags are lower-case snake_case identifiers up to 32 characters. Methods are visible in the existing interaction menu as `cap:<id>` actions with eligibility explanations.
- `outcome`: `unlock` (remove lock without opening), `open` (remove lock and open), `reveal` (uncover hidden object/secret wall), `disarm` (mark linked native trap safe), `use` (trigger existing bounded `onUse` routine), `traverse` (move the party to a fixed safe destination). No other arbitrary map mutation is supported yet.
- For `disarm`, the entity must be an `object` at the trap's cell with a `hazardId` matching an authored `traps[]` record.
- For `traverse`, add `destination: { "x": 4, "y": 10 }`. The target must be floor in the same map, within three Manhattan cells of the entity, unobstructed to the party, unoccupied by a live enemy, and cannot be the party's current cell. These are checked by map validation and again at runtime.
- `minutes` is 1–30 for a successful action. A failure/rejection spends neither minutes nor RNG, resources or item charges.

### Ability provider

An MP19 `ability` can declare `exploration` at the top of its record. Such abilities require `context:"exploration"`, `target:"self"`, `operations:[]` and an `activation.mode:"active"` grant. The effect cannot be invoked directly as an ordinary character ability, effect or script; only the placed-entity interaction may activate it.

```json
{
  "id": "bell:ability:echo_hand",
  "name": "Echo Hand",
  "description": "Operate a nearby mechanism using resonance.",
  "context": "exploration",
  "target": "self",
  "operations": [],
  "activation": {
    "mode": "active",
    "classes": ["bell:class:echo_sentinel"],
    "minLevel": 1,
    "cost": { "id": "bell:pool:echoes", "amount": 1 },
    "cooldown": { "clock": "minutes", "amount": 2 }
  },
  "exploration": { "tags": ["mechanism", "ward", "step"], "range": 3, "requiresSight": true }
}
```

Resource providers and level grants continue to follow MP19 rules. A helper named `spendExplorationAbility` verifies grant, resource balance, cooldown and living actor, then deducts the cost inside the enclosing simulation transaction. A minute cooldown begins after the current action's minutes.

### Item provider

A regular authored item may include `"exploration": { "tags": ["reveal"], "range": 1, "requiresSight": false }`. A conscious selected hero must own the item. If it has `maxCharges > 0`, the action consumes exactly one charge and refuses at zero. If the item requires attunement, it must be attuned. Zero-charge-capacity tools are reusable and do not consume an item. Other MP21 equip, curse and portability rules remain unchanged.

### Placed method example

```json
{
  "id": "bell:object:gallery_gate",
  "name": "Gallery pressure gate",
  "description": "A sealed pressure gate with a mechanical override.",
  "x": 6,
  "y": 5,
  "kind": "door",
  "doorId": "door_gallery",
  "lock": { "keyItemId": "bell:item:valve_key" },
  "capabilities": [
    { "id": "remote_open", "label": "Echo Hand: open gate", "tag": "mechanism", "outcome": "open", "minutes": 2 }
  ]
}
```

This is an excerpt of the authored map's `record.entities[]`, not a complete standalone map file. Existing key/pick/force pathways remain available and consistent with the same door state.

### Reach and line of sight

The selected living character must have a matching ability grant or own a matching item. Abilities are considered first by stable definition ID, then owned item instances by stable instance ID; no implicit party-wide auto-selection. The provider's range is capped at four Manhattan squares. When `requiresSight` is true, a bounded grid ray cannot pass through opaque intermediate cells or diagonally sealed corners. A target door or secret wall can itself be closed while being remotely manipulated. When false, physical touch is allowed only in the current or an adjacent cell with range one. The ordinary MP13 face-ahead physical action remains unchanged.

### Runtime contract and safety

From the browser's interaction menu, choose a method such as `Echo Hand: open gate`. Headless command:

```json
{ "type": "object", "entityId": "bell:object:gallery_gate", "action": "cap:remote_open" }
```

Supported outcomes automatically update map state, local flags or the trap registry and persist with the campaign. `use` dispatches the entity's existing authored `onUse` routine using the current configured routine/quest documents. If a nested routine fails, the entire action (including resources/charges, time and topology) is rolled back. Invalid commands and unattainable targets produce explanations rather than silent actions. No new save fields or format bump is needed.

### Reference content

- `examples/mp23/brass-bell/content/ability_echo_hand.json` — active Echo resource ability.
- `examples/mp23/brass-bell/content/item_siltglass_charm.json` — charged item reveal provider.
- `examples/mp23/brass-bell/content/map_yard.json` — sealed well (physical key, pick, force or Echo Hand).
- `examples/mp23/brass-bell/content/map_cistern.json` — remote pressure gate, secret conduit reveal, warded pressure trap, authored traversal, remote routine inscription.
- `tools/build-mp23-catalogues.mjs` — deterministic local proof builds for Brass Bell and the independent receiving adventure.
- `engine/world-of-maxxia/tests/exploration-mp23.test.mjs` — focused behavior, save, failure and contract tests.
- `tools/run-mp23-scenarios.mjs --production` — cross-runtime replay and cross-adventure item/class portability.

## Commands

From the source root with Node 22.18+ (the available test host ran Node 22.16):

```sh
node tools/build-mp23-catalogues.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/exploration-mp23.test.mjs
node --experimental-strip-types --test --test-concurrency=2 engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-local.json
npm run build:game
node --experimental-strip-types tools/run-mp23-scenarios.mjs --production
npm run verify:game
```

The separate AJV toolkit validation suite requires the missing npm `ajv` 8.17.1 dependency and must be rerun after restoring it; the native validators and composed-catalogue proofs were run. Windows/.NET editor and full visual/Chromium interaction were not tested here.

## Deliberate limits and follow-on work

MP23 cannot automatically reinterpret arbitrary Hexmaster prose, cast a spell at any world mesh, move walls/floors, simulate physics, or choose arbitrary free-form targets. MP24–25 handle generic scene/rendering and sprites; MP26 handles complex mutable geometry, MP27 illusions/puzzles, and MP28 regional travel. The original campaign's remaining bespoke scenes are scheduled for MP32. The two example adventures continue to use temporary existing art pending MP39–41.
