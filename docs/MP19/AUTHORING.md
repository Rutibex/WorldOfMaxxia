# MP19 — Abilities, Resources and Progression

**Cumulative runtime 0.64.0 · workspace 0.19.0-mp19 · 7 November 2026**

MP19 adds class- and level-restricted active, passive and triggered abilities on top of MP18’s atomic authored effect operations. Authoring remains JSON; no adventure-specific engine branches are introduced. Existing authored effect bundles **without** `activation` continue to behave as MP18 effects in the laboratory, objects, items and scripted mechanisms. **Character abilities with `activation` cannot be invoked through unrestricted effect, item, or routine calls.**

## Run the demonstrations

In the supplied **browser archive**, use `Start-World-of-Maxxia.cmd` on Windows or `sh start-world-of-maxxia.sh` on Unix with Node 22.18+ and visit the URL the launcher prints. `/cistern.html` launches the existing Brass Bell Cistern (MP17 default pack); the MP19 upgraded Bell pack is provided as a separately installed build, not automatically installed into every old campaign. The launcher’s Adventure Library includes an **MP19: Brass Bell Cistern** link to the upgraded pack and also serves `/mp19-proof/brass-bell.maxxia-build.json` and `/mp19-proof/receiving.maxxia-build.json` for importing into the pack library, with both packs authored without hard-coded engine IDs. **Existing saves must retain their resolved old pack versions** until deliberately migrated via MP10.

From the source archive (after installing npm dependencies where available):

```sh
node tools/build-mp19-catalogues.mjs
npm run check:mp19
npm run run:mp19
npm run test:game
npm run build:game
npm run verify:game
node tools/maxxia.mjs validate examples/mp19/brass-bell --engine 0.64.0
```

For **headless use with no npm install**, run `node --experimental-strip-types --test engine/world-of-maxxia/tests/abilities-mp19.test.mjs`. The production-parity replay compares source and built browser simulation using a deterministic combat fixture. The example test composes both catalogue builds, creates a Bellwarden, plays abilities through the same simulation command path as the browser, trains the character, serializes and reloads it, and imports a definition-bound copy into the receiving-yard adventure. `npm run check:mp19` runs only that dedicated test suite and the build-reproducibility proof.

## Authored record contract

`kind: "ability"`, `format: "maxxia-authored-ability"`, `formatVersion: 1`, and namespace-qualified `id` such as `bell:ability:resonant_guard`. The `record` retains MP18 fields: `name`, `description`, `context` (`combat`, `exploration`, `both`), `target` (`self`, `hero`, `party`, `enemy`, `enemies`) and ordered `operations` (`condition`, `damage`, `heal`, `dispel`). MP19 introduces optional `activation`:

| Activation property | Implemented meaning |
|---|---|
| `mode` | `active`, `passive`, or `triggered` |
| `classes` | Exact class IDs eligible for grants; case-sensitive and pack-qualified |
| `minLevel` | Minimum class level, 1–20; there is no custom XP table in MP19 |
| `resource` | Optional named pool declaration: `{id,base,perLevel,maximum,recovery:"rest"}` |
| `cost` | Optional `{id,amount}`; paid after successful effect evaluation in a staged transaction |
| `cooldown` | Optional `{clock:"minutes"|"rounds",amount}` |
| `passive` | Passive-only bounded `attack` and `defense` modifiers |
| `trigger` | Triggered-only `block`; executed at most once per eligible block/cooldown, under a bounded list of eight candidates |

A pool’s maximum is `min(maximum, base+(level-1)*perLevel)`. An absent per-character pool entry means its full level-appropriate maximum; once spent, current values are saved on `hero.abilityState.pools`. `abilityState.cooldowns` records ready-at game minutes or a character combat-round clock. `abilityState.learned` is an optional stable list for externally granted abilities, persisted and validated; MP19 provides class-level automatic grants, **not yet** a full player-facing ability-purchase UI. `refreshLevelResources` applies new capacity on training, and eligible pools with `recovery:"rest"` refill on successful rest. No new arbitrary time source or API access is permitted.

