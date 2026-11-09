# MP01 — Pack, rules and portability contracts v1

**Frozen baseline: 6 November 2026.** This contract covers metadata, identity, compatibility and portability envelopes. JSON Schemas in `contracts/mp01/schemas` and semantic checks in `contracts/mp01/validate.mjs` are executable authority. Generated `types.d.ts` is a convenience and cannot replace runtime validation.

This phase does not install packs into the game, implement character transfers or define every future gameplay payload. Descriptor fixtures are deliberately tiny metadata examples. Core extraction remains MP05, catalogue installation MP04, player pack selection MP06, portable roster MP08 and transfer execution MP09. The original browser runtime remains 0.49.0/save 18 and does not consume these new files yet.

## 1. Files and validation boundary

Each pack root has `pack.json`. It names a relative `.json` content index, normally `content/index.json`, distinct from the manifest. The index lists one descriptor per definition; each descriptor names one JSON/resource payload file. Fixture files contain `fixtureOnly: true` and their matching identity, not executable class/map data. Real payload schemas will be added in the relevant implementation phases without changing this identity/index contract. Resource payload file extensions may be image/audio formats; future kind-specific validators own media validation.

File paths are ASCII segments separated by `/`, end in an extension and have a maximum length of 240. No absolute paths, traversal, whitespace, backslashes, percent encoding, query strings or URLs. Descriptor paths must be unique under case folding and cannot overwrite `pack.json` or the selected index. Future archive import must also reject symlinks, duplicate ZIP entries, decompression abuse and paths escaping the root (MP03/43). Metadata validation alone is not an archive sandbox.

Unknown fields are rejected in these v1 envelopes. Unknown mechanics inside explicitly opaque `state` objects are preserved as data and never evaluated. These objects must not be used to smuggle world ownership into a portable character: source references belong in the declared typed fields and their dependency pins. Later extension payloads must declare reference-bearing fields and validation; the MP01 validator cannot discover arbitrary references hidden inside opaque data.

## 2. Permanent identity

A pack ID is a lowercase namespace, beginning with a letter, with letters/digits/underscores thereafter, at most 48 characters. Display titles can change without changing identity.

A definition ID is `namespace:kind:local_name`. Kinds are race, class, ability, item, spell, monster, condition, map, npc, dialogue, quest, routine, encounter, loot, environment and resource. The ID kind must match the descriptor kind. Local names begin with a lowercase letter and use lowercase letters/digits/underscores, at most 80 characters.

A pack may define only its namespace. The reserved `core` pack has kind `core`; no other pack may claim core kind. One version per pack ID may be selected in a catalogue. Full definition IDs are unique. Aliases/renames cannot be inferred from matching titles; a future explicit migration must record identity changes.

Rules-profile IDs occupy a separate `namespace:rules:name` space. v1 supports `core:rules:classic`; profile version is matched exactly to the selected context. Rules-profile version is distinct from the core distribution's pack version.

## 3. Versions and dependencies

Versions are canonical numeric `major.minor.patch`, each component between 0 and 999999. Leading zeros, prerelease/build suffixes, wildcard strings, caret/tilde notation and arbitrary semver expressions are excluded from v1. Compare numeric components, never lexical strings.

Compatibility is a half-open interval `{min, maxExclusive}`. `min` is included, `maxExclusive` is excluded and min must precede maxExclusive. Every pack declares its engine interval and exact rules profile/version.

Dependencies name a pack ID, a version interval and an explicit optional boolean. Every noncore pack must declare core as a required direct dependency. Duplicate dependencies, self-dependencies and selected graph cycles fail. Required providers must be selected and version-compatible. An optional dependency may be absent; if present it must satisfy its range. No implicit provider disabling or last-loaded-wins resolution.

The MP01 validator preflights an already selected set. It does not discover installed versions, select between candidates, produce an ordered load plan or compute a resolved catalogue hash. Those are MP03. Input selection order may affect the first diagnostic path; it cannot authorize a conflicting definition.

Cross-pack references require direct dependencies, even when another dependency would provide a transitive path. Cross-pack targets must be exported. A required reference is `{id}`. An optional provider reference must be `{id, whenPackEnabled: providerId, onAbsent: "skip"}`. If the provider is absent the branch is skipped; if present the referenced exported ID must exist. v1 does not yet support implicit fallback targets; author a separate unconditional route where needed. Local references cannot use optional guards.

