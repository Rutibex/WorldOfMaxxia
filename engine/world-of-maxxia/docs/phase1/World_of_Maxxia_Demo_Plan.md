# World of Maxxia — Full-Featured Demo Implementation Plan

## Goal and scope

An original, single-player browser blobber in Maxxia, with World of Xeen's screen organization, interaction coverage, discrete movement, fast party combat, and expressive full-colour animated art. Six adventurers explore one authored town and one two-level dungeon connected directly through a town entrance. Target roughly 2–4 hours for a first playthrough; playtesting determines the final length.

This is feature parity for the demo's core loop, not the entire campaign-scale content catalogue of Xeen. Original Maxxia art, writing, music, names, and maps replace Xeen assets. The attached Xeen report and manual guide interaction coverage; Hexmaster Classic guides identity, not literal rules fidelity. Proposed local names and story must be grounded in the supplied setting during Phase 1; any new lore is marked as new.

## Locked design decisions

- Six classes: Myrmidon, Artificer, Mutant, Wizard, Priest, Witch. Support a default party of one each and custom compositions, including duplicates.
- Melee and device/body attacks resolve with one Attack command. Optional prepared fighting styles and automatic passive effects; no per-turn maneuver selection or scripting editor.
- Wizard, Priest, and Witch use the same spell-point system and casting UI, each with a distinct spell list. No preparation slots, Circles subsystem, or permanent random spell-mutation workflow.
- Noncasters need no extra resource dashboard: Artificer signature devices and Mutant adaptations modify attacks; optional consumables use the normal item UI.
- Six Hexmaster ability scores; simplified computer-game combat and progression. Exact formulas are fixed in Phase 1.
- First-person grid movement with four facings, 90-degree turns, forward/backward steps and strafing. Short presentation transitions never change authoritative tile positions.
- Permanent viewport, right context panel, nine-command grid, six portraits, movement pad, parchment overlays, mouse and keyboard equivalents. Modern conveniences include tooltips, readable scaling, and configurable audio.
- Full-colour pixel-art presentation inspired by the supplied references. Book-interior black-and-white restrictions do not apply to this game's art.
- Browser executes the single-player game. Node.js serves the site; TypeScript rules remain independent from rendering. Phaser is the proposed presentation framework; lock a tested version in Phase 2.
- Browser-local saves and portable save export/import are included. Accounts, cloud saves, multiplayer, video-streaming infrastructure, extensive wilderness, and a general visual editor are later projects. Ordinary screen capture/broadcasting is supported by a clean fullscreen game view.

## Bounded content budget

One approximately 16×16 town map and two approximately 16×16 dungeon maps, with inaccessible space allowed. Eight service/quest NPCs; eight ordinary enemy types plus one boss. Three main environmental kits: town streets, dungeon masonry, and dungeon depths. Eight service/interior scene compositions may reuse approved backgrounds and props. Twelve selectable hero portraits, each with normal, hurt, afflicted, and dead treatments. Thirty-six spells, twelve per caster class. Approximately forty equipment/consumable definitions, eight notable rewards, six main-quest stages, and three optional quests. Target character levels 1–5.

Art delivery means integrated, reviewed in-game assets: complete perspective wall/door/floor variants, animated enemies and NPC scenes, portraits, effects, icons, title/menu art, and all visible UI panels. Reused modular assets are intentional; visible placeholders are not acceptable in the final demo. Enemy target: idle, attack, hurt, death; boss additionally telegraphs its special move. Typical frame counts are budget estimates, not rigid requirements: 4–6 idle, 4–6 attack, 2 hurt, 4 death. NPCs use short expressive loops. Approve one complete example before producing the rest.

## Working within Plus usage

These are deliberately small work units, not promises about a fixed token or five-hour allowance. Actual usage depends on the model, debugging, image generation, and existing context. Each phase has one main deliverable. Implement one phase per request, preserve an up-to-date project-state file, and split an unexpectedly large phase into A/B before expanding its scope. Art batches cover at most three new animated actors or one environment kit. Art generation limits may be separate from coding limits.

