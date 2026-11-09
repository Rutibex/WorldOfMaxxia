# Classes database (MM07)

World of Maxxia: `public/projects/WorldOfMaxxia/database/classes.json` (under `engine/world-of-maxxia`). Manifest `content.classes` is project-relative. Files use `format: maxxia-classes`, `version: 1`, `classes: [...]` and permanent opaque IDs.

## WinForms workflow

Build on Windows with .NET 10. Open the project via Ctrl+O and choose **Edit → Classes database** or Ctrl+K. Select or search a class; edit descriptions, HP/SP settings and casting ability; tick equipment tags, traits and prepared styles. **Apply changes** validates and creates an undo checkpoint; **Save classes** writes only the separate classes document with safe replacement. Ctrl+Z/Y undo/redo accepted changes within the dialog, and closing prompts for unapplied/unsaved edits. Duplicate copies a class with a fresh ID. Original six IDs cannot be deleted yet because saves and spell definitions still depend on them. Newly created, unreferenced classes may be deleted after confirmation.

## Rules and tags

Existing equipment tags: `melee:staff`, `melee:dagger`, `melee:mace`, `melee:sword`, `melee:general`, `ranged`, `shield`, `armor:light`, `armor:medium`, `armor:heavy`, `accessory`. The item database carries matching `equipmentTags` arrays. An item is eligible if any of its tags is permitted by the class; slots still must agree. New custom weapon items can share existing equipment tags. Class traits: `martial_mastery` (Measured/Power/Bastion), `device_training` (Needle/Spark), `mutant_biology` (Claws/Carapace), `thornhide` (Carapace retaliation). Assigning a specialized prepared style requires its matching trait. Quick Fight remains a single prepared attack, not a tactical submenu.

HP = hpBase + CON modifier + (level - 1) × max(1, hpGain + CON modifier). SP (if casting) = spBase + spAttributeMultiplier × max(0, casting modifier) + (level - 1) × spGain. The **Preview using game engine** button runs the actual TypeScript rule calculation through `scripts/preview-class.mjs` when the source tree and Node 22.18+ are available. If unavailable, the editor still shows a clearly marked approximate *base growth* illustration, not a verified combat result.

## Compatibility

Saving edited class JSON changes definitions, not campaign saves. The unchanged v18 save schema still contains class IDs and character HP/SP; changing original values may invalidate saved vitals. Original six IDs and game content remain stable. Legacy MM06 manifests without `content.classes` use the bundled baseline. Full actor authoring (MM08), progression/abilities (MM09), spell lists and effect composition (MM10–MM12), all-reference deletion protection (MM38) and migration (MM35) remain later work.
