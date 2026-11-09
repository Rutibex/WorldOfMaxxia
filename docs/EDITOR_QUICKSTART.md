# MM06 addendum: editable items database

**The MM06 editor executable was not compiled on this host.** On Windows, compile from the complete MM06 source with the .NET 10 SDK (`dotnet build editor/MaxxiaMaker.sln -c Release`) and open a `.maxxia` project. Choose **Edit → Items database…** (Ctrl+I) or the Items database toolbar control. Use Apply changes / Save items (Ctrl+S) to persist the independent JSON document. Legacy item IDs are protected. The parent manifest Save All does not save an open item dialog. See `docs/ITEM_DATABASE_MM06.md` and `PHASE_NOTES/MM06.md`.

# MM05 addendum: resources

Open a project then choose **Edit > Resource catalogue...** or **Resources** on the toolbar (Ctrl+R). This browser is read-only in MM05. The old MM03/MM04 packaged executable does not include MM05 controls; compile source with the .NET 10 SDK on Windows. See `docs/RESOURCE_CATALOGUE_MM05.md`.

# Maxxia Maker MM03 — Windows x64

Extract the complete ZIP and run MaxxiaMaker.exe. It is a self-contained .NET 10 Windows x64 app; keep its companion DLLs. The application is unsigned.

Open a .maxxia file with Ctrl+O. examples/WorldOfMaxxia.maxxia is included. Each project document gets a tab. Project settings edits title/revision/start position as one undoable group. JSON editing supports the complete current manifest; Apply JSON validates and accepts a draft, while Revert draft discards it. Compatible unknown fields are preserved.

Ctrl+S saves with an exact previous-version .bak; Ctrl+Shift+S saves all; Ctrl+Z/Y undo/redo accepted edits; Ctrl+W closes. * means accepted unsaved edits, [draft] unapplied JSON, ! outside file changes. Conflicts block overwrite; use Reload or Save Copy. Save Copy retains identity; Clone as New Game creates a new identity beside the source manifest and shares its existing content files.

The left reference list and bottom diagnostics are usable foundations. Map/database-specific editing starts in later phases. This build edits manifests, not the complete database/map system yet. Rebuild the browser game after changing a source/public manifest. The example folder contains no full game assets.

Read docs/WORKSPACE.md for backup retention, Save All partial-failure behavior and copy/clone scope. Core operations have 25 executed filesystem scenarios; the WinForms executable was cross-compiled on Linux, with native Windows UI/keyboard/DPI still unverified.

Next: MM04 — Dynamic map discovery and project boot.
