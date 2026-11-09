# MP01 contract package

Authoritative schemas: `schemas/*.schema.json`. Read `../../docs/MP01/PACK_RULES_PORTABILITY_CONTRACT.md` for normative semantics and future implementation boundaries.

`validate.mjs` exposes read-only `validateDocument`, `validateCatalogue`, `validateCharacter`, `validateLock`, `validateTransfer`, `compareVersions` and `ContractError`. Validation throws an error with `.code` and `.path`; it does not install content or change saves. `validateCatalogue` accepts an already selected `{engineVersion, rules, packs:[{manifest,index}]}` set, not arbitrary version candidates.

`fixtures/valid/{core,brass,lantern}` are complete on-disk **metadata fixtures only**. Their payloads are labelled `fixtureOnly`. `fixtures/cases` contains accepted/rejected catalogue selections; `fixtures/index.json` fixes expected diagnostic codes and paths. Portability examples use synthetic hashes, not verified distribution pins.

Run `npm run check:mp01` from the source root. Generated `types.d.ts` is derived from schemas and records only structural types; patterns, bounds and semantic constraints still require validation.

No new gameplay payloads, pack selection UI, catalogue installation, independent roster or transfer transaction are implemented in MP01. The browser runtime and old project/save formats remain unchanged.
