# MP22 — Monsters, behaviours and companions

**World of Maxxia runtime 0.67.0 · Maxxia Maker 0.22.0-mp22 · 7 November 2026.** This is a cumulative checkpoint. MP22 retains the original campaign, MP17 Brass Bell, MP18 effects, MP19 abilities, MP20 character creation and MP21 equipment/crafting. No live LLM/network service is required at playtime.

## Authoring contracts

Pack records are canonical JSON. Existing `maxxia-authored-monster` v1 documents and their legacy `aiPattern`/`abilities` continue to work. Optionally append a `behavior` object to a `monster` record; unknown fields are rejected. All monster IDs must be declared in the content index with complete cross-pack references. Monster appearances still use the existing visual atlas identifiers until MP25 and MP39–40.

```json
{
  "behavior": {
    "rules": [
      {"id":"call_spark","priority":100,"when":"hurt","action":"summon","kindId":"bell:monster:valve_spark","maxUses":1,"lifetimeRounds":3},
      {"id":"repair","priority":80,"when":"hurt","action":"heal","amount":2},
      {"id":"march","priority":60,"when":"distant","action":"approach"},
      {"id":"strike","priority":10,"when":"always","action":"strike"}
    ],
    "phases": [
      {"atOrBelowPercent":50,"title":"Damaged pistons release charged steam","attackBonus":1,"defenseBonus":0,"damageBonus":1}
    ]
  }
}
```

Rules are evaluated in priority-descending order with the rule ID as the deterministic tie-breaker. An eligible rule fires once per normal monster turn; an unavailable summoning slot, full HP for a heal, being adjacent for `approach`, or being out of reach for `strike` falls through to the next rule. All monsters with `behavior` require a safe unconditional `always` rule of `strike`, `guard`, or `approach` to avoid dead ends. Authored AI is separate from the older MM13 `abilities` weighted strike selection. No authored rule executes arbitrary code.

### Rule reference

| Field | Values/limits | Meaning |
|---|---|---|
| `id` | unique local snake_case | Deterministic ledger identity for limited summons |
| `priority` | 0–100 | Higher number evaluated first |
| `when` | `always`, `hurt`, `healthy`, `adjacent`, `distant`, `odd_round`, `even_round` | `hurt` is HP strictly below half; adjacent is Manhattan distance 1 or less |
| `action` | `strike`, `approach`, `guard`, `heal`, `summon` | One ordinary decision; other actions receive no extra turn |
| `amount` | integer 1–20, `heal` only | Heal self up to species maximum HP |
| `kindId` | installed monster ID, `summon` only | Spawnable support species |
| `maxUses` | integer 1–3, `summon` only | Per-summoner, per-rule usage ledger; save/reload stable |
| `lifetimeRounds` | integer 1–6, `summon` only | Support vanishes after this many encounter rounds |

Up to eight priority rules are allowed. At most three descending health thresholds can modify attack, defense and base damage by −5 to +5; the phase transition is announced once per threshold. The existing encounter-director phase/wave definitions remain independently supported. The older hardcoded Bell-Heart telegraph mechanic remains a legacy adapter until MP32; MP22 does not claim to remove it.

### Enemy summons

Summoned monsters are *targetable support units*, not full initiative actors. Each originating enemy can retain one living summon; the encounter limit is two. Supports assist their living owner with one bounded automatic strike on their owner's turn, and vanish on lifetime expiry, owner defeat, successful retreat or encounter completion. Their instance IDs and per-rule usage ledgers persist in the campaign save. They have **no separate turn, XP, guaranteed loot or corpse container**, preventing reward farming. Their HP and location are validated as ordinary bounded combat state. A command cannot inject one into the initiative list through a forged save.

### Hero companions

A granted, active, **self-targeted combat-only** ability can include a new operation:

```json
{
  "id": "bell:ability:call_chime_wisp",
  "name": "Call Chime Wisp",
  "description": "Summon a support ally for three rounds.",
  "context": "combat",
  "target": "self",
  "operations": [
    {"op":"summon-companion","kindId":"bell:monster:chime_wisp","lifetimeRounds":3}
  ],
  "activation": {
    "mode":"active",
    "classes":["bell:class:echo_sentinel"],
    "minLevel":1,
    "cost":{"id":"bell:pool:echoes","amount":1},
    "cooldown":{"clock":"rounds","amount":3}
  }
}
```

The full authored ability wrapper is `{ "format":"maxxia-authored-ability", "formatVersion":1, "id":"…", "record":{…} }`. In the pack content index, declare the ability's *class* and *monster* references; the companion species must be exported if the ability is exported. The sample uses `bell:monster:chime_wisp` (exported) and `bell:class:echo_sentinel` (exported). MP19 costs/cooldowns/character grants still control availability, and direct effect/routine bypass of grant-restricted abilities remains blocked.

Companions have an owner ID, summon species, HP, encounter ID, expiry round and last-assisted round. The cap is **two companions across the party and one per owner**, with one automatic strike per owner's ordinary action per round. They are neither roster characters nor independent bridge-crew-style turns. They are removed when their encounter ends, their owner falls, or the duration expires. Save/reload preserves active companion state. Temporary companion state is **not exported with a portable character**, while the character's granted companion-summoning ability is portable through the referenced pack definition.

## Playable examples

- **Silt Rat:** data-authored approach when distant, basic strike when adjacent.
- **Cistern Echo:** even-round defensive guard, otherwise approach/strike; a damage-phase shift under 50% HP.
- **Brass Sentinel:** on being hurt it calls one Valve Spark, later repairs itself, approaches or strikes. The Valve Spark is targetable, but provides no independent turn/reward.
- **Echo Sentinel:** gains the class-granted `Call Chime Wisp` ability; one-resource cost and three-round duration. Wisp acts as bounded, encounter-linked automatic support.

In the game Adventure Library choose **MP22 — Brass Bell Cistern: Monster AI, Summons and Chime Wisp**. For the receipt/portability proof, choose **MP22 — Companion-enabled Receiving Adventure**. New species, rules and ability are authored as ordinary JSON records; the runtime contains no branch keyed on the new MP22 example IDs.

## Reproduce validation and build

From the `Maxxia-Maker-MP22` source root, with Node.js **22.18+** for the supported distribution:

```bash
node tools/build-mp22-catalogues.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/monsters-mp22.test.mjs
node --experimental-strip-types --test --test-concurrency=2 engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-local.json
npm run generate:contracts
npm run check:generated
npm run build:game
npm run verify:game
node --experimental-strip-types tools/run-mp22-scenarios.mjs --production
npm run check:workspace
```

The fully independent toolkit semantic checks require AJV 8.17.1 from the root `package.json`; this offline environment lacks the dependency, so those checks must not be counted as passed. Platform-specific native Windows and graphical playthrough acceptance remain separate outstanding gates.

## Limitations and next phase

Companions are tactical support rather than persistent town NPCs or portable party members. They do not currently have complex ordered command trees, separate inventories, tactical tile turns, custom animation sets or dialogue. Enemy summon rules do not allow arbitrary scripting; they deliberately expose a small bounded vocabulary. Existing boss wave definitions and older resonance AI remain supported; final campaign-specific engine branch removal is MP32. MP23 should expand exploration capabilities and physical hazard/lock interactions using the same effect and capability systems.
