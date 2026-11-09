# MP11 shared simulation command and event contract

## Goal and exact scope

World of Maxxia's browser and headless test environment call `dispatchSimulation` in `src/shared/rules/simulation.ts`. This is an **engine-controlled execution boundary**, not a general-purpose content scripting language. It reuses the existing typed rules for Firstlight's movement, exploration, encounters, services, inventory, spells and party configuration. The browser handles rendering, input, consent prompts, file import/export and persistence only after an accepted simulation result. Command input contains no callbacks or executable strings.

The primary signature is:

```ts
function dispatchSimulation(
  source: CampaignState,
  registry: MapRegistry,
  command: unknown,
  options?: SimulationOptions
): SimulationResult;
```

A result has `state`, `status` (`applied`, `blocked`, `failed`), `changed`, `messages`, `events`, `presentation` and optional `errorCode`. Consumers **commit only `result.state`** if `result.status==='applied'` and `result.changed`. Invalid commands or a failed event cascade return the exact original `source` with a single `command.failed` event and no presentation side effects.

### Command families

| Type | Action / request | Rules implementation |
|---|---|---|
| `grid` | `forward`, `backward`, `strafe_left`, `strafe_right`, `turn_left`, `turn_right`, `interact` | `moveExpedition` plus Firstlight interaction/portal priority, caches, scenes |
| `expedition` | `rest`, `bash`, `lockpick`, `search` | Expedition and survival rules |
| `combat` | `engage`, `attack`, `block`, `run`, `mug`, `shoot`, `quick_fight`, `recover`, `target` | Combat simulation, initiative and RNG |
| `spell` | Canonical `CastRequest` | Exploration or combat spell rules |
| `learn-spell`, `ready-spell` | caster + spell identity | Magic progression and preparation |
| `item`, `loot`, `service` | Their existing typed command/request objects | Inventory, ground and NPC service rules |
| `party` | `select`, `exchange`, `prepared`, `quick` | Party selection, formation and combat preparation |
| `roll` | `min`, `max` bounded integer roll | Persisted xorshift32 RNG, increments `rollCount` |

All commands are validated at the boundary. Underlying rules remain responsible for domain prerequisites. UI-only interactions (opening an NPC menu or a loot panel) produce a `ui.open` event without changing the world. World-changing actions retain exactly the rule engine's existing clock and RNG costs. The original Firstlight story-specific priority rules remain in the shared adapter; these will be replaced with authored equivalents in later phases.

### Typed output events

`command.accepted`, `command.blocked`, `command.failed`, `message`, `state.changed`, `time.advanced`, `rng.advanced`, `position.changed`, `combat.changed`, `ui.open`, `roll.result`, and `presentation`.

For each accepted action, events are produced in a stable order: `command.accepted`, any action-specific event (such as `ui.open` or `roll.result`), then changed-state summary, clock/RNG delta, location delta, combat delta, readable messages and transient presentation. Their relative order is deterministic. `presentation` events are **never saved** in campaign files: they only instruct the browser to animate and sound the corresponding accepted action. The browser read-only `window.__MAXXIA_DIAGNOSTICS__.simulationTrace` contains up to 32 recent commands, statuses, event types and RNG snapshots (not a writer API).

### Trigger ordering and failure semantics

A trusted engine caller may pass `SimulationTrigger`s with `id`, numeric `priority` and `onEvent` function. Triggers are evaluated in ascending priority then lexical ID order. Emitted follow-up commands are queued FIFO after the current command's events. Every command and triggered action is validated before execution. The dispatcher stages **the whole command cascade**, so a blocked follow-up, invalid state, exception or budget overrun discards earlier staged mutations and returns original state. The failure event contains only an error code/reason, not partial rewards.

Caps: at most **16** commands per cascade, **128** events, **64** trigger calls and **32** registered triggers. Callers may lower but cannot raise these limits. These limits are intentionally conservative for MP11. **Author packs may not register JavaScript triggers.** In MP12, their actions will be expressed through bounded data-only conditions/actions/routines, mediated by this same boundary.

### Headless proof

Run from the cumulative source root (Node 22.18+ recommended):

```sh
node --experimental-strip-types tools/run-mp11-scenario.mjs examples/mp11/basic-commands.json
npm run check:mp11
npm run test:game
npm run build:game
npm --prefix engine/world-of-maxxia run verify:build
```

The replay tool intentionally uses the fixed Firstlight map fixtures. It accepts a small JSON envelope of type `maxxia-simulation-commands`, `version: 1`, an ordered `commands` array (maximum 100), and optional basic `expect` assertions. Its deterministic digest covers the end state and event trace. It does **not** implement MP35's general scenario/reachability DSL or validate arbitrary packs' map scripts.

A typical call inside tests:

```ts
const result=dispatchSimulation(campaign,registry,{type:'grid',action:'forward'});
if(result.status==='applied' && result.changed)campaign=result.state;
```

### Compatibility, ownership, and limits

- Gameplay save **v18**, instance envelope **v2**, roster **v1**, transfer receipts **v1** and MP10 upgrade journal **v1** remain unchanged.
- MP07 campaign instance state is stored separately from immutable definitions; UI saves only confirmed state. No pack definitions are mutated.
- The MP04 Brass/Glass content fixtures still reuse Firstlight maps; their authored maps/scripts do not execute as standalone adventures yet.
- Diagnostic developer controls, startup/campaign creation, transfer receipts, pack migration and save loading are not simulation commands; they retain their dedicated permission/persistence layers.
- Manual browser/Chromium acceptance remains unverified on this host. A successful headless/TypeScript/HTTP run is not proof of rendered gameplay correctness.
