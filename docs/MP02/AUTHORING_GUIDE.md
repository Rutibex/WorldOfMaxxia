# MP02 — Maxxia content tooling

**Toolkit 0.2.0-mp02.** The authoring workflow now has working scaffold, validate, inspect and build commands. All use the frozen MP01 pack metadata contracts. MP02 adds a deliberately small, strictly validated map/routine payload subset so an author can create and build actual room content rather than copy metadata fixtures.

The current browser engine remains 0.49.0/save 18. These authored payloads and compiled content bundles are not installed or playable there yet. Runtime catalogue integration starts at MP04; generic event execution follows MP11–16. A successful tool build means the authored files and selected dependencies passed the implemented checks, not that the full adventure can already be played or that every puzzle is solvable.

## Quick start

From the extracted source root, install the locked workspace tooling dependency:

```
npm ci
node tools/maxxia.mjs scaffold my-adventure --id my_adventure --title "My Adventure"
node tools/maxxia.mjs validate my-adventure
node tools/maxxia.mjs inspect my-adventure
node tools/maxxia.mjs build my-adventure --out builds/my-adventure.maxxia-build.json
```

No engine source edits are needed. The scaffold creates four files: `pack.json`, `content/index.json`, `content/entry.json` and `content/read-plaque.json`.

Use `npm run maxxia -- <command> ...` as an alternative to the direct Node entry point. Run `node tools/maxxia.mjs help` for discoverable usage. Put paths/titles containing spaces in shell quotes. Namespace IDs are lowercase letters/digits/underscores, beginning with a letter. `core` is reserved.

## Commands

| Command | Purpose | Writes |
|---|---|---|
| `scaffold <directory> --id <namespace> [--title <text>]` | Creates the complete entry-room source pack | A new directory only; refuses any existing destination |
| `validate <directory>` | Validates metadata, selected dependency graph, disk files and supported payload semantics | None |
| `inspect <directory>` | Shows pack IDs, exports, references, map dimensions/arrivals/objects and routine actions | None |
| `build <directory> --out <file.maxxia-build.json>` | Validates first, then writes a canonical self-describing content bundle | One output outside all selected pack roots |

Each command supports `--json`. Validate/inspect/build support repeated `--dependency <directory>` and optional `--engine <numeric-version>`. Scaffold options are limited to id/title/json. Unknown flags, missing values, duplicate singleton flags and extra positionals fail explicitly.

Exit 0 means success; exit 1 means content/filesystem failure; exit 2 means CLI usage failure. JSON mode writes one result to stdout, including errors, and does not print a stack trace. Human success uses stdout and human errors use stderr.

## The authored proof

`examples/mp02/entry-chamber` contains one 9×7 room with one arrival and a plaque on an open tile. The plaque references a local routine that displays “Beyond this threshold, a new adventure begins.” and sets `plaque_read` true in that routine's future campaign-local context.

`examples/mp02/entry-chamber.maxxia-build.json` is the compiled proof. It includes the two pack manifests, two content indexes and three routine/map payloads: seven documents total, including the tiny authoring-proof core provider. `validation/MP02/inspect.json` and `build-proof.json` show actual command output.

The proof has no unique final art yet. No production art was replaced or generated. Its map is authored data, not a new procedural replacement for the existing town/cistern/vault artwork.

## Dependencies: explicit selection, not resolution

MP02 automatically supplies `toolkit/core` unless one of the explicitly selected directories declares the `core` namespace. This is a small authoring-proof provider with one exported welcome routine. It is not the gameplay core extraction planned for MP05, and it has no baseline classes/items/spells.

To supply another provider:

```
node tools/maxxia.mjs validate my-adventure --dependency other-pack
node tools/maxxia.mjs build my-adventure --dependency other-pack --out builds/my-adventure.maxxia-build.json
```

The supplied directories form an explicit selection. All required providers must be present and compatible; MP01 rules still govern private exports and guarded optional references. There is no folder search, network download, installed-version negotiation, automatic transitive selection or load-order override. MP03 implements deterministic dependency resolution.

All selected payloads must use supported map/routine schemas. Passing MP01 metadata validation does not mean an item/class/monster or fixture-only payload can be compiled by MP02. Unsupported kinds fail with `E_UNSUPPORTED_KIND`, rather than being silently packaged as validated gameplay.

## Supported authored payloads

