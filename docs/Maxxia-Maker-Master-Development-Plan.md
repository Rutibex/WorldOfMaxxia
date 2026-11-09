# Maxxia Maker — Master Development Plan

Version 1.0 • 31 October 2026 • Planning baseline: World of Maxxia Phase 34

## 1. Purpose and instructions for a new chat

This is the portable design and implementation context for developing **Maxxia Maker**, a C# Windows Forms editor, together with the existing **World of Maxxia** browser blobber RPG. The user is Michael Robinson, publisher of Witches Mirror Games. The goal is an RPG Maker style authoring tool specifically for grid-based, first-person party RPGs resembling Might and Magic / World of Xeen.

Read this document and the latest source package before implementing. This document is a plan, not a claim that the features below exist. The latest project's PROJECT_STATE.md, PHASE_STATUS.json, changelog, and executable source determine implementation status. Resolve conflicts explicitly; preserve the user's later instructions. Do not restart from Phase 34 when a newer package is supplied.

The editor must let a nonprogrammer create areas, classes, actors, items, spells, monsters, encounter groups, shops, dialogue, chests, doors, secrets, switches, quests, and puzzles; inspect and configure existing illustrated art, animations, music, and sound; playtest; and export browser and desktop games. The editor will be Windows-only. Exported games will support the web, Windows, and macOS through the same TypeScript runtime and an Electron desktop shell where appropriate.

World of Maxxia becomes the first fully editable example game. Preserve its gameplay, existing art quality, UI, campaign content, and save migration paths during conversion. Keep attack routines fast and prepared; do not add tactical micromanagement or different resource systems for every caster. Retain the shared spell-point approach with class-specific spell access.

**Implementation rule:** complete one numbered phase per requested pass. Every phase has a bounded result, tests/checks, and a handoff. Do not implement this entire plan in one response. The MM numbering below replaces the earlier broad 35A–35G outline for planning purposes; keep existing Phase 34 history intact.

## 2. Budget and continuity policy

These phases are deliberately small, but no phase can be guaranteed to fit a particular Plus allowance: usage depends on model, debugging, source size, tool output, and the remaining allowance. Each phase targets one coherent implementation pass, normally one schema or subsystem and one focused editor surface. Avoid combining neighboring phases merely because they seem related.

At phase start: inspect project state and relevant files, identify dependencies, state the bounded goal, and implement only that goal. Read an index before reading whole large files. Avoid re-auditing all art or regenerating assets during programming work. Reuse production assets. Avoid broad unrelated rewrites.

If unexpected complexity makes a phase too large, split it into named subpasses such as MM18a and MM18b. Finish and package a working checkpoint, document exact remaining work, and mark the parent incomplete. Do not report a stub, disabled button, or data-only prototype as a completed feature when the phase requires working behavior.

Every phase must produce:

1. Updated source containing both editor and engine, including unchanged portions needed to build.
2. A runnable browser build whenever runtime changes occur, and an updated Windows editor build when the environment can produce and verify it.
3. PROJECT_STATE.md, PHASE_STATUS.json, CHANGELOG.md, and a short PHASE_NOTES/MMxx.md containing changed behavior, checks run, limitations, and next phase.
4. Format migrations and compatibility notes whenever serialized data changes.
5. A self-contained handoff naming authoritative files and unfinished checks.

If native Windows or macOS execution is unavailable, say exactly what was compiled, what was tested, and what still requires the target OS. Maintain a reproducible Windows build/test workflow; never label unexecuted native behavior as visually verified. Runtime behavior can still be tested independently.

## 3. Audited Phase 34 baseline

The prior assessment inspected the attached source package, inspected browser archive structure, and executed the Node test suite: 313 tests passed, zero failed. This is historical evidence for that baseline, not a substitute for checking future packages or a claim that an editor already exists.

| Location | Current situation | Required direction |
| --- | --- | --- |
| src/shared/rules/ | Rules separated from much browser presentation | Keep and generalize; avoid C# copies of combat |
| public/content/ | foundation.json plus town.json, galleries.json, vault.json | Versioned project with discovered maps/databases |
| src/client/main.ts | Explicitly loads those three maps and many named assets | Generic project boot and resource discovery |
| src/shared/content/manifest.ts | Specific version/room and exactly six classes | General manifest validation |
| src/shared/content/items.ts and party.ts | Compiled content tables | Editable definitions |
| rules/magic.ts, combat.ts, services.ts | Spell, monster, encounter, service definitions mixed with execution | Separate definitions and reusable behaviors |
| rules/party.ts | Specific class checks, level cap 5, portrait range 0–11 | Configurable progression, traits, portrait IDs |
| rules/grid.ts | # . D row format, sealed perimeter, max 64×64 | General map document with explicit budgets |
| rules/campaign.ts | 2–20 maps, campaign save version 18, specific vault/quest checks | Project-independent state and migration |
| rules/quests.ts | Specific quest flags, sequences, scenes, endings | Data-authored event/quest behavior |
| rules/ground.ts | Persistent piles/corpses, special plot-pickup paths | Generic ground definitions and pickup events |
| client/perspective-renderer.ts | Environment dispatch by three map IDs | Data-selected environment profiles |
| client/audio-plan.ts | Music selection by named maps/boss | Configurable audio assignments |
| shared/saves/campaign-store.ts | Browser localStorage, fixed World of Maxxia prefix | Project/profile/slot storage boundary |
| server.mjs | Static HTTP file server for browser output | Reuse for development; separate desktop host |
| scripts/package.mjs | Fixed Phase 34 package layout | Versioned build/export pipeline |

Do not remove current safety checks by simply accepting arbitrary content. Replace demo-specific validation with structural rules, cross-reference validation, resource budgets, and explicit project migrations.

## 4. Architecture decisions

### 4.1 Responsibilities

