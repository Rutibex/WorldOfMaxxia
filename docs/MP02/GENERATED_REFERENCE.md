# MP02 generated schema and diagnostic reference

Generated from the seven frozen MP01 schemas, two authored-payload schemas and diagnostic registry. Edit sources and regenerate. Schema tables describe shape; semantic validation additionally checks IDs, visibility, dependencies, positions and references. `[]` denotes an array item; `<n>` denotes a schema alternative or intersection branch.

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
| `#/$defs/id` | yes | string | `pattern=^[a-z][a-z0-9_]{0,47}:(race\|class\|ability\|item\|spell\|monster\|condition\|map\|npc\|dialogue\|quest\|routine\|encounter\|loot\|environment\|resource):[a-z][a-z0-9_]{0,79}$` `minLength=5` `maxLength=160` |
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
| `$.definitions[].kind` | yes | enum race, class, ability, item, spell, monster, condition, map, npc, dialogue, quest, routine, encounter, loot, environment, resource |  |
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
| `E_DEST_EXISTS` | Scaffold destination already exists; no files were replaced. |
| `E_DIRECTORY` | Expected a pack directory. |
| `E_ENTRY_ARRIVAL` | Manifest arrival is missing from its entry map. |
| `E_FILE_ALIAS` | Two selected packs use the same physical source folder. |
| `E_GENERATED_DRIFT` | Generated documentation differs from schemas. |
| `E_IO` | A required input file or directory cannot be read. |
| `E_JSON` | The input is not valid UTF-8 JSON. |
| `E_LOCAL_DUPLICATE` | Local arrival/object IDs must be unique. |
| `E_MAP_POSITION` | Arrival or object must occupy an open in-bounds tile. |
| `E_MAP_SHAPE` | Map rows must have identical widths. |
| `E_OUTPUT` | Build output is unsafe or is not a prior Maxxia build. |
| `E_PAYLOAD_ID` | Payload identity does not match its descriptor. |
| `E_PAYLOAD_SCHEMA` | Authored payload violates its schema. |
| `E_REFERENCE_INDEX` | Payload references must exactly match its descriptor reference IDs. |
| `E_ROUTINE_KIND` | Interaction target must be a routine. |
| `E_SIZE` | A source file exceeds the admission limit. |
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
