# MP04 generated schema and diagnostic reference

Generated from the seven frozen MP01 schemas, six authored-payload schemas and diagnostic registry. Edit sources and regenerate. Schema tables describe shape; semantic validation additionally checks IDs, visibility, dependencies, positions and references. `[]` denotes an array item; `<n>` denotes a schema alternative or intersection branch.

## contracts/mp01/schemas/catalogue-lock.schema.json

Schema ID: `https://maxxia.invalid/contracts/mp01/catalogue-lock.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-catalogue-lock" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.rules` | yes | object |  |
| `$.rules.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:rules:[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=120` |
| `$.rules.version` | yes | ref common.schema.json#/$defs/version |  |
| `$.engineVersion` | yes | ref common.schema.json#/$defs/version |  |
| `$.packs` | yes | array | `minItems=1` `maxItems=128` |
| `$.packs[]` | yes | ref common.schema.json#/$defs/packPin |  |

## contracts/mp01/schemas/catalogue.schema.json

Schema ID: `https://maxxia.invalid/contracts/mp01/catalogue.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.engineVersion` | yes | ref common.schema.json#/$defs/version |  |
| `$.rules` | yes | object |  |
| `$.rules.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:rules:[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=120` |
| `$.rules.version` | yes | ref common.schema.json#/$defs/version |  |
| `$.packs` | yes | array | `minItems=1` `maxItems=128` |
| `$.packs[]` | yes | object |  |
| `$.packs[].manifest` | yes | ref pack.schema.json |  |
| `$.packs[].index` | yes | ref content-index.schema.json |  |

## contracts/mp01/schemas/character.schema.json

Schema ID: `https://maxxia.invalid/contracts/mp01/character.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-character" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.characterId` | yes | string | `pattern=^c_[a-z0-9_]{1,100}$` `minLength=1` `maxLength=120` |
| `$.revision` | yes | integer | `minimum=0` `maximum=9007199254740991` |
| `$.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.compatibility` | yes | object |  |
| `$.compatibility.rules` | yes | object |  |
| `$.compatibility.rules.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:rules:[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=120` |
| `$.compatibility.rules.version` | yes | ref common.schema.json#/$defs/version |  |
| `$.compatibility.requiredPacks` | yes | array | `minItems=1` `maxItems=128` |
| `$.compatibility.requiredPacks[]` | yes | ref common.schema.json#/$defs/packPin |  |
| `$.raceId` | yes | ref common.schema.json#/$defs/id |  |
| `$.classId` | yes | ref common.schema.json#/$defs/id |  |
| `$.level` | yes | integer | `minimum=1` `maximum=1000` |
| `$.xp` | yes | integer | `minimum=0` `maximum=9007199254740991` |
| `$.abilities` | yes | array | `minItems=0` `maxItems=1024` |
| `$.abilities[]` | yes | ref common.schema.json#/$defs/id |  |
| `$.items` | yes | array | `minItems=0` `maxItems=4096` |
| `$.items[]` | yes | object |  |
| `$.items[].instanceId` | yes | string | `pattern=^i_[a-z0-9_]{1,100}$` `minLength=1` `maxLength=120` |
| `$.items[].definitionId` | yes | ref common.schema.json#/$defs/id |  |
| `$.items[].quantity` | yes | integer | `minimum=1` `maximum=999999` |
| `$.items[].charges` | yes | integer \| null | `minimum=0` `maximum=999999` |
| `$.items[].binding` | yes | enum portable, campaign |  |
| `$.items[].originCampaignId` | yes | string \| null | `minLength=1` `maxLength=120` |
| `$.items[].state` | yes | object |  |
| `$.equipment` | yes | object |  |
| `$.conditions` | yes | array | `minItems=0` `maxItems=256` |
| `$.conditions[]` | yes | object |  |
| `$.conditions[].definitionId` | yes | ref common.schema.json#/$defs/id |  |
| `$.conditions[].remaining` | yes | integer \| null | `minimum=0` `maximum=999999` |
| `$.conditions[].unit` | yes | enum turns, minutes, persistent |  |
| `$.conditions[].portable` | yes | boolean |  |
| `$.conditions[].state` | yes | object |  |
| `$.resources` | yes | object |  |
| `$.state` | yes | object |  |

## contracts/mp01/schemas/common.schema.json

Schema ID: `https://maxxia.invalid/contracts/mp01/common.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | constraint |  |
| `#/$defs/namespace` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` `minLength=1` `maxLength=48` |
| `#/$defs/id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:(race\|class\|ability\|item\|recipe\|spell\|monster\|condition\|map\|npc\|dialogue\|quest\|routine\|encounter\|loot\|environment\|resource):[a-z][a-z0-9_]{0,79}$` `minLength=5` `maxLength=160` |
| `#/$defs/version` | yes | string | `pattern=^(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})$` `minLength=5` `maxLength=20` |
| `#/$defs/path` | yes | string | `pattern=^[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$` `minLength=3` `maxLength=240` |
| `#/$defs/hash` | yes | string | `pattern=^[a-f0-9]{64}$` `minLength=64` `maxLength=64` |
| `#/$defs/range` | yes | object |  |
| `#/$defs/range.min` | yes | string | `pattern=^(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})$` `minLength=1` `maxLength=120` |
| `#/$defs/range.maxExclusive` | yes | string | `pattern=^(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})$` `minLength=1` `maxLength=120` |
| `#/$defs/packPin` | yes | object |  |
| `#/$defs/packPin.packId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` `minLength=1` `maxLength=120` |
| `#/$defs/packPin.version` | yes | string | `pattern=^(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})\.(0\|[1-9][0-9]{0,5})$` `minLength=1` `maxLength=120` |
| `#/$defs/packPin.sha256` | yes | string | `pattern=^[a-f0-9]{64}$` `minLength=64` `maxLength=64` |

## contracts/mp01/schemas/content-index.schema.json

Schema ID: `https://maxxia.invalid/contracts/mp01/content-index.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-content-index" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.definitions` | yes | array | `minItems=1` `maxItems=4096` |
| `$.definitions[]` | yes | object |  |
| `$.definitions[].id` | yes | ref common.schema.json#/$defs/id |  |
| `$.definitions[].kind` | yes | enum race, class, ability, item, recipe, spell, monster, condition, map, npc, dialogue, quest, routine, encounter, loot, environment, resource |  |
| `$.definitions[].visibility` | yes | enum local, exported |  |
| `$.definitions[].file` | yes | ref common.schema.json#/$defs/path |  |
| `$.definitions[].placement` | yes | enum none, authored, eligible |  |
| `$.definitions[].tags` | yes | array | `minItems=0` `maxItems=64` |
| `$.definitions[].tags[]` | yes | string | `pattern=^[a-z][a-z0-9_:-]{0,79}$` `minLength=1` `maxLength=120` |
| `$.definitions[].references` | yes | array | `minItems=0` `maxItems=256` |
| `$.definitions[].references[]` | yes | oneOf |  |
| `$.definitions[].references[]<0>` | yes | object |  |
| `$.definitions[].references[]<0>.id` | yes | ref common.schema.json#/$defs/id |  |
| `$.definitions[].references[]<1>` | yes | object |  |
| `$.definitions[].references[]<1>.id` | yes | ref common.schema.json#/$defs/id |  |
| `$.definitions[].references[]<1>.whenPackEnabled` | yes | ref common.schema.json#/$defs/namespace |  |
| `$.definitions[].references[]<1>.onAbsent` | yes | const "skip" |  |

## contracts/mp01/schemas/pack.schema.json

Schema ID: `https://maxxia.invalid/contracts/mp01/pack.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-pack" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.packId` | yes | ref common.schema.json#/$defs/namespace |  |
| `$.title` | yes | string | `minLength=1` `maxLength=120` |
| `$.version` | yes | ref common.schema.json#/$defs/version |  |
| `$.kind` | yes | enum core, adventure, content |  |
| `$.engine` | yes | ref common.schema.json#/$defs/range |  |
| `$.rules` | yes | object |  |
| `$.rules.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:rules:[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=120` |
| `$.rules.version` | yes | ref common.schema.json#/$defs/version |  |
| `$.dependencies` | yes | array | `minItems=0` `maxItems=128` |
| `$.dependencies[]` | yes | object |  |
| `$.dependencies[].packId` | yes | ref common.schema.json#/$defs/namespace |  |
| `$.dependencies[].versions` | yes | ref common.schema.json#/$defs/range |  |
| `$.dependencies[].optional` | yes | boolean |  |
| `$.contentIndex` | yes | allOf |  |
| `$.contentIndex<0>` | yes | ref common.schema.json#/$defs/path |  |
| `$.contentIndex<1>` | yes | string | `pattern=\.json$` |
| `$.entry` | yes | oneOf |  |
| `$.entry<0>` | yes | null |  |
| `$.entry<1>` | yes | object |  |
| `$.entry<1>.mapId` | yes | ref common.schema.json#/$defs/id |  |
| `$.entry<1>.arrivalId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=120` |
| `$.credits` | yes | array | `minItems=1` `maxItems=64` |
| `$.credits[]` | yes | string | `minLength=1` `maxLength=300` |

## contracts/mp01/schemas/transfer.schema.json

