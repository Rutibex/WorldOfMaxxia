# Phase 17 — Upper Cistern Dungeon Contract

## Design scope

This is **original Maxxia demo lore**, not a claim about an existing tabletop location. The authored first dungeon floor is 16×16 and preserves internal stable ID `map_diagnostic_galleries` for compatibility with the existing save chain. Display name: **Upper Cistern — Bellwether Waterworks**. Position coordinates are `(x,y)` with `(0,0)` at NW; facing north decreases y. No lower-floor tiles are created prematurely. All remaining diagnostic room names in historical code are stable technical IDs only.

## Routes and landmarks

- Enter from Bellwether Quay at `(13,2)` with Iona's brass key. Party arrives upper floor `(2,8)`, facing east. The return portal is `(6,8)` and targets the town entrance.
- The earlier two doors at `(4,8)` and `(4,2)` remain stable and retain their persisted open state. New doors at `(10,5)` (pump grate), `(10,3)` (bell archive, DC 15), and `(12,11)` (tool ward, DC 12). All can be opened/forced using ordinary rules; no quest-locked hard stop.
- The old secret `(4,7)` and new shortcut `(10,12)` are optional exploration connections. A new hidden ledger arch `(5,12)` enters an enclosed western archive at `(4,12)`. Face the arch from `(6,12)` and press Space to open, then walk inside.
- **Main quest clues**: Copper bell at `(2,2)`, Moon plaque at `(8,2)`, Glass diagram at `(13,3)`. First inspection appends distinct persistent journal notes, at one world minute each. Their order can be discovered freely; the correct sequence is **Copper → Moon → Glass**.
- **Lower stair**: `(13,13)`. With all three inscriptions recorded and MQ03 active, inspecting it once records `flag_upper_descent_ready`. MQ03 remains active because actual descent and MQ04 will be implemented when the Phase 18 Resonator Vault exists. No fake destination or ending is presented.
- **Optional ledger**: Tessa's request must be accepted. Find item `(4,12)` behind the concealed wall; collect it with Space. This records `item_quest_tessa_ledger` independently of ordinary inventory and sets status `ready`. Return to Tessa at `(4,11)` in town and use **Return the lost ledger** to complete once (+25 gold, +60 XP per active member).
- **Optional tools**: Orro's request must be accepted. Reach `(12,12)`, search/disarm the `upper_tool_snare` from an adjacent facing tile, or endure the trap by stepping onto it before collecting. Return the plot item to Orro at `(10,11)` in town for +40 gold and +60 XP per active member once.
- Nera's bottled echo is still a Phase 18 quest; no echo is awarded in this phase.

## World content

- Five standard doors, three secret passages, five traps, two daily-use fountains, thirteen authored scenery/interactive compositions, three original old-area caches plus two new caches, and six persistent encounters total (three established + three new on the eastern/southern branches). Enemy kinds remain the mechanically implemented Imp, Mite, Watcher; visual/roster expansion happens with the complete lower floor and art phases.
- New encounters: `enc_upper_pumps`, `enc_upper_archive`, `enc_upper_sluice`, each with one-time rewards and retained HP/defeat state. The dungeon remains traversable after defeating enemies. The original temporary `enc_town_patrol` stays attached to the upper floor under its historic ID so old saves keep its victory record.
- Existing temporary assets render all corridors at the expanded depth and use the same UI. Final masonry art, props, enemy animation, effects and sound arrive in the later production phases. No stock Xeen graphics were added.

## Persistence and migration

- Campaign schema v12, same browser storage keys, slots and JSON portability. v11→12 expands the original 11×11 dungeon to 16×16 under its stable ID, preserving all historical door states, surviving discovered tiles, secret reveals, triggered traps, claimed loot, fight states, party, RNG, merchants and quest history. New doors/secrets start closed; new encounters are seeded once only; all older v1–v10 migrations chain through v11.
- Malformed saves are rejected without mutating stored originals. The quest validator disallows fake side-quest pickups, inconsistent ready/completed statuses and flags claiming the stair was unlocked before all clues.
- Scripted interactions consume a minute when committed; repeat observations and invalid commands don't pay or recreate resources.

## Acceptance and limitation

The complete upper floor is reachable, three clues persist, hidden optional rooms and traps work, two optional quests can be turned in, and the level-one stair is prepared for Phase 18. This **is not yet the full game**: lower dungeon, valve puzzle, final boss, ending and polished production art/audio remain pending. Browser playtesting is documented separately from automated verification.
