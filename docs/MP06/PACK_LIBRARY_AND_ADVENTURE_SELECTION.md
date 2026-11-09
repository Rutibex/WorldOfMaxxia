# MP06 — Local pack library and adventure selection

## Player workflow

From a clean extraction of the browser ZIP, run `Start-World-of-Maxxia.cmd` on Windows, or `node server.mjs` with Node 22.18+ from the browser folder. Open the local address displayed. MP06 opens the *Adventure Library* before loading the Phaser game. Select one of these **runtime project choices**:

1. **World of Maxxia — Firstlight**: the unchanged original campaign with core rules and original save slots.
2. **Brass Workshop — Pack Fixture**: the Firstlight runtime with the Brass content pack enabled and isolated catalogue-hash save slots.
3. **Glass Archive — Pack Fixture**: the MP04 proof project with Brass and Glass packs enabled and isolated save slots.

The latter two are explicitly **compatibility fixtures**, not separate finished stories. Brass contributes class/equipment/monsters and Glass contributes more definitions and authored map metadata; authored maps/routines are validated but **not yet executed as independent game worlds**. Genuine authored module gameplay is scheduled for MP11–17. MP06 deliberately does not invent a generic script interpreter.

The library screen also shows providers, exact versions, requirements, optional availability, and installed packages. Checkboxes enable/disable complete providers. A required provider cannot be disabled while an enabled consumer requires it. Select a project, enable compatible content, then click **Open selected adventure**. Character creation, new game, continue and import/export legacy saves remain in the original game title screen.

## Local import / export

- **Import local pack** accepts a canonical `.maxxia-pack.zip` produced by `node tools/maxxia.mjs archive` (stored ZIP entries) and a `.maxxia-build.json` produced by `node tools/maxxia.mjs build`. No arbitrary JavaScript or remote URL is executed. Compressed/deflate third-party ZIPs are rejected rather than parsed incompletely.
- ZIP entries have bounded counts, lengths, total size, CRC-32 integrity, canonical paths, no overlaps, no external file types, and no executable prefixes. The pack and index must agree exactly; common v1 manifest validation runs before admission. The browser checks the content build's signed-by-content hashes, declared engine/rules and cross-pack lock/order. These are **integrity checks, not an authenticity signature**.
- Imports are stored in IndexedDB. Imported bundle export downloads its exact original ZIP/JSON bytes. Removal only removes the installed bundle; it does **not** delete campaign saves.
- A provider conflict, invalid archive, unsupported rules/engine or missing required provider is displayed with a specific error. No load begins until the enabled selection passes the dependency check.
- A malformed historical installed bundle is quarantined in the UI and can be removed; it cannot prevent bundled adventures loading.
- Limits: maximum individual archive 32 MiB, maximum build 8 MiB, maximum cumulative library 48 MiB, maximum 32 imported bundles, max 128 selected providers and no path traversal.

**Known boundary:** imported authored maps, routines, and new artwork are not yet standalone adventures. Runtime catalogue composition currently executes class/item/monster/resource aliases, and validates but does not place authored maps and routines in the active world. The pack metadata schema is still v1. The browser imports canonical authoring archives and compiled catalogues, not arbitrary web downloads.

## Save protection and catalogue provenance

Firstlight **without extra packs** retains its original `world-of-maxxia:campaign:v1:` localStorage keys. Other projects use their project namespace; a nonempty enabled catalogue uses `maxxia-catalogue:<projectId>:<catalogueHash>:`. The catalogue hash is calculated deterministically from engine version, selected project ID, provider manifests and exact content documents. It changes if pack contents, selection or version changes. The title screen displays the current catalogue identity, and the library lists existing slot namespace families.

No previous save is removed, rewritten or transferred when a provider is disabled, a different adventure is chosen or a bundle is removed. Old saves appear again if the original compatible project and catalogue are restored. Actual cross-campaign portable characters, format migrations, and resolving missing provider characters are MP07–10, not MP06. A loaded game must be closed/reloaded to adopt pack changes: the engine never hot-swaps registries in battle.

## Architecture and entry points

- `src/shared/content/pack-library.ts`: browser-safe bounded ZIP decoder, validated catalogue intake, deterministic provider selection and staged runtime installation. Uses the same `composePackCatalogue` as MP04.
- `src/client/pack-library-ui.ts`: IndexedDB package storage, offline browser UI, dependency toggles, package import/export and quarantine/recovery.
- `src/client/main.ts`: pre-boot library selection; reads the appropriate legacy project manifest and installs enabled packs only after core/legacy staging. Direct `?project=...` and `?catalogue=...` diagnostics still use their historical paths.
- `public/mp06-proof/catalogue.maxxia-build.json`: reproducibly regenerated from `toolkit/core` 1.0.1 and the unchanged MP04 Brass/Glass examples by `node tools/build-mp06-catalogue.mjs` (no external packages needed).
- Original `public/mp04-proof` remains untouched for compatibility and historical reproduction.

## Running checks from cumulative source

```sh
node tools/build-mp06-catalogue.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/pack-library.test.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/*.test.mjs
tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json
npm run build:game
npm run verify:game
```

The native Windows editor, interactive Chromium on this host, and full toolkit tests requiring an installed AJV package are separate verification gates. Nothing in MP06 claims a verified Windows installer, unrestricted ZIP support, cross-campaign roster portability or a finished adventure-conversion runtime.
