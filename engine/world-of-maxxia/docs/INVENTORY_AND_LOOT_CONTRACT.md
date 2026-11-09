# Phase 13 — Inventory and loot contract

This phase implements the 40 ordinary and 8 named rewards in `docs/phase1/Item_Manifest.csv`. The native item catalogue is `src/shared/content/items.ts`, and transactions are implemented in `src/shared/rules/inventory.ts`. No Phase 15 merchant NPCs, final Phase 16–18 dungeon treasure placement, or Phase 30 item icon art is claimed.

## Persistent model

- Campaign v8 stores physical, individually addressed `stack_<serial>` items in `inventory.items`. The next serial is always greater than every existing serial; IDs must be unique. Every item has a valid catalog definition, owner, count, known/unknown flag, current charges, durability and equipped slot. Separate item instances never share mutable state.
- The existing `character.equipment` map remains a normalized definition-ID cache for Phase 5–12 derived-stat and combat compatibility. An equipped item instance *must* back every nonempty slot, and no two instances may equip the same character slot. The validator rejects divergence and forged gear.
- Nine **stacks** are allowed per category per character (Weapons, Armor, Accessories, Misc). Up to 20 ordinary items may share a stack if their mutable properties match. Named rewards cannot stack. There is a global save limit as an additional defense.
- Existing original Phase 6–12 saves (campaign formats v1–v7) migrate through the established upgrade chain. Starting equipment is materialized as actual equipped instances, and old party-wide healing draught and antidote supplies become owned consumables exactly once. Previous maps, combat, spell learning, SP, time, RNG and quest state remain intact. Existing local save slot keys are unchanged.

## Operations

- **Equip / Remove:** Only out of combat; validate class, slot, intact condition, stack count and curse restrictions. Two accessories may be equipped. Equipping displaces the previous item without destroying it. Equipment adjusts damage, defense and some resistances immediately. Myrmidon/Artificer/Mutant prepared styles still resolve on one Attack.
- **Use:** Consume one potion/scroll/throwable or one charge on a valid effect. Self or specified party-member targets are available for healing, antidote, wake salts and fear cures. Invalid targets, full HP, absent ailments, incorrect combat actors or empty charges consume nothing. Combat Use belongs to the active character and advances the turn and enemy actions. Healing, light, poison/acid/spark attacks, smoke escape and a 3-charge recall token are covered; Artificer built-in attacks remain free of items.
- **Transfer:** Target must be another current party member; item must be unequipped and recipient's category must have room. Transfers preserve identification, wear and charges.
- **Split stack:** Non-unique unequipped stack must contain at least two; splitting takes an integer amount less than the stack count and needs a free category slot.
- **Discard / Sell:** Permanent discard requires browser confirmation. Selling only works in town and removes owned un-equipped items at a fixed half-price prototype rate. The actual blacksmith interface and dynamic buy-stock pricing are Phase 15.
- **Identify / Repair:** Town-only repair of damaged items with a visible gold charge; gold-priced identification for unknown goods. If there is insufficient gold, the item and party remain unchanged. Identification outside town currently uses the item inspector's fee, pending merchant UI in Phase 15.
- **Wear:** Every melee/ranged attack reduces equipped weapon durability by one. Enemy hits can wear body armor. Broken items are automatically unequipped and must be repaired in town before re-equipping. Existing Priest `Break Malison` continues to remove equipped curses.

## Treasure interactions

Victory from three existing test encounters grants the original XP/gold reward plus a fixed one-time item bundle. Item awards are flagged independently, so loading/reentering cannot duplicate them. Full bags cause overflow treasure to remain on the ground as persistent, recoverable drops. A nearby dropped item is collected with Space once a selected party member has room.

Four authored prototype caches are located at the Village Market, Gallery Mirror, Gallery Brazier and Gallery Glass Star. Stand on or beside the object and press Space; the hint identifies nearby treasure. Taking the contents is atomic; if the selected character lacks room, the entire cache remains unclaimed. Eight named rewards are distributed among the current prototype caches/encounters to allow testing before campaign content arrives.

## Quality and deferred work

Rules and browser modules are TypeScript with an independent Node test suite. Source and browser distributions contain a standalone offline build of the game. Final item icons, expanded merchant services, advanced identification costs, procedural treasure generation and full dungeon placements remain future phases. The final art and playable graphics have not been falsely claimed complete.
