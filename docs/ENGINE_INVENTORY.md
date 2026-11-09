# Engine inventory — historical Phase 34 / MM01 baseline

MM02 supplement: added src/shared/project/{generated,manifest}.ts and src/client/project-boot.ts, plus public/WorldOfMaxxia.maxxia. Exactly five original non-dist files changed; see MM02_ENGINE_CHANGES.json. The table below remains the original navigation baseline.

Paths below are relative to engine/world-of-maxxia. The original engine is untouched. Export lists are navigation aids, not a semantic parser.

| File | Bytes | Exported entry points/types (first 18) |
| --- | ---: | --- |
| src/client/adventure-screen.ts | 12586 | AdventurePage, AdventureScreen |
| src/client/art-production.ts | 5563 | ClipName, BossClipName, AnimationName, Clip, EnemyAtlas, DUST_IMP, STONE_MITE, GALLERY_WATCHER, CISTERN_RAT, SLUDGE_LEECH, PIPE_GOBLIN, BELL_WRAITH, VALVE_SENTINEL, BELL_HEART, ANIMATED_ENEMY_ATLASES, animationClip, clipFrame, clipDuration … |
| src/client/audio-plan.ts | 2208 | MusicScene, AudioSettings, DEFAULT_AUDIO, validateAudio, musicScene, SoundCue, soundCues |
| src/client/audio.ts | 11523 | AudioDirector, audioDirector |
| src/client/character-model.ts | 5611 | CHARACTER_TABS, CharacterTab, signed, inspectedCharacter, characterSummary, statExplanation, partyComparison |
| src/client/character-screen.ts | 17142 | CharacterScreen |
| src/client/combat-art.ts | 25677 | CombatArt |
| src/client/creation-screen.ts | 5821 | heroEditor, CreationScreen, recruitEditor |
| src/client/dashboard.ts | 83683 | PartyDiagnostic, Dashboard |
| src/client/enemy-projection.ts | 2134 | ENEMY_VIEW_WIDTH, EnemyProjection, projectEnemies |
| src/client/hover-tooltip.ts | 1245 | hideHoverTip, showHoverTip |
| src/client/inventory-screen.ts | 14215 | itemDescription, InventoryPage |
| src/client/loot-screen.ts | 5394 | LootScreen |
| src/client/main.ts | 42555 |  |
| src/client/message-history.ts | 671 | HistoryEntry, MessageHistory, messageHistory |
| src/client/midi.ts | 4125 | MidiNote, MidiScore, parseMidi |
| src/client/npc-scenes.ts | 4831 | NpcScene, NPC_SCENES, npcSceneFor, npcSceneFrame, npcFramePosition, createNpcSceneElement, updateNpcSceneElement, validateNpcScenes |
| src/client/perspective-renderer.ts | 8623 | PerspectiveRenderer |
| src/client/phase30-art.ts | 5860 | FeedbackIcon, FeedbackCue, itemArt, spellArt, feedbackArt, spellClass, spellClassLabel, feedbackCuesFromMessages |
| src/client/presentation.ts | 8455 | openAudioSettings, showCredits, showEnding, installPresentation |
| src/client/spell-effects.ts | 7519 | EffectKind, EffectAtlas, EFFECT_ATLASES, effectFrame, effectDuration, PlannedEffect, SPELL_EFFECTS, plannedEffectsFromMessages, changedEnemyIds, changedAllyIds, effectsForEvent |
| src/client/spellbook-model.ts | 1742 | spellbookEntries, allyTargetReason, spellTargetLabel |
| src/client/spellbook-screen.ts | 8699 | SpellbookPage |
| src/client/status-effects.ts | 4152 | ImpactKind, ImpactAtlas, IMPACT_ATLASES, impactFrame, impactDuration, CONDITION_MARKS, conditionMarkArt, conditionMarkLabel, PlannedImpact, plannedImpactBursts |
| src/client/style.css | 77276 |  |
| src/client/town-art.ts | 2409 | TOWN_TEXTURES, TownTexture, townAsset, TOWN_PROPS, facadeAt, validateTownArt |
| src/client/town-environment.ts | 5182 | TownImages, TownEnvironment |
| src/client/town-service-screen.ts | 4599 | TOWN_SERVICE_VIEWS, isTownServiceView, TownServiceScreen |
| src/client/ui-art.ts | 2955 | icon, CLASS_NAMES, portrait |
| src/client/ui-contract.ts | 3325 | EXPLORATION_COMMANDS, COMBAT_COMMANDS, combatShortcut, CommandId, ShortcutInput, explorationShortcut, ModalStack |
| src/client/upper-art.ts | 5936 | UPPER_TEXTURES, UpperTexture, upperAsset, UpperArtState, emptyUpperArt, upperArtState, UPPER_PROPS, UPPER_CACHES, UpperSprite, upperWallAt, upperFloorAt, upperDoorTexture, upperSprites, knownUpperTraps, validateUpperArt |
| src/client/upper-environment.ts | 4201 | UpperImages, UpperEnvironment |
| src/client/vault-art.ts | 4739 | VAULT_TEXTURES, VaultTexture, vaultAsset, VAULT_PROPS, VAULT_CACHES, VaultSprite, vaultWallAt, vaultFloorAt, vaultDoorTexture, vaultSprites, knownVaultTraps, validateVaultArt |
| src/client/vault-environment.ts | 4374 | VaultImages, VaultEnvironment |
| src/shared/content/README.md | 160 |  |
| src/shared/content/field-actions.ts | 275 | chestDC, hiddenCache |
| src/shared/content/items.ts | 22396 | ITEM_CATEGORIES, ItemCategory, ItemSlot, ItemEffect, ItemDefinition, ITEMS, ITEM_IDS |
| src/shared/content/manifest.ts | 679 | FoundationManifest, validateManifest |
| src/shared/content/party.ts | 4858 | ABILITIES, Ability, Attributes, CLASS_IDS, ClassId, CLASSES, StarterGear, STARTER_GEAR, STARTER_HEROES |
| src/shared/rules/README.md | 127 |  |
| src/shared/rules/campaign.ts | 17765 | CAMPAIGN_FORMAT, CAMPAIGN_VERSION, MAX_SAVE_BYTES, CampaignState, MapRegistry, Portal, TravelMap, validateMapRegistry, newCampaign, validateCampaign, upgradeCampaign, parseCampaign, serializeCampaign, travelCampaign |
| src/shared/rules/combat.ts | 26856 | EnemyKind, ENEMY_KINDS, EnemyState, EncounterState, ActiveCombat, CombatState, ENCOUNTER_SEEDS, initialCombatState, currentEnemies, closeEncounter, activeActor, combatTargets, CombatResult, beginEncounter, chooseTarget, combatAction, castCombatSpell, quickFight … |
| src/shared/rules/creation.ts | 3447 | PORTRAIT_COUNT, ROSTER_LIMIT, ATTRIBUTE_TOTAL, RECRUIT_COST, HeroBlueprint, proposedHero, validateBlueprint, makeHero, createCustomParty, nextHeroId |
| src/shared/rules/expedition.ts | 16397 | ExpeditionState, initialExpedition, ExpeditionResult, expeditionDay, settleExpeditionTime, validateExpedition, campError, restExpedition, lockpickExpedition, searchExpedition, bashExpedition, interactExpedition, moveExpedition, expeditionMapSymbols |
| src/shared/rules/grid.ts | 7376 | Facing, GridAction, Pose, SecretWall, Trap, Fountain, GridMap, GridState, DIRECTIONS, FACING_NAMES, tileAt, doorAt, isOpaque, initialGridState, applyGridAction, validateGridMap |
| src/shared/rules/ground.ts | 9624 | GroundEntry, GroundContainer, GroundState, LootRequest, GroundResult, PLOT_GROUND, initialGround, groundReachable, nearbyGround, groundName, dropItem, makeGroundItem, lootGround, migrateGround, validateGround |
| src/shared/rules/inventory.ts | 26333 | ITEM_LIMIT_PER_CATEGORY, ITEM_LIMIT_TOTAL, ITEM_SLOTS, EquipmentSlot, ItemInstance, GroundDrop, BACKPACK_SORTS, BackpackSort, InventoryState, LOOT_TABLE, LOOT_CACHES, validateInventory, initialInventory, itemCategoryCount, giveItem, itemName, ItemCommand, ItemResult … |
| src/shared/rules/magic.ts | 39344 | SpellTarget, SpellContext, SpellEffect, SpellDefinition, SPELLS, STARTER_SPELLS, MagicEffectKind, MagicEffect, MagicState, initialMagicState, validateMagic, effectiveEffects, expireMagic, hasPartyWard, partyDefenseBonus, partyAttackBonus, partyFearImmune, finishCombatRound … |
| src/shared/rules/noncaster.ts | 3567 | StrikeProfile, strikeProfile, classStrikeText, setPrepared, setQuickAction |
| src/shared/rules/party.ts | 13671 | DAMAGE_TYPES, DamageType, CONDITION_IDS, ConditionId, Condition, QuickAction, PreparedStyle, PREPARED_STYLES, PREPARED_INFO, defaultPrepared, CombatSetup, defaultCombatSetup, Character, PartyState, modifier, proficiency, effectiveAttributes, XP_THRESHOLDS … |
| src/shared/rules/perspective.ts | 2369 | ViewPose, RayHit, CAMERA_PLANE, castRay, ScenerySlot, scenerySlots, viewPose |
| src/shared/rules/presentation.ts | 590 | PresentationEvent, emitPresentation, takePresentation |
| src/shared/rules/quests.ts | 25051 | MAIN_STAGES, OPTIONAL_QUESTS, OptionalQuestId, OptionalStatus, PLOT_ITEMS, UPPER_SCENES, UPPER_CLUES, VAULT_SCENES, VALVE_ORDER, TOWN_SCENES, QuestState, initialQuests, migrateQuests, validateQuests, QuestResult, acceptMain, acceptOptional, onTravelQuest … |
| src/shared/rules/rng.ts | 1739 | RngSnapshot, seedFromText, SeededRng |
| src/shared/rules/services.ts | 17226 | ServiceKind, TownService, TOWN_SERVICES, SHOP_STOCK, RUMORS, ServicesState, initialServices, validateServices, nearbyService, ServiceAction, ServiceRequest, ServiceResult, serviceAction |
| src/shared/rules/thievery.ts | 3648 | ThieveryState, initialThievery, STEAL_TABLE, bestThief, stealBonus, validateThievery |
| src/shared/saves/README.md | 480 |  |
| src/shared/saves/campaign-store.ts | 3606 | SLOT_IDS, SlotId, SAVE_PREFIX, StorageLike, SlotSummary, CampaignStore |

