# Maxxia Maker MM17 — Windows x64

Extract the entire archive into a writable folder. Install Node.js **22.18 or newer** on PATH. The editor's .NET runtime is included; Node is required for canonical map validation and browser rebuilds.

Run **tools/Start-Maxxia-Maker.cmd**, then open:

`engine/world-of-maxxia/public/WorldOfMaxxia.maxxia`

Click **Maps**, or double-click a map in the project tree. Paint with Pencil, Erase, Rectangle or Fill. Erase restores walls. Select copies/pastes geometry only. Existing objects and material overrides are protected. Use wheel/+/− to zoom, middle drag or Pan to move the canvas. Ctrl+Z/Y undo/redo; Ctrl+S saves all maps in this window.

For a small isolated test, open `engine/world-of-maxxia/public/projects/SingleMapProof/SingleMapProof.maxxia`, edit its room, save, then run **tools/Rebuild-and-Play.cmd**. Open `http://localhost:3000/?project=projects/SingleMapProof/SingleMapProof.maxxia`. Rebuild after edits; the browser serves the compiled `dist` snapshot. Use a new game when testing changed topology against an old save. Stop the server with Ctrl+C before rebuilding.

For a newly created map, choose its ID and a valid floor position in the existing main-window project settings before rebuilding. MM18 adds transfer/arrival editing.

Source and authored project data are included. Changes are saved in the extracted copy. Keep `tools` and `engine` alongside `editor-bin`: the canonical map save validator imports the actual engine rules. Node package installation is not needed for these launchers.

The executable is unsigned. It was cross-compiled/published on Linux; actual Windows launch, mouse interaction and DPI layout remain untested. Build output contains nullable warnings. Map saves use per-file backups/conflict checks; multiple files are not one atomic transaction. Removing a map unindexes it and retains its file for recovery.

Detailed implementation, checks and manual acceptance: `PHASE_NOTES/MM17.md`.
