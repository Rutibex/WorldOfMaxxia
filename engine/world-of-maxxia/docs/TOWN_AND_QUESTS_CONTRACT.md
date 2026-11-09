# Phase 16 — Bellwether Quay Town and Quest Contract

The locked Phase 1 demo specification calls the authored town **Bellwether Quay**. Earlier prototypes used **Firstlight Village**. The release presents the village as Bellwether Quay's *Firstlight Ward*, retaining stable identifiers and the Firstlight Well while using the original formal town name. This is original **demo lore**, not established Hexmaster canon.

## Coordinate contract and navigation

- Town ID `map_town`, **16×16**, origin at NW, north decreases Y, spawn `(7,12)` facing N.
- Services (standing on or facing adjacent square, Space): Tessa `(4,11)`; Orro `(10,11)`; Sister Vale `(4,6)`; Captain Brann `(11,6)`; Pell Glass `(2,3)`; Nera Salt `(6,3)`; Aunt Vell `(10,3)`; Iona Reed `(8,8)`.
- The old cistern entrance is `(13,2)` and requires the **brass cistern key** acquired from Iona. Key is a plot item, not a character-inventory item. The original dungeon map ID `map_diagnostic_galleries` is retained until Phase 17 replaces its temporary art/content. Return portal now lands at `(13,2)`.
- Town has two ordinary gate doors (the original persistent `town_north_gate` and `town_south_gate` IDs). The street network has loops linking all service locations; the perimeter is solid.
- Environment discovery: nine unique named landmark scenes (old foundry, river steps, south notice, clock arch, stalls, well, cistern stair, lantern alley, survey marker), first inspection consumes one minute, writes one note; subsequent inspections do not duplicate notes. NPCs and quest notes are reached through the existing dialog and V journal.
- Full automap: discovered services marked T/M/H/L/G/Q; fog of war remains in effect. Not a quest-GPS overlay.
- Town has **no active enemy encounter**. The previous `enc_town_patrol` stable encounter ID is retained but now belongs to the existing diagnostic dungeon map to avoid breaking saved encounter IDs.
- Firstlight Well `(7,7)`: once per **campaign**, full HP/SP for living heroes only, explicit confirmation when healing is needed. Other experimental dungeon fountains retain their once-per-day refill.

## Quest state schema

`CampaignState.quests` now includes:

- `flags`, `notes`: prior fields retained; notes from rumors and Witch magic continue to work.
- `mainStage`: `0` before Iona, `2` once the key is given, `3` once the key-bearing party enters the upper galleries. Higher stages are reserved for content in Phases 17–18.
- `completedStages`: strictly consecutive `quest_main_01` through current stage minus one. Completed stages remain visible under V → Completed.
- `optional`: three defined quest IDs, with `available|active|ready|completed` status. Phase 16 offers the quests, but does **not** grant dungeon objective items or rewards early.
- `questItems`: critical quest objects live **outside** inventory, cannot be sold/dropped or consume bag capacity.
- `seenScenes`: one-time map-scene discovery IDs.

### Main stages (6)

1. MQ01 `quest_main_01`: hear Iona’s request.
2. MQ02 `quest_main_02`: receive the brass key and enter the upper cistern.
3. MQ03 `quest_main_03`: learn the regulator sequence and descend (Phase 17).
4. MQ04 `quest_main_04`: reset the valves and enter the deep chamber (Phase 18).
5. MQ05 `quest_main_05`: defeat the Bell-Heart Custodian and recover the regulator (Phase 18).
6. MQ06 `quest_main_06`: return to Iona and choose repair/disconnect ending (Phase 18).

### Optional quests (3)

- SQ01 `quest_optional_ledger`: Tessa’s lost ledger, upper secret room (Phase 17).
- SQ02 `quest_optional_tools`: Orro’s missing tool roll, trapped cache (Phase 17).
- SQ03 `quest_optional_echo`: Nera’s bottled echo, vault shrine (Phase 18).

Phase 16 delivers acceptance, descriptions, quest ledger navigation and stable statuses, *not* simulated dungeon resolution or early rewards. All progress is monotonic; repeated conversations do not grant duplicate objects or notes. The journal categories Current Quests, Quest Items, Auto Notes, and Completed are opened with **V**, paginated using previous/next buttons, and preserve mouse/key equivalence to other overlays.

## Persistence and migration

Campaign save **v11**, with intact browser storage keys and JSON import/export. v10→v11 transforms the previous 11×11 town geometry to the new 16×16 map: existing valid walkable town cells and visited cells are kept; newly obstructed legacy positions relocate to `(7,12)`, and blocked old discovery cells are dropped. All dungeon state, items, abilities, spell knowledge, combat progression, bank/merchant stock, RNG and clock remain unchanged. Old Iona acceptance becomes main stage 2 with its brass key. Unknown future versions, invalid plot-item combinations, duplicate scene IDs, contradictory stage flags, and malformed states are rejected. Earlier migration chain (v1–v10) remains supported.

## Acceptance and deferred work

This phase passes when every town service is reachable, the main key gate works, all four journal tabs display accurate persisted data, town discoveries are idempotent, and older saves survive the structural map expansion. Phase 17 provides the authored upper cistern map and dungeon objective logic; Phase 18 supplies lower cistern, resolution and rewards. Dedicated town art/animated service scenes remain in Phases 20–24.
