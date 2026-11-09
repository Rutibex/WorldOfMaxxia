# Spells database (MM10)

`maxxia-spells` v1 appears at `public/projects/WorldOfMaxxia/database/spells.json`; it is referenced as the optional `content.spells` path in `WorldOfMaxxia.maxxia`. Legacy manifests without the field use bundled defaults.

The file contains a `spells[]` array (permanent `id`, display `name`, primary legacy `classId`, `level` 1–20, `sp` 0–999, `target`, `context`, `effect`, optional `dice`, `save`, `saveHalf`, `bonus`, `duration`, `damageType`, and `description`). Each record also contains a **stable `behaviorKey`** selecting one of the current 36 existing mechanics implementations. This is an intentional compatibility adapter, *not* unrestricted scripting. A copied spell keeps the original handler key, so changing its ID and name cannot accidentally change mechanics. The effect, target and context must match the selected handler until MM11/MM12 introduces data-driven effect families.

`classAccess` maps class IDs from the Classes database to `spellIds[]` (learnable spells) and `starterSpellIds[]` (initially known, maximum 12); starter IDs must be a subset of learnable IDs. Spells may be shared across multiple casting classes. The legacy primary class remains useful to existing named spell guilds; the regular spellbook and casting checks use `classAccess` instead.

Windows editor source: **Edit → Spells database**, Ctrl+L. Search, create or duplicate a spell, edit name, SP cost and supported optional fields, and choose class access through the second tab. Apply accepts a validated document snapshot; Save writes the JSON with original-preservation/backup and an external-write guard. Newly named casting classes from the Classes database can be added on the access tab. Delete requires removing class references; deleting an ID used by an existing save requires a deliberate migration.

Run `node --experimental-strip-types --test tests/spell-database.test.mjs` from `engine/world-of-maxxia` for six focused runtime tests. For all tests, `node --experimental-strip-types --test tests/*.test.mjs`.

**Restrictions:** No arbitrary script execution, new spell operation families, effects timeline authoring, or fixed dungeon/story event editor in MM10. Those capabilities are explicitly scheduled for later phases. The Windows editor has not been rebuilt or GUI-verified in this host; compile from source on Windows with .NET 10.
