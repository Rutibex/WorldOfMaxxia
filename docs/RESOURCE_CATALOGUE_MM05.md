# MM05 Resource catalogue authoring guide

## Format and existing art

Project manifest v1 has an optional `content.resources` value, a path relative to the manifest's folder. The main example project uses `assets/catalog.json`. Its resource records point to files relative to the catalogue's folder, so `art/ui/stone.png` resolves to `assets/art/ui/stone.png`. The existing browser `assets/` tree is unchanged, and no asset master files are duplicated.

A record resembles:

```json
{
  "id": "asset_art_ui_stone_png",
  "kind": "image",
  "path": "art/ui/stone.png",
  "legacyPath": "assets/art/ui/stone.png",
  "name": "Stone"
}
```

Valid kinds: `image` (PNG, JPG/JPEG, GIF, WEBP, SVG), `audio` (WAV, OGG, MP3, MID/MIDI), and `font` (WOFF/WOFF2, TTF). Resources are referenced by their permanent IDs in new content. Display names and `path` may change without changing the ID. A legacy alias is **only** a transitional lookup for pre-MM05 hardcoded art paths; do not use it for new content.

Catalogues are limited to 2048 records and 512 KiB. Paths must be safe catalogue-relative paths. The parser rejects traversal, absolute URLs/drive paths, mismatched file extensions, duplicate IDs/aliases and case-only collisions. The standalone offline checker also verifies real files and symlink containment. Non-Windows exports need case-exact physical files.

## Opening resources in the Windows editor

Open a `.maxxia` project manifest, choose **Edit → Resource catalogue…** or the **Resources** toolbar button (Ctrl+R). Filter to Images/Audio/Fonts/Missing files, search by ID/name/path, and select an image to see a larger preview and metadata. A limited batch of visible image rows shows thumbnails; SVG/audio/fonts are listed without rendered preview. The browser is intentionally read-only in MM05.

## Demonstration: relink a file without changing its ID

1. Copy the entire project directory before changing files.
2. Move `assets/art/ui/stone.png` to another relative path under the same `assets` directory (for example, `assets/art/alternate/stone.png`).
3. Edit the `path` of `asset_art_ui_stone_png` to `art/alternate/stone.png`, **leaving its ID and `legacyPath` unchanged**.
4. Run `node --experimental-strip-types tools/check-resources.mjs` from the source root, and launch the browser game. The Phaser `ui-stone` asset resolves through the ID. Other current legacy callers of `assets/art/ui/stone.png` in CSS/HTML or future media code are not guaranteed migrated yet; MM05 is incremental.
5. Undo the move or restore a backup if unrelated legacy references still need the old file.

For an original title with no `content.resources`, the legacy browser asset paths remain active. For independent MM04 proof projects, the initial resource catalogues are empty because their visual content still uses the original engine's shared demonstration assets; independent asset import starts in MM22.

## Checks

- TypeScript: `tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json --noEmit`
- File integrity: `node --experimental-strip-types tools/check-resources.mjs`
- Regression: `node --experimental-strip-types --test engine/world-of-maxxia/tests/*.test.mjs`
- Portable browser: `node --experimental-strip-types engine/world-of-maxxia/scripts/build-offline.mjs`
- Windows source: `dotnet build editor/MaxxiaMaker.sln -c Release` (requires .NET 10 SDK on Windows)
