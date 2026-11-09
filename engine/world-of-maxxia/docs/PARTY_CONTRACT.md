# Phase 5 — party and character contract

This document records implemented behavior. The Phase 1 specification supplies initial formulas; this phase does not implement later combat, inventory or advancement systems.

## State ownership

The scene owns one PartyState. Characters are stored by stable hero ID, independent of slot. `order` is the active ID sequence and `selectedId` is the inspected identity. Exchange swaps only two order entries. No attribute/vital/equipment/XP/condition data is copied into another character. Selection follows the identity to the new position. Invalid targets reject without mutating prior state. Six default members are supplied; creation/recruitment remain Phase 19.

Shared balances belong to the party, not a member: gold 300, food 48, bank 0, reserved healing draughts 2 and antidotes 2. No use or shop transaction exists yet. Starting gear references stable item definition IDs and is read-only. Defense/core weapon numbers use these provisional starter values; full inventory instance ownership is a Phase 13 migration task.

## Calculations

Modifier floor((score−10)/2). Proficiency +2 at levels 1–4 and +3 at 5. Max HP = class base + CON modifier + (level−1) × max(1,class gain+CON modifier), minimum 1. Max SP for casters = 8 + 2 × max(0,casting modifier) + 4 × (level−1); other classes zero. Wizard INT, Priest WIS, Witch CHA. All pools initialize full.

Defense = 10 + armor + shield + capped DEX − curse penalty. Medium caps positive DEX at +2; heavy at +0; negative DEX remains. Current starter attacks use STR for melee, DEX for Vexa's crossbow, plus proficiency/accuracy and condition penalties. Mutant body attacks, Artificer devices and Myrmidon damage passives are Phase 8 and are not claimed in current numbers. Caster DC is 10 + proficiency + casting modifier. Eight resistance channels initialize at zero and derive within −50%..75%.

XP thresholds to levels 2/3/4/5: 250/750/1600/2800. Eligible training costs 25×new level gold; eligibility is displayed, not performed. Gaining XP never changes level. Level cap 5. The ordinary healing helper cannot revive dead members. Increasing CON capacity adds only the positive HP-capacity difference to a living character; shrinking capacity clamps current HP. Increasing SP capacity does not grant free current SP. Attribute recalculation never revives.

## Conditions and displays

At zero HP the character is dead. Portrait priority dead > afflicted > hurt (<50% HP) > normal. Health markers green at ≥75%, yellow at 25–74%, red at 1–24%, blue at zero. Condition records support poisoned/asleep/frightened/cursed/drunk/hungry with duration metadata. Cursed lowers Defense by 2; frightened/drunk each lower core attack by 2; hungry lowers damage bonus by 1. Damage wakes sleep. Refreshing a condition replaces rather than stacks a duplicate. Tick/expiry procedures are not running in this phase, and UI navigation never spends time.

## Interaction

Portrait click/F1–F6 inspects a member. Member tabs duplicate mouse access within the modal character view. F-key switching inside details preserves the same field and panel depth; back returns to the currently selected character. Every displayed numeric field has a detail panel. Items explains the Phase 13 dependency; Equipment already lists actual stat-producing starter definitions. Exchange opens a target prompt, where F1–F6 chooses destination instead of switching inspection; Esc cancels. Quick Reference shows real six-member stats and shared balances. No combat turn ownership exists yet.

Diagnostics are explicit test controls. Wound-to-40%, poison, exhaust SP, mark dead, restore and +250 XP mutate only the current in-memory party. Restore fills living/dead pools and clears conditions, but retains XP. These are not gameplay rewards or recovery services. JSON validation supports a future save boundary, but no campaign persistence is claimed. Earlier phase references remain historical; current sheets are no longer placeholders, although all artwork remains temporary.
