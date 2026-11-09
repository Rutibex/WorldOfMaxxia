# MM09 progression database guide

The default project declares `content.progression` in `WorldOfMaxxia.maxxia`, pointing to `projects/WorldOfMaxxia/database/progression.json`. Independently authored older projects without this optional field continue using the bundled `src/shared/content/progression-default.json` baseline.

- **maxLevel**: supported 1–20, with one XP threshold entry for every level 0 through maxLevel; levels 0 and 1 start at zero, later thresholds increase strictly.
- **trainingGoldPerLevel**: a multiplier on the next level, preserving 25 × nextLevel for the original project.
- **attributeMilestoneLevels**: distinct levels between 2 and maxLevel at which a trainer grants an attribute increase (default 3, 5).
- **proficiency**: base, veteran level and veteran bonus; by default +2 until level 5, then +3.
- **preparedMilestoneLevel / preparedVeteranLevel**: thresholds for prepared attack tuning (default 3 and 5).
- **prepared**: eight stable style IDs with a display name, bounded operation/required trait, hit/damage/dice/defense modifiers. These determine the existing one-click Attack; no extra combat button or resource cost.
- **traitBonuses**: reusable bonuses to ranged Device Training and reflected Thornhide damage. A class with a matching MM07 trait automatically inherits this behavior regardless of its class ID.

WinForms: **Edit → Progression and abilities (Ctrl+P)**. The Progression tab edits the XP curve, training cost and milestones; Prepared abilities edits existing style names and numerical modifiers, while the Traits tab adjusts reusable trait bonuses. Apply validates, Undo/Redo operates on accepted document snapshots, and Save writes with backup and external modification detection. Detailed operation, trait prerequisites and dice remain in validated JSON and are not offered as freeform C# scripts.

Save compatibility: authored definitions stay separate from mutable game state; original save schema stays v18. Changing a live campaign's cap or class rules can invalidate an existing character and requires an explicit future migration under MM35. A developer should test copies of affected saves before deploying incompatible changes.
