# World of Maxxia / Maxxia Maker: Module Pack Development Plan

**Revision 1 — 6 November 2026**  
**Baseline:** supplied MM19 source, engine 0.49.0, workspace 0.19.0-mm19.  
**New phase series:** MP00–MP47. This roadmap supersedes the remaining editor-first roadmap; it does not mark any of these phases as implemented.

## 1. Product goal and completion standard

World of Maxxia becomes a reusable, locally playable blobber engine. Maxxia Maker becomes its LLM-oriented content toolkit: structured files, reusable adventure behaviours, scripts, command-line validation, simulation, inspection and packaging. A human beginner editor is optional.

A campaign is a self-contained pack containing its adventure, definitions and unique presentation assets, depending only on the engine/core rules and explicitly declared optional or required packs. Enabled packs contribute their exported content to a shared catalogue. Players select an adventure and create or import characters, then carry those characters into other compatible adventures.

“Ready for module production” means two substantially different finished packs run through the same engine; neither requires campaign-specific engine branches. A third, unseen conversion sample must be achievable through pack files and documented extension APIs. This is a finite acceptance target, not a claim that every conceivable tabletop situation is already supported.

### Fixed product decisions

- Keep the existing first-person, grid-based, party blobber and fast combat foundation. Preserve existing illustrated assets and campaign behaviour while migrating them.
- Use one versioned core rules profile initially. Reconcile older module mechanics during adaptation; do not let a pack silently replace global combat rules.
- No live LLM or network service is required to play installed packs. LLMs assist production.
- JSON is the canonical initial content format. Give it generated schemas, examples and precise diagnostics. Avoid parallel authoring formats until there is a demonstrated need.
- Use a bounded, typed event/action language for scripts initially, with named reusable routines, conditions and finite iteration. No arbitrary JavaScript evaluation. Consider a richer sandbox only if real conversion cases cannot be expressed cleanly.
- Keep rendering independent of rules and campaign IDs. Use the same simulation in the game and headless tests.
- Keep content definitions immutable during a running session. Store changes in campaign or character state.
- Exported content becomes globally available; placement in shops, loot and encounters follows explicit eligibility rules.
- Art production follows a stable asset contract. Temporary development art is acceptable during implementation; the two release examples require their own finished art.

## 2. Baseline findings and migration constraints

The supplied source already has project manifests, resource catalogues, external item/class/actor/progression/spell/monster/encounter/loot databases, map documents, named arrivals/transfers and MM19 environment profiles. Reuse these systems and broaden their contracts where necessary.

Important gaps: project database installation replaces registries rather than composing enabled packs; quest and service behaviour includes original-campaign assumptions; class traits/styles and some condition/effect behaviours remain closed enumerations; bespoke town/cistern/vault presentation still exists. New definitions alone therefore do not yet provide arbitrary new mechanics.

MM19 reports 467 passing Node tests and an offline build; these are historical results, not new verification performed for this plan. MM18/MM19 Windows compilation/UI checks and MM19 Chromium visual verification remain unresolved. The new primary release target is the browser engine plus command-line authoring tools. If the native editor ships later, its Windows acceptance is a separate mandatory gate; no browser success implies a verified native executable.

The existing save format is 18. New formats must have explicit migrations, backups and failure behaviour. Do not change old saves in place before a successful migration.

## 3. Pack and state model

| Layer | Responsibility |
|---|---|
| Engine | Simulation, renderer, content API, pack resolution, persistence |
| Core rules pack | Shared baseline classes, spells, items, conditions and progression |
| Enabled content catalogue | Validated composition of core and exported definitions from enabled packs |
| Adventure definition | Starting locations, maps, local NPCs, quests, encounter placements, endings |
| Campaign instance | Explored cells, doors, local object state, NPC attitudes, quest progress, time and RNG |
| Character roster | Portable characters, progression, equipment instances, conditions and dependency provenance |
| Asset catalogue | Pack-qualified images, animations, sounds and presentation profiles |

IDs use a namespace such as `vexxna:item:echo_amulet`. Keep identity separate from display names and file paths. Dependencies declare supported versions; saves retain the exact resolved versions/hashes used. Reject duplicate full IDs and ambiguous replacements. Do not use implicit last-loaded-wins behaviour.

