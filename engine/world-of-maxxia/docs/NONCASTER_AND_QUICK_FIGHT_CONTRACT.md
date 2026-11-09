# World of Maxxia — Phase 8 combat interaction contract

## The single-button requirement

Attack (`A` or dashboard) **never opens a maneuver picker**. A character's persistent prepared routine is executed automatically, along with its passive features. Configuring the routine costs no combat turn and can be done from the character sheet or the Quick Option (`O`) parchment overlay. All routes use the existing deterministic `combatAction` and save/replay state.

## Myrmidon

- **Measured Steel** (default): +1 melee hit. At level 3, +1 damage to all Myrmidon melee attacks; level 5, another +1 accuracy.
- **Power Stroke**: -1 melee hit, +2 damage. Its level bonuses still apply.
- **Bastion**: +2 persistent Defense while prepared; -1 melee hit. No new resource bar.
- Uses the equipped melee weapon's base damage and the usual STR modifier. Styles do not change normal missile volleys.

## Artificer

- **Needle Device** (default): built-in melee device using DEX and proficiency rather than equipped melee weapon. 1d4 + DEX modifier, +1 hit, ignores 2 of the enemy's Defense. Damage +1 at level 3. Costs no consumable or SP.
- **Spark Coil**: built-in 1d4 + DEX device hit, with an additional +1 lightning damage (+2 at level 3). No charges or SP. Lightning is exposed as a typed result label in this diagnostic demo; enemy elemental resistance is not authored yet.
- A carried crossbow remains the weapon for Shoot volleys: +1 accuracy from class training, +1 ranged damage at level 3, another +1 accuracy at level 5. Devices do not replace inventory gear or future inventory-gadget rules.

## Mutant

- **Rending Claws** (default): melee CON attack, 1d6 + CON modifier, improving to 1d8 at level 3 and 1d10 at level 5. It does not use the equipped weapon's damage.
- **Carapace**: while prepared, Defense +2 (+3 at level 5), attacks use the equipped melee weapon and STR. At level 3, enemy melee hits cause 1 automatic thorn damage to that attacker, and a thorn kill can end an encounter and grant the one-time victory reward.

## Quick Fight

`O` opens per-character options, also reachable on character sheets. Each character independently saves **Attack**, **Block**, or **Run** as their Quick default; all default to Attack. Spell casts and item consumption are **not** Quick Fight actions until their systems exist. The single **F** press resolves up to one action for each living hero in initiative order, interleaved with enemy actions from the existing engine, stopping immediately on victory, successful escape or party defeat. For an out-of-reach target, the quick action changes to Block instead of stalling. Each automatic action is capped to prevent infinite loops; Quick Fight does not cast spells, use items or consume SP, even with multiple button presses. All RNG, gold and XP come from Phase 7 rules, so saving and deterministic replay continue to work.

## Saves and migration

`CampaignState.version=3` adds `Character.combatSetup = {prepared, quickAction}`. Older valid v1 documents are migrated through v2 and v3; valid v2 Phase 7 saves gain defaults without changing existing encounters, turn order, opened doors, progress, party resources, time or RNG state. Unknown future versions, partial migrations and class-incompatible styles are rejected. Browser localStorage keys remain unchanged so pre-existing local save slots are still discoverable and backed up on overwrite. JSON exports are named v3. Existing stable class, encounter, item and map IDs are unchanged.

## Deliberately outside Phase 8

Shared SP spell casting and casting presets (Phase 9); changing inventory instances and device consumables (Phase 13); leveling/training services (Phases 15 and 19); animated monsters and final attack effects (Phases 20–30). No multi-action attack menus or separate tactical battle mode are introduced.