Every implementation phase supplies updated complete source, a browser-ready build, launch instructions, a short change report, and a focused verification record. Carry forward stable content IDs and versioned saves. Deliver a real checkpoint, with explicit outstanding work, if a limit intervenes. No repeated full-project audits or unrelated rewrites. Tool availability determines whether a browser build is also hosted; an untested hosted release is never claimed.

## Phases

### 1. Demo specification and interaction contract
Create the compact design specification from the attached references. Fix formulas, class roles, command mappings, resource/time rules, service behavior, spell schema, and inventory limits. Produce an interface coverage matrix mapping every normal Xeen exploration/combat control and major window to an implemented phase, a deliberate Maxxia replacement, or an out-of-demo feature. Write the town/dungeon outline and asset manifest. No engine implementation yet.
**Done:** every included feature has an owner phase; demo content counts and new lore are explicit.

### 2. Runnable browser project
Set up TypeScript, Phaser, Node serving, build scripts, loading/error screens, and a development test room. Separate rules, content, saves, and presentation. Include a seeded random source for reproducible checks.
**Done:** a clean checkout builds and opens the test room using documented commands.

### 3. Grid movement and perspective rendering
Implement authoritative tiles/facing, collision, doors, occlusion, distance slots, perspective layers, keyboard movement, and short optional transitions. Use temporary diagnostic art only.
**Done:** a small test map renders correctly at all four facings, including junctions and blocked movement.

### 4. Xeen-style dashboard and input
Build the viewport frame, portrait strip, context pane, command grid, direction pad, hotkeys, focus rules, tooltips, and modal stack. Commands without systems yet show explicitly unavailable states. Include scalable layout and an original initial frame.
**Done:** all screen regions and button hit areas work at supported desktop sizes; overlays block world input.

### 5. Party and character screens
Add six persistent party members, six attributes, HP/SP, defenses, equipment slots, conditions display, member selection, party order and compact party summary. Supply a default party.
**Done:** selecting and inspecting any member works through mouse and F1–F6.

### 6. Saves and persistent map travel
Versioned browser-local saves, manual slots, autosave, export/import, validation and recovery messages. Persist party, maps, discovery, inventory, quests, time, and random state as those systems arrive. Connect test town and dungeon through persistent transitions.
**Done:** reload and cross-map round trips preserve state without resetting opened doors.

### 7. Fast combat foundation
Implement encounters, initiative, targets, attack, defend, flee, enemy turns, damage, victory, defeat and rewards. Support approaching ranged enemies and line-of-sight missile volleys without a separate battle scene.
**Done:** a small encounter can be won or escaped, and party defeat offers recovery/load.

### 8. Three noncaster classes and Quick Fight
Implement Myrmidon styles/passives, Artificer signature attacks and Mutant attack adaptations. Provide level-scaled distinctions, useful defaults, equipment interaction, and automatic effects. Add per-character default actions and Quick Fight with controlled resource spending and safe fallbacks.
**Done:** all three play with one Attack press; Quick Fight cannot stall on invalid actions.

### 9. Shared magic engine and casting interface
Implement spell points, caster selection, spell list, ready/cast, quick cast, target validation, area effects, healing, buffs, damage, status effects and expiry. Start with two spells per caster.
**Done:** all casters use the same controls and correctly spend SP only on committed valid casts.

### 10. Wizard spell list
Complete twelve Wizard spells across the demo progression: offense, control, detection and movement utility. Include at least two useful exploration spells; ensure movement magic respects map boundaries and quest rules.
**Done:** every spell has clear costs, targets, effects and a meaningful in-game check.

### 11. Priest spell list
Complete twelve Priest spells: healing, cures, protection, blessing and supernatural offense. Balance party sustain against expedition attrition.
**Done:** cures, duration rules and invalid/dead target handling work consistently.

