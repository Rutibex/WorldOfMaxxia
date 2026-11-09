# World of Maxxia — browser engine

The TypeScript/Phaser 3 browser runtime for [World of Maxxia / Maxxia Maker](../../README.md). **Engine version 0.72.0**, MP27, save schema 18.

## Build and play

From the repository root (Node.js 22.18+):

```bash
npm ci
npm --prefix engine/world-of-maxxia ci
npm run build:game
npm run start:game
```

Then open http://localhost:3000/. This build outputs to `engine/world-of-maxxia/dist/`, which is deliberately excluded from source control. The separate Play archive contains a prebuilt game.

## Development

- `npm --prefix engine/world-of-maxxia run check` — TypeScript and runtime tests.
- `npm run check:mp27` — current illusion/perception and toolkit tests.
- `npm run build:game:vite` — alternate Vite build.
- `engine/world-of-maxxia/src/` — runtime and shared rules.
- `engine/world-of-maxxia/public/` — static content and compatible sample catalogues.
- `engine/world-of-maxxia/scripts/` — build and checking utilities.
- `engine/world-of-maxxia/art-source/` — original production prompts, graphics masters and source notes, retained for asset provenance.

Documentation for the current checkpoint is in [`docs/MP27/AUTHORING.md`](../../docs/MP27/AUTHORING.md); see the main README for pack creation, Windows editor and release documentation.

**Licensing:** The project's original work is all rights reserved; see [`LICENSE`](../../LICENSE). Third-party notices and licenses are in this directory.