- **C# WinForms:** native editor UI, map canvas, forms, project documents, undo/redo, resource management, validation display, export orchestration.
- **TypeScript rules/runtime:** gameplay simulation, combat, event execution, progression, inventory, saves, and expression evaluation.
- **Phaser/browser presentation:** first-person rendering, combat visuals, dashboard, animations, audio playback.
- **WebView2 inside WinForms:** actual runtime preview, animation/effect preview, and playtesting; native authoring UI remains WinForms.
- **Electron shell:** desktop window/fullscreen, asset hosting, file-based save adapter, installer/portable packaging.
- **Shared contracts:** JSON Schemas, generated or checked C#/TypeScript models, fixtures, command specifications, migrations.

The editor must not acquire an independent gameplay implementation. Local C# validation catches document errors; canonical runtime validation catches gameplay constraints. Their shared fixtures prevent drift. Build-time Node/.NET tooling may be bundled with the maker or installed as a documented developer prerequisite; ordinary exported desktop players must not need Node or the editor.

### 4.2 Versioning

Track projectFormatVersion, engineVersion/minimumEngineVersion, contentRevision, saveFormatVersion, eventCommandVersion, and previewProtocolVersion independently. A content revision is not automatically a breaking save change. A future engine version must be rejected clearly if unsupported. Migrate on a backed-up copy; never silently downgrade or discard unknown fields.

### 4.3 Repository layout

```text
Maxxia/
  engine/
    runtime/           # project boot and gameplay orchestration
    rules/             # authoritative simulation
    rendering/         # Phaser/browser presentation
    platform/          # browser, preview, desktop adapters
  editor/
    MaxxiaMaker.sln
    MaxxiaMaker.WinForms/
    MaxxiaMaker.ProjectModel/
    MaxxiaMaker.Validation/
    MaxxiaMaker.Export/
  contracts/
    schemas/
    generated/
    fixtures/
    migrations/
    event-commands.json
  projects/
    WorldOfMaxxia/
    BlankBlobber/      # added during final independent-project test
  export-templates/
    web/
    electron/
  tools/
  tests/
  docs/
  PHASE_NOTES/
  PROJECT_STATE.md
  PHASE_STATUS.json
```

Move existing files incrementally. Keep compatibility entry points until build scripts and imports are updated. One physical source of engine truth; avoid a second manually maintained engine copy inside the editor.

### 4.4 Game project layout

```text
WorldOfMaxxia/
  WorldOfMaxxia.maxxia
  database/
    system.json
    classes.json
    actors.json
    items.json
    spells.json
    monsters.json
    encounter-groups.json
    conditions.json
    abilities.json
    shops.json
    services.json
    quests.json
    animations.json
    environments.json
    switches.json
    variables.json
    terms.json
  maps/
    index.json
    map_town.json
    map_diagnostic_galleries.json
    map_resonator_vault.json
  events/
    common-events.json
    templates.json
  assets/
    catalog.json
    images/
    audio/
    fonts/
  editor/
    project-tree.json
    preferences.json
```

Databases initially use one file per category for simple browsing and transactions. Maps use one file each. Source art masters live in an optional separate source-assets folder excluded from ordinary exports. Generated output and saves go outside project definitions. Editor layout preferences do not affect gameplay. Named file lists are the intended end state; add files when the relevant phase introduces them rather than fabricating empty functionality.

### 4.5 IDs, references, paths, and saves

IDs are permanent opaque strings; display names, sorting, folders, and filenames can change. Preserve existing IDs during conversion. New IDs use a collision-resistant generator. References use IDs and optional expected record type. Duplicate creates new IDs; duplicate-map operations remap contained object IDs and internal self-references. External transfers are retained or explicitly cleared with a warning.

Resources have catalogue IDs with project-relative paths. Copy imported files into the project; reject escaping paths, absolute paths, and case-only collisions. Validate asset existence and metadata. Work on Windows but test case-sensitive paths for web/macOS exports.

Save state stores mutable facts: party state, inventory instances, map discoveries, door states, event-local state, quest progress, encounter instances, ground containers, shared clock, RNG and active interpreter state when supported. Definitions remain in the project. Separate item definitions from instances and monster definitions from spawned enemies. Runtime state must never be written back into authored map documents.

## 5. How the editor works

### 5.1 Main window and project workflow

The main window has File/Edit/View/Project/Tools/Help menus; toolbar commands for save, undo/redo, database, resource manager, validation, playtest and export; a project/map tree on the left; a central tabbed map workspace; a palette and properties panel; and a bottom validation/output panel. Panels resize and can be hidden. Use SplitContainer, TreeView, tabs and custom controls; a sophisticated docking framework is optional later.

File actions: New Project, Open, Recent, Save, Save All, Save Copy, Close. New Project asks for a folder, name and template, then generates an independent project ID and valid starting map/party. Save Copy preserves project identity by default for backups; a separate Clone as New Game action creates a new project ID and isolated saves. Dirty tabs show an indicator. Closing a dirty project offers save/discard/cancel. Recovery files are distinct from intentional saves.

The editor loads unknown compatible fields without destroying them. A newer unsupported format opens read-only with diagnostics or is rejected. It does not rewrite a project merely by opening it.

### 5.2 Map workspace

Top-down grid authoring is the primary interface; first-person preview shows what the party will see. Palette modes: geometry, materials, scenery, events, encounters, and transfer/arrival markers. Tools: pencil, line, rectangle, fill, selection, copy/cut/paste, eyedropper, erase, undo/redo, zoom and pan. Dragging a brush stroke is one undo action.

Map properties include stable ID, name, dimensions, environment, default materials, music/ambience, encounter settings, named arrival points and notes. Resizing previews removed content and requires explicit resolution of out-of-bounds objects. Map folders organize the tree without changing travel logic.

Map display toggles: grid, coordinates, collision, events, encounter zones, portal links, light/scenery markers. Double-click an event to edit it. Context menu: edit, duplicate, cut/copy/paste, delete, playtest here, set arrival point. Transfers use a destination-map picker and destination-square preview.

### 5.3 Database workflow