## 4. Exports and placement

Every descriptor declares `visibility` as local or exported; there is no implicit export-all default. Local definitions can be used by their owner and remain available to that campaign, but external packs cannot target them.

Exported classes/races become candidates for global character creation after runtime composition is implemented. Exported abilities/items remain usable by characters in compatible campaigns. Export does not automatically put a monster in another map or add a quest to another journal.

Placement is independently declared:

| Value | Meaning |
|---|---|
| `none` | No automatic placement; content remains available to explicit references |
| `authored` | Deliberately placed by the owning adventure, not generic global stock |
| `eligible` | Exported item/monster/loot/encounter may be selected by generic tables under authored eligibility tags |

Maps, plot objects, dialogue and quest state are never globally injected just because a pack is enabled. `eligible` requires an exported supported kind. Eligibility tags identify future table selectors; MP01 does not implement table selection. Local story item definitions can have authored placement, but their instances must be campaign-bound and cannot enter a portable envelope.

Overrides are unsupported in v1. A second definition with the same full ID fails. A later explicit override contract must define target/version/consent/conflicts; authoring a record in another pack's namespace is not an override mechanism.

## 5. Adventure entries and independent operation

Adventure packs must name one owned map ID and a stable arrival ID; content/core packs have null entry. MP01 validates the map reference, not the arrival's coordinates: real map payload/arrival validation arrives in subsequent phases. Entry maps cannot come from an optional provider.

Each adventure must operate with core and its required dependencies only. Optional integration may offer flavour or an alternative solution, never be the sole path to an advertised completion. That playability requirement needs behavioural tests later; metadata cannot prove it.

## 6. Resolved catalogue lock

`maxxia-catalogue-lock` v1 stores engine version, exact rules profile/version and exact pack pins. A pin contains pack ID, exact version and lowercase SHA-256 of that pack's final distributed archive bytes. Core must be pinned, and each provider appears once. A source folder must be built into an archive before a genuine distribution pin can be produced. The fixture hashes are synthetic schema examples, not attestations of fixture archive contents.

MP03 will define canonical resolution ordering and hash production; MP43 will enforce deterministic distribution archives. A hash detects byte mismatch, not author trust or code safety. No MP01 validator claims to verify bytes from a pin alone.

A running campaign keeps its resolved selection. Enable/disable changes take effect for new campaigns, or through an explicit validated migration of existing saves. No hot replacement during combat. Save updates preserve a backup and commit only after successful validation. Version ranges are resolved to exact pins before use; they are not stored as a substitute for provenance.

## 7. Ownership and portable character envelope

| Owner | State |
|---|---|
| Definitions | Immutable race/class/ability/item/etc. specifications |
| Campaign instance | Position, explored cells, opened doors, entity state, flags, quest progress, NPC attitudes, time and RNG |
| Character record | Identity/revision, name, race/class, XP/level, gained abilities, inventory instances, equipment, portable conditions/resources and declared extension state |
| Roster participation | Which campaign owns a live character revision; transfer reservation/receipts |

`maxxia-character` v1 is a future portable envelope, not a replacement for save-18 today. Every referenced provider must be pinned. Pins may include extra transitive providers required to interpret mechanics; MP01 does not compute that closure. The source/runtime later must traverse typed references when building an export.

Character IDs and item instance IDs are independent of definition IDs. Equipment refers to an owned item instance, not its definition. A single item instance cannot occupy multiple equipment slots under this v1 contract. Copying a character must allocate a new character ID and new item instance IDs, preserving references among them.

Portable exports reject campaign-bound items and nonportable conditions. The eventual export UI must preview what stays behind; it must never silently erase items from the source merely because they cannot travel. Finite condition durations are integer turns/minutes; persistent durations use null. Timers do not advance while the character is exported/offline unless a later explicit rule says so.

The `resources` map uses an owning ability ID as its key in v1. Each value is a nonnegative current amount. Ability definitions supply caps/recovery; MP19 may extend the resource payload explicitly if a class requires several independent pools. Opaque state is preserved, not executed, and cannot bypass dependency or world-state policy.

