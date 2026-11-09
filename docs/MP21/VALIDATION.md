# MP21 — Validation Results

**7 November 2026 · World of Maxxia 0.66.0 · Maxxia Maker 0.21.0-mp21**  
Baseline: complete supplied MP20 source and browser checkpoint. Save version 18, campaign envelope v2 unchanged.

## Implemented

- Item schema/definition enhancements: attunement, bounded equip requirements, passive attack/defense, curse-on-equip/use.
- Persistent per-instance attuned/cursed flags and bounded resource/charge use; shared combat derives passive statistics.
- Catalogued `recipe` type with schema/qualified IDs/checked ingredient and output dependencies.
- Generic authored map workshop markers, validated walkable positions, and proximity-gated crafting.
- Atomic crafting through simulation command, cross-map/level/ingredient/unique/capacity gates, with precise failure messages and no partial inventory changes.
- Character inventory attunement actions, equipped-bonus calculations, temple curse removal, and item portable snapshots.
- Quest-bound items persist in the local campaign but are filtered from portable character exports.
- MP21 example Bell pack with forge materials stocked by Mara the Trader, Regulator Aegis, Binding Ring and recipe, plus a receiving-adventure interoperability proof.

## Independently verified

| Test | Result |
|---|---|
| Full gameplay regression (`--test-concurrency=2`) | **816 / 816 passing** |
| Focused MP21 equipment, crafting, transfer, validation cases | **12 / 12 passing** |
| TypeScript offline check | **passed** |
| Generated shared contract checksum for runtime 0.66.0 | **passed** |
| MP21 Bell and receiving catalogue proof builds | **passed**; 54 and 58 records |
| Source / production replay (forge → identify → attune → equip → use → save/reload → copy) | **passed**, byte-equivalent scenario traces |
| Standalone offline browser build | **passed** |
| Built Node server and HTTP asset delivery | **passed**, **608** files byte-for-byte, missing asset correctly 404 |
| ZIP integrity | Verified during release packaging |

A previous `--test-concurrency=4` regression run recorded **815 / 816**, with a timing-sensitive *pre-existing* sprite impact opacity assertion in `effects-repair.test.mjs` failing once. Rerunning the full suite at concurrency 2 passed all 816 tests. No MP21 mechanics tests failed in that run. A serial run was stopped before completion due to execution time; it is not counted as verified.

## Limitations and unverified gates

- **AJV-based authoring CLI / contract suite:** Not rerun successfully because this offline workspace lacks installed `ajv`; `node tools/maxxia.mjs` and `npm run check:contracts` fail at module resolution before checking MP21 content. The runtime composition and generated schema JSON are verified separately. This remains an outstanding toolkit gate, not a reported pass.
- **Native editor/document checks:** No installed `dotnet` SDK. `tools/check-documents.mjs` could not complete; native Windows compilation/UX must be verified separately.
- **Interactive graphical browser QA:** Not performed. Standalone build, Node HTTP delivery and actual compiled runtime scenario parity passed, but screenshots, keyboard, responsive layout and accessibility are not certified.
- **Remaining legacy assumptions:** Some pre-existing merchant/repair and special objects remain original-town-specific; MP21 did not claim to generalize every system. These are tracked in later migration phases.
- **Node validation host:** Node.js 22.16.0 with experimental type stripping was used for tests. Published project requirement remains Node.js 22.18+.

## Reproduction

```bash
node tools/build-mp21-catalogues.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/equipment-mp21.test.mjs
node --experimental-strip-types --test --test-concurrency=2 engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
node tools/generate-contracts.mjs --check
npm run build:game
node --experimental-strip-types tools/run-mp21-scenarios.mjs --production
npm run verify:game
node tools/verify-workspace.mjs
```

MP21's headless game implementation is verified; final interactive UI, toolkit CLI and native Windows editor release acceptance remain open, consistent with the project roadmap's staged release criteria.