A category list/tabs selects Actors, Classes, Abilities, Spells, Items, Monsters, Encounter Groups, Conditions, Animations, Environments, Shops, Services, Quests, Common Events, Switches, Variables, System and Terms. Each category uses a searchable record list, detail form and contextual preview. Records can be created, duplicated, renamed, deleted and searched by ID/name. A Where Used view lists references before deletion. Dropdowns show names but persist IDs. Missing references remain visible as broken references.

Edits use typed controls and domain forms. PropertyGrid may help early diagnostics but does not replace finished forms. Apply validates the record; Cancel discards that dialog's changes. Project Save persists the accepted document changes. Undo/redo covers accepted edits across map and database operations.

### 5.4 Events and pages

Each placed event has ID, name, position, optional facing, notes and ordered pages. Pages have conditions, visual definition, collision/visibility settings, trigger, interaction reach, repeat policy and command list. The highest-numbered matching page wins; no matching page means inactive. Conditions are AND by default, with explicit grouped alternatives when needed.

Conditions: global switch, typed variable comparison, event-local switch, item possession, quest state, party class/trait/capability, time range, encounter result, and whether a ground container is empty. Variables are typed integer/boolean/string values with documented limits. Local switches are keyed by map ID plus event ID, never page index.

Triggers: interact while facing; enter square; search; lockpick/pickpocket; enter map; battle outcome; scheduled time/condition; explicit common-event call. Interaction reach must use the same rules as the game, including blocked sight/reach. Search and thief actions use party capability selection, preserving the current best-thief behavior. Trigger priority and input ownership must prevent one press opening both a door and unrelated dialogue.

Command categories: text/choices; conditions/branches; switches/variables; items/gold/XP; party/conditions; shops/services; battles/results; transfer/facing; doors/scenery; quest/journal; audio/animation; wait/common event; bounded loops. Commands are typed data with schema version, not arbitrary code strings. Comments and folding improve readability. Errors identify map, event, page and command.

The interpreter operates on deterministic simulation state and seeded RNG. It can suspend for dialogue, choices, shop, battle, animation or wait; resumes once; tracks instruction pointer/call stack/locals; blocks runaway command execution with per-tick budgets. Autorun should finish, disable itself, or report a useful diagnostic. Parallel events are cooperative scheduled jobs, not uncontrolled threads. Save behavior during suspended execution is explicitly supported or temporarily disabled with a clear reason until implemented.

### 5.5 Ready-made event templates

Users choose a template, fill a short form and place it. Templates produce ordinary editable pages/commands; a project is not dependent on a hidden wizard. Updating a template does not unexpectedly overwrite customized instances.

| Template | Main fields and behavior |
| --- | --- |
| NPC/dialogue | Portrait/scene, text, choices, conditional pages, optional common event |
| Shop | Shop ID, greeting, inventory, prices, opening conditions |
| Inn/training/bank/temple | Service ID, fees, allowed operations, presentation |
| Chest | Contents/loot table, gold, lock/trap, opening animation, persistent empty page |
| Door | Initial state, lock, key or switch requirement, bash permissions, visuals |
| Hidden passage | Search difficulty, reveal/collision changes, permanent local state |
| Switch/lever | Local/global state, toggle/set behavior, linked common event |
| Pressure plate | Enter/leave or step behavior, linked switch, repeat policy |
| Teleporter/stairs | Target map and arrival point, facing, activation conditions |
| Fountain/rest point | Restore effects, charges/cooldown, text and sound |
| Ground pickup | Item/quest reward, quantity, art, one-time state |
| Fixed encounter | Encounter group, respawn policy, win/lose/escape branches |
| Puzzle controller | Typed variables, input sequence, reset/success common events |

### 5.6 Resources and preview

Resource manager provides folders, search, thumbnails, import, relink, rename/move, preview and Where Used. Import records source attribution/license notes and supported media metadata. Keep existing illustrated raster quality; packing/cropping is allowed, replacing finished art with procedural placeholders is not.

Image previews support zoom, transparency backgrounds, dimensions, pivot/anchor overlays and frame selection. Animation editor supports frame rectangles, durations, loop mode, state names, scale, anchor and optional sound markers. Existing enemy idle/attack/hurt/death and portrait condition variants must remain configurable. Spell presentation supports missiles, impacts and condition marks separately from mechanical effects.

Audio preview uses the runtime backend so MIDI and other supported formats behave consistently; do not promise codec support before testing the actual backend. Assign default title, victory, defeat, battle, boss and UI audio in System; maps and encounters can override it. Provide volume, fade, loop and stop controls.

### 5.7 Playtest and validation

Playtest supports full new game and start-at-selected-map/pose. A temporary immutable project snapshot includes accepted unsaved edits without modifying the authored files. Test saves use separate project/session storage. Stopping a test discards simulation changes. Map/pose changes may refresh preview; schema changes require a restart until safe hot reload is implemented.

Diagnostics have severity, record location, explanation and jump-to-editor action. Check duplicate IDs, broken references, invalid target squares, invalid expressions, assets, impossible settings, event command structure, unsafe loops, page reachability hints, and export path collisions. General validation is not a proof that a puzzle is solvable. Export is blocked by errors, warnings remain reviewable.

## 6. Runtime data and compatibility rules

### 6.1 Maps and environment profiles

Start with the existing cell-authoritative movement model. A map document has width/height, compact geometry/material layers, placed scenery, events, encounter zones, named arrival points and metadata. Keep cells as walls/floors/door cells initially; per-face material overrides are allowed. Edge-based walls, free movement, vertical stacking and slopes are later extensions, not prerequisites.

Environment profiles select floor/wall/ceiling/sky resources, fog/palette, perspective scale and rendering features. Convert the existing town, upper cistern and vault visuals into reusable profiles and placement data incrementally. A new map must render correctly without matching a World of Maxxia map ID. Preserve specialized existing visual features through reusable profile components where necessary.

Use practical configurable budgets rather than unlimited allocation. Retain the current safe map size until rendering and editor performance justify increasing it. Remove the mandatory two-map minimum to permit a valid single-map project. Growing map count must not require eager initialization of every map state in every save.

