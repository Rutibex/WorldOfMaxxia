# Phase 7 — Fast Combat Interaction Contract

## Core loop

Encounter content lives in `src/shared/rules/combat.ts`, defined by stable encounter IDs and fixed enemy IDs. A new game seeds per-map enemy HP and coordinates. When the party is adjacent to a living enemy, `beginEncounter` rolls deterministic initiative for all living heroes and enemies in that encounter. This state is embedded in the versioned campaign save. Enemies occupy the existing perspective world; no tactical grid or separated battle scene appears.

The combat command grid replaces exploration controls in the same nine positions:

| Position | Key | Command | Phase 7 status |
|---|---|---|---|
| R1C1 | F | Quick Fight | deliberately deferred to Phase 8 |
| R1C2 | C | Cast | deliberately deferred to Phase 9 |
| R1C3 | A | Attack | one melee action with equipped starting weapon |
| R2C1 | U | Use | deliberately deferred to Phase 13 |
| R2C2 | R | Run | attempt withdrawal; party regroups at map entrance on success |
| R2C3 | B | Block | +4 defense against next attack targeting that hero; damage -2 |
| R3C1 | O | Quick Option | deliberately deferred to Phase 8 |
| R3C2 | I | Information | shared informational window |
| R3C3 | Q | Quick Reference | living party resources and vitals |

The acting party member is highlighted. Click target rows or press 1–3 to choose among up to three currently living enemies. Attack requires an enemy within Manhattan distance one. An invalid attack does not consume a turn or RNG. The existing party sheet uses STR for melee damage and DEX for ranged; Phase 8 adds specialized class passives. Combat targets use transient vector glyphs until final animated art production.

Exploration **Shoot (S)** checks an unobstructed forward lane to distance three, fires all conscious heroes with ranged starting equipment, and causes living targets from that encounter to advance a grid square by shortest path. As soon as an enemy reaches an adjacent square, the melee grid replaces exploration commands. Closed doors and solid walls block missiles and pathfinding.

Enemy turns move one cell toward the party or attack if adjacent. Each enemy uses a fixed attack, defense, HP, damage die and speed; hit rolls and damage rolls use the campaign RNG. Initiative is determined by ability/speed + d6, saved once at encounter start. The world clock advances for player actions and missile volleys. The session never calls `Math.random` for game rules.

Defeated enemy HP stays zero; clearing a group grants encounter-defined gold and XP **once**, with XP to conscious surviving party members. Cleared encounters never reappear. A failed withdrawal consumes a turn. Successful withdrawal repositions the party at the area's spawn square and takes five minutes; enemies remain persistent. Full-party defeat offers town recovery (half HP, eight hours, gold cost up to 50) or loading a previous save. Total-party defeat does not overwrite a viable autosave.

## Data and validation

- `CampaignState.version=2`, `combat.encounters` keyed by stable encounter ID, `combat.active` turn order/round/target/guards, `combat.defeated` boolean.
- `parseCampaign` explicitly upgrades an otherwise Phase 6 v1 document with no combat property to v2 and validates the entire result. Existing v1 slot names are unchanged. Future unknown versions are not migrated.
- All enemy positions must remain legal walkable cells in their own authored maps; HP is bounded by enemy definitions; clear/reward/turn state is validated.
- `src/shared/rules/combat.ts` never manipulates Phaser or DOM. UI simply dispatches commands, renders snapshots and autosaves validated state. This retains shared-rules testability.

## Intentional Phase 7 limitations

Temporary monster silhouettes (not the planned nine finished enemy animations), only three test encounters, one current encounter at a time, no missile ammunition/loaded-charge system, no caster actions or consumables, no customizable Quick Fight routine, no audible feedback, and no extensive AI. These remain scoped to subsequent phases.
