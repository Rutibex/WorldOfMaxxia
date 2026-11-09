# Phase 9 — Shared Magic Engine and Casting Interface

## Design contract

Wizard (INT), Priest (WIS), and Witch (CHA) share precisely one spell-point engine. No spell slots, prepared spell quantities, gem costs, mutation rolls, hidden secondary currency, charge spending, or separate class-specific casting UI. Each caster knows exactly two Phase 1 starter spells at level 1, and has one saved *readied spell*. There are 6 usable spells here; Phases 10–12 complete the remaining 30 spells across the three traditions.

The menu on the existing dashboard's `C` button opens a parchment Cast screen with the caster's remaining/max SP, spell name, SP cost, description, and current target, plus **New** and **Cast**. **New** opens that character's learned list. Choosing a spell readies it without spending SP or a turn. Casting checks cost, learned state, context, target, actor/turn ownership, and redundant or unavailable effect *before* changing state or consuming RNG. A valid casting action costs exactly the listed SP; a curse resisted by the target is still a committed and paid action. Casting while exploring advances one minute; in combat it consumes the acting hero's action in the same initiative and enemy-action sequence as normal Attack.

Use **F1–F6** or click a caster in the exploration casting window; only the acting caster can cast in combat. Single-ally heals ask for a living wounded party target, selectable by portrait/function key or the displayed buttons. Enemy casts require one of the first three living foes in the current encounter, using the target selector (1–3). An invalid selection keeps the dialog open and displays a reason. Escape/Exit leaves everything unchanged.

## Six starter spells (from Phase 1 catalogue)

| Class | Spell | SP | Context | Effect |
|---|---|---:|---|---|
| Wizard | Spark Lance | 2 | Combat | Single enemy takes 1d6 + INT modifier arcane damage; no save |
| Wizard | Lantern Globe | 1 | Exploration | One party Light effect lasts 60 minutes; a redundant cast is rejected |
| Priest | Mend Flesh | 2 | Either | One living wounded ally heals 1d8 + WIS modifier (no overheal) |
| Priest | Sacred Ember | 2 | Combat | Single enemy takes 1d6 + WIS modifier holy damage; no save |
| Witch | Withering Word | 2 | Combat | Single enemy takes 1d6 + CHA modifier necrotic damage; no save |
| Witch | Ill Omen | 2 | Combat | Enemy saves with d20+WIS modifier against caster Spell DC; failure causes −2 attack on its next 3 scheduled actions |

Ill Omen uses currently authored enemy Wisdom values (Dust Imp 8, Stone Mite 6, Gallery Watcher 10) and uses the campaign RNG. Status persists in campaign saves; its turns decrement at the end of each enemy action, including advancing. Lantern Globe persists as an absolute expiry minute and visibly brightens the test viewport; final effect artwork/lighting rules follow in later phases. Repeated effects cannot stack. Healing won't revive a dead ally (revival is a higher-level Priest spell). No SP or RNG rolls are spent for invalid casts.

## Reusable architecture

`src/shared/rules/magic.ts` defines the spell registry, four target models (`enemy`, `enemies`, `ally`, `party`), contexts (`combat`, `exploration`, `both`), resource/target validation, learned and readied state, turn/minute expiry, seeded rolls, healing, damage and status hooks. The `enemies` area target and timed-effect architecture are **scaffolding** for future spells; no Phase 9 starter AoE combat spell is invented outside the Phase 1 catalogue.

`combat.ts` calls the engine for combat casts, advances the existing initiative order, grants rewards once, and uses the enemy attack-penalty modifier on affected enemies. `campaign.ts` maintains the versioned `magic` save data. The client's Dashboard consumes state through hooks; it does not implement separate Wizard/Priest/Witch rules.

## Quick Fight policy

Casters may select **Cast Readied Spell** as their saved default under Quick Option (`O`). Each automatic spell is validated separately at turn time. It **spends SP only when a valid cast will occur**, targeting the already-selected living enemy or, for healing, the living party member with the lowest HP fraction who is not full. Unreadied, inappropriate-context, redundant, out-of-SP, or otherwise invalid casts automatically Block instead, without spending SP. Quick Fight still executes at most one action per living member per press. **Legacy saves retain Attack as their default**, so the new SP-spending automation is opt-in only.

## Saves and compatibility

Campaign version 4 adds `magic:{known,readied,effects}`. Real Phase 8 v3 saves migrate to v4 without changing maps, doors, visits, inventory, quests, party stats/equipment/presets, RNG or combat positions/turns. Phase 6 v1 and Phase 7 v2 migrate through the existing chain. Invalid or future versions are rejected without overwriting existing user data. LocalStorage keys remain the same, with backup-on-overwrite. The portable export is named `World-of-Maxxia-Save-v4.json`.

## Out of scope

The remaining Wizard, Priest and Witch spell lists, spell sellers and learning by purchase, full dungeon objects, curses/poison cures, combat item use, audio, finished casting art/animations, and completion of expedition procedures remain in their roadmap phases. Normal attack remains one button; preparing Quick Fight spells does not introduce per-attack tactics.
