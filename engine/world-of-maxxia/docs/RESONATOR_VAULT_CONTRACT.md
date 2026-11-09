# Phase 18 — Resonator Vault and Ending Contract

## Scope and content anchors

- **Three connected, saved areas:** Bellwether Quay (`map_town`), Upper Cistern (`map_diagnostic_galleries`, historical save-compatible ID), and the **16×16 Resonator Vault** (`map_resonator_vault`). All areas have their own exploration, door, and object states.
- **Upper stair (13,13):** after reading Copper `(2,2)`, Moon `(8,2)`, and Glass `(13,3)` inscriptions, interact once to unlock the lower stair; interact again to travel to the vault, arriving `(2,13)` facing north. Return using the stair at `(2,13)`.
- **Lower landmarks:** maintenance score `(6,10)`; rest alcove `(3,11)`; valves `(6,8)`, `(7,8)`, `(8,8)`; echo shrine `(3,4)`; bypass corridor `(11,10)`; guarded threshold `(12,4)`; Custodian `(12,2)`; regulator `(13,2)`. Shortcut at the regulator leads upstairs only after the regulator has been collected.
- **Environmental obstacles:** one quest-sealed chamber door, one discoverable secret, two traps, one daily-use fountain, two treasure caches, four vault encounters. The earlier two maps and their encounters remain functional.

## Quest stages and safeguards

1. Iona's assignment and brass key: unchanged.
2. Enter Upper Cistern: unchanged.
3. Read three bell inscriptions and unlock the resonator stair; travelling into the new vault completes MQ03.
4. Enter the three valves in **Copper → Moon → Glass** order. Incorrect operation resets the combination and costs up to three HP for each living hero **without killing them**. Successful alignment opens `door_bell_heart_seal` and completes MQ04. The door is protected from Bash and Unseal before the sequence is complete.
5. Face the Bell-Heart Custodian, a 65-HP boss, in the northeastern chamber. Boss follows a three-round telegraph → resonant discharge → recovery cycle; Block reduces the special damage and the boss becomes easier to hit during recovery. Run/Smoke Bomb are disabled inside this encounter. Its victory rewards are one-time. Inspect the regulator `(13,2)` after defeating it to record the protected plot item and complete MQ05.
6. Travel upstairs and back to Iona `(8,8)`. Choose **Repair** or **Disconnect**. Either grants **150 gold + 200 XP per active party member**, records its own ending epilogue and finishes MQ06. A second ending choice cannot be selected; side quests remain available.

### Optional side quest: Nera's Bottled Echo

- Accept the request from Nera Salt at the Priest guild `(6,3)` in town.
- Find the Echo Shrine at `(3,4)` in the vault. A nonviolent interaction collects its intact bottled memory; the shrine's western route also contains a Bell Wraith encounter. The echo is a protected plot item, not an ordinary inventory stack.
- Return to Nera to receive **50 gold + 75 XP per active character**, once. The request is not blocked by boss victory or the ending.

## Enemies, loot and persistence

- Three existing ordinary enemy definitions remain unchanged. Five new types: Cistern Rat, Sludge Leech, Pipe Goblin, Bell Wraith and Valve Sentinel. Bell-Heart Custodian is the final boss.
- Four seeded vault encounters: drain, engine, echo passage, boss. Rewards and ground overflow follow the existing one-time inventory engine. Existing named reward definitions are reused; final bespoke visual art is still a later phase.
- Campaign version is now **v13**, with chained migrations from v1–v12. Phase 17 v12 migration appends the lower map, encounter seeds, valve sequence and ending state; it never resets upper floor quest completion, combat results or treasure claims.
- Validators enforce map, encounter, item and quest consistency; boss gate state must match the completed valve flag, and claimed regulator progress requires the Custodian to have been defeated.

## Presentation and outstanding tasks

The existing first-person Xeen-style dashboard is used for all three floors. Important clues, boss telegraph and the ending appear in readable interface text, including journal Auto Notes. Environment art, enemy frames, and music are still temporary/reused diagnostic assets. Phase 19 remains character creation and advancement; Phases 20–31 replace art/audio. A full graphical playthrough is not claimed without successful browser automation or manual testing.