## Baseline data and assets

- public/content/foundation.json: contentVersion, roomId, title, classes
- public/content/galleries.json: id, name, rows, spawn, doors, props, portals, secrets, traps, fountains
- public/content/town.json: id, name, rows, spawn, doors, props, portals, fountains
- public/content/vault.json: id, name, rows, spawn, doors, props, secrets, traps, fountains, portals
- src: 58 files, 652,614 bytes.
- public/assets: 390 files, 27,453,937 bytes.
- art-source: 84 files, 108,765,660 bytes.
- tests: 44 files, 258,242 bytes.
- scripts: 50 files, 256,345 bytes.
- dist: 474 files, 41,353,282 bytes.

## Baseline files and package identities

See BASELINE_MANIFEST.json for original archive SHA-256 identities and every original file hash. Source masters are retained in art-source; only runtime assets go into browser output. Test scripts ending in -browser.mjs require Playwright/Chromium; npm check runs the *.test.mjs suite and TypeScript. Historical verification reports describe historical runs; current results are in VERIFICATION-MM01.md.


## Build and verification script entry points

| Existing script/group | Role and MM01 treatment |
| --- | --- |
| package.json scripts / tsconfig*.json | Original strict checks, test entry points and offline checker configs; preserved |
| vite.config.ts | Relative base URL, ES2022, sourcemaps and Phaser chunk split; preserved |
| scripts/build-offline.mjs | Portable ESM builder using shipped Phaser vendor and TS/Node transpilation; root build:game delegates here |
| scripts/build-galleries.mjs and build-*-gallery.mjs | Generate browser review galleries from production metadata; preserved |
| scripts/verify-build.mjs | Spawn server and compare every served browser file to disk; root verify:game delegates here |
| scripts/verify-module-graph.mjs | Check relative ESM and CSS resolution; run from nested engine folder |
| scripts/verify-ground-browser.mjs | Actual drop/loot/corpse/quest-pickup/reload/layout checks; rerun for MM01 |
| scripts/verify-*-browser.mjs | Additional optional Playwright scenarios; historical scripts remain available |
| scripts/verify-phase33-upgrade.mjs / verify-phase34-upgrade.mjs / verify-cache-regression.mjs | Historical cache/save upgrade regressions requiring their named baseline inputs |
| scripts/verify-packaged-release.mjs | Historical Phase 34 extracted-ZIP checks; fixed release assertion retained |
| scripts/package.mjs / scripts/package-zips.py | Historical Phase 34 naming; do not use to package Maker MM01 |
| scripts/prepare-*.py / pack-*.py / render-*-review.* / build-audio.py | Art/audio production/review utilities; preserved, not rerun as content generation in MM01 |
| tools/package-mm01.py at workspace root | New handoff packager for source/browser/Windows editor; not a generic game export implementation |

Browser checks require Playwright plus an installed Chromium binary; CHROMIUM_PATH can select one. They are optional developer dependencies, not player/editor prerequisites. Offline gallery generation is distinct from generating replacement artwork.