Every pack-owned definition is local or explicitly exported. Exporting a class makes it available for creation; exporting an item makes it usable across adventures. A loot-eligible export may enter generic treasure tables; a story relic remains deliberately placed. Exported monsters do not automatically spawn in every dungeon. Optional dependency references must have validated absent-provider behaviour.

Pack enablement occurs between sessions or through an explicit save migration, not by hot-swapping definitions during combat. A campaign records its resolved catalogue. New campaigns use the current enabled selection; existing campaigns can deliberately adopt an updated selection after validation.

## 4. Delivery discipline for every phase

Each phase produces a cumulative source checkpoint, runnable browser build when runtime changes apply, updated phase ledger, conversion notes, and a concise validation report. Content-only/tool-only phases still include a reproducible proof of their behaviour. Package cumulative example packs once they exist.

Every phase entry below specifies its prerequisite, implementation scope and exit proof. A phase is complete only when its applicable checks pass. Label blocked platform or visual checks explicitly. Do not package phase notes as if they were implemented functionality.

Keep tests proportional: verify meaningful behaviours and regressions, not every trivial data record. Add machine checks for IDs, references and schemas, and behavioural scenarios for mechanics. Record commands and actual results. The engine must never gain a new branch keyed on an example pack's ID merely to pass a test.

## 5. Foundation and pack composition

### MP00 — Baseline, direction change and reproducible release

**Requires:** MM19 source.  
**Build:** Inventory real engine capabilities and hardcoded campaign references; reproduce browser build/checks; record existing failures and preserve assets/saves. Retire remaining beginner-editor milestones from the critical path. Create the MP ledger and migration register.  
**Exit:** Original campaign runs from a clean extraction; baseline results distinguish passed, failed and unverified checks. No gameplay change.

### MP01 — Pack, rules and portability contracts

**Requires:** MP00.  
**Build:** Freeze v1 manifest shape, namespaces, export policy, dependency semantics, rules compatibility and save ownership. Define character transfer/copy policy and version migration policy. Create minimal valid/invalid fixtures and initial schemas.  
**Exit:** A core pack plus two tiny fixture packs validate; duplicate IDs, missing dependencies and incompatible rules fail with actionable paths.

### MP02 — Content tooling skeleton

**Requires:** MP01.  
**Build:** Provide scaffold, validate, inspect and build commands; shared diagnostic codes; generated schema/type documentation. Scaffold a small pack with one map and one interaction. Command names in this roadmap are proposed interfaces, not existing commands.  
**Exit:** A fresh scaffold builds without editing engine code; malformed records identify file, object and property.

### MP03 — Deterministic dependency resolution

**Requires:** MP02.  
**Build:** Resolve required/optional dependencies and supported versions, detect cycles, produce a lock record and stage pack loading before installation. Enforce archive path and resource limits.  
**Exit:** Load-order permutations produce the same catalogue hash; failed loading leaves the previous valid session untouched.

### MP04 — Composed registries and cross-pack references

**Requires:** MP03.  
**Build:** Replace project-wide registry replacement with catalogue composition; namespace resources and references; make overrides explicit and conflict-checked. Validate the full composed graph.  
**Exit:** Two packs contribute classes, items and monsters simultaneously. Broken references and conflicting overrides are rejected before play.

### MP05 — Core content extraction and legacy adapter

**Requires:** MP04.  
**Build:** Extract baseline shared definitions into the core rules pack; adapt the existing campaign without changing its intended behaviour. Track remaining hardcoded story/presentation systems for later replacement.  
**Exit:** Original campaign launches through pack boot; representative combat, equipment and old-save restoration checks pass. Adapter use remains visible in the migration register.

### MP06 — Pack library and adventure selection

**Requires:** MP05.  
**Build:** Local pack import/export, list, enable/disable, dependency explanation, adventure selection, new-campaign creation and save-associated catalogue display. Bundle browser dependencies needed for offline play.  
**Exit:** Install and select either fixture adventure; disabling a required provider gives a precise explanation and does not erase saves.

## 6. State and portable characters

### MP07 — Campaign instances and namespaced state

**Requires:** MP06.  
**Build:** Separate immutable definitions from mutable map/entity/quest state; introduce typed flags, counters and collections with local/campaign scopes. Persist time, RNG and resolved pack identity.  
**Exit:** Two instances of the same adventure develop independently; save/reload reproduces state and subsequent random outcomes.