Schema ID: `https://maxxia.invalid/contracts/mp01/transfer.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-character-transfer" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.transferId` | yes | string | `pattern=^t_[a-z0-9_]{1,100}$` `minLength=1` `maxLength=120` |
| `$.operation` | yes | enum move, copy |  |
| `$.sourceCampaignId` | yes | string | `minLength=1` `maxLength=120` |
| `$.destinationCampaignId` | yes | string | `minLength=1` `maxLength=120` |
| `$.sourceCharacterId` | yes | string | `pattern=^c_[a-z0-9_]{1,100}$` `minLength=1` `maxLength=120` |
| `$.destinationCharacterId` | yes | string | `pattern=^c_[a-z0-9_]{1,100}$` `minLength=1` `maxLength=120` |
| `$.sourceRevision` | yes | integer | `minimum=0` `maximum=9007199254740991` |
| `$.characterSha256` | yes | ref common.schema.json#/$defs/hash |  |
| `$.stage` | yes | enum prepared, imported, committed, cancelled |  |

## toolkit/schemas/ability.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp22/ability.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-ability" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.description` | yes | string | `minLength=1` `maxLength=1000` |
| `$.record.context` | yes | enum both, combat, exploration |  |
| `$.record.target` | yes | enum self, hero, party, enemy, enemies |  |
| `$.record.operations` | yes | array | `minItems=0` `maxItems=8` |
| `$.record.operations[]` | yes | oneOf |  |
| `$.record.operations[]<0>` | yes | object |  |
| `$.record.operations[]<0>.op` | yes | const "condition" |  |
| `$.record.operations[]<0>.conditionId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.operations[]<0>.duration` | yes | constraint |  |
| `$.record.operations[]<1>` | yes | object |  |
| `$.record.operations[]<1>.op` | yes | const "damage" |  |
| `$.record.operations[]<1>.amount` | yes | integer | `minimum=0` `maximum=100` |
| `$.record.operations[]<1>.damageType` | yes | string | `minLength=1` `maxLength=20` |
| `$.record.operations[]<1>.save` | no | object |  |
| `$.record.operations[]<1>.save.ability` | yes | enum CON, DEX, WIS |  |
| `$.record.operations[]<1>.save.dc` | yes | integer | `minimum=1` `maximum=30` |
| `$.record.operations[]<1>.save.half` | yes | boolean |  |
| `$.record.operations[]<2>` | yes | object |  |
| `$.record.operations[]<2>.op` | yes | const "heal" |  |
| `$.record.operations[]<2>.amount` | yes | integer | `minimum=0` `maximum=100` |
| `$.record.operations[]<3>` | yes | object |  |
| `$.record.operations[]<3>.op` | yes | const "dispel" |  |
| `$.record.operations[]<3>.tags` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.operations[]<3>.tags[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.operations[]<3>.max` | yes | integer | `minimum=1` `maximum=16` |
| `$.record.operations[]<4>` | yes | object |  |
| `$.record.operations[]<4>.op` | yes | const "summon-companion" |  |
| `$.record.operations[]<4>.kindId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79}$` |
| `$.record.operations[]<4>.lifetimeRounds` | yes | integer | `minimum=1` `maximum=6` |
| `$.record.activation` | no | object |  |
| `$.record.activation.mode` | yes | enum active, passive, triggered |  |
| `$.record.activation.classes` | yes | array | `minItems=1` `maxItems=16` |
| `$.record.activation.classes[]` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.activation.minLevel` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.activation.resource` | no | object |  |
| `$.record.activation.resource.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}:pool:[a-z][a-z0-9_]{0,31}$` |
| `$.record.activation.resource.base` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.activation.resource.perLevel` | yes | integer | `minimum=0` `maximum=30` |
| `$.record.activation.resource.maximum` | yes | integer | `minimum=1` `maximum=300` |
| `$.record.activation.resource.recovery` | yes | const "rest" |  |
| `$.record.activation.cost` | no | object |  |
| `$.record.activation.cost.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}:pool:[a-z][a-z0-9_]{0,31}$` |
| `$.record.activation.cost.amount` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.activation.cooldown` | no | object |  |
| `$.record.activation.cooldown.clock` | yes | enum minutes, rounds |  |
| `$.record.activation.cooldown.amount` | yes | integer | `minimum=1` `maximum=1000` |
| `$.record.activation.passive` | no | object |  |
| `$.record.activation.passive.attack` | yes | integer | `minimum=-5` `maximum=5` |
| `$.record.activation.passive.defense` | yes | integer | `minimum=-5` `maximum=5` |
| `$.record.activation.trigger` | no | const "block" |  |
| `$.record.exploration` | no | object |  |
| `$.record.exploration.tags` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.exploration.tags[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.exploration.range` | yes | integer | `minimum=1` `maximum=4` |
| `$.record.exploration.requiresSight` | yes | boolean |  |
| `$.record<0>` | yes | constraint |  |

