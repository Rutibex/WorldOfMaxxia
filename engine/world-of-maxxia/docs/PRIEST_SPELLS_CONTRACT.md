# Phase 11 — Priest Spell List: Implementation Contract

Source of truth: `docs/phase1/Spell_Catalogue.csv`, retaining the shared Phase 9 magic engine (one SP cost, common targeting UI, no circles, no slots).

| Level | Spell | SP | Target, context, rules |
|---|---|---:|---|
| 1 | Mend Flesh | 2 | Living, wounded ally; heal 1d8+WIS; both |
| 1 | Sacred Ember | 2 | Enemy; 1d6+WIS holy; combat |
| 1 | Pilgrim Light | 1 | Party light, 60 minutes; exploration only; shares light effect with Lantern Globe |
| 2 | Cleanse Venom | 3 | Living poisoned ally; remove poison; both; no SP/turn on invalid target |
| 2 | Steadfast | 3 | Party; remove frightened condition, block new fear for 3 combat rounds or 3 exploration minutes |
| 2 | Blessing | 4 | Party +1 hit roll for 30 minutes, melee and ranged; both |
| 3 | Healing Chorus | 6 | Heal 1d8+WIS separately to all **living** party members, with maximum HP caps; both |
| 3 | Turn the Hollow | 5 | Only undead enemies among the normal up-to-three visible target list; 2d6 holy and 2 enemy-action turns frightened; WIS save halves damage and negates fear; combat |
| 3 | Sheltering Hand | 5 | Party +2 Defense for 30 minutes, stacks with Stone Skin; both |
| 4 | Break Malison | 6 | Living ally; remove cursed condition and per-character equipped item curse flags; both |
| 4 | Return Breath | 8 | Dead ally; resurrect with 1 HP and 0 SP, cannot cast in combat |
| 5 | Dawn Judgment | 9 | Visible enemies 3d6+WIS holy, CON save for half; combat |

**Undead integration:** the pre-existing spectral `Gallery Watcher` is flagged as an undead-compatible test opponent for Turn the Hollow. Other two test enemy kinds are not undead. This classification is a Phase 11 gameplay convention for the diagnostic demo, not a new setting-lore assertion.

**Fear:** the party `frightened` condition already exists; `inflictFear()` provides a rule-level entry point for future enemy fear attacks. In combat a Steadfast ward ticks down at whole round boundaries, not each hero action. Outside combat it expires after three minutes (allowing the casting action). Undead fear imposes −2 on attack and prevents movement toward the party for two turns, and declines once per enemy action. This is the game's Phase 11 gameplay interpretation of the catalogue's frightened effect.

**Temporary item curse tracking:** starter gear is referenced by item definition IDs, with no separate item instances until Phase 13. To preserve the Phase 1 Break Malison contract now, the magic state stores per-character curses against **currently equipped gear IDs** only. The temporary Diagnostics panel can mark equipped gear as cursed. In Phase 13 move these flags onto real item instances, preserving the save migration and spell behavior.

**Learning:** only the two Phase 9 Priest starter spells are known on a fresh party. The other ten are level-gated and learned deliberately. Diagnostic `Advance Priest` and `Learn eligible caster spells` buttons allow Phase 11 verification before official training and guild systems arrive in Phases 15 and 19. No new permanent progression rule is added.

**Save rules:** campaign format v6 extends v5 magic state with `itemCurses` keyed by every active party member. v5 imports synthesize empty curse lists, with all existing hero/map/combat/quest/clock/RNG data preserved. Earlier versions chain to v6; malformed future versions or illegal item references reject without overwrite. Effects are validated and serialized. Successful spells use campaign RNG/roll count; rejected casts consume no SP/time/rolls.

**Not in this phase:** final spell effects and icon art (Phase 30), spells for Witch (Phase 12), regular item enchantment and curing services (Phase 13/15), story content and normal level training.