### MP08 — Portable roster and item instances

**Requires:** MP07.  
**Build:** Separate roster records from campaign snapshots; stable character/item-instance IDs, source-pack provenance, equipment, advancement, charges, durability and portable condition state. Campaign saves use explicit character snapshots/revisions.  
**Exit:** Export/import round-trip preserves a character and unique equipment exactly; missing providers produce dependency diagnostics rather than deletion.

### MP09 — Transfers, copies and transfer receipts

**Requires:** MP08.  
**Build:** Adopt explicit move and copy operations. A move checkpoints the source, records a receipt, imports into the destination, then marks the source participation transferred. Handle interruption and retries idempotently. Copies get a new character identity and are visibly separate branches.  
**Exit:** A→B→A transfer works with no unintended duplicate move/reward on retry. Interrupted local transactions recover. Document that user-controlled exported copies cannot provide tamper-proof anti-cheat.

### MP10 — Save versions, upgrades and dependency removal

**Requires:** MP09.  
**Build:** Versioned migrations, backup/recovery, pack rename aliases, missing-provider preservation and explicit update previews. Catalogue changes are adopted deliberately. Quest items have declared campaign-bound/exportable policy.  
**Exit:** Restore a format-18 fixture, update a pack, and recover from a failed migration without rewriting the original. Disabled dependencies preserve opaque character data until restored.

## 7. Generic adventure logic and an early playable pack

### MP11 — Shared simulation command/event boundary

**Requires:** MP07.  
**Build:** Route gameplay through validated commands and typed events, with seeded randomness and a presentation event queue. Define trigger ordering, re-entry limits and action failure semantics.  
**Exit:** Browser and headless execution of the same command sequence reach equivalent state; a failed atomic action does not partially grant rewards.

### MP12 — Conditions, actions and reusable routines

**Requires:** MP11.  
**Build:** Typed comparisons and queries; bounded action sequences; branches; scoped variables; reusable routines and parameter validation. Operations cover state, messages, checks, inventory, quests, encounters and transfers. No unrestricted host/file/network access.  
**Exit:** A composed lever puzzle executes identically in both runtimes; invalid operands and recursive/event loops fail within defined limits.

### MP13 — Generic objects, doors and interaction menus

**Requires:** MP12.  
**Build:** Stable placed entities, inspect/use/search actions, locks, keys, bashing, secret discovery, containers and one-time claims. Entity states select both behaviour and appearance.  
**Exit:** One room supports key, pick and force routes to the same door; claimed treasure stays claimed after re-entry and reload.

### MP14 — Dialogue, NPC relationships and services

**Requires:** MP13.  
**Build:** Conditional dialogue graphs, choices, remembered facts, NPC attitude, barter/tribute, shops, healing and training as reusable services. Specify terminal/unavailable choices and interruption behaviour.  
**Exit:** One NPC offers multiple outcomes based on state; a shop uses the composed item catalogue with explicit stock eligibility.

### MP15 — Quests, journals and endings

**Requires:** MP14.  
**Build:** Multiple quest states, objectives, optional/alternative paths, journal entries, reward claims and ending outcomes. Replace original story-specific quest assumptions incrementally.  
**Exit:** A branching quest supports success, refusal and failure without requiring a single global main-stage counter; rewards cannot fire twice.

### MP16 — Encounters, wandering tables and time

**Requires:** MP15.  
**Build:** Generic encounter triggers, seeded weighted tables, exploration clocks, rest consequences, respawn policy, peaceful outcomes and configurable boss phases using existing combat foundations.  
**Exit:** A patrol can be fought, bribed or avoided; timed checks survive reload and do not trigger repeatedly by opening menus.

### MP17 — Example A: functional Brass Bell Cistern

**Requires:** MP10, MP16.  
**Build:** Implement Pack A below using existing rendering capabilities and temporary labelled assets. Include its complete branching quest, class/item exports and headless playthroughs.  
**Exit:** A short adventure is playable to both endings entirely through pack content. Export its character and use its new class/item in a separate fixture adventure.

## 8. Extensible game mechanics

### MP18 — Unified effects and extensible conditions

