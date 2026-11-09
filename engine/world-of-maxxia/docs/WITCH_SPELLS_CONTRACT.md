# Phase 12 — Witch Spell List and Mechanics

All twelve spells from `docs/phase1/Spell_Catalogue.csv` are implemented in the common Phase 9 spell engine. No separate spell points, classes, or combat commands. Learn spells through the temporary Diagnostics panel at or above their class level; spell shops arrive in Phase 15. Older saved adventures keep existing known spells; new knowledge must be learned intentionally.

| Spell | Level | SP | Behavior |
|---|---:|---:|---|
| Withering Word | 1 | 2 | 1d6 + CHA necrotic to one enemy |
| Ill Omen | 1 | 2 | WIS save or attack −2 for 3 enemy actions |
| Borrowed Face | 1 | 1 | Nearby interactions highlighted in casting feedback and Information for 30 min, no dialogue bypass |
| Leech Kiss | 2 | 4 | 2d6 necrotic; heal witch for half actual HP taken, rounded down |
| Sleep of Thorns | 2 | 4 | WIS save or skip next enemy action; direct damage wakes |
| Rat Whisper | 2 | 3 | Add nearest undetected authored local clue to persistent notes; no duplicate or SP charge without one |
| Crooked Bones | 3 | 5 | CON save or −3 Defense for 3 enemy turns |
| Briar Mantle | 3 | 5 | Successful melee hit on party retaliates for 2 physical; 5 combat rounds or 5 exploration minutes |
| Malice Rain | 3 | 6 | Visible foes take 2d6 poison each; CON save halves |
| Bottle the Echo | 4 | 6 | WIS save or suppress special attacks for 2 enemy turns; normal strike remains |
| Hearth Thread | 4 | 7 | Exploration-only recall to known town spawn, consumes 10 minutes, no healing, no combat escape |
| Black Moon | 5 | 9 | All visible enemies take 3d6 + CHA necrotic; WIS save halves |

The existing Gallery Watcher has an alternate *spectral pulse* test attack every even combat round (arcane, +2 base damage); ordinary attacks remain physical. Suppression prevents only pulse, not the regular hit. This introduces no new boss or late-phase enemy content.

`Borrowed Face` interacts with current scene props, doors and gateways, never bypassing service dialogue. `Rat Whisper` currently records authored *prototype* notes about actual village/gallery landmarks, not unreleased Phase 17 treasure or quests. It does not mark squares explored. The final secret catalogue and interactions come in Phase 17.

Save format v7 migrates valid v1–v6 games, retains old magic knowledge, combat, notes, status, RNG and world state. Magic statuses are validated against allowed kinds, durations and actual enemy IDs. Canceled/invalid casts cost no SP or turns.