### 12. Witch spell list
Complete twelve Witch spells: curses, draining, transformation and strange utility. Implement summons, if selected in Phase 1, as simple party effects rather than separately controlled units.
**Done:** the list feels distinct while using exactly the same SP and casting flow.

### 13. Equipment, inventory and loot
Implement approximately forty ordinary item definitions and eight special rewards, equip/use/drop/transfer, gold, chests, identification, charges, repairable damage and clear comparison readouts. Use shared item commands across inventories and shops.
**Done:** item ownership, costs, charges and bonuses survive save/load without duplication.

### 14. Expedition procedures and utility windows
Complete time/date, food, rest, light, temporary protections, traps, secrets, fountains, locks/bashing, automap, information and party resources. Add portrait condition behavior and functional ornamental indicators.
**Done:** one expedition consumes resources, reveals a secret and returns with persistent consequences.

### 15. Town services
Implement eight NPC roles: tavern/roster, equipment merchant, healer/temple, trainer, three caster-specific spell sellers and quest giver. Tavern covers food, rest and rumors. Map banking, identification and repair services to existing NPCs; include buy/sell, prices and confirmations.
**Done:** players can prepare, recover, sell loot, learn spells and train through the actual service screens.

### 16. Town map and quests
Author the full town map with landmarks, service entrances, conversations and rumors. Add journal categories, quest items, six main-quest stages and three optional quest definitions; dungeon steps remain unfulfilled until later content arrives.
**Done:** town exploration and quest acceptance work with spatially distinct destinations.

### 17. Dungeon level one
Author the first dungeon floor with loops, doors, traps, secrets, chests, clues and initial enemies. Add main-quest progress and at least one optional quest route.
**Done:** the entire floor is explorable and its major obstacles have clear solutions.

### 18. Dungeon level two and ending
Author the second floor, remaining enemies, boss encounter, central puzzle, special rewards, return route and quest resolution. Boss behavior is mechanically complete using temporary visuals.
**Done:** the default party can complete the entire adventure and reach an ending.

### 19. Character creation and advancement
Add custom party creation, naming, portrait selection, class descriptions, level 1–5 training, attribute/HP/SP growth and noncaster upgrades. Support duplicate classes and tavern roster changes without losing quest state. Check viable alternatives to the default party.
**Done:** a custom party can start, advance, dismiss/recruit and continue a saved game.

### 20. Art production proof
Finalize palette, logical canvas resolution/aspect treatment, sprite scale, lighting and perspective templates. Finish one animated monster, one NPC scene and one hero portrait with condition treatments. Review them at actual game size; reuse the finished actors in later batches.
**Done:** integrated examples establish the final look and a repeatable animation workflow.

### 21. Final interface and portrait art
Finish frame, buttons, parchment panels, ornaments and portraits. Bound the batch to twelve base portraits with consistent condition treatments rather than dozens of separately painted variants. Add final title treatment and readable font assets.
**Done:** all normal interface surfaces use final artwork and six portraits remain legible at play size.

### 22. Town environment art
Finish the town kit: street/ground, walls, roofs, doors, sky, landmarks, signage, scenery and distance variants. Integrate every town view using reusable components.
**Done:** a walk through every accessible town tile reveals no diagnostic environment art.

### 23. Town NPC art, batch one
Finish four of the eight service/quest scenes, counting the NPC proof from Phase 20. Add expressive loops and scene props, preserving dialogue legibility.
**Done:** four service scenes use final integrated art, with at most three newly animated actors.

### 24. Town NPC art, batch two
Finish the remaining four scenes using at most three additional animated actors; one can deliberately reuse an established character or approved animation with a distinct scene composition. If four unique new actors are essential, split this phase into 24A/24B.
**Done:** all eight town scenes are complete and visually distinct.

### 25. Dungeon level-one art
Finish the masonry environment kit, doors, stairs, chests, traps, secret reveals and unique quest props. Integrate the floor's visual storytelling.
**Done:** all first-floor views and interactive object states have final art.