**Requires:** MP17.  
**Build:** Broaden existing composed effects into a shared ability/object/item system. Define targets, durations, stacking, immunity, resistance, dispels, save timing and effect expiry. Replace closed condition restrictions where needed.  
**Exit:** A pack-defined condition works in combat, exploration and saves; interactions have explicit outcomes and bounded calculations.

### MP19 — Abilities, resources and progression

**Requires:** MP18.  
**Build:** Data-defined active/passive abilities, resource pools, costs, cooldowns, rest recovery, level grants and prerequisites. Triggered abilities have bounded execution and clear turn costs.  
**Exit:** Create a new resource-using ability without engine edits; cost payment, failure, reload and level-up behave consistently.

### MP20 — Races, classes and character creation

**Requires:** MP19.  
**Build:** Pack-defined race/class identities, starting choices, equipment permissions and progression tracks backed by reusable mechanics. Remove fixed class/style assumptions from creation and UI.  
**Exit:** An enabled pack adds a mechanically distinct class and race; creation, advancement, import and character sheets work without special UI code.

### MP21 — Equipment, artifacts and crafting

**Requires:** MP20.  
**Build:** Charges, attunement/equip constraints, curses, identified/unidentified states, recipes, ingredient consumption and scripted artifact use. Separate shared item definitions from campaign-owned plot instances.  
**Exit:** An artifact has a passive and active ability; a recipe consumes its ingredients once and handles full inventory correctly.

### MP22 — Monsters, behaviours and companions

**Requires:** MP21.  
**Build:** Reusable monster decision rules, priorities, conditional abilities, phases, summons and companion ownership/lifetime. Bound extra actions to preserve fast combat.  
**Exit:** Three different enemies use authored behaviours; defeat/spawn/reload does not duplicate summons or rewards.

### MP23 — Exploration abilities and physical interactions

**Requires:** MP22.  
**Build:** Capability tags for doors/objects/hazards; line of sight, reach, remote manipulation, reveal, wards and limited traversal. Define what unsupported targets return.  
**Exit:** A lock or hazard can be resolved through equipment, class ability or spell, with consistent costs and explanations.

## 9. Maps and generic presentation

### MP24 — Common scene profiles and renderer migration

**Requires:** MP17.  
**Build:** Complete MM19's generic environment path for town/dungeon scenes; parameterize existing town/cistern/vault presentation while retaining their art. Remove scene selection by specific map identity.  
**Exit:** Equivalent geometry renders through different authored profiles; original scenes retain reviewed visual quality.

### MP25 — Scenery, sprites and animation contracts

**Requires:** MP24.  
**Build:** Authored props, NPC/enemy placement, scale, facing, occlusion, interaction hotspots and state-driven animation. Specify sprite dimensions, pivots, atlas frames and fallback behaviour.  
**Exit:** Two packs use completely different scenery and enemy art through identical rendering code; interactions align with visible objects.

### MP26 — Elevation, hazards and mutable routes

**Requires:** MP23, MP25.  
**Build:** Doors, bridges, pits, liquids, conveyors, teleporters and bounded tile/edge transformations. Define collision, party safety, revisiting and save behaviour. Use finite authored maze configurations initially.  
**Exit:** A maze route changes, persists and remains recoverable; the engine rejects a transformation that illegally embeds the party in a wall.

### MP27 — Illusions, perception and puzzle presentation

**Requires:** MP26.  
**Build:** Separate perceived features from actual collision/state; support reveal conditions, false scenery and reusable sequence/alignment/combination puzzle widgets.  
**Exit:** A false wall is discoverable by two routes; a puzzle's clues, solution, incorrect input and reset behaviour are all defined in the pack.

### MP28 — Regional travel and encounter sites

**Requires:** MP27.  
**Build:** A regional hex/node map linked to first-person locations, route conditions, travel time, discovery, supplies and regional encounter tables. This is a travel layer, not a new tactical combat system.  
**Exit:** Two routes reach the same site with different time/risk costs; discovered locations and clocks persist.

### MP29 — Pack UI, handouts and audio

**Requires:** MP28.  
**Build:** Pack title art, portraits, books/notes, handouts, maps, journal illustrations, music/sound cues and readable text panels. Support keyboard input, text scaling and volume controls through shared UI.  
**Exit:** A pack presents a clue image and readable transcription; missing optional audio does not block gameplay; no special screen implementation is needed per pack.