### 6.2 Rules and databases

Keep core attributes and current damage/condition mechanics initially, exposing labels and supported values without promising arbitrary new rules engines. Classes configure HP/SP progression, casting attribute, spell access, equipment tags, starting abilities, prepared styles and traits. Traits replace named-class checks. XP tables and maximum level become data with validation.

An effect definition includes operation, target selector, amount/expression, duration, stack policy and optional conditions. Initial operations reproduce existing behavior, including damage, healing, revival, cures, wards, attribute/resistance modifiers, binding, reveals and transfer-like spells. Game-specific exceptions become named reusable engine behaviors where decomposition would be impractical; they must not depend on a particular record ID.

Expressions use a small parser with allowlisted variables/functions, dice notation and bounded operations. No eval, arbitrary JavaScript, C# compilation or filesystem access in ordinary formulas. One TypeScript evaluator is authoritative; WinForms asks the runtime for calculated previews.

Monster AI initially uses weighted/conditional ability selection, not a universal behavior-tree designer. Encounter group definitions are distinct from map placements and runtime instances. Loot tables preserve seeded rolls, unique rules and corpse persistence. Taking a quest item invokes a generic event/reward path.

### 6.3 Saves and migrations

Namespaces include project ID, profile and slot. Desktop file writes use safe replacement and backup; browser saves preserve import/export and corruption handling. Preview saves are isolated. Compatible added maps/objects initialize defaults; removed content and modified progression require declared migration or an explicit incompatibility result. Never silently relocate the party into a wall or delete unknown inventory.

Ship a Phase 34 importer, preserving original save bytes and IDs. Maintain representative fixtures: town, active quest, upper puzzle, vault gate, completed ending, dropped inventory, corpse contents and quest pickup. Migration checks compare gameplay meaning, not only JSON shape. General save validation must not reference Bell-Heart or specific map names; campaign constraints become project-level checks.

## 7. Detailed implementation phases

All phases include the common handoff/build obligations in section 2. Dependencies are sequential unless stated otherwise. Checks below are the meaningful acceptance checks, not an instruction to write redundant tests for every control.

### MM01 — Baseline, build entry points, and project ledger

**Work:** Inventory current engine modules, content tables, assets, save migrations and build scripts. Preserve the Phase 34 packages as baseline inputs. Introduce the solution/repository layout incrementally, a phase ledger, build instructions, and a precise conversion inventory. Add a minimal WinForms application that opens a window with version/build information; do not create the whole editor UI.

**Acceptance:** Current game behavior/tests still pass; runtime builds; C# project builds in the appropriate environment. Record target-OS execution limits. **Defer:** content conversion and map editing.

### MM02 — Project manifest and shared contract infrastructure

**Work:** Define manifest v1, stable ID conventions, reference format, separate version fields, and schema tooling. Create C#/TypeScript manifest models and shared good/bad fixtures. Add a project-selection boot option while retaining the legacy default entry point. Establish schema generation/check commands and deterministic JSON formatting.

**Acceptance:** Both readers accept the same minimal valid manifest and reject malformed references/version fields. Unsupported versions produce actionable messages. **Defer:** extracting all content.

### MM03 — Document workspace, safe save, and undo foundation

**Work:** Implement C# project/document services, dirty tracking, snapshot-based edit commands, grouped undo/redo, backed-up safe saves, project open/close, and external-modification detection. Add record-list and diagnostics view foundations. Save Copy and Clone as New Game have distinct identity behavior.

**Acceptance:** Edit/undo/redo/save/reopen round-trips a small project without data loss; cancelled dialogs and simulated write failures preserve originals. **Defer:** specialized content forms.

### MM04 — Dynamic map discovery and project boot

**Work:** Add map index, project root resolver, dynamic map loading, configured start map/pose, and error display. Convert the three existing map files into a project-owned location with an adapter for unchanged map geometry. Permit one-map projects. Replace the restrictive foundation manifest path.

**Acceptance:** A fourth plain map loads and is reachable by portal without modifying the map list in TypeScript. World of Maxxia still starts correctly. **Defer:** generic rich environment rendering.

### MM05 — Resource catalogue and asset resolution

**Work:** Define asset catalogue records and resolvers; migrate file paths behind stable resource IDs incrementally. Add a read-only native resource browser with thumbnails, type filters and missing-file diagnostics. Preserve old asset paths through a temporary conversion adapter where necessary.

**Acceptance:** Rename/relink one resource path without changing its references; paths outside the project and case collisions are rejected. Existing art still loads. **Defer:** animation authoring and bulk asset conversion.

### MM06 — Items database and first editable database form

**Work:** Extract item definitions to JSON, inject item lookup into rules, and implement searchable item list plus general/equipment fields. Support create, duplicate, edit, icon selection, validation and Where Used for implemented reference types. Preserve instance IDs and item behavior.

**Acceptance:** Add a new ordinary item, give it through a test fixture, equip/use/drop/loot it, and save/reload. Editing its display name requires no runtime rebuild. **Defer:** new effect types and loot-table editor.

### MM07 — Classes, equipment permissions, and trait data

**Work:** Extract classes, equipment tags, HP/SP growth, casting attributes and existing prepared-style availability. Replace equipment permission checks with data. Add class list/detail form and a runtime-backed stat preview. Keep current prepared ability implementations during this pass.

**Acceptance:** Create a new class by duplicating one, change equipment tags/growth and use it in a fixture without extending the ClassId union manually. Existing six classes retain results. **Defer:** actor UI and custom prepared abilities.

### MM08 — Actors, portraits, and starting party

**Work:** Extract starter heroes; migrate numeric portrait selection to catalogue-backed portrait sets; add actor forms and starting-party ordering. Update character creation to list project classes and valid portrait resources. Preserve current party-size rules initially.

**Acceptance:** Author a new hero/class combination, select it in the starting party, launch and save/reload it. Portrait condition states still work. **Defer:** recruitment event commands.

