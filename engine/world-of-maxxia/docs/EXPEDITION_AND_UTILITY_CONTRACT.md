# Phase 14 — Expedition/Utility Interaction Contract

## Clock and survival
- Shared campaign clock begins at 08:00, day 1. `elapsedMinutes` remains authoritative; map-local `minutes` tracks movement/rest/interaction for compatibility.
- `expedition.settledAtMinute` prevents time conditions from being processed twice across scene updates, saves and imports. `lastMealAtMinute` controls hunger; hunger starts 24 hours after the last camp meal and remains until fed.
- Eight-hour rest spends six food portions for six active members; requires at least one living hero, no active combat and no monster within three Manhattan steps. It replenishes the HP/SP of living heroes but never resurrects. Timed conditions and buffs advance. Camp failure is free.

## Environmental interactions
- A single `Space` action prioritizes portals and inventory caches before expedition interactions (secrets, traps, fountains), then ordinary doors/scenery. Door bashing is a separate `B` action.
- Face a secret `#` tile and interact to reveal it; it becomes traversable and collides correctly with perspective rays and enemies. A revealed wall persists under its secret ID.
- Disarm a face-on trap using the first living hero's DEX modifier plus a seeded d20 versus stored DC; the successful flag is persistent. Failure costs a minute but leaves the trap armed. Stepping on an armed trap triggers one save and damage, marks it permanently triggered and records the RNG.
- Fountains can heal finite HP/SP to living heroes once per in-world day and do not resurrect. If the party has no missing HP/SP, fountain activation is free.
- Bash with the first two living heroes' STR modifiers and a seeded d20. Open or quest-sealed targets cannot be smashed, and invalid bashes do not advance time. Failed attempts do one HP to the first contributor and cost one minute.

## Automap and feedback
- Recorded visited cells persist between map travel and saves. Fog-of-war displays only those cells and the immediate adjacent walls; Glass Eye temporarily reveals nearby unknown geometry with no changes to the visited array.
- Door states, found secret passages, visited fountains and discovered traps are encoded visually. In a detected combat encounter the upper-right map yields to the target list as before.
- Corner gems reflect positive elemental resistance among living heroes, not invented global immunities. The central compass remains functional, the crown reacts to danger and discovered passages, and portrait conditions remain visible.

## Persistence
- Campaign v9 adds `expedition` and map `secrets`, validates keys against map-authored stable IDs and checks time/day consistency. Legacy v8 map states are populated with undiscovered secret flags; item instances and prior state remain unchanged. Unknown/forged IDs or incomplete data cause validation failure; no automatic deletion of corrupt browser slots.

## Out of scope
- Final town/dungeon authored content, secondary skills, full service NPCs, spell merchant economy, audio and final animation are owned by later phases. No general survival crafting or new extra combat resources were added.