## 10. Social and systemic adventures; second example

### MP30 — Factions, schedules and rival parties

**Requires:** MP20, MP29.  
**Build:** Reputation, faction clocks, scheduled NPC availability and rival-party abstract actions between exploration turns. Resolve offscreen actions through seeded rules and journalled events.  
**Exit:** A rival claims one of several rewards or changes an NPC relationship without causing impossible quest states or real-time simulation overhead.

### MP31 — Example B: functional Lantern Market After Midnight

**Requires:** MP30.  
**Build:** Implement Pack B below with regional travel, social routes, time gates, alternate appearances and faction outcomes; include Pack A content integration. Use temporary art where final assets are not ready.  
**Exit:** Both social and combat routes finish; a Pack A character uses its carried artifact and class in B. B's exports are available in a new A campaign.

### MP32 — Remove remaining original-campaign assumptions

**Requires:** MP31.  
**Build:** Finish migrating quests, services, NPC scenes, special objects and presentation from the original campaign into pack data. Remove compatibility branches only after migration parity is demonstrated.  
**Exit:** Original campaign, A and B share the normal runtime; campaign IDs do not choose story mechanics, service stock or renderers.

## 11. LLM production tools and conversion workflow

### MP33 — Authoring kit, recipes and complete examples

**Requires:** MP32.  
**Build:** Generate reference docs from schemas; supply minimal and full examples for common adventure patterns, bounded scripts and extension recipes. Add an authoring guide, stable command help and concise machine-readable capability inventory.  
**Exit:** A new authoring session can create a small room/quest/class from the kit without rediscovering undocumented assumptions.

### MP34 — Source-module conversion ledger

**Requires:** MP33.  
**Build:** Track source page/key, destination ID, adaptation decision, asset needs and implementation/test status. Provide a staging workflow from extracted room information to validated pack content. Flag unspecified puzzles and incompatible mechanics explicitly.  
**Exit:** Sample Vexxna rooms have traceable mappings, explicit rulings and no unresolved details disguised as executable content.

### MP35 — Headless scenarios and reachability analysis

**Requires:** MP34.  
**Build:** Test DSL for move/interact/talk/fight/assert/save/reload; seeded replay logs; map connectivity checks and bounded quest-state exploration. Static analysis reports its limits around scripts and conditional paths.  
**Exit:** Automated solutions and wrong-input cases run for both packs; intentionally missing keys, unreachable exits and duplicate rewards are detected. Do not claim exhaustive solvability for arbitrary scripts.

### MP36 — Inspection and visual playtest tools

**Requires:** MP35.  
**Build:** Debug overlay for IDs/state/triggers, save snapshots, command history, reproducible teleport-to-test-location, screenshots and asset contact sheets. Keep debug tools out of normal player flow.  
**Exit:** Reproduce a reported issue using a seed and commands; inspect why a dialogue choice or gate is unavailable.

### MP37 — Incremental build and focused validation

**Requires:** MP36.  
**Build:** Dependency-aware rebuilds, content watch mode, changed-record validation and schema-aware patch helpers. Content reload creates an explicit safe checkpoint; no mutation of a running battle's definitions.  
**Exit:** Editing one room rebuilds relevant content and checks promptly without repackaging all art or restarting unrelated tests.

### MP38 — Reusable content templates and capability gaps

**Requires:** MP37.  
**Build:** Parameterized templates for keyed rooms, shops, shrines, traps, puzzles and services; generate ordinary canonical content, not a hidden second runtime. Add a gap report for unsupported source mechanics.  
**Exit:** Instantiate several mechanically distinct rooms from templates and inspect the generated files; unsupported rules are surfaced before a full conversion proceeds.

## 12. Unique art and finished example releases

### MP39 — Art specification and production manifests

**Requires:** MP31, MP38.  
**Build:** Freeze asset dimensions/formats, palettes, camera/framing, transparency, animation frames, pivots and naming. Create complete asset lists and consistent art direction for A and B. Shared interface assets may come from core; campaign scenes/characters must have their own art.  
**Exit:** All required asset slots have specifications and provenance; automated checks reject bad dimensions, missing frames and unresolved resource IDs.

### MP40 — Brass Bell Cistern final art and polish