### MM09 — Progression, prepared abilities, and class traits

**Work:** Extract XP/max-level/training settings and prepared attack definitions. Replace named-class bonuses with trait/ability operations reproducing current routines. Add progression and prepared-ability tabs, keeping one-click player attacks.

**Acceptance:** Existing class attacks match baseline fixtures; a newly named class uses the same abilities and can progress beyond the former cap when configured. Invalid/incomplete progression curves fail validation. **Defer:** a general skill-tree designer.

### MM10 — Spell definitions and spell list editor

**Work:** Extract spell definitions and class access/learning lists to JSON. Add spell general settings, cost/target/level fields and class spell selection. Retain legacy behavior handlers behind stable behavior keys until the next passes.

**Acceptance:** Duplicate an existing spell under a new ID, alter cost/name/scaling parameters and learn/cast it. No remaining behavior may accidentally rely on the original ID for the duplicated spell. **Defer:** effect composition UI.

### MM11 — Effect primitives and expression evaluator

**Work:** Define typed mechanical effects and a bounded dice/arithmetic expression parser. Implement damage, healing, resource change and condition application operations. Add basic effect-list editing and canonical runtime evaluation preview. Preserve RNG consumption ordering or document migration impact.

**Acceptance:** Tests cover parser bounds, invalid references, seeded outcomes and representative current spells. Compose a new heal/damage effect without source edits. **Defer:** complex wards and utility effects.

### MM12 — Advanced spell effects and condition definitions

**Work:** Convert remaining current wards, buffs, cures, revival, binding, reveals and utility behavior to effect operations or reusable handler keys. Extract supported condition settings and add their editor. Finish removal of spell-ID-specific mechanical dispatch.

**Acceptance:** Existing spell suites pass and newly named copies behave consistently. Durations/stacking/expiration survive saves. Split this phase by effect family if the remaining inventory is large. **Defer:** arbitrary user scripting.

### MM13 — Monsters database and AI selection

**Work:** Extract enemy kinds, statistics, resistances, ability choices and visual-state references. Add monster forms, resource selection and weighted/conditional AI settings. Preserve current actions and balance.

**Acceptance:** A new monster record enters a test encounter, selects valid attacks and displays its configured visuals without source registration. **Defer:** encounter placement editor and behavior trees.

### MM14 — Encounter groups and placement definitions

**Work:** Extract encounter seeds into reusable groups plus map placement records. Add group composition, boss/music tags, trigger range, respawn policy and battle outcome references. Expose fixed encounter markers on an interim read-only map view.

**Acceptance:** Same group can be placed twice with independent runtime IDs/state; defeating one does not clear the other. Current battles retain rewards and persistence. **Defer:** random zones.

### MM15 — Loot definitions, corpses, and generic ground pickups

**Work:** Define loot tables and placed ground containers/pickups; decouple plot pickups from named area handlers. Add loot-table editor and ground-content forms. Preserve dropped-instance identity, partial looting, inventory limits and empty corpse behavior.

**Acceptance:** Configure a monster drop and a loose quest item; kill/loot/drop/reload preserves exact ownership and one-time rewards. Existing Phase 34 ground tests remain meaningful. **Defer:** shop authoring.

### MM16 — New map model and migration adapter

**Work:** Define dimensions, geometry/material layers, scenery placements, event placeholders, arrival points and map settings. Convert current # . D maps without changing collision. Add old-format importer and compatible budgets; do not enlarge limits until measured.

**Acceptance:** All three maps preserve walkable cells, doors, secrets, traps and transfers. Export/import round-trip retains IDs and unknown compatible metadata. **Defer:** brush UI and visual conversion.

### MM17 — Map tree, canvas, geometry painting

**Work:** Implement native grid canvas, zoom/pan, coordinates, palette, pencil/erase/rectangle/fill, selection and grouped undo. Add create/duplicate/rename/delete map actions, dimensions and bounds handling. Render simple top-down symbols initially.

**Acceptance:** Draw a map, undo a fill, resize safely, save/reopen and walk it in runtime using the generic fallback environment. **Defer:** production environment palette and event forms.

### MM18 — Named arrivals and transfer authoring

**Work:** Add arrival markers, target picker, facing preview, reciprocal-transfer helper and configurable step/interact activation. Validate target collision and establish arrival suppression so transfers do not bounce immediately. Preserve existing portal conditions through adapters.

**Acceptance:** Connect a new map in both directions, move the arrival point and retain valid links; copy/duplicate actions preserve intended internal references. **Defer:** generic conditional event execution.

### MM19 — Generic environment profiles and simple materials

**Work:** Add environment database, default wall/floor/ceiling/sky settings and material selectors. Refactor fallback first-person rendering to use resource IDs/profile properties. Add material painting and a preview bridge stub using the actual runtime.

**Acceptance:** Two new maps share a profile; changing its wall asset updates both without map-ID checks. **Defer:** converting all existing bespoke environment layers.

### MM20 — Town environment and scenery conversion

**Work:** Convert town buildings, landmarks, background and props into reusable environment/scenery definitions. Add placement tools, scale/anchor settings, selection and occlusion properties needed for town assets. Keep the existing artistic composition.

**Acceptance:** Existing town retains its visuals; place one building/scenery asset on another map without adding a new renderer class. Capture equivalent camera-position comparisons. **Defer:** dungeon-specific effects.

### MM21 — Upper cistern and vault environment conversion

**Work:** Convert upper/vault placements and profile-specific reusable visual features. Replace remaining map-ID rendering dispatch with profile selection. Expose door states, puzzle scenery variants and ground presentation through data bindings.

**Acceptance:** Both areas retain occlusion and special visuals; a fourth dungeon map uses their assets without renderer code edits. Split upper/vault into subpasses if needed. **Defer:** new art production.

### MM22 — Native resource import and animation metadata

