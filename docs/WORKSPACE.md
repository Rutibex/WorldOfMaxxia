# MM03 document workspace

## What you can do

Open existing .maxxia manifests in tabs. Edit project settings through the dialog or edit the full JSON draft. Apply commits one validated, undoable edit; Cancel in settings changes nothing. Revert draft removes only unapplied text. A dirty asterisk marks accepted changes that differ from the saved snapshot; [draft] marks unapplied JSON; ! marks external disk changes.

Ctrl+O opens, Ctrl+S saves, Ctrl+Shift+S saves all, Ctrl+Z/Ctrl+Y undo/redo accepted edits, Ctrl+W closes a tab. Project settings group title/revision/start pose into one history entry. History retains up to 100 accepted commands per document; undo/redo tracks the content savepoint, including after saving. Editing an undone branch clears its redo history.

The left pane lists open documents and the current starting-map/actor references. Double-click a reference to locate it in JSON. The diagnostics panel lists validation and external-change errors; double-click a document error to activate its tab and locate a field where possible. This is reference/diagnostic infrastructure; actor/item/map database forms arrive in later phases.

JSON and settings are validated using the same MM02 reader. Unknown compatible fields remain in snapshots and saves. Project ID is protected from ordinary edits: use Clone as New Game for an identity change. The validated summary from MM02 is available through Edit.

## Saves, backups, conflicts

Opening or saving an unchanged document does not rewrite it, normalize original bytes on disk, or create a backup. Accepted edits are represented as canonical JSON snapshots in memory. A successful changed-file save writes UTF-8 JSON and preserves the exact prior raw file (including BOM/CRLF) as <filename>.bak. One previous generation is retained; subsequent successful saves replace that backup. This bounds backup storage.

Before overwriting, the store hashes the disk bytes and compares them with the open/save baseline. It checks again after writing/flushing a same-directory staging file. File.Replace performs the final per-file commit and previous-version backup. A failed operation leaves the in-memory work dirty and removes its staging file where possible. Symbolic-link save targets are rejected; no unsafe copy-over fallback is used on unsupported filesystems.

Cooperating editor saves use a zero-byte <filename>.save-lock sidecar. It may remain after closing; it contains no document contents and an OS handle, not its mere presence, controls locking. A crashed process releases the handle. The editor polls for outside changes every two seconds, and actual saves recheck independently. Same-length edits with unchanged timestamps are detected. Reload is explicit and validates the replacement before discarding current accepted work/history.

These are optimistic filesystem conflict checks, not an atomic compare-and-swap guarantee against a noncooperating program that replaces a pathname between the last check and the OS commit. Local filesystem File.Replace/locking behavior must be certified on Windows; Linux execution tests are recorded separately. Network/cloud filesystem durability is not claimed.

Save All preflights every dirty document before any write. Each file then commits separately: if an I/O error occurs partway through, earlier successful files are saved and remaining files stay dirty. The UI reports saved/pending counts. There is no false all-or-nothing multi-file transaction claim.

## Copies and identity clones

Save Copy writes a new .maxxia file with the same project identity, without retargeting the original tab or clearing its dirty flag. It never overwrites an existing destination. This is a document backup, not a complete game-folder export; if placed elsewhere, restore it beside the content before playing so relative paths resolve.

Clone as New Game writes a new manifest with a new opaque project ID. In MM03 it must sit beside the source manifest and deliberately uses the same maps/assets/database content. The UI explains that sharing. It preserves compatible metadata and opens the result in another tab. It does not duplicate a full project folder or regenerate map/actor IDs. Full project-owned content loading starts MM04; richer project copying can follow once that format exists. Other project identities already have isolated campaign slots through MM02.

Both operations use the accepted document snapshot. Unapplied drafts are explicitly applied/discarded/cancelled first. Cancelling the file dialog does not create a copy. Existing targets are rejected instead of overwritten.

## Closing and cancelling

Closing a dirty tab asks to save/discard/cancel. Unapplied JSON has its own apply/discard/cancel decision. App shutdown preflights all tabs before removing any: choosing Cancel on a later tab keeps the workspace open. Discard-only draft decisions are deferred until close completes. Changes explicitly applied/saved during those prompts remain accepted/saved. Failed saves block the close.

## Build/export hygiene and lean source

Both portable and standard Vite builds filter .bak/.save-lock/.tmp sidecars. Source/browser/editor packaging filters them as well. No backup contents ship merely because the manifest lives in public. Original art masters remain optional; no masters or generated dist are added back to source packages.

Source-only distribution: run npm run build:game before launching. To use this editor with the actual game, open engine/world-of-maxxia/public/WorldOfMaxxia.maxxia, edit/save, then rebuild the browser game. The included editor examples are manifest examples, not complete game-content directories. Runtime rules/assets and campaign schema remain unchanged.

## Verification commands

- npm run check:documents builds the cross-platform library/test runner and executes 25 real temporary-file scenarios. Set MAXXIA_DOTNET for a non-PATH SDK.
- npm run check runs generated-schema, 42 C#/TS fixtures, document scenarios, strict TypeScript/363 game tests and audited-file checks.
- npm run verify:build-hygiene plants synthetic sidecars, runs both actual build routes, verifies filtering, then removes its fixtures.
- npm run build:editor and tools/Build-Editor.ps1 -Publish build/publish the Windows app.

Native Windows manual checklist: open two manifests; apply/undo/redo settings and JSON; Cancel a settings dialog; save and inspect exact .bak; change a file in another program and attempt save; resolve by reload or copy; exercise Save All partial/error reporting; cancel app shutdown on the last tab and confirm earlier drafts remain; test Copy/Clone and keyboard/DPI layouts. These UI interactions are not represented as passed by headless tests.