**Requires:** MP39.  
**Build:** Produce and integrate A's unique environment set, props, NPC portraits, enemies, item icons, title art and short audio palette. Refine interactions, clue readability, combat pacing and ending feedback.  
**Exit:** Complete visual playthrough at target resolutions; no placeholder art, broken occlusion, unreadable text or missing interaction feedback.

### MP41 — Lantern Market final art and polish

**Requires:** MP40.  
**Build:** Produce B's distinct outdoor/night-market art, NPCs, enemies, illusion variants, handouts and sound palette. Make its social outcomes clear and playable without prior knowledge of A.  
**Exit:** Independent playthroughs of its major routes pass with final assets; no dependency on A unless its optional integration is enabled.

### MP42 — Combined catalogue and portability acceptance

**Requires:** MP41.  
**Build:** Exercise A alone, B alone, A+B, core-only and missing/updated dependency cases. Check creation, inventory, shops, loot, class abilities, transfer receipts and campaign-local quest objects.  
**Exit:** Enable order does not change resolved results; round-trip characters preserve supported mechanics; absent providers preserve data and explain requirements.

## 13. Packaging and production readiness

### MP43 — Reproducible distribution and import resilience

**Requires:** MP42.  
**Build:** Deterministic pack archives, content/asset hashes, version metadata, credits/licences, dependency report and migration notes. Reject unsafe archive paths and oversized/decompression-abusive inputs.  
**Exit:** Packs built from the same source have identical canonical content hashes; failed imports leave installed packs and saves intact.

### MP44 — Performance, persistence and platform acceptance

**Requires:** MP43.  
**Build:** Establish measured load/render/save budgets on a named reference machine; lazy-load large pack assets, release unused textures, test browser storage limits, interruption and offline startup. Confirm intended browsers.  
**Exit:** Both packs meet recorded budgets and recovery checks; platform claims are limited to systems actually tested. No Windows editor release without its separate native checks.

### MP45 — Fresh-session module conversion trial

**Requires:** MP44.  
**Build:** Convert a small previously unused source extract using only the shipped toolkit. Suggested test: several connected Vexxna rooms with a secret, check translation, puzzle and unique treasure. Do not expand this into the entire book.  
**Exit:** Runnable mini-pack, traceable adaptations, art manifest and scenarios are produced without campaign-specific engine edits. Record actual effort and capability gaps; repair blockers before proceeding.

### MP46 — Release documentation and repair workflow

**Requires:** MP45.  
**Build:** Player install/character-transfer guide, authoring/conversion guide, troubleshooting, pack upgrade recipe and minimal bug-report bundle. Provide templates for future development phases and cumulative handoffs.  
**Exit:** Clean extraction can launch either example and run its authoring checks from documented commands; no reliance on transient workspace files.

### MP47 — Engine and example pack 1.0 acceptance

**Requires:** MP46.  
**Build:** Consolidate source, runtime, core pack, finished A/B packs, schemas, toolkit, tests and migration documentation into reproducible distributions. Freeze v1 compatibility commitments and list optional future work separately.  
**Exit:** Complete release matrix below passes. Announce outstanding limitations explicitly; no implementation placeholders count as finished systems.

## 14. Example pack A — The Brass Bell Cistern

**Purpose:** Prove a compact dungeon adventure with combat, mechanisms, alternative solutions and portable rewards. An original example, not a full adaptation of another module.  
**Length target:** 30–45 minutes on first play.  
**Scope:** Two first-person maps: a four-location village yard and a ten-area cistern. Three NPCs, three enemy types, one boss, one main quest, two optional objectives, two endings, one exported class, two exported equipment definitions and one local quest object. Starting level 1; benchmark the expected exit level during balance work.

### Premise and route

A village bell rings below the ground whenever its well runs dry. Keeper Edda asks the party to recover the bell's missing clapper. The party can discover that the old regulator was deliberately sabotaged and decide whether to restore it or divert its power to an abandoned infirmary.

The yard contains arrival/exit, keeper, trader and sealed well entrance. The cistern's ten areas are: entry stair; flooded landing; pump room; vermin nest; keeper's alcove; three-valve gallery; trapped maintenance store; secret infirmary conduit; sentinel chamber; bell regulator. Connect the loop so optional exploration rejoins the main route. The secret conduit is a discoverable alternate route, not a required hidden bottleneck.

