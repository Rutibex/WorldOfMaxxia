# MP18 — Unified effects and extensible conditions

Runtime **0.63.0** · 7 November 2026 (America/Toronto)

MP18 introduces a bounded effect kernel shared by data-authored effect bundles, charged items, exploration object routines and authored condition primitives in composed spells. Pack-defined conditions now affect heroes and enemies, combat and exploration, saved games and portable character copies. The original six conditions and existing spell behaviours remain supported; this phase adds shared adapters rather than rewriting every legacy special case.

## Try the laboratory

The browser release is prebuilt. With Node22.18+, run its launcher, open the printed local address and visit `/effects.html`. From the source package run `npm run build:game` and `npm run start:game`. No external service is needed to play.

The party starts at (3,4), facing the basin at (3,3). Interact → Use applies **Silt Fever** to the selected conscious hero. The character sheet uses its authored name; its attack and defense fall by1 per stack. Each elapsed game minute deals poison damage until the duration expires. Reading menus and journals does not tick it.

The restorative fountain at (2,4) dispels matching conditions and heals20 HP. The box at (4,4) contains a three-charge vial that applies exactly the same Fever through the item system. Opening and claiming the box uses ordinary object controls. The basin applies after its normal interaction time; item use outside combat and direct laboratory effects currently add no exploration time. Spells retain their normal casting time, so an application before that time advance can immediately consume one minute of duration.

Information (I) → **Shared Effects** exposes the enabled bundles. Choose a hero or enemy in its target selector when the bundle requires one. This is the MP18 primitive surface; resource costs, class eligibility and progression grants are MP19. Effects in combat must be invoked by the current hero and consume the normal item action. The target selector does not bypass context, target or turn validation.

| Laboratory bundle | Result |
|---|---|
|Apply Silt Fever|Four minutes; stacks to3; attack/defense−1 per stack and1 poison damage per stack per minute |
|Clearblood Ward|Eight-minute toxic-tag immunity, poison resistance+50 and save modifier+1 |
|Cleanse Toxic Effects|Dispel conditions tagged toxic, preserving unrelated wards |
|Restorative Wash|Dispel magic/curse/toxic tags, then heal20 HP |
|Test Per-Minute Saves|A CON save at DC10 before each poison tick; early success ends it |
|Poison Pulse|Four poison damage before resistance |
|Curse the Practice Sentinel|Three global combat rounds of Tremor: attack−2 and defense−1; CON DC18 at application |

Clearblood prevents later incoming toxic conditions; it does not automatically remove a condition already present. Cleanse handles that separately. Immunity produces an explicit outcome and consumes no saving throw. Invalid context/target/item use rolls back, including charges. A valid saved, immune or no-match effect reports that outcome and still consumes its normal combat action or item charge.

The practice sentinel is near (5,2). Move east to (4,4), north to (4,3), then north to (4,2) to trigger it. Fight, then select its enemy target for Tremor. Blocking through several global round-ends demonstrates expiry; ordinary attacks finish combat. The proof traverses this route, saves and reloads it through real campaign instance storage.

## Data contracts

New records use existing content kinds: **condition** for immutable condition definitions and **ability** for effect bundles. The ability payload is deliberately only the effect contract in this phase; MP19 adds resource/progression activation rules. Their formats are `maxxia-authored-condition` and `maxxia-authored-ability`, formatVersion1, with matching wrapper/record IDs. Conditions and bundles use namespace components and names up to32 characters.

| Condition field | Contract |
|---|---|
|clock|minutes, rounds or persistent |
|maxDuration|1–60; finite applications cannot exceed this; persistent applications use null remaining time |
|stacking|refresh, extend, stack or reject |
|maxStacks|1–3; non-stack policies require1 |
|tags|Up to8 named tags used by immunity |
|immuneTags|Incoming conditions with a matching tag are blocked |
|dispelTags|A matching dispel may remove this condition |
|modifiers|Attack/defense/save each−5 through+5 per stack; resistance bonuses−50 through+50 by damage family |
|periodic|Optional damage1–10 per stack per clock tick; persistent periodic damage is rejected |
|save|CON, DEX or WIS; DC1–30; at apply, minute or round-end; timing must match the clock |

Refresh replaces remaining time with the new application duration. Extend adds durations up to maxDuration. Stack increments up to maxStacks and refreshes duration, including at the cap. Reject returns already-active without another application save. Different condition IDs can coexist up to16 per target. Attack, defense and save totals are clamped to±10; condition resistance totals to±50, and final ordinary resistance to−50 through75.

Effect bundles define a name, description, context (combat/exploration/both), target (self/hero/party/enemy/enemies) and1–8 ordered operations. They accept conscious active-party heroes and living enemies in the current encounter. Dead or inactive targets are unavailable; this contract does not silently revive or target a reserve.

| Operation | Fields and result |
|---|---|
|condition|conditionId and duration; uses definition clocks, stacking, immunity and saves |
|damage|amount0–100, damageType; optional ability/DC saving throw with half boolean |
|heal|amount0–100; clamps to current maximum HP; no revive |
|dispel|One or more tags and max1–16; removes matching authored conditions in stored order |