**Work:** Finish resource import/relink/move/Where Used, image preview, atlas frame selection, durations, pivots, loops and state mappings. Migrate existing NPC/monster animation metadata into definitions. Validate dimensions and frames.

**Acceptance:** Preview, duplicate and retime an existing idle animation; playback in preview/game matches. Asset moves update catalogue paths without rewriting event references. **Defer:** spell-effect timeline controls.

### MM23 — Spell presentation and audio configuration

**Work:** Add animation selection for cast/missile/impact/condition presentation; expose existing render parameters and sound markers. Move map/boss-specific audio choice into data and add runtime-backed music/SFX/MIDI preview with volume/loop/fade controls.

**Acceptance:** Configure a new spell's existing visual resources and sound, assign new map music, and verify preview/runtime agreement. Unsupported formats report clearly. **Defer:** arbitrary audio synthesis or new rendered art.

### MM24 — Event schema, switches, variables, and dispatcher

**Work:** Define event/page/condition/trigger/command records, typed global variables and scoped local switches. Implement page selection and trigger dispatch with deterministic priority, reach and repeat rules. Add switch/variable naming forms; event records may be fixture-authored initially.

**Acceptance:** A two-page event changes page when a switch changes; inactive events do not intercept interaction. Fixtures cover multiple eligible events and map-local state. **Defer:** full interpreter and command editor.

### MM25 — Event interpreter and dialogue/choice suspension

**Work:** Implement command execution state, bounded instruction budgets, branches, text, choices, waits and common-event calls with call-depth limits. Connect runtime dialogue presentation. Add basic event trace output for diagnosis.

**Acceptance:** A choice resumes exactly once into the correct branch; common events return correctly; runaway loops stop with event/page/command diagnostics. **Defer:** economy, battle and service commands.

### MM26 — Event editor pages and command list

**Work:** Build event dialog, page tabs, condition controls, trigger/reach fields, visual/collision options and command insert/edit/copy/paste/reorder/indent display. Support the commands already executable. Use command descriptors for parameter forms where sensible.

**Acceptance:** Author a branching NPC with conditional pages through WinForms, save it and interact in-game. Copying a page preserves references and gives deterministic behavior. **Defer:** remaining command families.

### MM27 — Rewards, party, state, and quest commands

**Work:** Add grant/remove items/gold/XP, conditions, party recruit/remove, variable operations, quest stage updates and journal commands. Introduce quest-definition forms and typed quest state independent of the old mainStage field. Ensure one-time rewards commit once.

**Acceptance:** Complete an authored fetch quest with item turn-in, XP/gold and persistent journal progress; reopening dialogue cannot duplicate rewards. **Defer:** battle/services/transfers as event commands.

### MM28 — Battle, transfer, world, and presentation commands

**Work:** Add battle start/result branches, transfer, facing, door/scenery state, sound/music/animation and relevant wait semantics. Reuse existing gameplay operations instead of manipulating saves ad hoc. Define transaction boundaries around grants and transfers.

**Acceptance:** An event starts combat, waits for win/lose/escape, then opens a door or transfers the party correctly. Input does not leak into exploration during modal commands. **Defer:** service templates and advanced scheduling.

### MM29 — Shops and existing town service definitions

**Work:** Extract shops and inn/training/bank/temple/spell-teaching service settings. Add inventory/prices/fees/availability editors and Open Shop/Open Service commands with completion behavior. Keep economic mechanics shared with the runtime.

**Acceptance:** Create a second shop/service provider in another map; buy/sell/train/rest through data-defined interactions with correct resource changes. **Defer:** converting all original NPC conversations.

### MM30 — Chest, door, secret, and switch templates

**Work:** Implement template wizard and editable generated pages for chests, keys/locks/traps, doors, hidden passages, levers and fountains. Integrate best-thief search/lockpick behavior and configured bash permissions. Define template instance/update behavior.

**Acceptance:** Create each template from native forms, use it, save/reload, and verify persistent open/revealed/depleted states. Template customization is preserved. **Defer:** timed/parallel events and full campaign conversion.

### MM31 — Enter/leave, time, and cooperative background events

**Work:** Add pressure plates, map-entry triggers, game-time schedules and constrained autorun/parallel jobs. Define fixed event ordering, shared-clock use, retrigger policy and interaction with combat/rest. Add author diagnostics for self-repeating events.

**Acceptance:** A plate changes a linked door; an event fires once on map entry; a scheduled event uses simulation time rather than wall clock; stopping a map unloads inappropriate jobs. **Defer:** unrestricted scripting.

### MM32 — World of Maxxia town campaign conversion

**Work:** Convert original town dialogue, quest acceptance, optional quest hooks, service NPCs and gate conditions to events/definitions. Preserve names, text, rewards and art. Remove corresponding town-specific dispatch only after parity checks.

**Acceptance:** New game through town departure matches original quest and inventory state. The original town NPCs can be edited with ordinary forms. **Defer:** upper/vault quest logic.

### MM33 — Upper cistern campaign conversion

**Work:** Convert inscriptions, recoveries, trap interactions, encounters, gates and stair conditions to generic events and quest data. Preserve ground quest pickups and search behavior. Remove upper-specific scene handlers after checks.

**Acceptance:** Play/automate representative correct and incorrect puzzle paths; optional recovery rewards and descent requirements persist through saves. **Defer:** vault and endings.

### MM34 — Vault puzzles, boss, and endings conversion

**Work:** Convert valve sequence/reset, sealed gate, Bell-Heart progression, regulator choices and ending presentation to generic data/events. Remove campaign-specific invariants from core validators, replacing them with project validation where needed.

**Acceptance:** Complete both original endings from authored events; wrong sequence, early access, reload and boss outcomes remain correct. The same puzzle template works under different IDs. **Defer:** final migration of all legacy save formats.

### MM35 — Project saves and Phase 34 migration

**Work:** Finish project/profile save identity, lazy defaults for compatible new maps, content revision policy and explicit migration registry. Implement Phase 34 importer and remove temporary runtime dependencies on legacy global tables. Keep old entry points only for import.

