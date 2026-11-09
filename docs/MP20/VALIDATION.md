# MP20 — Validation Results

**7 November 2026 · Cumulative MP20 checkpoint**

Engine 0.65.0 / toolkit 0.20.0-mp20. Save version 18 unchanged. Baseline: supplied MP19 cumulative source/browser.

## Implemented

- New composed race registry and authored race JSON schema; `core:race:human` fallback for legacy characters.
- Class `creationChoices`, authored `styleDefinitions`, class/race/choice ability grants and bounded class-specific attack styles. No campaign ID checks were introduced.
- Character creation selects any enabled race/class/choice. Character sheet shows race, specialization and abilities. Starter equipment obeys class permissions.
- Derived race and specialization attribute/resistance benefits with original base point budget intact.
- Training/level grants, persistent character state and portable copy definitions with provider/version validation.
- Brass Bell 1.2.0 demonstrating Bellforged, Echo Sentinel, Watcher/Runner, Sonorous Needle and Echo Pulse; core and previous phase examples retained.

## Confirmed checks

| Check | Recorded result |
|---|---|
| Full gameplay regression | **804/804 pass**, 0 fail (Node 22.16.0 experimental TS stripping) |
| Focused MP20 race/class/creation cases | **10/10 pass** |
| Legacy creation save round-trips | **8/8 pass** after optional `creationChoiceId` serialization compatibility correction |
| MP17–19 focused scenarios | **56/56 pass** during iteration |
| Strict offline TypeScript client | **pass** (`tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json`) |
| Generated contracts | **pass** (`generate-contracts` and `--check`, engine 0.65.0) |
| MP20 catalogue builds | **pass**; 49 records in Bell and 53 in receiving proof |
| MP20 source / production scenario parity | **pass**, identical deterministic traces and copied character state |
| Offline browser build | **pass**, TypeScript 5.8.3 offline builder |
| Local Node HTTP browser delivery | **pass**, 603 files byte-for-byte and expected 404 |
| Selected new schema checks | **pass**, 26 relevant MP20 package records (legacy v2 routine/map schema remains separate from historic v1 schema files) |

## Gaps / platform restrictions

- **AJV-powered toolkit suite not independently rerun**. The npm offline cache lacks dependencies (including `require-from-string`); previous historical toolkit results must not be misrepresented as current verification. Runtime build verification and source/schema checks are independent of that suite.
- Native Windows/.NET editor and cross-language document check **not run**: `dotnet` is absent in this environment. Windows launcher runtime is only verified using the Node-based production server.
- Interactive graphical and keyboard/visual review of actual launched browser **not performed**. Automated browser files and source/production simulation pass; rendering/UX claims remain open.
- For authored structures that predate MP20, some `toolkit/schemas` map/routine JSON schemas describe earlier authoring forms, so the 44-record demonstration uses the runtime and composed-catalogue validator as authoritative for those migrated records.
- No general-purpose class scripting, equipment crafting, fully editable race art or novel rule profiles are claimed; these fall under later phases.

## Reproduction

```bash
node tools/build-mp20-catalogues.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/creation-mp20.test.mjs
node --experimental-strip-types --test --test-concurrency=4 engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
node tools/generate-contracts.mjs --check
npm run build:game
node --experimental-strip-types tools/run-mp20-scenarios.mjs --production
npm run verify:game
node tools/verify-workspace.mjs
```

The *complete toolkit and native document validation gates are not closed*. Full cross-platform acceptance remains explicitly outstanding, but the implemented game and source/production acceptance checks pass.