### Required behaviours

- Entrance can be opened by Edda's key, lockpicking or force with consequences.
- Valve clues specify a complete solution; wrong inputs cause a recoverable hazard and a reset.
- A shutoff bypass allows a different route at a resource/time cost.
- A maintenance spirit can be fought, appeased with an item or questioned after finding a record.
- Optional objectives recover a tool roll and identify the saboteur; each reward is claimed once.
- Restore the village supply or power the infirmary. The ending changes local state and Edda's dialogue.

### Shared exports

**Bellwarden class:** Initially a defensive equipment/progression variant supported by existing mechanics; MP19–20 adds a Resonance resource and an active guard ability using the shared ability system. Define exact costs, recovery, scaling and action timing in its implementation contract.

**Resonant Buckler:** Portable shield with a bounded active ward. **Siltglass Charm:** Portable exploration item that reveals eligible hidden mechanisms. Both have authored tags for appropriate shop/loot inclusion. The **Bell Clapper** is campaign-bound and does not become generic treasure.

### Art direction and release asset budget

Warm brass, damp slate, old waterworks and readable mechanical silhouettes. Plan one title image, two environment profiles, roughly eight scenery props, three NPC portraits, four enemy appearances with required animation states, and icons for its distinctive items/abilities. Final asset count follows the renderer contract, not an arbitrary image quota.

### Acceptance scenarios

Main route with restore ending; diversion ending; wrong valve input and recovery; key/pick/force access; peaceful spirit outcome; optional reward claim/reload; secret-route traversal; death/recovery; exported Bellwarden and Buckler in Pack B; repeated transfer receipt handling.

## 15. Example pack B — The Lantern Market After Midnight

**Purpose:** Prove that the engine can support social investigation, time, factions, regional travel and illusions using the same primitives.  
**Length target:** 35–60 minutes on first play.  
**Scope:** A five-node regional travel map and two first-person maps: an eight-location night market and a six-area glasshouse. Five named NPCs, two factions, two enemy types plus one optional boss, one branching investigation, three endings, one exported race, one exported class and two exported items. Fully playable without Pack A. Suggested entry levels 1–3; preserve imported levels and communicate the intended range rather than silently rewriting characters.

### Premise and route

A midnight market has bought the dawn. The party must recover the missing sunrise contract before the last lantern burns out. The Lamplighters want to preserve a profitable night; the Orchard Court wants daylight restored but conceals its own debt.

Regional nodes are arrival road, ferry stop, market gate, orchard approach and glasshouse. The market contains entry, lantern stall, broker, ferry agent, shrine, ledger booth, Court envoy and glasshouse passage. The glasshouse contains foyer, mirrored gallery, keeper's room, sealed archive, roof mechanism and contract chamber. Provide conditional shortcuts and at least one non-secret route to every required objective.

### Required behaviours

- A visible three-stage clock advances through explicit travel/rest/story actions, not real-world waiting or menu use. Missing one opportunity opens a costlier fallback route instead of silently softlocking the adventure.
- Evidence and NPC attitudes unlock dialogue options. Bribery, bargaining, testimony and combat are viable routes with distinct costs.
- A false wall and disguised broker demonstrate perceived versus actual state. Both have more than one reveal method.
- The archive puzzle has defined clues and a complete solution; evidence can also purchase lawful access.
- Outcomes: restore dawn; negotiate a limited night market charter; sell the contract and accept the consequences. Record clear journal and faction results.

### Shared exports

**Mothkin race:** A pack-defined race with limited low-light/perception capability. **Lantern Envoy class:** A resource-using support class whose abilities affect applicable dialogue checks and combat morale through shared operations, not pack-specific exceptions.

**Borrowed-Flame Lantern:** Portable light/reveal item with charges. **Glass Orchard Seed:** Portable consumable using a shared healing/ward effect. The **Sunrise Contract** is campaign-bound. Export exact mechanics during MP20–21 implementation.

### Optional connection with Pack A

Declare A as optional, not required. A Bellwarden can detect the glasshouse mechanism through a capability check; the Resonant Buckler functions normally in combat. The Bellwarden route offers flavour and an alternative clue, never exclusive access to the ending. B's race/class become available when starting a new A campaign with B enabled. Eligible generic stock can include B items; A's fixed quest rewards remain deliberate placements.