### 26. Dungeon level-two art
Finish the depths kit, environmental animations, special puzzle states and boss chamber. Reuse the perspective templates established earlier.
**Done:** all second-floor environments and puzzle transitions have final art.

### 27. Enemy animation, batch one
Finish three ordinary enemy types, counting the approved monster proof. Integrate idle, attack, hurt and death states, consistent anchors and distance scaling.
**Done:** the three types animate correctly in encounters without sliding or clipping errors.

### 28. Enemy animation, batch two
Finish three more ordinary enemy types with the same animation coverage. Differentiate their silhouettes, attacks and palette treatment.
**Done:** six ordinary types are complete in total.

### 29. Enemy animation, batch three and boss
Finish the last two ordinary types plus the boss, including the boss special-attack telegraph. Check multi-enemy composition and death timing.
**Done:** all nine enemy types have complete integrated animation.

### 30. Spell, item and feedback art
Finish a bounded library of reusable spell effects, missile animations, impact flashes, condition marks, item icons and reward art. Thirty-six spells may share effect families with meaningful variations. Split into 30A effects and 30B icons if needed.
**Done:** every spell and item has an appropriate finished visual; effects do not conceal target information.

### 31. Audio and presentation
Add original or properly licensed town, dungeon and combat music, ambience, UI sounds, footsteps, enemy attacks, spell effects and victory/defeat cues. Complete title/menu background and ending presentation. Add music/SFX controls, mute persistence and browser audio-unlock handling.
**Done:** the whole adventure has coherent audiovisual feedback and a credits/asset-origin record.

### 32. UI parity and usability audit
Resolve the Phase 1 matrix, exploration/combat command switching, targeting prompts, spell/service dialogs, hotkeys, journal/map behavior, status indicators and settings. Add clear help, fullscreen, readable scale options and a reduce-motion option. Any deliberate differences are documented.
**Done:** every included control has an implemented behavior, accessible state feedback and mouse/keyboard checks.

### 33. Balance, persistence and complete playthrough
Play from fresh party to ending; tune encounter difficulty, rewards, SP, food, rest and training. Test save/load before and after quest transitions, full inventories, condition expiry, custom parties and boss defeat. Check all visible assets against the manifest. Fix issues within this scope; avoid unrelated feature additions.
**Done:** a documented complete run succeeds and no known progression blockers remain.

### 34. Browser release and handoff
Profile asset loading, memory and rendering; check current Chrome/Edge and Firefox plus Safari where test access exists. Build from a clean source package, verify launch instructions and provide deployment configuration for Node hosting. Package source, website build, save documentation, credits and known limitations. Host only through an explicitly available suitable workflow; verify any claimed live URL.
**Done:** someone can download the package, follow its instructions and play the complete demo through to the ending.

## Milestones and completion gate

After Phase 6: walkable persistent prototype. After Phase 14: playable systems foundation. After Phase 19: complete adventure with all classes and temporary art. After Phase 30: complete visual asset coverage. After Phase 34: finished browser demo.

Release requires a complete town-to-dungeon-to-town loop; all six classes; one shared SP system and three distinct complete spell lists; fast Attack/Quick Fight; inventory and town services; secrets, traps, quests and automap; versioned working saves; complete original integrated art and animation; audio/settings; clean build and launch instructions; and a successful end-to-end playthrough. Unverified browser coverage and remaining limitations must be stated honestly.

## Suggested implementation request

“Implement Phase N of the World of Maxxia demo plan. Use the latest project source and project-state document, preserve existing features and saves, stay within this phase's scope, verify the result, and package updated source and the browser build. Explain any incomplete acceptance criteria. Split the phase if necessary instead of silently dropping requirements.”

## Technical reference

Phaser's official overview documents JavaScript/TypeScript browser support: https://phaser.io/oss/docs/phaser/getting-started/what-is-phaser . Technical versions must be checked and locked when implementation begins. The supplied Xeen report, manual and screenshots remain the primary project references for interface coverage; this plan proposes scope rather than claiming exact original-game behavior.