**Acceptance:** Representative Phase 34 fixtures migrate with party, quests, drops/corpses and puzzle facts intact; adding a map does not invalidate a compatible save; incompatible removal reports a reason and preserves bytes. **Defer:** suspended interpreter save details.

### MM36 — Suspended event saves and recovery

**Work:** Serialize/resume interpreter state at supported boundaries, validate command identity/version, and handle content changes during a suspended event. Define safe-point saving and explicit migration/restart policy. Preserve reward commit state and pending battle/service ownership.

**Acceptance:** Save during dialogue/choice and around battle/transfer, load and finish once without duplicate rewards. Changed incompatible event content cannot resume at an unrelated command. **Defer:** desktop storage adapter.

### MM37 — Integrated playtest, preview protocol, and debug tools

**Work:** Complete WebView2 preview protocol, version handshake, project snapshots, start-at-pose/new-game modes, error forwarding, event trace, switch/variable inspector and deterministic seed controls. Isolate preview storage/user data. Keep accepted unsaved edits in snapshots.

**Acceptance:** Edit a spell/map/event, playtest the snapshot, stop, and confirm no simulation changes entered authored files or normal saves. Preview uses the same compiled engine as export. **Defer:** distributed exports.

### MM38 — Reference index, diagnostics, and bulk editing reliability

**Work:** Finish Where Used across every database/event/asset reference, jump-to-error navigation, protected deletion/remap, copy/paste across maps, batch changes and external-edit conflict handling. Add search over dialogue and command references. Preserve unknown compatible fields.

**Acceptance:** Delete/remap a referenced item safely; locate an invalid teleporter and jump to it; undo a batch change; reopen documents without losing unsupported optional metadata. **Defer:** performance tuning beyond measured issues.

### MM39 — System, terms, and game presentation settings

**Work:** Add title/logo/credits, currency/labels, starting party/map, default audio, supported party/advancement settings and configurable UI resource theme bindings. Bind existing dashboard to these settings. Preserve the established Xeen-like game interaction model.

**Acceptance:** Rename the game/currency, change title art and starting configuration through forms, and launch an independent-looking game without source edits. **Defer:** a freeform visual UI-layout designer.

### MM40 — Project validator and release staging pipeline

**Work:** Add a shared command-line validate/stage pipeline consuming an explicit project/engine version. Stage deterministic runtime/data/assets and provenance/build info into a clean output directory. Validate all reachable and dynamic resource references; use conservative inclusion if reachability is uncertain.

**Acceptance:** Staging never includes editor backups/source art by accident, never deletes source, reports missing dynamic resources, and creates repeatable manifests. Test an independent minimal project. **Defer:** platform installers.

### MM41 — Web export wizard

**Work:** Add export destination/title/options, static web packaging, base-path support, hosted launch instructions, build/version display and visible progress/errors. Include required notices and save import/export. Export should use installed engine resources rather than requiring a developer checkout.

**Acceptance:** Export under a URL subdirectory on a static host, cold-load, play, save/reload and import/export a save. No external development server or hardcoded World of Maxxia paths remain. **Defer:** offline PWA support.

### MM42 — Electron shell and desktop save adapter

**Work:** Add narrow desktop platform API, supported resource origin, window/fullscreen settings and user-data save files. Keep renderer sandbox/context isolation and restricted IPC; Node access remains outside ordinary game content. Bundle resources so the player needs no Node installation.

**Acceptance:** Windows desktop app loads packaged assets, saves outside install location, restarts correctly and runs with networking disabled. Test installed/read-only application folder behavior. **Defer:** branded installer export UI.

### MM43 — Windows export and editor distribution

**Work:** Add Windows portable/installer output, app identity/icons/version, prerequisite handling and export progress/cancellation. Package WinForms maker and its runtime/export templates with documented build tools/runtime dependencies. Add Windows CI or reproducible scripts for native checks.

**Acceptance:** On a clean Windows machine or documented clean test image, install/open maker, create project and export/run a Windows game. Report signing status accurately. **Defer:** macOS packages.

### MM44 — macOS export pipeline and target testing

**Work:** Add macOS Electron configuration, platform icons/identifiers, supported architectures, resource case checks, build instructions/automation and signing/notarization hooks. Windows editor may stage a Mac export project and use a Mac build worker; do not promise every final artifact can be produced locally on Windows.

**Acceptance:** Produce and launch the supported Mac artifact on macOS, verify assets/audio/saves/fullscreen and document unsigned vs signed distribution. If no Mac runner is available, mark native validation blocked rather than complete. **Defer:** app-store submission and Linux export.

### MM45 — Blank template and independent miniature game

**Work:** Create BlankBlobber with a clean project ID and only required starter resources. Through the editor, build a small original two-area game with a new class/hero/item/spell/monster, NPC, shop, chest, lock, switch puzzle and ending. Use it to find remaining hidden World of Maxxia assumptions.

**Acceptance:** Complete the miniature game from web and available desktop exports without adding campaign-specific TypeScript. No required Bell-Heart, town or original quest IDs remain in generic engine paths. **Defer:** additional content packs.

### MM46 — Editor recovery, performance, and accessibility pass

**Work:** Add tested recovery snapshots, crash/reopen workflow, recent projects, keyboard shortcuts, DPI/layout fixes, map paint performance and resource caching based on measured bottlenecks. Validate realistic project sizes and stop background work cleanly.

**Acceptance:** Recover intentional unsaved changes without overwriting originals, use editor at common DPI settings, and document measured map/asset budgets. **Defer:** speculative large-scale optimization.

### MM47 — Documentation and authoring tutorials

**Work:** Write installed help covering create project, map, transfer, databases, events/pages, assets, animation/audio, playtest, saves and exports. Provide a short guided tutorial using BlankBlobber and troubleshooting for missing resources/invalid events/build tools. Publish schema/behavior compatibility notes for future development.