MP01 checks envelope shape, IDs, provider-pin coverage, item identity/equipment links and condition portability. It does not validate a character's legality against loaded class mechanics, verify actual pack bytes, compare HP/resource caps or perform imports into the current runtime. Those checks belong to MP08–10 and MP18–23.

## 8. Missing providers and incompatible imports

An importer must preserve the original bytes as a recoverable file when a provider is absent, hashes differ, or rules are incompatible. It refuses playable activation and reports precise requirements. It must not delete unknown item/class/state records or substitute a similarly named core definition.

Restore the exact provider or offer an explicit migration with a preview and backup. Pack/profile migrations are separate from character-schema migrations; changing display names does not migrate identity. Future format versions fail visibly rather than being guessed.

MP01 validators are read-only: rejection leaves their input unchanged. Actual quarantine/storage/recovery execution is future work.

## 9. Move, copy and receipt policy

A receipt identifies transfer ID, operation, source/destination campaigns, source/destination character IDs, source revision, hash of the frozen sanitized character envelope and stage. Hash the exact immutable UTF-8 envelope bytes that will be imported; do not recompute from differently serialized objects. MP09 will define its deterministic serializer and storage transaction implementation.

Move preserves character identity; copy explicitly creates a new identity. Campaign instances must differ. The receipt has prepared, imported, committed or cancelled stage. The normal progression is prepared → imported → committed. Cancellation is allowed only from prepared, before an import exists; an imported transfer must finish recovery or perform an explicit compensating operation, not silently roll back the source.

Execution requirements for MP09:

1. Validate source revision and destination compatibility, preview exclusions, checkpoint source, freeze export bytes and reserve that source revision against another move.
2. Persist prepared receipt before attempting destination import.
3. Import idempotently using transfer ID and matching frozen hash; persist destination revision and imported receipt together.
4. Mark source participation transferred, then commit the shared receipt. Replaying any completed step returns its existing result.
5. Recover interruptions by inspecting durable records. A changed hash/revision under an existing transfer ID is a conflict, not a second import.

A character cannot remain simultaneously active in two campaigns after a completed move. Copies are separate branches and may intentionally duplicate value under a local single-player policy. Exported files are user-controlled; this is not tamper-proof anti-cheat.

The receipt schema and identity checks do not implement this transaction, verify a transition history or guarantee atomic multi-file writes. MP00 explicitly recorded that existing project saves are not one atomic project-wide transaction.

## 10. Schema limits and change control

Limits include 128 selected packs, 128 dependencies/pins, 4096 descriptors/items, 256 references per descriptor and 1024 character abilities. These are metadata admission bounds, not promises about current renderer capacity or game balance. Existing map/index constraints remain in force until adapted.

Top-level/schema structural changes require a new contract version or an explicit backwards-compatible revision with fixtures proving old behaviour. Changes to opaque mechanics payloads use their own future format versions. All diagnostics expose code and JSON-style path. Schemas enforce local shape; semantic validators enforce relationships. Preserve invalid fixtures as regression evidence.

## 11. Fixture pack roles

| Fixture | Contributes | Tests |
|---|---|---|
| core | Human, adventurer, strike, sword, poisoned | Baseline exported definitions |
| brass | Local cistern map/clapper, exported Bellwarden and Buckler | Required core dependency, authored/local vs eligible/exported |
| lantern | Local market, exported Mothkin and Envoy | Optional Brass integration that can be skipped |

These are metadata fixtures inspired by the planned examples, not the finished Brass Bell Cistern or Lantern Market adventures. They have no newly generated art and cannot be selected in the existing game's project menu.

## 12. Commands and acceptance

- `npm run check:mp01`: schema-generated declaration check, catalogue fixtures, portability/negative tests and declaration compilation.
- `npm run audit:mp00`: original engine input preservation.
- `npm run build:game` / `npm run verify:game`: original runtime build/HTTP checks.
- `npm run package:mp01`: cumulative deterministic source and unchanged-runtime browser ZIPs.

MP01 exits when all contract fixtures, semantic tests and schema/type consistency pass, including core plus both tiny fixture packs and precise rejection of duplicate IDs, missing dependencies and incompatible rules. MP00's blocked browser/native acceptance remains an independent open item, not a reason to misreport the contract results.