### Art direction and release asset budget

Indigo sky, amber lamps, painted market wood, moth motifs and fractured greenhouse glass. Plan one title image, one regional map, two environment profiles, five portraits, market/glasshouse props, three enemy appearances, illusion variants, a contract handout, item/ability icons and short ambient/music cues. Colours distinguish it from A while preserving consistent game UI.

### Acceptance scenarios

Social restore-dawn route; bribery route; combat route; each ending; clock-expiry fallback; two illusion reveal methods; optional dependency absent/present; no A-only required clue; Mothkin and Lantern Envoy in A; artifact charges and conditions preserved during round-trip transfer.

## 16. Milestones and dependency overview

| Milestone | Phases | User-visible result |
|---|---|---|
| M1: Packs compose | MP00–06 | Select adventures and combine exported content |
| M2: Characters travel | MP07–10 | Independent campaigns and portable roster |
| M3: First short adventure | MP11–17 | Complete functional dungeon example |
| M4: New mechanics | MP18–23 | New classes, races, effects and artifacts via content |
| M5: Broad adventure presentation | MP24–29 | Generic art, changing maps, illusions and regional travel |
| M6: Second adventure style | MP30–32 | Social/time/faction example; original campaign migrated |
| M7: Efficient conversion toolkit | MP33–38 | Documented generation, inspection and verification workflow |
| M8: Finished example packs | MP39–42 | Distinct art, polish and demonstrated interoperability |
| M9: Production release | MP43–47 | Reproducible engine/toolkit and proven conversion process |

MP11 can begin after MP07 while portability work continues, but MP17 requires both branches. MP24 can follow the first playable pack while mechanics work proceeds, but mutable-map and exploration capability work converge at MP26. The listed execution order is a manageable default; dependency statements govern actual prerequisites. No calendar duration is promised before MP00 establishes build and implementation costs.

## 17. Final release acceptance matrix

| Area | Required evidence |
|---|---|
| Original campaign | Representative story/combat/save parity after migration |
| Pack independence | A and B each install and finish with core only |
| Composition | A+B loads deterministically, with no duplicate IDs or silent overrides |
| Shared content | Exported races/classes/items usable in the other compatible adventure |
| Placement policy | Generic stock follows eligibility; story items stay local |
| Character portability | Move, copy, retry, interruption and round-trip scenarios verified |
| Saves | Exact dependency provenance, migrations, backups and missing-provider preservation |
| Scripts | Bounded execution, explicit ordering, no accidental repeated reward |
| Mechanics | New resource/class/condition/monster behaviour without campaign-specific code |
| Presentation | Unique final assets; actual screenshot and interactive review |
| Conversion workflow | New small source extract made playable using the toolkit |
| Offline distribution | Clean extraction launches without LLM/API calls or development caches |
| Documentation | Complete commands, schemas, examples, limitations and troubleshooting |

## 18. Definition of scope after 1.0

Defer a beginner graphical editor, multiplayer, arbitrary ruleset interoperability, live generative dialogue, unrestricted mod code, continuous 3D movement, a tactical battle mode and a full Vexxna conversion. They are not prerequisites for efficient module packs.

After release, convert one complete module and use measured gaps to guide further primitives. Extend the engine for a reusable capability when needed; avoid either flattening distinctive adventures into generic combat rooms or attempting to predict every possible future mechanic before making playable content.

**Current checkpoint: MP25 — Scenery, sprites and animation contracts (engine 0.70.0).**

MP00–MP24 implementation history and individual unresolved gates are recorded in `../MP_PHASE_STATUS.json`; the initial roadmap above is not evidence that every historical acceptance gate passed. MP25 implementation and automated production-rendering checks pass; interactive browser review remains open.

**Recommended next implementation request: MP26 — Elevation, hazards and mutable routes.**


## MP26 checkpoint

MP26 implemented and automatically verified; current MP26, next MP27 — Illusions, perception and puzzle presentation. See MP26 authoring and validation documents. Interactive browser/native acceptance remains open.


## MP27 checkpoint

MP27 implemented and automatically verified. Current MP27; next MP28 — Regional travel and encounter sites. See MP27 guide/report. Interactive browser/native acceptance remains open.
