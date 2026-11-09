# Project manifest v1 — MM02 contract

## Authority and scope

A .maxxia file is UTF-8 JSON. The authoritative schema is contracts/schemas/project-manifest-v1.schema.json. Its $id is an identifier, not an endpoint the application fetches. JSON Schema structural checks and engine compatibility are separate: a future minimum engine can be structurally valid but unsupported by the installed engine.

Current workspace/editor version: 0.2.0-mm02. Engine: 0.35.0. Project format: 1. Content revision in the sample: 1. Campaign save format remains 18. These version numbers have separate meanings; no Phase 34 campaign migration occurs in MM02.

## Fields

| Field | Meaning and current constraints |
| --- | --- |
| format | Literal maxxia-project |
| projectFormatVersion | Integer 1; any unsupported integer receives E_PROJECT_VERSION |
| projectId | Permanent opaque identity, independent of title/path; lowercase ASCII ID, max 96 characters |
| title | Display title, 1–120 Unicode code points; must contain a character beyond ASCII controls/space |
| engineVersion | Authored/tested engine version, numeric major.minor.patch with no leading zeroes or prerelease suffix; components 0–9999 |
| minimumEngineVersion | Lowest supported engine; must not exceed authored version or installed engine |
| contentRevision | Integer 1–2147483647; content revision is not the project/save-format version |
| content | Explicit legacy-phase34 adapter with foundation, town, galleries and vault paths |
| start | Typed map reference plus x/y 0–63 and facing 0=N, 1=E, 2=S, 3=W |
| startingParty | 1–6 typed actor references; no duplicate actor IDs |

References use {"type":"map","id":"map_town"} or {"type":"actor","id":"hero_tarin"}. Existing IDs remain unchanged. New IDs can use createStableId(prefix) / ManifestReader.CreateStableId(prefix), producing a lowercase prefix plus opaque 32-hex UUID. Prefixes are 1–62 valid ASCII characters. Renaming/reordering files or display names does not change identity. More record-reference types will be added with their actual databases.

Project-relative paths use forward slashes, max 240 characters, ASCII letters/digits/underscores/hyphens and interior dots. No absolute URLs, drive letters, backslashes, dot segments, percent encoding or trailing-dot segments. Paths are relative to the manifest URL for content JSON. This prevents path escape; it does not certify every future Windows filename or resource codec. Resource importing/export validation is still future work.

The selected manifest query path is relative to the game page directory and must end in .maxxia. A hosted subdirectory works. Query examples:

- http://localhost:3000/ — original default boot; no manifest fetch.
- http://localhost:3000/?project=WorldOfMaxxia.maxxia — select included manifest.

A missing, malformed, oversized or incompatible selected manifest shows an error; it never silently starts the default game. Browser loads use no-store, disallow redirects, limit downloads, and time out after ten seconds.

## Transitional content adapter

The descriptor deliberately says legacy-phase34. It supplies the existing three named JSON maps/foundation to the existing renderer and rule systems; art/databases remain compiled or loaded by their current paths. The current reader is not a general project-owned map index loader. Changing content.kind to an unimplemented adapter is rejected. MM04 will extend the descriptor/loader with dynamic discovery while preserving this adapter as needed.

Example fields: content.foundation="content/foundation.json", content.town="content/town.json", content.galleries="content/galleries.json", content.vault="content/vault.json". There are no fictitious database or catalogue paths pointing to files that have not been created.

Selected manifests can change title, choose an existing map/start square/facing and order/select existing starter actors. Custom character creation explicitly overrides the recommended actor roster. At game startup the adapter checks actual map/actor existence and walkability; contract validation alone checks reference shape. New classes, actors, items and maps require their later content phases.

## Preservation and limits

Unknown fields are retained at the root and nested typed objects, including inside reference records, and survive C#/TypeScript parse/serialize round trips. This preserves compatible future metadata. Unsupported required formats, adapter kinds or engine requirements are rejected. Serialization is canonical formatting, not preservation of original whitespace/number spelling. It falls back to compact JSON if indentation would exceed the byte budget; it never drops unknown fields to make a document fit. Parsers use the last occurrence for duplicate JSON keys; authored documents should use unique keys.

Document limit: 64 KiB UTF-8 after an optional leading BOM; maximum 32 object/array nesting levels. Browser/native file reads are bounded and strict about UTF-8. Integer notation such as 1.0/1e0 is accepted when mathematically integral and in range. Unknown compatible fields remain subject to the same resource limits. Very deeply malformed input may be rejected as JSON before receiving a depth-specific diagnostic.

Error objects expose code, JSON-style path and readable message. Structural errors use E_REQUIRED/E_TYPE/E_CONST/E_PATTERN/E_LENGTH/E_MINIMUM/E_MAXIMUM/E_ITEMS/E_DUPLICATE_ITEMS. Reader policies use E_JSON/E_SIZE/E_DEPTH/E_PROJECT_VERSION/E_ENGINE_VERSION/E_ENGINE_RANGE/E_REFERENCE_DUPLICATE. Browser/adapter errors add E_PROJECT_SELECTION/E_PROJECT_HTTP/E_PROJECT_FETCH/E_REFERENCE/E_START_BLOCKED.

## Saves

Default startup and project_world_of_maxxia intentionally retain the exact existing campaign slot keys. Other explicitly selected project IDs wrap CampaignStore storage with a maxxia-project:<id>: prefix, including backup keys. A temporary separate project cannot overwrite the default slots merely by sharing the same browser origin.

This is slot isolation, not a new save schema: portable saves do not yet carry project identity; profile metadata/content migration arrives in MM35–36. Audio preferences are still application-wide. No original campaign data is rewritten while selecting/inspecting a manifest.

## Tooling

1. npm ci at workspace root installs pinned Ajv for development checks only.
2. npm run generate:contracts updates checked-in models/schema snapshots; npm run check:generated verifies exact reproducibility.
3. npm run check:contracts runs standard schema expectations, TypeScript reader, cross-platform C# reader and unknown-field round-trip parity. Requires .NET 10 SDK; MAXXIA_DOTNET can point to an explicit SDK executable.
4. npm run check:game type-checks and runs 363 gameplay/contract/bootstrap tests.
5. npm run verify:project-browser exercises real selected/default boot and save continuity; optional Playwright/Chromium required.

C# generated models plus validator are in a net10.0 library shared by the native inspector and headless fixture executable. The editor performs no file writes in this phase. Schema/model updates must be committed to source together; neither browser players nor the shipped editor need a development schema generator or npm installation.