Typed direct damage uses physical/fire/cold/lightning/poison/arcane/holy/necrotic families and rounds positive resisted damage upward. A successful damage save negates damage or halves the raw integer amount before resistance. Composed spell damage retains its existing monster-resistance rounding. Hero/enemy attack and defense paths now include the authored modifiers; spell saves include save modifiers. Legacy special effects such as binding, party wards and original status cures retain their supported rules. New tag-based dispels operate on authored conditions, not arbitrary legacy spell-state entries.

Targets are resolved once per bundle; operations then execute in order. An earlier death yields fallen outcomes for later operations on that target. A later invalid operation fails the enclosing transaction and restores earlier HP, conditions, RNG, scope and charges. Kernel work is bounded to128 target operations and256 saves per invocation; clock settlement is bounded to1024 condition ticks and256 saves. Excessive work fails the whole command, rather than dropping unprocessed time. Existing simulation/routine command and event limits also apply.

## Time, saves and persistence

Minute conditions use **game time**, not wall-clock time. Before each minute tick, an eligible per-minute save is rolled; success ends the condition before periodic damage. Otherwise damage applies, then remaining duration decrements. Large time advances process every eligible tick up to the authored remaining duration, under the shared budget. Reserve hero timers are paused; active heroes and placed enemies use the campaign clock.

Round conditions use **global combat round-end**, not each actor's action. Round-end saves precede damage and decrement. The upcoming end of the application round counts toward duration. Round conditions require active combat and are cleared when combat ends. Active enemies and heroes tick; unrelated off-map enemy round conditions do not tick in another fight. Persistent conditions never decrement and require an explicit matching dispel or authored removal. Authored conditions are also cleared on a target’s death.

Condition saving throws use the campaign's serialized RNG. Round-end saves share the same in-flight stream as combat attacks and initiative. Menu reads do not roll. Periodic damage reconciles ordinary combat victory, boss-wave progression, corpse loot and defeat through existing combat settlement; rewards are not duplicated.

Saved condition instances retain id, remaining, unit and optional stacks. Hero conditions share the existing character collection; enemies gain an optional conditions collection. Minute bookkeeping uses optional `magic.effectClock`, a processed campaign-minute marker. Unknown definitions, invalid clocks, excessive durations/stacks and round conditions outside combat are rejected. They are not erased from an unreadable save.

Gameplay save18 and instance envelope2 remain unchanged. Older saves with no authored statuses need no new fields. Definition dependencies stay in the catalogue identity. Renaming IDs, changing clocks or changing existing condition semantics requires explicit MP10 migration. Keep missing-provider saves intact until their original definitions are restored.

Portable exports with definition snapshots now include active authored condition definitions and provider versions. Explicit cross-catalogue file copies require exact matches, retain remaining duration/stacks and start their minute ledger at destination time. Local MP09 receipt transfers also initialize that ledger when needed. Existing legacy files without authored conditions remain supported. This does not grant permission to silently reinterpret conditions under a different pack.

## Items, objects, spells and queries

A composed item uses `effect: "composed"` plus `effectId` referencing an ability definition. The ordinary inventory system still owns charges, active-hero checks and action timing. Its descriptor must declare the effect reference; the effect must declare every condition reference. Exports must satisfy the normal closure rules.

An exploration object calls a routine containing:

```json
{"op":"effect","effectId":"effect_lab:ability:fever"}
```

The selected conscious hero is the caster, with the selected hero as the default target. An optional targetId can name another supported hero. Routine/object effect hooks are exploration-only in this phase; combat use goes through the effect command or ordinary item activation so it spends a real action. The enclosing object/routine transaction owns rollback.

A composed spell condition primitive may name the authored conditionId, preserving its existing caster, SP payment and spell targeting rules. The requested unit/duration must agree with the installed definition. Original six-status project condition databases remain compatible; new pack definitions go through the condition payload contract.

Shared condition expressions now support:

```json
{"op":"eq","left":{"query":"has-condition","conditionId":"effect_lab:condition:silt_fever"},"right":true}
```

An optional targetId checks another hero or current encounter enemy; otherwise the selected hero is used. Missing targets return false. This query is usable in routines, dialogue and quest conditions, with ordinary declared condition references. Typed `effect.applied` outcomes and `condition.changed` events expose applications, immunity, saves, dispels, expiry and updates to the shared command/event boundary.

## Authoring and checks

The complete example is `examples/mp18/effect-lab`, with its compiled catalogue alongside it. It contains four condition definitions, seven bundles, two exploration routines, one charged item, one map and one encounter. Use its JSON as working authoring examples; schemas are `toolkit/schemas/condition.schema.json` and `ability.schema.json`.

```sh
node tools/maxxia.mjs validate examples/mp18/effect-lab --engine 0.63.0
node tools/maxxia.mjs build examples/mp18/effect-lab --engine 0.63.0 --out examples/mp18/effects.maxxia-build.json
npm run check:mp18
npm run check:game
node --test toolkit/tests/*.test.mjs
npm run build:game
npm run verify:game
node --experimental-strip-types tools/run-mp18-scenarios.mjs --production
```

The example uses ordinary commands for object/item applications, immunity, resistance, dispel, saves, combat expiry, victory and save/reload. Full source/built state, scope, RNG, messages and events compare exactly. MP17's Cistern and receiving fixture and all earlier examples remain included.

Native Windows/.NET and interactive visual acceptance are not claimed. Automatic approval review blocked cloud-browser inspection because serving the local project to that browser could expose it externally. Local build, tests, HTTP delivery and production-module replays remain the verification evidence. MP19 is next: abilities, resources and progression.