`maxxia-authored-map` v1 defines its own permanent map ID, name, rectangular rows (`#` wall, `.` open), named arrivals and placed interaction objects. Coordinates are zero-based. Facing is 0=north, 1=east, 2=south, 3=west. Arrivals and objects must occupy open in-bounds tiles; IDs are unique within their own arrival/object collection. The manifest's entry arrival must actually exist on its entry map. The current validation does not prove reachability or puzzle solvability.

Each object's `onInteract` names a routine. Every payload reference must also appear in its descriptor's reference list; no undeclared reference can bypass dependency/export checks. For optional references, the descriptor's MP01 guard controls whether the future interaction branch is available. An absent optional provider does not supply a callable routine. These guards are validated data, not an active runtime feature in this checkpoint.

`maxxia-authored-routine` v1 supports 1–32 actions, each exactly one of:

| Operation | Fields | Authored meaning |
|---|---|---|
| `message` | `text` | Display a message |
| `set_flag` | `flag`, boolean `value` | Assign a pack-scoped campaign flag |

Flag names are local to the owning pack; their eventual state identity is the owning namespace plus local flag name. This limited vocabulary is a buildable authoring seed for later event/action work. MP02 does not execute arbitrary scripts or implement the generic game event engine. Unknown operations and unknown payload fields fail. The new payload schemas are separate from the existing map-document v1 format; no conversion or runtime adapter is implied.

## Build format and reproducibility

The output format is `maxxia-content-build` v1. It records toolkit/engine versions, exact selected rules, root pack ID, sorted pack-relative document paths, parsed JSON documents and a SHA-256 content hash. `playableInCurrentRuntime` is explicitly false.

Builds are deterministic for the same normalized content. Object keys are sorted recursively; array order is preserved because it can affect actions. Absolute source/output paths, timestamps and random temporary names are excluded from the bundle. Changing whitespace or object-key order does not change bytes. The SHA-256 is calculated over canonical UTF-8 JSON of the body excluding `contentHash`; the final file adds that hash and one newline.

This hash identifies the compiled content body. It is not the final distribution archive hash required by MP01 provider pins. A `.maxxia-build.json` file is not yet a campaign ZIP, catalogue lock, importable game project or installed pack.

Only manifest/index-listed files are read and embedded. Unindexed notes/files are ignored and cannot accidentally enter the bundle. Media compilation and additional definition kinds arrive in later phases.

## Errors and safe writes

Every JSON diagnostic carries `severity`, `code`, `file`, `objectId`, `path` and `message`. Example: a malformed routine with a missing flag value identifies its `content/read-plaque.json`, routine ID and `$.actions[1].value`. A descriptor error identifies the index file and `$.definitions[n]...`. Missing/unparseable payload files still identify the owning definition when known.

Inputs are limited to 1 MiB per JSON file and 32 MiB total selected source content, with at most 128 total selected packs, including the proof core. Pack paths must pass MP01's restricted relative-path rules. The tool rejects symlinked roots, intermediate paths and files; payloads are opened with no-follow where supported. These are local tooling safeguards, not a claim of a fully race-proof hostile-archive sandbox; archive import enforcement remains MP03/43.

Scaffold refuses existing directories and cleans up its own incomplete creation on failure. Builds validate the entire source selection before opening output. Output must end in `.maxxia-build.json`, reside outside every selected source pack and must not be a symlink. An existing output is replaced only if it identifies itself as a Maxxia content build. Writing uses a same-directory temporary file followed by rename; a failed validation leaves the last good build intact. This is one-file replacement, not a cross-project transaction or durability guarantee against power loss.

## Generated reference and development checks

`docs/MP02/GENERATED_REFERENCE.md` is generated directly from seven MP01 schemas, two authored payload schemas and shared diagnostic codes. `toolkit/types.d.ts` is generated from the authored schemas; `contracts/mp01/types.d.ts` remains unchanged. Type declarations express structure; admission bounds and semantic checks still need validators.

```
npm run generate:toolkit-reference
npm run check:mp02
npm run check:mp01
npm run check:game
```

The first check detects documentation/type drift, runs actual CLI/filesystem tests, typechecks generated authored types and validates the included proof. Existing MP01 and game checks remain separate. Install engine development dependencies with `npm --prefix engine/world-of-maxxia ci` for TypeScript/game checks.

The baseline game source, rules, production assets and save format remain unchanged. MP00's browser/native acceptance limitations remain visible. Next phase: **MP03 — Deterministic dependency resolution**.
