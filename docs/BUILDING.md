# Build and run World of Maxxia / Maxxia Maker

## Requirements

- **Node.js 22.18+** and npm for the game/CLI source workspace.
- **.NET 10 SDK** for Windows editor and document model compilation. On Windows, use Visual Studio with .NET 10 support if you want the GUI editor.
- Python is optional for historical test/release helper tools; it is not required for ordinary gameplay.

## Browser game

From the repository root:

```bash
npm ci
npm --prefix engine/world-of-maxxia ci
npm run check:generated
npm run check:game
npm run check:mp27
npm run build:game
npm run verify:game
npm run start:game
```

Open http://localhost:3000/. `build:game` uses the included offline-capable source compiler and Phaser vendor chunks. It writes a complete standalone distribution to `engine/world-of-maxxia/dist/`.

Alternative Vite build: `npm run build:game:vite` writes to `artifacts/vite-game/`. Do not conflate the portable and Vite output paths. The build is static and can be hosted without Node on a standard static host, but game files must be served over HTTP or HTTPS.

## Windows editor

```powershell
dotnet build editor/MaxxiaMaker.sln -c Release
```

To publish a self-contained Windows x64 folder:

```powershell
npm run publish:editor
```

The output folder is `artifacts/editor-win-x64/`; keep its complete contents. This repository packages editor **source**, not a prebuilt executable. Actual Windows interaction is a separate acceptance step and has not been verified as part of this packaging.

## Module toolkit

The content tools run from the repo root:

```bash
node tools/maxxia.mjs scaffold my-adventure --id my_adventure --title "My Adventure"
node tools/maxxia.mjs validate my-adventure --json
node tools/maxxia.mjs inspect my-adventure --json
node tools/maxxia.mjs build my-adventure --out builds/my-adventure.maxxia-build.json --json
```

Read `docs/MP27/AUTHORING.md` for current puzzles and perception, and the other `docs/MPxx/` authoring guides for compatible features and data contracts.

## GitHub Pages

```bash
npm run build:game
node tools/prepare-pages.mjs
```

This creates `_site/` with `index.html` for the public landing page and `play/index.html` for the game. See [GitHub deployment](GITHUB_DEPLOYMENT.md). Public CI and Pages deploy from `.github/workflows/`.

## Verifying this release

A GitHub Actions workflow runs browser source checks and a Windows .NET editor compilation. In the provided packaging environment, Node 22.16 was installed (below project minimum), npm dependencies were not cached, and .NET was unavailable; do not infer that a complete CI run or manual gameplay acceptance has already passed here.
