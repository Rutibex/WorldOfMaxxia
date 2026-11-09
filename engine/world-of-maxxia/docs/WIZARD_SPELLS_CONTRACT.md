# Phase 10 — Wizard spell list and interaction contract

The twelve Wizard spells below reproduce the **original World of Maxxia Phase 1 catalogue** in name, SP cost, level and category. They extend the Phase 9 `SPELLS` registry: there is **one shared casting interface, SP resource, deterministic seeded RNG and turn/time accounting**, not a separate Wizard system. The Priest and Witch retain their two starters each until Phases 11–12.

| Level | Spell | SP | Range/context | Resolution |
|---|---|---:|---|---|
| 1 | Spark Lance | 2 | One combat enemy | 1d6 + INT arcane damage |
| 1 | Lantern Globe | 1 | Exploration party | Light for 60 minutes |
| 1 | Frost Needle | 2 | One combat enemy | 1d6 + INT cold damage |
| 2 | Burning Fan | 4 | Up to three visible enemies | Each receives 2d6 fire; DEX save for half |
| 2 | Glass Eye | 3 | Exploration geometry | Reveals map geometry up to 3 Manhattan-distance tiles for 30 minutes, without writing visited flags |
| 2 | Binding Thread | 4 | One combat enemy | WIS save negates; otherwise lose next action; direct damage breaks the bind |
| 3 | Storm Arc | 5 | Up to three visible enemies | Each receives 2d6 + INT lightning; DEX save for half |
| 3 | Unseal | 4 | Facing adjacent locked door | Unlocks/opens doors with `lockDC <= 16`, excluding quest seals; test case is north gallery door (DC 14) |
| 3 | Stone Skin | 5 | Party, either context | +2 Defense for 30 minutes, including enemy hit calculations |
| 4 | Fold Step | 6 | Exploration; choose 1 or 2 | Translates along facing into *visited* passable squares; cannot cross blocked walls, shut doors, scenery interaction cells, gateways or living enemies |
| 4 | Mirror Ward | 6 | Party, either context | 25% reduction to arcane damage for 30 minutes; gallery watcher attack is arcane and supplies a real demo test |
| 5 | Starfall | 9 | Up to three visible enemies | Each receives 4d6 arcane; DEX save for half |

## Learning and level gate

Fresh default campaigns retain the two Phase 9 starter Wizard spells (Spark Lance and Lantern Globe). Learned lists and readied spell persist. New spells are available through the exported pure `learnWizardSpell` function, which strictly validates class, learned-duplicates and character level. The full spell guild and level-up/training services are Phase 15 and 19 features; **the Diagnostics panel supplies clearly labeled test-only controls** to advance a selected Wizard one level (max level 5) and learn all eligible Wizard spells. This is a testing facility, not the future shop or progression economy. It modifies the current campaign and is saved; start a New Adventure to reset it.

## Targeting and safeguards

- Casting, including area spells, validates caster, learned spell, character level, SP and combat/exploration context *before* spending SP, advancing time or RNG. Selecting/readying a spell is free.
- AoE targets are the same up-to-three living targets displayed in the combat context pane. Each gets deterministic damage and a distinct saving throw. Successful saving throws round damage down to half.
- Target control effects remain enemy-specific and expire on their scheduled turn. A bound enemy cannot move or attack during the one skipped turn. Damage to that enemy releases the bind immediately.
- Glass Eye does not alter any `GridState.visited`, permanent map knowledge or quest flags. Active reveal is a timed visual overlay in the map dialog. Full map completion remains a later phase.
- Unseal cannot bypass quest locks or locks of DC 17+. The example locked door is never reopened by an ordinary Space action after being sealed; a successfully unsealed test lock remains open.
- Fold Step requires each traversed cell already be in visited state. It cannot go through closed doors, stone, map-edge, living enemies, portals or scene objects. It uses one spell action/minute, regardless of 1 or 2 tiles, and does not add newly visited squares.
- Ward duration uses the common campaign clock. Stone Skin grants Defense only while active; Mirror Ward uses a 25% resistance addend when taking arcane damage.
- Quick Fight's explicitly configured `cast` option uses the same checks. When invalid, it Blocks instead of spending SP or looping.

## Save compatibility

Campaign schema is now **v5**, with a conservative v4→v5 migration; legacy localStorage slot keys are unchanged, so valid saves from Phases 6–9 remain loadable. The added timed magic effects and Binding Thread are validated, bounded and serialized. Original v1–v4 saves with valid data are retained without regenerating party, maps, RNG, foes or completed encounters. Imported future-version/corrupt saves remain untouched. No full inventory/quest/spell-shop feature is claimed.

## Proof and known limits

Use `tests/wizard.test.mjs` plus existing tests. Confirm the released browser site can be launched and played on a real desktop; the automated environment may block graphical Chromium navigation. No finished sprite VFX are produced in this phase (Phase 30). The diagnostic level/learn actions are deliberately development scaffolding.
