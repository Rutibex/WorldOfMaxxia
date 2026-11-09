# Phase 19 — Character Creation, Advancement and Tavern Roster Contract

## Character-creation flow

New Adventure opens the character-creation overlay. **Use recommended six** starts the original Tarin/Vexa/Brindle/Orrin/Sera/Mora lineup without modifying its established statistics or starter equipment. **Begin custom adventure** starts a new campaign only after all six characters validate. **Back to title** leaves the current adventure and autosaves unchanged.

Each custom slot has a unique name (1–24 printable characters), class (Myrmidon, Artificer, Mutant, Wizard, Priest or Witch, repeats permitted), portrait (12 provisional drawn choices), and six Hexmaster abilities. Starting scores total 76; each score must be between 8 and 16, with points transferable using minus and plus controls. Class switching resets the slot to 16 in its primary attribute and 12 in each other attribute; other slots are unaffected. Other traits (starting age and heritage, initial weapons, armor, prepared combat routine and starting known spells) inherit the established class template. No new stance selectors, separate magic resources or spell systems are introduced.

All characters begin at level 1 with derived starting HP and SP, 0 XP, default combat routine, full class-legal starting equipment and two starter spells for Wizards, Priests and Witches. Custom character IDs are unique `hero_custom_###` entries, stable across save/load; character names are display labels and may never overwrite another character's record.

## Tavern roster

Tessa Bell's Roster screen manages the current six-character party and all stored characters. A new `Register Adventurer` editor uses the same bounded creation rules. Registration costs 40 carried gold; the new companion is **stored at the tavern**, not added silently to the active party. The roster limit is 24 total characters. Registration is atomic: invalid names/attributes, lack of gold or full roster do not mutate the adventure, gold, items or spell registers. The registered recruit receives class-legal starting equipment in instance inventory and known/readied starter magic when applicable. One can recruit into an open party slot after dismissing someone, provided a living adventurer remains. Gear and spell knowledge stay attached to individual character IDs.

Quest flags, journal, maps, defeated enemies, gold, bank, drops, other party members, world time and RNG do not reset when managing the roster. Active slots remain at a maximum of six; only active characters fight and collect XP rewards. Stored characters preserve their own XP/levels and are available later, regardless of whether their class duplicates an existing active one.

## Advancement

Captain Brann's Trainer already converts earned XP and gold to levels 2–5: XP thresholds 250, 750, 1600 and 2800; price 25 times the new level. Level 3 and 5 ask for one base ability below 18 to raise by 1, with the same derived HP/SP increase and class upgrades as the original party. This also applies to custom characters; no background auto-leveling, character locking or re-roll changes occur. Guild lessons continue to require the selected character's class and current trained level.

## Persistence and compatibility

Save format v14. Phase 18 format v13 upgrades by version bump without changing other state, and all earlier chained migrations remain available. The browser storage keys and portable JSON export/import remain unchanged. Party validation accepts portraits 0–11 and up to 24 total hero records but still enforces 1–6 unique active IDs, class/equipment legality, bounded stats and vitals, one-to-one inventory ownership, and per-character spell/curses registers. No deletion of stored characters is exposed, preventing accidental inventory loss.

## Scope and limits

Twelve portraits are alternate temporary vector portraits, not the final full-color hero art of Phase 21. A full visual playthrough and cross-browser QA remain future gates. This phase adds no character ancestry selection mechanics or new races, no class or spell redesign, and no change to the planned adventure or final dungeon.