An *active* ability is activated with the normal simulation command: `{ "type": "ability", "abilityId": "bell:ability:resonant_guard", "casterId": "<current hero id>" }`. It validates a conscious active hero, class/level grant, effect context and target, enough resources, cooldown, and current combat turn. In combat it uses exactly the ordinary item-action turn boundary. Failed validation or effect work rolls back state, resource payment, turn and seeded random draws. Passive benefits are included in derived attack/defense without creating turns; their `operations` must be empty. Triggered `block` activations happen inside an accepted block command and create no extra turn. They still obey grant, cost and cooldown rules.

The new ability JSON Schema is `toolkit/schemas/ability.schema.json`; the canonical runtime checks are in `src/shared/content/effect-definitions.ts` and `src/shared/rules/abilities.ts`. Editing a shipped definition or changing a provider version can invalidate an existing saved/copy dependency and requires explicit migration. Do not hot-swap definitions during combat.

## Three Bellwarden abilities (MP19 upgraded example pack)

| Ability | Unlock | Mechanics |
|---|---|---|
| **Resonant Guard** | Level 1 | Spend 1 Resonance and a normal combat action to apply +2 Defense for two global combat rounds; 2-round cooldown |
| **Counter-Chime** | Level 2 | Automatically heals 1 HP on a successful block, with a two-round cooldown and no bonus action |
| **Stillwater Stance** | Level 3 | Passive +1 Defense, added to derived stats only once |

The shared **Resonance** resource starts at 2, adds 1 to its cap per level, maxes at 6 and refills on eligible rest. The pack version is `bell@1.1.0`. Its content files are `examples/mp19/brass-bell/content/ability_*.json`, `condition_resonant_guard.json` and the upgraded `class_bellwarden.json`. The original MP17 Bell pack remains in `examples/mp17/brass-bell` and is intentionally not modified. The receiving-adventure build composes `core + bell@1.1.0 + receiving-yard`, permitting dependency-verifiable cross-adventure class and ability use.

## Persistence and portability

The gameplay save remains version 18 and the instance envelope remains 2. Newly added `Character.abilityState` is optional in old saves. Pool/cooldown values, learned IDs and the combat-round clock survive campaign serialization. Portable-copy definition snapshots include class-granted abilities and provider versions. Copies fail on mismatched definition snapshots or missing/incompatible providers rather than silently losing features. Consumables/legacy items with normal MP18 effects remain unaffected.

## Important bounds and deferred work

This is **not** full general-purpose race/class creation (MP20), crafting (MP21), AI action selection (MP22), or novel exploration capability targeting (MP23). MP19 supports bounded passive combat modifiers, a block-based trigger, named rest-recoverable resources, cost and cooldown checks, and existing MP18 operations. Custom action templates or new trigger names are **not** supported through arbitrary scripts. The character editor/selection UI for learning elective skills remains future work; `learned` is an internal extensibility/persistence field for later grants. The shared Effects dialogue displays active character abilities and optional status text, but remains a developer-oriented panel; the original laboratory's ungated legacy effects stay accessible when installed.

## Acceptance evidence and limitations

Locally rechecked: 794/794 gameplay tests, 12/12 MP19-specific tests, strict offline TypeScript client compilation, deterministic demonstration catalogues, source-versus-production MP19 parity replay, offline browser build, and 600-file HTTP delivery verification. The demo verifies resource/cooldown payment and failure, class/level grants, passive scaling, block reactions, save/reload, portable-copy provider integrity, validation and rejected combat-turn bypasses. The separate AJV-based toolkit test and CLI validation suite **could not be rerun** because npm offline cache lacks `require-from-string`; `npm ci --offline` fails. All MP19 example ability records were independently checked with Python’s JSON Schema validator, and both catalogue proofs are verified by the production catalogue verifier in the tests. The interactive graphics review and native Windows/.NET editor verification remain unverified.