**Acceptance:** Follow the tutorial from a fresh project to a playable exported mini-adventure. Documentation uses the actual UI and accurately marks platform restrictions. **Defer:** public marketplace or plugin ecosystem.

### MM48 — Release candidate and full handoff

**Work:** Run final cross-language fixtures, runtime regression, Phase 34 migration, World of Maxxia campaign paths, independent-game authoring, native Windows UI and supported target exports. Resolve blocking issues in bounded repair passes. Freeze initial project/command format versions and package source/editor/example game/export templates/docs.

**Acceptance:** Publish a capability checklist with pass/fail/not-tested per platform, reproducible build instructions, known limitations and exact versioned packages. No completion claim for absent Mac testing, broken templates or placeholder core controls. **Defer:** post-v1 features below.

## 8. Milestone map

| Milestone | Phases | Useful result |
| --- | --- | --- |
| Project foundation | MM01–MM05 | Maker shell, shared documents, dynamic project loading |
| RPG databases | MM06–MM15 | Editable party, combat content, loot and pickups |
| World authoring | MM16–MM23 | Map painting, transfers, reusable environments and media |
| Event authoring | MM24–MM31 | Configurable interactions and reusable templates |
| Original campaign parity | MM32–MM36 | World of Maxxia data-authored with migrated saves |
| Authoring polish | MM37–MM40 | Isolated playtest, diagnostics, system settings, staging |
| Distribution | MM41–MM44 | Web and desktop packaging with explicit platform checks |
| Maker v1 | MM45–MM48 | Independent game, reliable editor, tutorials, release candidate |

MM45 is scheduled as the final comprehensive independence test, but keep a tiny non-World-of-Maxxia fixture project from MM04 onward. Every content phase must prove a newly named record works without bespoke source registration.

## 9. Shared acceptance and regression checklist

Preserve four classes of evidence:

- **Contract checks:** C# and TypeScript read/write the same fixtures, IDs survive round-trips, incompatible versions fail clearly.
- **Gameplay checks:** movement/collision, combat/RNG, prepared attacks, spells, economy, loot identity, quests, clocks and save migrations retain behavior.
- **Authoring checks:** create/edit/duplicate/delete/remap/undo/save/reopen; event pages/triggers; missing reference navigation; snapshots do not mutate source.
- **Platform checks:** browser hosted root/subpath, Windows editor, Electron Windows, and macOS builds/runs where supported.

Use image comparisons or fixed-camera screenshots when renderer changes could damage existing illustrated scenes. Use meaningful scenario tests for engine changes. Do not replace actual native execution with assertions that merely check whether controls or source strings exist.

Reference deletion, migration and save overwrite must preserve recoverable originals. Export cancellation must clean only its own staging files. Test projects with spaces/non-ASCII paths, differently cased filenames, no audio device, missing asset, damaged JSON and unsupported version at suitable milestones.

## 10. Handoff records and next-chat prompts

### Required PROJECT_STATE.md content

Project/engine/editor version; latest completed phase; current partial phase if any; next recommended phase; authoritative project folder; build/run commands; installed tooling assumptions; relevant schemas and migrations; checks executed and native checks not executed; known regressions; artifact filenames. Keep the opening summary short enough to read at chat start.

PHASE_STATUS.json records planned/in_progress/partial/complete/blocked, dependency IDs, package version and brief evidence/limitations for each phase. A blocked Mac verification must remain visible. This master plan remains a specification; update status records more often than rewriting the entire plan.

### Starting a new implementation chat

> We are developing Maxxia Maker, a C# WinForms RPG Maker style editor, together with the existing TypeScript/Phaser World of Maxxia blobber engine. Read the attached Maxxia-Maker-Master-Development-Plan.md and latest source package, especially PROJECT_STATE.md and PHASE_STATUS.json. Implement **MMxx — [phase title]** only. Preserve existing art, gameplay and save compatibility. Complete engine/project-format/editor work required by that phase, perform meaningful checks, update handoff records, and package the full updated source plus relevant runnable builds. If the phase proves too large, finish a working subpass, document the remainder and mark the phase partial. Do not restart from the original Phase 34 baseline or implement future phases silently.

### Resuming an interrupted phase

> Continue MMxx from the attached latest checkpoint. Read its phase notes and current state before editing. Finish only the documented remaining acceptance items, preserve completed work, rerun checks relevant to the changes, and package the result. Report any target-platform checks that remain unavailable.

### Requesting a review

> Review the latest Maxxia Maker source against MMxx acceptance criteria and the master plan. Identify implemented behavior, stubs, broken references, compatibility risks and missing native checks. Do not change unrelated systems. Recommend the smallest next repair or implementation pass.

## 11. Boundaries for the initial release

Initial release includes a configurable blobber engine and editor, not arbitrary RPG Maker feature parity across all genres. Keep these outside the critical path unless the user later requests them: unrestricted scripting, freeform UI designer, general plugin marketplace, multiplayer, Linux editor, macOS editor, procedural world generator, free movement/slopes, advanced skeletal animation tools, cloud collaboration, asset store and automatic updater. A simple movement-route command system can be added after event scheduling if actual NPC movement is needed; reproducing every RPG Maker movement command is not necessary for stationary first-person service interactions.

Maintain extensible schemas and behavior registries so later features can be added deliberately. A project should be useful through ordinary forms and events before requiring code extensions.

## 12. Technical references

The architecture uses documented platform capabilities; verify SDK/package versions when implementing rather than hardcoding this plan's publication date as a support guarantee.

- Microsoft, Windows Forms overview: https://learn.microsoft.com/en-us/dotnet/desktop/winforms/overview/
- Microsoft, WebView2 local content and virtual-host mapping: https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content
- Electron, distribution overview: https://www.electronjs.org/docs/latest/tutorial/distribution-overview
- Electron, code signing: https://www.electronjs.org/docs/latest/tutorial/code-signing

Preview hosting through WebView2 and game distribution through Electron are separate integrations. Both use the same runtime, but neither removes the need to test the actual packaged origin, save adapter, media playback and target platform.