## toolkit/schemas/class.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp20/class.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-class" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:class:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record` | yes | object |  |
| `$.record.name` | yes | string | `maxLength=2000` |
| `$.record.primary` | yes | enum STR, DEX, CON, INT, WIS, CHA |  |
| `$.record.hpBase` | yes | integer | `minimum=1` `maximum=500` |
| `$.record.hpGain` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.casting` | yes | enum STR, DEX, CON, INT, WIS, CHA,  |  |
| `$.record.role` | yes | string | `maxLength=2000` |
| `$.record.features` | yes | string | `maxLength=2000` |
| `$.record.equipmentTags` | yes | array | `minItems=1` `maxItems=11` |
| `$.record.equipmentTags[]` | yes | enum melee:staff, melee:dagger, melee:mace, melee:sword, melee:general, ranged, shield, armor:light, armor:medium, armor:heavy, accessory |  |
| `$.record.traits` | yes | array | `maxItems=12` |
| `$.record.traits[]` | yes | string | `pattern=^(?:martial_mastery\|device_training\|mutant_biology\|thornhide\|[a-z][a-z0-9_]{0,47}:trait:[a-z][a-z0-9_]{0,79})$` |
| `$.record.preparedStyles` | yes | array | `minItems=1` `maxItems=12` |
| `$.record.preparedStyles[]` | yes | string | `pattern=^(?:measured\|power\|bastion\|needle\|spark\|claws\|carapace\|standard\|[a-z][a-z0-9_]{0,47}:style:[a-z][a-z0-9_]{0,79})$` |
| `$.record.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:class:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record.spBase` | yes | integer | `minimum=0` `maximum=500` |
| `$.record.spGain` | yes | integer | `minimum=0` `maximum=100` |
| `$.record.spAttributeMultiplier` | yes | integer | `minimum=0` `maximum=20` |
| `$.record.starterEquipment` | no | object |  |
| `$.record.starterEquipment.melee` | no | oneOf |  |
| `$.record.starterEquipment.melee<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.starterEquipment.melee<1>` | yes | null |  |
| `$.record.starterEquipment.ranged` | no | oneOf |  |
| `$.record.starterEquipment.ranged<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.starterEquipment.ranged<1>` | yes | null |  |
| `$.record.starterEquipment.body` | no | oneOf |  |
| `$.record.starterEquipment.body<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.starterEquipment.body<1>` | yes | null |  |
| `$.record.starterEquipment.offhand` | no | oneOf |  |
| `$.record.starterEquipment.offhand<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.starterEquipment.offhand<1>` | yes | null |  |
| `$.record.abilityGrants` | no | array | `maxItems=32` |
| `$.record.abilityGrants[]` | yes | object |  |
| `$.record.abilityGrants[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:ability:[a-z][a-z0-9_]{0,79}$` |
| `$.record.abilityGrants[].minLevel` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.styleDefinitions` | no | array | `maxItems=12` |
| `$.record.styleDefinitions[]` | yes | object |  |
| `$.record.styleDefinitions[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:style:[a-z][a-z0-9_]{0,79}$` |
| `$.record.styleDefinitions[].name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.styleDefinitions[].description` | yes | string | `maxLength=500` |
| `$.record.styleDefinitions[].operation` | yes | enum weapon, device, natural |  |
| `$.record.styleDefinitions[].requiredTrait` | yes | constraint |  |
| `$.record.styleDefinitions[].attackBonus` | yes | integer | `minimum=-20` `maximum=20` |
| `$.record.styleDefinitions[].attackBonusAtVeteran` | yes | integer | `minimum=0` `maximum=20` |
| `$.record.styleDefinitions[].damageBonus` | yes | integer | `minimum=0` `maximum=20` |
| `$.record.styleDefinitions[].damageBonusAtMilestone` | yes | integer | `minimum=0` `maximum=20` |
| `$.record.styleDefinitions[].damageBonusAtMilestoneReplacesBase` | yes | boolean |  |
| `$.record.styleDefinitions[].ignoreDefense` | yes | integer | `minimum=0` `maximum=20` |
| `$.record.styleDefinitions[].damageType` | yes | enum physical, lightning |  |
| `$.record.styleDefinitions[].dice` | yes | string | `pattern=^(?:[1-9][0-9]?d(?:4\|6\|8\|10\|12\|20)\|[1-9][0-9]?)$` |
| `$.record.styleDefinitions[].diceAtMilestone` | yes | constraint |  |
| `$.record.styleDefinitions[].diceAtVeteran` | yes | constraint |  |
| `$.record.styleDefinitions[].defenseBonus` | yes | integer | `minimum=0` `maximum=20` |
| `$.record.styleDefinitions[].defenseAtVeteran` | yes | integer | `minimum=0` `maximum=20` |
| `$.record.creationChoices` | no | array | `minItems=1` `maxItems=12` |
| `$.record.creationChoices[]` | yes | object |  |
| `$.record.creationChoices[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,79}$` |
| `$.record.creationChoices[].name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.creationChoices[].description` | yes | string | `maxLength=500` |
| `$.record.creationChoices[].attributeBonuses` | no | object |  |
| `$.record.creationChoices[].attributeBonuses.STR` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.creationChoices[].attributeBonuses.DEX` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.creationChoices[].attributeBonuses.CON` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.creationChoices[].attributeBonuses.INT` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.creationChoices[].attributeBonuses.WIS` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.creationChoices[].attributeBonuses.CHA` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.creationChoices[].starterEquipment` | no | object |  |
| `$.record.creationChoices[].starterEquipment.melee` | no | oneOf |  |
| `$.record.creationChoices[].starterEquipment.melee<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.creationChoices[].starterEquipment.melee<1>` | yes | null |  |
| `$.record.creationChoices[].starterEquipment.ranged` | no | oneOf |  |
| `$.record.creationChoices[].starterEquipment.ranged<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.creationChoices[].starterEquipment.ranged<1>` | yes | null |  |
| `$.record.creationChoices[].starterEquipment.body` | no | oneOf |  |
| `$.record.creationChoices[].starterEquipment.body<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.creationChoices[].starterEquipment.body<1>` | yes | null |  |
| `$.record.creationChoices[].starterEquipment.offhand` | no | oneOf |  |
| `$.record.creationChoices[].starterEquipment.offhand<0>` | yes | string | `pattern=^(?:[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}\|item_[a-z0-9_]{1,70})$` `maxLength=160` |
| `$.record.creationChoices[].starterEquipment.offhand<1>` | yes | null |  |
| `$.record.creationChoices[].abilityGrants` | no | array | `maxItems=32` |
| `$.record.creationChoices[].abilityGrants[]` | yes | object |  |
| `$.record.creationChoices[].abilityGrants[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:ability:[a-z][a-z0-9_]{0,79}$` |
| `$.record.creationChoices[].abilityGrants[].minLevel` | yes | integer | `minimum=1` `maximum=20` |

## toolkit/schemas/condition.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp18/condition.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-condition" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=80` |
| `$.record.description` | yes | string | `minLength=1` `maxLength=500` |
| `$.record.clock` | yes | enum minutes, rounds, persistent |  |
| `$.record.maxDuration` | yes | integer | `minimum=1` `maximum=60` |
| `$.record.stacking` | yes | enum refresh, extend, stack, reject |  |
| `$.record.maxStacks` | yes | integer | `minimum=1` `maximum=3` |
| `$.record.tags` | yes | array | `maxItems=8` |
| `$.record.tags[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.immuneTags` | yes | array | `maxItems=8` |
| `$.record.immuneTags[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.dispelTags` | yes | array | `maxItems=8` |
| `$.record.dispelTags[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.modifiers` | yes | object |  |
| `$.record.modifiers.attack` | yes | integer | `minimum=-5` `maximum=5` |
| `$.record.modifiers.defense` | yes | integer | `minimum=-5` `maximum=5` |
| `$.record.modifiers.save` | yes | integer | `minimum=-5` `maximum=5` |
| `$.record.modifiers.resistance` | yes | object |  |
| `$.record.periodic` | no | object |  |
| `$.record.periodic.amount` | yes | integer | `minimum=1` `maximum=10` |
| `$.record.periodic.damageType` | yes | string | `minLength=1` `maxLength=20` |
| `$.record.save` | no | object |  |
| `$.record.save.ability` | yes | enum CON, DEX, WIS |  |
| `$.record.save.dc` | yes | integer | `minimum=1` `maximum=30` |
| `$.record.save.timing` | yes | enum apply, minute, round-end |  |

## toolkit/schemas/dialogue.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp14/dialogue.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-dialogue" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.entry` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.nodes` | yes | array | `minItems=1` `maxItems=32` |
| `$.record.nodes[]` | yes | object |  |
| `$.record.nodes[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.nodes[].text` | yes | string | `minLength=1` `maxLength=2000` |
| `$.record.nodes[].terminal` | no | boolean |  |
| `$.record.nodes[].choices` | yes | array | `maxItems=8` |
| `$.record.nodes[].choices[]` | yes | object |  |
| `$.record.nodes[].choices[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.nodes[].choices[].text` | yes | string | `minLength=1` `maxLength=300` |
| `$.record.nodes[].choices[].next` | yes | constraint |  |
| `$.record.nodes[].choices[].condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.nodes[].choices[].unavailable` | no | enum hide, disable |  |
| `$.record.nodes[].choices[].unavailableText` | no | string | `minLength=1` `maxLength=300` |
| `$.record.nodes[].choices[].once` | no | boolean |  |
| `$.record.nodes[].choices[].effects` | no | array | `maxItems=16` |
| `$.record.nodes[].choices[].effects[]` | yes | oneOf |  |
| `$.record.nodes[].choices[].effects[]<0>` | yes | object |  |
| `$.record.nodes[].choices[].effects[]<0>.op` | yes | enum attitude, gold |  |
| `$.record.nodes[].choices[].effects[]<0>.delta` | yes | integer | `minimum=-1000000` `maximum=1000000` |
| `$.record.nodes[].choices[].effects[]<1>` | yes | object |  |
| `$.record.nodes[].choices[].effects[]<1>.op` | yes | enum remember, forget |  |
| `$.record.nodes[].choices[].effects[]<1>.fact` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.nodes[].choices[].effects[]<2>` | yes | object |  |
| `$.record.nodes[].choices[].effects[]<2>.op` | yes | enum give-item, take-item |  |
| `$.record.nodes[].choices[].effects[]<2>.itemId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.nodes[].choices[].effects[]<2>.count` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.nodes[].choices[].routine` | no | object |  |
| `$.record.nodes[].choices[].routine.routineId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.nodes[].choices[].routine.args` | yes | object |  |

## toolkit/schemas/encounter.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp16/encounter.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-encounter" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,15}:encounter:[a-z][a-z0-9_]{0,23}$` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.description` | yes | string | `minLength=1` `maxLength=2000` |
| `$.record.mapId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.nativeMapId` | yes | string | `minLength=1` `maxLength=80` |
| `$.record.x` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.y` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.range` | yes | integer | `minimum=0` `maximum=4` |
| `$.record.trigger` | yes | object |  |
| `$.record.trigger.kind` | yes | enum proximity, clock, rest |  |
| `$.record.trigger.interval` | yes | integer | `minimum=1` `maximum=10080` |
| `$.record.trigger.table` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.weight` | yes | integer | `minimum=1` `maximum=1000` |
| `$.record.members` | yes | array | `minItems=1` `maxItems=3` |
| `$.record.members[]` | yes | object |  |
| `$.record.members[].kindId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.members[].dx` | yes | integer | `minimum=-4` `maximum=4` |
| `$.record.members[].dy` | yes | integer | `minimum=-4` `maximum=4` |
| `$.record.bribe` | yes | constraint |  |
| `$.record.avoidDC` | yes | constraint |  |
| `$.record.condition` | no | constraint |  |
| `$.record.respawn` | yes | object |  |
| `$.record.respawn.kind` | yes | enum never, reentry, cooldown |  |
| `$.record.respawn.minutes` | yes | integer | `minimum=1` `maximum=10080` |
| `$.record.phases` | yes | array | `minItems=1` `maxItems=4` |
| `$.record.phases[]` | yes | object |  |
| `$.record.phases[].title` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.phases[].healthPercent` | yes | integer | `minimum=1` `maximum=100` |

## toolkit/schemas/environment.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp24/environment.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-environment" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:environment:[a-z][a-z0-9_]{0,79}$` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:environment:[a-z][a-z0-9_]{0,79}$` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=120` |
| `$.record.skyResourceId` | yes | constraint |  |
| `$.record.skyColor` | yes | string | `pattern=^#[a-fA-F0-9]{6}$` |
| `$.record.fogColor` | yes | string | `pattern=^#[a-fA-F0-9]{6}$` |
| `$.record.fogStrength` | yes | number | `minimum=0` `maximum=0.5` |
| `$.record.materials` | yes | array | `minItems=3` `maxItems=128` |
| `$.record.materials[]` | yes | object |  |
| `$.record.materials[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,63}$` |
| `$.record.materials[].name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.materials[].surface` | yes | enum floor, wall, ceiling |  |
| `$.record.materials[].resourceId` | yes | constraint |  |
| `$.record.scene` | no | object |  |
| `$.record.scene.renderer` | yes | enum courtyard, waterworks, vault |  |
| `$.record.scene.legacyScenery` | no | const false |  |
| `$.record.scene.textures` | no | object |  |
| `$.record.scene.wallTexture` | yes | string |  |
| `$.record.scene.floorTexture` | yes | string |  |
| `$.record.scene.doorTexture` | yes | string |  |
| `$.record.scene.walls` | no | array | `maxItems=1024` |
| `$.record.scene.walls[]` | yes | object |  |
| `$.record.scene.walls[].x` | yes | integer | `minimum=-1024` `maximum=1023` |
| `$.record.scene.walls[].y` | yes | integer | `minimum=-1024` `maximum=1023` |
| `$.record.scene.walls[].width` | yes | integer | `minimum=1` `maximum=2048` |
| `$.record.scene.walls[].height` | yes | integer | `minimum=1` `maximum=2048` |
| `$.record.scene.walls[].texture` | yes | string | `minLength=1` `maxLength=40` |
| `$.record.scene.floors` | no | array | `maxItems=1024` |
| `$.record.scene.floors[]` | yes | object |  |
| `$.record.scene.floors[].x` | yes | integer | `minimum=-1024` `maximum=1023` |
| `$.record.scene.floors[].y` | yes | integer | `minimum=-1024` `maximum=1023` |
| `$.record.scene.floors[].width` | yes | integer | `minimum=1` `maximum=2048` |
| `$.record.scene.floors[].height` | yes | integer | `minimum=1` `maximum=2048` |
| `$.record.scene.floors[].texture` | yes | string | `minLength=1` `maxLength=40` |
| `$.record.scene.doors` | no | object |  |
| `$.record.scene.tintColor` | no | string | `pattern=^#[a-fA-F0-9]{6}$` |
| `$.record.scene.tintStrength` | no | number | `minimum=0` `maximum=0.7` |
| `$.record.sprites` | no | array | `maxItems=64` |
| `$.record.sprites[]` | yes | object |  |
| `$.record.sprites[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.sprites[].sources` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.sprites[].sources[]` | yes | object |  |
| `$.record.sprites[].sources[].resourceId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:resource:[a-z][a-z0-9_]{0,79}$` |
| `$.record.sprites[].sources[].width` | yes | integer | `minimum=1` `maximum=4096` |
| `$.record.sprites[].sources[].height` | yes | integer | `minimum=1` `maximum=4096` |
| `$.record.sprites[].frames` | yes | array | `minItems=1` `maxItems=256` |
| `$.record.sprites[].frames[]` | yes | object |  |
| `$.record.sprites[].frames[].source` | yes | integer | `minimum=0` `maximum=7` |
| `$.record.sprites[].frames[].x` | yes | integer | `minimum=0` `maximum=4095` |
| `$.record.sprites[].frames[].y` | yes | integer | `minimum=0` `maximum=4095` |
| `$.record.sprites[].frames[].width` | yes | integer | `minimum=1` `maximum=4096` |
| `$.record.sprites[].frames[].height` | yes | integer | `minimum=1` `maximum=4096` |
| `$.record.sprites[].animations` | yes | array | `minItems=1` `maxItems=16` |
| `$.record.sprites[].animations[]` | yes | object |  |
| `$.record.sprites[].animations[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.sprites[].animations[].frames` | yes | array | `minItems=1` `maxItems=64` |
| `$.record.sprites[].animations[].frames[]` | yes | integer | `minimum=0` `maximum=255` |
| `$.record.sprites[].animations[].fps` | yes | number | `minimum=0` `maximum=24` |
| `$.record.sprites[].animations[].loop` | yes | boolean |  |
| `$.record.sprites[].defaultAnimation` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.sprites[].pivot` | yes | object |  |
| `$.record.sprites[].pivot.x` | yes | number | `minimum=0` `maximum=1` |
| `$.record.sprites[].pivot.y` | yes | number | `minimum=0` `maximum=1` |
| `$.record.sprites[].directionOffsets` | no | array | `minItems=4` `maxItems=4` |
| `$.record.sprites[].directionOffsets[]` | yes | integer | `minimum=0` `maximum=255` |
| `$.record.sprites[].fallback` | yes | enum placeholder, hide |  |

## toolkit/schemas/item.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp04/item.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-item" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record.name` | yes | string | `maxLength=2000` |
| `$.record.category` | yes | enum weapons, armor, accessories, misc |  |
| `$.record.price` | yes | integer | `minimum=0` `maximum=100000000` |
| `$.record.maxDurability` | yes | integer | `minimum=0` `maximum=10000` |
| `$.record.maxCharges` | yes | integer | `minimum=0` `maximum=10000` |
| `$.record.effect` | yes | enum none, heal, antidote, wake, courage, light, escape, acid, spark, venom, recall, identify, ward, reveal, composed |  |
| `$.record.power` | yes | integer | `minimum=0` `maximum=100000` |
| `$.record.unique` | yes | boolean |  |
| `$.record.slot` | yes | enum melee, ranged, body, offhand, accessory,  |  |
| `$.record.weight` | yes | enum light, medium, heavy,  |  |
| `$.record.armor` | yes | integer | `minimum=0` `maximum=10000` |
| `$.record.dice` | yes | string \| null | `pattern=^[1-9][0-9]?d(?:[1-9][0-9]?\|100)$` |
| `$.record.accuracy` | yes | integer | `minimum=-1000` `maximum=1000` |
| `$.record.resistance` | yes | string \| null | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.resistBonus` | yes | integer | `minimum=-100` `maximum=100` |
| `$.record.description` | yes | string | `maxLength=2000` |
| `$.record.iconResourceId` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}:resource:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record.equipmentTags` | no | array | `maxItems=20` |
| `$.record.equipmentTags[]` | yes | string | `pattern=^[a-z][a-z0-9_:]{0,47}$` `maxLength=48` |
| `$.record.portability` | no | enum exportable, campaign-bound |  |
| `$.record.effectId` | no | string | `pattern=^[a-z][a-z0-9_]{0,31}:ability:[a-z][a-z0-9_]{0,31}$` |
| `$.record.attunement` | no | boolean |  |
| `$.record.curseOnEquip` | no | boolean |  |
| `$.record.curseOnUse` | no | boolean |  |
| `$.record.passive` | no | object |  |
| `$.record.passive.attack` | no | integer | `minimum=-5` `maximum=5` |
| `$.record.passive.defense` | no | integer | `minimum=-5` `maximum=5` |
| `$.record.equipRequirements` | no | object |  |
| `$.record.equipRequirements.minLevel` | no | integer | `minimum=1` `maximum=20` |
| `$.record.equipRequirements.classIds` | no | array | `minItems=1` `maxItems=12` |
| `$.record.equipRequirements.classIds[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:class:[a-z][a-z0-9_]{0,79}$` |
| `$.record.equipRequirements.raceIds` | no | array | `minItems=1` `maxItems=12` |
| `$.record.equipRequirements.raceIds[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:race:[a-z][a-z0-9_]{0,79}$` |
| `$.record.exploration` | no | object |  |
| `$.record.exploration.tags` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.exploration.tags[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.exploration.range` | yes | integer | `minimum=1` `maximum=4` |
| `$.record.exploration.requiresSight` | yes | boolean |  |

## toolkit/schemas/map-v2.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp13/map.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-map" |  |
| `$.formatVersion` | yes | const 2 |  |
| `$.id` | yes | string |  |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string |  |
| `$.record.name` | yes | string |  |
| `$.record.rows` | yes | array | `minItems=3` `maxItems=64` |
| `$.record.rows[]` | yes | string |  |
| `$.record.spawn` | yes | object |  |
| `$.record.doors` | yes | array |  |
| `$.record.props` | yes | array |  |
| `$.record.arrivals` | yes | array |  |
| `$.record.entities` | no | array | `maxItems=64` |
| `$.record.entities[]` | yes | object |  |
| `$.record.entities[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:object:[a-z][a-z0-9_]{0,47}$` |
| `$.record.entities[].name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.entities[].description` | yes | string | `minLength=1` `maxLength=2000` |
| `$.record.entities[].x` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.entities[].y` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.entities[].kind` | yes | enum object, door, container, secret, npc |  |
| `$.record.entities[].doorId` | no | string | `minLength=1` `maxLength=128` |
| `$.record.entities[].secretId` | no | string | `minLength=1` `maxLength=128` |
| `$.record.entities[].hidden` | no | boolean |  |
| `$.record.entities[].searchDC` | no | integer | `minimum=1` `maximum=30` |
| `$.record.entities[].lock` | no | object |  |
| `$.record.entities[].lock.keyItemId` | no | string | `minLength=1` `maxLength=128` |
| `$.record.entities[].lock.consumeKey` | no | boolean |  |
| `$.record.entities[].lock.pickDC` | no | integer | `minimum=1` `maximum=30` |
| `$.record.entities[].lock.forceDC` | no | integer | `minimum=1` `maximum=30` |
| `$.record.entities[].rewards` | no | array | `minItems=1` `maxItems=8` |
| `$.record.entities[].rewards[]` | yes | object |  |
| `$.record.entities[].rewards[].itemId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.entities[].rewards[].count` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.entities[].onUse` | no | object |  |
| `$.record.entities[].onUse.routineId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.entities[].onUse.args` | yes | object |  |
| `$.record.entities[].appearance` | no | object |  |
| `$.record.entities[].appearance.idle` | no | enum mirror, brazier, crystal, banner, chest_closed, chest_open, lever_off, lever_on, marker, npc |  |
| `$.record.entities[].appearance.used` | no | enum mirror, brazier, crystal, banner, chest_closed, chest_open, lever_off, lever_on, marker, npc |  |
| `$.record.entities[].appearance.closed` | no | enum mirror, brazier, crystal, banner, chest_closed, chest_open, lever_off, lever_on, marker, npc |  |
| `$.record.entities[].appearance.open` | no | enum mirror, brazier, crystal, banner, chest_closed, chest_open, lever_off, lever_on, marker, npc |  |
| `$.record.entities[].appearance.claimed` | no | enum mirror, brazier, crystal, banner, chest_closed, chest_open, lever_off, lever_on, marker, npc |  |
| `$.record.entities[].npcId` | no | string | `minLength=1` `maxLength=128` |
| `$.record.entities[].hazardId` | no | string | `minLength=1` `maxLength=48` |
| `$.record.entities[].capabilities` | no | array | `minItems=1` `maxItems=8` |
| `$.record.entities[].capabilities[]` | yes | object |  |
| `$.record.entities[].capabilities[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.entities[].capabilities[].label` | yes | string | `minLength=1` `maxLength=80` |
| `$.record.entities[].capabilities[].tag` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.entities[].capabilities[].outcome` | yes | enum unlock, open, reveal, disarm, use, traverse |  |
| `$.record.entities[].capabilities[].minutes` | yes | integer | `minimum=1` `maximum=30` |
| `$.record.entities[].capabilities[].destination` | no | object |  |
| `$.record.entities[].capabilities[].destination.x` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.entities[].capabilities[].destination.y` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.recovery` | no | object |  |
| `$.record.recovery.mapId` | yes | string | `pattern=^map_[a-z0-9_]+$` |
| `$.record.recovery.arrivalId` | yes | string | `minLength=1` `maxLength=80` |
| `$.record.workshops` | no | array | `maxItems=16` |
| `$.record.workshops[]` | yes | object |  |
| `$.record.workshops[].id` | yes | string | `pattern=^[a-z0-9_]{1,48}$` |
| `$.record.workshops[].x` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.workshops[].y` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.environmentId` | no | string | `pattern=^(environment_default\|[a-z][a-z0-9_]{0,47}:environment:[a-z][a-z0-9_]{0,79})$` |
| `$.record.spritePlacements` | no | array | `maxItems=128` |
| `$.record.spritePlacements[]` | yes | object |  |
| `$.record.spritePlacements[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].spriteId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].x` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.spritePlacements[].y` | yes | integer | `minimum=0` `maximum=63` |
| `$.record.spritePlacements[].scale` | yes | number | `minimum=0.1` `maximum=3` |
| `$.record.spritePlacements[].facing` | yes | integer | `minimum=0` `maximum=3` |
| `$.record.spritePlacements[].entityId` | no | string |  |
| `$.record.spritePlacements[].propId` | no | string |  |
| `$.record.spritePlacements[].animation` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations` | no | object |  |
| `$.record.spritePlacements[].stateAnimations.idle` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.used` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.closed` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.open` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.claimed` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.active` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.guarded` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.attack` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.hurt` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].stateAnimations.dead` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.spritePlacements[].hotspot` | no | object |  |
| `$.record.spritePlacements[].hotspot.x` | yes | number | `minimum=0` `maximum=1` |
| `$.record.spritePlacements[].hotspot.y` | yes | number | `minimum=0` `maximum=1` |
| `$.record.spritePlacements[].hotspot.width` | yes | number | `minimum=0.01` `maximum=1` |
| `$.record.spritePlacements[].hotspot.height` | yes | number | `minimum=0.01` `maximum=1` |
| `$.record.spritePlacements[].mount` | no | enum floor, wall |  |
| `$.record.enemyAppearances` | no | array | `maxItems=32` |
| `$.record.enemyAppearances[]` | yes | object |  |
| `$.record.enemyAppearances[].kindId` | yes | string |  |
| `$.record.enemyAppearances[].spriteId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].scale` | yes | number | `minimum=0.1` `maximum=3` |
| `$.record.enemyAppearances[].facing` | yes | integer | `minimum=0` `maximum=3` |
| `$.record.enemyAppearances[].stateAnimations` | no | object |  |
| `$.record.enemyAppearances[].stateAnimations.idle` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.used` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.closed` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.open` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.claimed` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.active` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.guarded` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.attack` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.hurt` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.enemyAppearances[].stateAnimations.dead` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}$` |
| `$.record.terrain` | no | object |  |
| `$.record.terrain.version` | yes | const 1 |  |
| `$.record.terrain.initialConfigurationId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.terrain.changeMinutes` | yes | integer | `minimum=1` `maximum=10` |
| `$.record.terrain.recovery` | yes | object |  |
| `$.record.terrain.recovery.x` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.recovery.y` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.recovery.entityId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:object:[a-z][a-z0-9_]{0,47}$` |
| `$.record.terrain.configurations` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.terrain.configurations[]` | yes | object |  |
| `$.record.terrain.configurations[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.terrain.configurations[].name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.terrain.configurations[].cells` | yes | array | `maxItems=256` |
| `$.record.terrain.configurations[].cells[]` | yes | object |  |
| `$.record.terrain.configurations[].cells[].x` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.configurations[].cells[].y` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.configurations[].cells[].kind` | yes | enum floor, wall, bridge, pit, liquid, conveyor, teleporter |  |
| `$.record.terrain.configurations[].cells[].elevation` | no | integer | `minimum=-2` `maximum=2` |
| `$.record.terrain.configurations[].cells[].minutes` | no | integer | `minimum=0` `maximum=5` |
| `$.record.terrain.configurations[].cells[].damage` | no | integer | `minimum=0` `maximum=20` |
| `$.record.terrain.configurations[].cells[].direction` | no | integer | `minimum=0` `maximum=3` |
| `$.record.terrain.configurations[].cells[].destination` | no | object |  |
| `$.record.terrain.configurations[].cells[].destination.x` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.configurations[].cells[].destination.y` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.configurations[].cells[].facing` | no | integer | `minimum=0` `maximum=3` |
| `$.record.terrain.configurations[].blockedEdges` | yes | array | `maxItems=128` |
| `$.record.terrain.configurations[].blockedEdges[]` | yes | object |  |
| `$.record.terrain.configurations[].blockedEdges[].x` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.configurations[].blockedEdges[].y` | yes | integer | `minimum=1` `maximum=62` |
| `$.record.terrain.configurations[].blockedEdges[].direction` | yes | integer | `minimum=0` `maximum=3` |
| `$.record.terrain.transitions` | yes | array | `maxItems=32` |
| `$.record.terrain.transitions[]` | yes | object |  |
| `$.record.terrain.transitions[].from` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `$.record.terrain.transitions[].to` | yes | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |

## toolkit/schemas/map.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp02/map.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-map" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:(map\|routine):[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=160` |
| `$.name` | yes | string | `minLength=1` `maxLength=120` |
| `$.rows` | yes | array | `minItems=3` `maxItems=128` |
| `$.rows[]` | yes | string | `pattern=^[#.]+$` `minLength=1` `maxLength=128` |
| `$.arrivals` | yes | array | `minItems=1` `maxItems=128` |
| `$.arrivals[]` | yes | object |  |
| `$.arrivals[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=80` |
| `$.arrivals[].x` | yes | integer | `minimum=0` `maximum=127` |
| `$.arrivals[].y` | yes | integer | `minimum=0` `maximum=127` |
| `$.arrivals[].facing` | yes | integer | `minimum=0` `maximum=3` |
| `$.objects` | yes | array | `minItems=0` `maxItems=256` |
| `$.objects[]` | yes | object |  |
| `$.objects[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=80` |
| `$.objects[].name` | yes | string | `minLength=1` `maxLength=100` |
| `$.objects[].x` | yes | integer | `minimum=0` `maximum=127` |
| `$.objects[].y` | yes | integer | `minimum=0` `maximum=127` |
| `$.objects[].onInteract` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:(map\|routine):[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=160` |

## toolkit/schemas/monster.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp22/monster.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-monster" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record.name` | yes | string | `maxLength=2000` |
| `$.record.hp` | yes | integer | `minimum=1` `maximum=100000` |
| `$.record.defense` | yes | integer | `minimum=0` `maximum=200` |
| `$.record.attack` | yes | integer | `minimum=-100` `maximum=200` |
| `$.record.damage` | yes | string | `maxLength=2000` |
| `$.record.speed` | yes | integer | `minimum=0` `maximum=200` |
| `$.record.xp` | yes | integer | `minimum=0` `maximum=1000000` |
| `$.record.gold` | yes | integer | `minimum=0` `maximum=1000000` |
| `$.record.symbol` | yes | string | `maxLength=2000` |
| `$.record.attributes` | yes | object |  |
| `$.record.attributes.DEX` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.attributes.WIS` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.attributes.CON` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.undead` | yes | boolean |  |
| `$.record.resistances` | yes | object |  |
| `$.record.visualId` | yes | enum dust_imp, stone_mite, gallery_watcher, cistern_rat, sludge_leech, pipe_goblin, bell_wraith, valve_sentinel, bell_heart |  |
| `$.record.aiPattern` | yes | enum standard, resonance |  |
| `$.record.abilities` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.abilities[]` | yes | object |  |
| `$.record.abilities[].id` | yes | string | `maxLength=2000` |
| `$.record.abilities[].kind` | yes | enum strike, spectral |  |
| `$.record.abilities[].weight` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.abilities[].when` | yes | enum always, odd_round, even_round, hurt, healthy |  |
| `$.record.abilities[].bonusDamage` | yes | integer | `minimum=0` `maximum=100` |
| `$.record.guaranteedLootItemId` | no | string | `pattern=^[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.record.behavior` | no | object |  |
| `$.record.behavior.rules` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.behavior.rules[]` | yes | object |  |
| `$.record.behavior.rules[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{1,79}$` |
| `$.record.behavior.rules[].priority` | yes | integer | `minimum=0` `maximum=100` |
| `$.record.behavior.rules[].when` | yes | enum always, hurt, healthy, adjacent, distant, odd_round, even_round |  |
| `$.record.behavior.rules[].action` | yes | enum strike, approach, guard, heal, summon |  |
| `$.record.behavior.rules[].amount` | no | integer | `minimum=1` `maximum=20` |
| `$.record.behavior.rules[].kindId` | no | string | `maxLength=160` |
| `$.record.behavior.rules[].maxUses` | no | integer | `minimum=1` `maximum=3` |
| `$.record.behavior.rules[].lifetimeRounds` | no | integer | `minimum=1` `maximum=6` |
| `$.record.behavior.phases` | no | array | `maxItems=3` |
| `$.record.behavior.phases[]` | yes | object |  |
| `$.record.behavior.phases[].atOrBelowPercent` | yes | integer | `minimum=1` `maximum=100` |
| `$.record.behavior.phases[].title` | yes | string | `maxLength=100` |
| `$.record.behavior.phases[].attackBonus` | yes | integer | `minimum=-5` `maximum=5` |
| `$.record.behavior.phases[].defenseBonus` | yes | integer | `minimum=-5` `maximum=5` |
| `$.record.behavior.phases[].damageBonus` | yes | integer | `minimum=-5` `maximum=5` |

## toolkit/schemas/npc.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp14/npc.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-npc" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.dialogueId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.initialAttitude` | yes | integer | `minimum=-100` `maximum=100` |
| `$.record.services` | yes | array | `maxItems=8` |
| `$.record.services[]` | yes | oneOf |  |
| `$.record.services[]<0>` | yes | object |  |
| `$.record.services[]<0>.kind` | yes | const "shop" |  |
| `$.record.services[]<0>.id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.services[]<0>.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.services[]<0>.condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.services[]<0>.minAttitude` | no | integer | `minimum=-100` `maximum=100` |
| `$.record.services[]<0>.stock` | yes | array | `maxItems=32` |
| `$.record.services[]<0>.stock[]` | yes | object |  |
| `$.record.services[]<0>.stock[].itemId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.services[]<0>.stock[].quantity` | yes | integer | `minimum=1` `maximum=1000` |
| `$.record.services[]<0>.stock[].price` | no | integer | `minimum=1` `maximum=1000000` |
| `$.record.services[]<0>.generic` | no | object |  |
| `$.record.services[]<0>.generic.tags` | yes | array | `minItems=1` `maxItems=8` |
| `$.record.services[]<0>.generic.tags[]` | yes | string | `minLength=1` `maxLength=80` |
| `$.record.services[]<0>.generic.quantity` | yes | integer | `minimum=1` `maximum=1000` |
| `$.record.services[]<0>.generic.maxItems` | yes | integer | `minimum=1` `maximum=32` |
| `$.record.services[]<0>.buybackPercent` | no | integer | `minimum=0` `maximum=50` |
| `$.record.services[]<1>` | yes | object |  |
| `$.record.services[]<1>.kind` | yes | const "healing" |  |
| `$.record.services[]<1>.id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.services[]<1>.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.services[]<1>.condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.services[]<1>.minAttitude` | no | integer | `minimum=-100` `maximum=100` |
| `$.record.services[]<1>.cost` | yes | integer | `minimum=0` `maximum=1000000` |
| `$.record.services[]<1>.amount` | yes | integer | `minimum=1` `maximum=1000` |
| `$.record.services[]<2>` | yes | object |  |
| `$.record.services[]<2>.kind` | yes | const "training" |  |
| `$.record.services[]<2>.id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.services[]<2>.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.services[]<2>.condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.services[]<2>.minAttitude` | no | integer | `minimum=-100` `maximum=100` |
| `$.record.services[]<3>` | yes | object |  |
| `$.record.services[]<3>.kind` | yes | const "tribute" |  |
| `$.record.services[]<3>.id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.services[]<3>.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.services[]<3>.condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.services[]<3>.minAttitude` | no | integer | `minimum=-100` `maximum=100` |
| `$.record.services[]<3>.cost` | yes | integer | `minimum=1` `maximum=1000000` |
| `$.record.services[]<3>.attitudeDelta` | yes | integer | `minimum=-100` `maximum=100` |
| `$.record.services[]<3>.once` | no | boolean |  |
| `$.record.services[]<4>` | yes | object |  |
| `$.record.services[]<4>.kind` | yes | const "barter" |  |
| `$.record.services[]<4>.id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.services[]<4>.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.services[]<4>.condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.services[]<4>.minAttitude` | no | integer | `minimum=-100` `maximum=100` |
| `$.record.services[]<4>.offers` | yes | array | `minItems=1` `maxItems=16` |
| `$.record.services[]<4>.offers[]` | yes | object |  |
| `$.record.services[]<4>.offers[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.services[]<4>.offers[].name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.services[]<4>.offers[].give` | yes | array | `maxItems=8` |
| `$.record.services[]<4>.offers[].give[]` | yes | object |  |
| `$.record.services[]<4>.offers[].give[].itemId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.services[]<4>.offers[].give[].count` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.services[]<4>.offers[].receive` | yes | array | `maxItems=8` |
| `$.record.services[]<4>.offers[].receive[]` | yes | object |  |
| `$.record.services[]<4>.offers[].receive[].itemId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.services[]<4>.offers[].receive[].count` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.services[]<4>.offers[].costGold` | yes | integer | `minimum=0` `maximum=1000000` |
| `$.record.services[]<4>.offers[].once` | no | boolean |  |
| `$.record.services[]<4>.offers[].attitudeDelta` | no | integer | `minimum=-100` `maximum=100` |

## toolkit/schemas/quest.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp15/quest.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-quest" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=120` |
| `$.record.description` | yes | string | `minLength=1` `maxLength=2000` |
| `$.record.initial` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.states` | yes | array | `minItems=1` `maxItems=16` |
| `$.record.states[]` | yes | object |  |
| `$.record.states[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.states[].title` | yes | string | `minLength=1` `maxLength=120` |
| `$.record.states[].status` | yes | enum hidden, available, active, succeeded, refused, failed |  |
| `$.record.states[].ending` | no | object |  |
| `$.record.states[].ending.title` | yes | string | `minLength=1` `maxLength=120` |
| `$.record.states[].ending.text` | yes | string | `minLength=1` `maxLength=4000` |
| `$.record.states[].ending.campaign` | yes | boolean |  |
| `$.record.objectives` | yes | array | `minItems=0` `maxItems=32` |
| `$.record.objectives[]` | yes | object |  |
| `$.record.objectives[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.objectives[].title` | yes | string | `minLength=1` `maxLength=120` |
| `$.record.objectives[].description` | yes | string | `minLength=1` `maxLength=2000` |
| `$.record.objectives[].states` | yes | array | `minItems=1` `maxItems=16` |
| `$.record.objectives[].states[]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.objectives[].condition` | yes | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.objectives[].optional` | no | boolean |  |
| `$.record.objectives[].hidden` | no | boolean |  |
| `$.record.objectives[].journalId` | no | string | `minLength=1` `maxLength=24` |
| `$.record.journal` | yes | array | `minItems=0` `maxItems=64` |
| `$.record.journal[]` | yes | object |  |
| `$.record.journal[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.journal[].text` | yes | string | `minLength=1` `maxLength=2000` |
| `$.record.journal[].states` | no | array | `minItems=1` `maxItems=16` |
| `$.record.journal[].states[]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.journal[].condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.transitions` | yes | array | `minItems=0` `maxItems=64` |
| `$.record.transitions[]` | yes | object |  |
| `$.record.transitions[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.transitions[].title` | yes | string | `minLength=1` `maxLength=160` |
| `$.record.transitions[].from` | yes | array | `minItems=1` `maxItems=16` |
| `$.record.transitions[].from[]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.transitions[].to` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.transitions[].condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.transitions[].requirements` | no | object |  |
| `$.record.transitions[].requirements.all` | no | array | `minItems=0` `maxItems=32` |
| `$.record.transitions[].requirements.all[]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.transitions[].requirements.any` | no | array | `minItems=0` `maxItems=16` |
| `$.record.transitions[].requirements.any[]` | yes | array | `minItems=1` `maxItems=32` |
| `$.record.transitions[].requirements.any[][]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.transitions[].manual` | no | boolean |  |
| `$.record.transitions[].minutes` | no | integer | `minimum=0` `maximum=60` |
| `$.record.transitions[].journal` | no | array | `minItems=0` `maxItems=16` |
| `$.record.transitions[].journal[]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.rewards` | yes | array | `minItems=0` `maxItems=16` |
| `$.record.rewards[]` | yes | object |  |
| `$.record.rewards[].id` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.rewards[].title` | yes | string | `minLength=1` `maxLength=160` |
| `$.record.rewards[].states` | yes | array | `minItems=1` `maxItems=16` |
| `$.record.rewards[].states[]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.rewards[].condition` | no | ref https://maxxia.invalid/toolkit/mp12/routine.schema.json#/$defs/condition |  |
| `$.record.rewards[].requirements` | no | object |  |
| `$.record.rewards[].requirements.all` | no | array | `minItems=0` `maxItems=32` |
| `$.record.rewards[].requirements.all[]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.rewards[].requirements.any` | no | array | `minItems=0` `maxItems=16` |
| `$.record.rewards[].requirements.any[]` | yes | array | `minItems=1` `maxItems=32` |
| `$.record.rewards[].requirements.any[][]` | yes | string | `minLength=1` `maxLength=24` |
| `$.record.rewards[].gold` | yes | integer | `minimum=0` `maximum=1000000` |
| `$.record.rewards[].xp` | yes | integer | `minimum=0` `maximum=1000000` |
| `$.record.rewards[].items` | yes | array | `minItems=0` `maxItems=8` |
| `$.record.rewards[].items[]` | yes | object |  |
| `$.record.rewards[].items[].itemId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.rewards[].items[].count` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.rewards[].consume` | no | array | `minItems=0` `maxItems=8` |
| `$.record.rewards[].consume[]` | yes | object |  |
| `$.record.rewards[].consume[].itemId` | yes | string | `minLength=1` `maxLength=128` |
| `$.record.rewards[].consume[].count` | yes | integer | `minimum=1` `maximum=20` |
| `$.record.rewards[].journalId` | no | string | `minLength=1` `maxLength=24` |

## toolkit/schemas/race.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp20/race.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-race" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:race:[a-z][a-z0-9_]{0,79}$` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:race:[a-z][a-z0-9_]{0,79}$` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=100` |
| `$.record.description` | yes | string | `maxLength=1500` |
| `$.record.attributeBonuses` | no | object |  |
| `$.record.attributeBonuses.STR` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.attributeBonuses.DEX` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.attributeBonuses.CON` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.attributeBonuses.INT` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.attributeBonuses.WIS` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.attributeBonuses.CHA` | no | integer | `minimum=-3` `maximum=3` |
| `$.record.resistances` | no | object |  |
| `$.record.resistances.physical` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.resistances.fire` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.resistances.cold` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.resistances.lightning` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.resistances.poison` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.resistances.arcane` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.resistances.holy` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.resistances.necrotic` | no | integer | `minimum=-25` `maximum=25` |
| `$.record.traits` | no | array | `maxItems=12` |
| `$.record.traits[]` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:[a-z][a-z0-9_]{0,47}:[a-z][a-z0-9_]{0,79}$` |
| `$.record.abilityGrants` | no | array | `maxItems=32` |
| `$.record.abilityGrants[]` | yes | object |  |
| `$.record.abilityGrants[].id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:ability:[a-z][a-z0-9_]{0,79}$` |
| `$.record.abilityGrants[].minLevel` | yes | integer | `minimum=1` `maximum=20` |

## toolkit/schemas/recipe.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp21/recipe.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-recipe" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:recipe:[a-z][a-z0-9_]{0,79}$` |
| `$.record` | yes | object |  |
| `$.record.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:recipe:[a-z][a-z0-9_]{0,79}$` |
| `$.record.name` | yes | string | `minLength=1` `maxLength=120` |
| `$.record.description` | yes | string | `maxLength=1000` |
| `$.record.station` | yes | enum field, workshop |  |
| `$.record.minLevel` | no | integer | `minimum=1` `maximum=20` |
| `$.record.ingredients` | yes | ref #/$defs/itemCounts |  |
| `$.record.results` | yes | ref #/$defs/itemCounts |  |
| `#/$defs/itemCounts` | yes | array | `minItems=1` `maxItems=8` |
| `#/$defs/itemCounts[]` | yes | object |  |
| `#/$defs/itemCounts[].itemId` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}$` |
| `#/$defs/itemCounts[].count` | yes | integer | `minimum=1` `maximum=20` |

## toolkit/schemas/resource.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp04/resource.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-resource-alias" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:resource:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.sourceResourceId` | yes | oneOf |  |
| `$.sourceResourceId<0>` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:resource:[a-z][a-z0-9_]{0,79}$` `maxLength=160` |
| `$.sourceResourceId<1>` | yes | string | `pattern=^asset_[a-z0-9_]{1,89}$` `maxLength=96` |

## toolkit/schemas/routine-v2.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp12/routine.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-routine" |  |
| `$.formatVersion` | yes | const 2 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:routine:[a-z][a-z0-9_]{0,63}$` |
| `$.parameters` | yes | object |  |
| `$.actions` | yes | array | `maxItems=128` |
| `$.actions[]` | yes | ref #/$defs/action |  |
| `#/$defs/expression` | yes | oneOf |  |
| `#/$defs/expression<0>` | yes | constraint |  |
| `#/$defs/expression<1>` | yes | object |  |
| `#/$defs/expression<1>.param` | yes | string |  |
| `#/$defs/expression<2>` | yes | object |  |
| `#/$defs/expression<2>.variable` | yes | string |  |
| `#/$defs/expression<3>` | yes | object |  |
| `#/$defs/expression<3>.query` | yes | const "state" |  |
| `#/$defs/expression<3>.address` | yes | ref #/$defs/address |  |
| `#/$defs/expression<3>.kind` | yes | enum flag, counter, collection |  |
| `#/$defs/expression<3>.key` | yes | string |  |
| `#/$defs/expression<4>` | yes | object |  |
| `#/$defs/expression<4>.query` | yes | const "has-item" |  |
| `#/$defs/expression<4>.item` | yes | string |  |
| `#/$defs/expression<5>` | yes | object |  |
| `#/$defs/expression<5>.query` | yes | const "gold" |  |
| `#/$defs/expression<6>` | yes | object |  |
| `#/$defs/expression<6>.query` | yes | const "attitude" |  |
| `#/$defs/expression<7>` | yes | object |  |
| `#/$defs/expression<7>.query` | yes | const "fact" |  |
| `#/$defs/expression<7>.fact` | yes | string | `pattern=^[a-z][a-z0-9_]{0,23}$` |
| `#/$defs/expression<8>` | yes | object |  |
| `#/$defs/expression<8>.query` | yes | const "quest-state" |  |
| `#/$defs/expression<8>.questId` | yes | string | `minLength=1` `maxLength=128` |
| `#/$defs/expression<9>` | yes | object |  |
| `#/$defs/expression<9>.query` | yes | const "objective" |  |
| `#/$defs/expression<9>.questId` | yes | string | `minLength=1` `maxLength=128` |
| `#/$defs/expression<9>.objectiveId` | yes | string | `minLength=1` `maxLength=24` |
| `#/$defs/expression<10>` | yes | object |  |
| `#/$defs/expression<10>.query` | yes | const "quest-claimed" |  |
| `#/$defs/expression<10>.questId` | yes | string | `minLength=1` `maxLength=128` |
| `#/$defs/expression<10>.rewardId` | yes | string | `minLength=1` `maxLength=24` |
| `#/$defs/expression<11>` | yes | object |  |
| `#/$defs/expression<11>.query` | yes | const "has-condition" |  |
| `#/$defs/expression<11>.conditionId` | yes | string | `maxLength=128` |
| `#/$defs/expression<11>.targetId` | no | string | `maxLength=128` |
| `#/$defs/condition` | yes | oneOf |  |
| `#/$defs/condition<0>` | yes | boolean |  |
| `#/$defs/condition<1>` | yes | object |  |
| `#/$defs/condition<1>.not` | yes | ref #/$defs/condition |  |
| `#/$defs/condition<2>` | yes | object |  |
| `#/$defs/condition<2>.all` | yes | array |  |
| `#/$defs/condition<2>.all[]` | yes | ref #/$defs/condition |  |
| `#/$defs/condition<3>` | yes | object |  |
| `#/$defs/condition<3>.any` | yes | array |  |
| `#/$defs/condition<3>.any[]` | yes | ref #/$defs/condition |  |
| `#/$defs/condition<4>` | yes | object |  |
| `#/$defs/condition<4>.op` | yes | enum eq, ne, lt, lte, gt, gte, contains |  |
| `#/$defs/condition<4>.left` | yes | ref #/$defs/expression |  |
| `#/$defs/condition<4>.right` | yes | ref #/$defs/expression |  |
| `#/$defs/action` | yes | oneOf |  |
| `#/$defs/action<0>` | yes | object |  |
| `#/$defs/action<0>.op` | yes | const "message" |  |
| `#/$defs/action<0>.text` | yes | ref #/$defs/expression |  |
| `#/$defs/action<1>` | yes | object |  |
| `#/$defs/action<1>.op` | yes | const "set" |  |
| `#/$defs/action<1>.variable` | yes | string |  |
| `#/$defs/action<1>.value` | yes | ref #/$defs/expression |  |
| `#/$defs/action<2>` | yes | object |  |
| `#/$defs/action<2>.op` | yes | const "state" |  |
| `#/$defs/action<2>.kind` | yes | enum flag, counter, collection-add, collection-remove |  |
| `#/$defs/action<2>.key` | yes | string |  |
| `#/$defs/action<2>.address` | yes | ref #/$defs/address |  |
| `#/$defs/action<2>.value` | yes | ref #/$defs/expression |  |
| `#/$defs/action<3>` | yes | object |  |
| `#/$defs/action<3>.op` | yes | const "if" |  |
| `#/$defs/action<3>.condition` | yes | ref #/$defs/condition |  |
| `#/$defs/action<3>.then` | yes | array | `maxItems=128` |
| `#/$defs/action<3>.then[]` | yes | ref #/$defs/action |  |
| `#/$defs/action<3>.else` | no | array | `maxItems=128` |
| `#/$defs/action<3>.else[]` | yes | ref #/$defs/action |  |
| `#/$defs/action<4>` | yes | object |  |
| `#/$defs/action<4>.op` | yes | const "call" |  |
| `#/$defs/action<4>.routine` | yes | string |  |
| `#/$defs/action<4>.args` | yes | object |  |
| `#/$defs/action<5>` | yes | object |  |
| `#/$defs/action<5>.op` | yes | const "check" |  |
| `#/$defs/action<5>.variable` | yes | string |  |
| `#/$defs/action<5>.target` | yes | ref #/$defs/expression |  |
| `#/$defs/action<6>` | yes | object |  |
| `#/$defs/action<6>.op` | yes | const "give-item" |  |
| `#/$defs/action<6>.owner` | yes | ref #/$defs/expression |  |
| `#/$defs/action<6>.item` | yes | ref #/$defs/expression |  |
| `#/$defs/action<6>.count` | yes | ref #/$defs/expression |  |
| `#/$defs/action<7>` | yes | object |  |
| `#/$defs/action<7>.op` | yes | const "command" |  |
| `#/$defs/action<7>.command` | yes | object |  |
| `#/$defs/action<7>.command.type` | yes | enum grid, expedition, combat, spell, learn-spell, ready-spell, item, loot, service, roll, party, terrain |  |
| `#/$defs/action<7>.command.configurationId` | no | string | `pattern=^[a-z][a-z0-9_]{0,31}$` |
| `#/$defs/action<7>.command<0>` | yes | constraint |  |
| `#/$defs/action<8>` | yes | object |  |
| `#/$defs/action<8>.op` | yes | const "repeat" |  |
| `#/$defs/action<8>.count` | yes | ref #/$defs/expression |  |
| `#/$defs/action<8>.actions` | yes | array | `maxItems=128` |
| `#/$defs/action<8>.actions[]` | yes | ref #/$defs/action |  |
| `#/$defs/action<9>` | yes | object |  |
| `#/$defs/action<9>.op` | yes | const "quest" |  |
| `#/$defs/action<9>.action` | yes | const "transition" |  |
| `#/$defs/action<9>.questId` | yes | string | `minLength=1` `maxLength=128` |
| `#/$defs/action<9>.transitionId` | yes | string | `minLength=1` `maxLength=24` |
| `#/$defs/action<9>.expectedState` | no | string | `minLength=1` `maxLength=24` |
| `#/$defs/action<10>` | yes | object |  |
| `#/$defs/action<10>.op` | yes | const "quest" |  |
| `#/$defs/action<10>.action` | yes | const "claim" |  |
| `#/$defs/action<10>.questId` | yes | string | `minLength=1` `maxLength=128` |
| `#/$defs/action<10>.rewardId` | yes | string | `minLength=1` `maxLength=24` |
| `#/$defs/action<10>.heroId` | no | string | `minLength=1` `maxLength=128` |
| `#/$defs/action<11>` | yes | object |  |
| `#/$defs/action<11>.op` | yes | const "cost" |  |
| `#/$defs/action<11>.gold` | no | integer | `minimum=0` `maximum=10000` |
| `#/$defs/action<11>.food` | no | integer | `minimum=0` `maximum=20` |
| `#/$defs/action<11>.minutes` | no | integer | `minimum=0` `maximum=60` |
| `#/$defs/action<11>.damage` | no | integer | `minimum=0` `maximum=20` |
| `#/$defs/action<11>.item` | no | string | `maxLength=160` |
| `#/$defs/action<11>.count` | no | integer | `minimum=1` `maximum=20` |
| `#/$defs/action<12>` | yes | object |  |
| `#/$defs/action<12>.op` | yes | const "effect" |  |
| `#/$defs/action<12>.effectId` | yes | string | `minLength=1` `maxLength=128` |
| `#/$defs/action<12>.targetId` | no | string | `minLength=1` `maxLength=128` |
| `#/$defs/address` | yes | oneOf |  |
| `#/$defs/address<0>` | yes | object |  |
| `#/$defs/address<0>.scope` | yes | const "campaign" |  |
| `#/$defs/address<1>` | yes | object |  |
| `#/$defs/address<1>.scope` | yes | const "local" |  |
| `#/$defs/address<1>.mapId` | yes | string |  |

## toolkit/schemas/routine.schema.json

Schema ID: `https://maxxia.invalid/toolkit/mp02/routine.schema.json`

| Field | Required | Type | Constraints |
|---|---|---|---|
| `$` | yes | object |  |
| `$.format` | yes | const "maxxia-authored-routine" |  |
| `$.formatVersion` | yes | const 1 |  |
| `$.id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:(map\|routine):[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=160` |
| `$.actions` | yes | array | `minItems=1` `maxItems=32` |
| `$.actions[]` | yes | oneOf |  |
| `$.actions[]<0>` | yes | object |  |
| `$.actions[]<0>.operation` | yes | const "message" |  |
| `$.actions[]<0>.text` | yes | string | `minLength=1` `maxLength=2000` |
| `$.actions[]<1>` | yes | object |  |
| `$.actions[]<1>.operation` | yes | const "set_flag" |  |
| `$.actions[]<1>.flag` | yes | string | `pattern=^[a-z][a-z0-9_]{0,79}$` `minLength=1` `maxLength=80` |
| `$.actions[]<1>.value` | yes | boolean |  |

## Tool diagnostics

| Code | Meaning |
|---|---|
| `E_ARCHIVE_FORMAT` | ZIP structure, compression or flags are unsupported. |
| `E_ARCHIVE_INTEGRITY` | Archive entry length or CRC32 does not match. |
| `E_ARCHIVE_LIMIT` | Archive exceeds entry, byte or expansion limits. |
| `E_ARCHIVE_PATH` | Archive entries contain unsafe, duplicate or special paths. |
| `E_CANDIDATE_FORK` | Different archive bytes claim the same pack ID and version. |
| `E_DEST_EXISTS` | Scaffold destination already exists; no files were replaced. |
| `E_DIRECTORY` | Expected a pack directory. |
| `E_ENTRY_ARRIVAL` | Manifest arrival is missing from its entry map. |
| `E_FILE_ALIAS` | Two selected packs use the same physical source folder. |
| `E_GENERATED_DRIFT` | Generated documentation differs from schemas. |
| `E_IO` | A required input file or directory cannot be read. |
| `E_JSON` | The input is not valid UTF-8 JSON. |
| `E_LOCAL_DUPLICATE` | Local arrival/object IDs must be unique. |
| `E_LOCK` | Exact lock pins or rules context do not match available bytes. |
| `E_MAP_POSITION` | Arrival or object must occupy an open in-bounds tile. |
| `E_MAP_SHAPE` | Map rows must have identical widths. |
| `E_OUTPUT` | Build output is unsafe or is not a prior Maxxia build. |
| `E_PAYLOAD_ID` | Payload identity does not match its descriptor. |
| `E_PAYLOAD_SCHEMA` | Authored payload violates its schema. |
| `E_REFERENCE_INDEX` | Payload references must exactly match its descriptor reference IDs. |
| `E_RESOLUTION_CONFLICT` | No dependency version selection satisfies all constraints. |
| `E_RESOLUTION_LIMIT` | Bounded dependency search exhausted its node budget. |
| `E_ROUTINE_KIND` | Interaction target must be a routine. |
| `E_SIZE` | A source file exceeds the admission limit. |
| `E_STAGE_SUPERSEDED` | A newer authoring-session request superseded this staged load. |
| `E_SYMLINK` | Pack inputs must not contain symlink paths. |
| `E_UNSUPPORTED_KIND` | The tooling skeleton does not yet compile this definition kind. |
| `E_USAGE` | Command or arguments are invalid. |

## Inherited contract diagnostics

These preserve the MP01 semantic codes and report paths against the actual manifest or index file. See the MP01 normative contract and invalid fixtures for each rule.

- `E_ABILITY_DUPLICATE`
- `E_CAMPAIGN_BOUND`
- `E_CONDITION_DURATION`
- `E_CONDITION_LOCAL`
- `E_CORE`
- `E_CORE_DEPENDENCY`
- `E_DEPENDENCY_CYCLE`
- `E_DEPENDENCY_DUPLICATE`
- `E_DEPENDENCY_MISSING`
- `E_DEPENDENCY_SELF`
- `E_DEPENDENCY_VERSION`
- `E_ENGINE`
- `E_ENTRY`
- `E_EQUIPMENT_DUPLICATE`
- `E_EQUIPMENT_REFERENCE`
- `E_ID_DUPLICATE`
- `E_ID_KIND`
- `E_INDEX_PATH`
- `E_INSTANCE_DUPLICATE`
- `E_NAMESPACE`
- `E_OPTIONAL_GUARD`
- `E_PACK_DUPLICATE`
- `E_PATH_DUPLICATE`
- `E_PIN_CORE`
- `E_PIN_DUPLICATE`
- `E_PIN_MISSING`
- `E_PLACEMENT`
- `E_REFERENCE_DEPENDENCY`
- `E_REFERENCE_KIND`
- `E_REFERENCE_MISSING`
- `E_REFERENCE_PRIVATE`
- `E_RULES`
- `E_SCHEMA`
- `E_TAG_DUPLICATE`
- `E_TRANSFER_DESTINATION`
- `E_TRANSFER_IDENTITY`
- `E_VERSION_RANGE`

## Runtime catalogue diagnostics

- `E_ABILITY`
- `E_CAPABILITY`
- `E_CATALOGUE_FIELD`
- `E_CATALOGUE_FILES`
- `E_CATALOGUE_FORMAT`
- `E_CATALOGUE_HASH`
- `E_CATALOGUE_INDEX`
- `E_CATALOGUE_LOCK`
- `E_CATALOGUE_MANIFEST`
- `E_CATALOGUE_ORDER`
- `E_CATALOGUE_PATH`
- `E_CATALOGUE_ROOT`
- `E_CATALOGUE_SIZE`
- `E_CATALOGUE_STAGE`
- `E_CLASS`
- `E_COMPANION`
- `E_CORE_DEPENDENCY`
- `E_DEPENDENCY`
- `E_DEPENDENCY_CYCLE`
- `E_DEPENDENCY_MISSING`
- `E_DEPENDENCY_VERSION`
- `E_EFFECT`
- `E_ENCOUNTER`
- `E_ENGINE`
- `E_ENTRY`
- `E_ENVIRONMENT`
- `E_EQUIP_REQUIREMENT`
- `E_EXPORT_CLOSURE`
- `E_ID_DUPLICATE`
- `E_LOOT_REFERENCE`
- `E_MAP`
- `E_MAP_POSITION`
- `E_MONSTER_SUMMON`
- `E_NAMESPACE`
- `E_OPTIONAL_GUARD`
- `E_OVERRIDE`
- `E_PACK_DUPLICATE`
- `E_PAYLOAD`
- `E_PAYLOAD_ID`
- `E_QUEST`
- `E_QUEST_REFERENCE`
- `E_RACE`
- `E_RECIPE`
- `E_RECIPE_REFERENCE`
- `E_REFERENCE`
- `E_REFERENCE_DEPENDENCY`
- `E_REFERENCE_INDEX`
- `E_REFERENCE_KIND`
- `E_REFERENCE_MISSING`
- `E_REFERENCE_PRIVATE`
- `E_RESOURCE`
- `E_RESOURCE_CYCLE`
- `E_RESOURCE_KIND`
- `E_RESOURCE_REFERENCE`
- `E_ROUTINE`
- `E_RULES`
- `E_SOCIAL`
- `E_SPRITE`
- `E_STAGE_SUPERSEDED`
- `E_STARTER_REFERENCE`
- `E_SUMMON_REFERENCE`
- `E_TAGS`
- `E_TERRAIN`
- `E_UNSUPPORTED_KIND`
- `E_VERSION`
- `E_VERSION_RANGE`
- `E_VISIBILITY`
