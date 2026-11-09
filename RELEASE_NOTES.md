# World of Maxxia · MP27 release notes

**Suggested GitHub tag:** `v0.27.0-mp27`  
**Game engine:** `0.72.0` · **Campaign save schema:** `18`  
**Release stage:** preview

The MP27 checkpoint introduces illusions, discoverable false scenery and three kinds of reusable puzzles on top of the modular first-person dungeon crawler and Maxxia Maker authoring toolchain.

### Download choices

- **`World-of-Maxxia-MP27-Play.zip`** — prebuilt browser game, local Node.js server and launch scripts for Windows/macOS/Linux. Requires Node 22.18+, not npm or .NET.
- **`World-of-Maxxia-GitHub-Repository-MP27.zip`** — full cleaned source workspace, documentation, CLI pack authoring, tests, Windows editor source, website and deployment workflows. Install Node 22.18+ for builds and .NET 10 for editor development.
- **`World-of-Maxxia-MP27-GitHub-Pages.zip`** — ready-to-publish static landing page plus playable browser content. Uploadable to compatible static web hosting. This archive is not necessary when the Pages GitHub Actions workflow is enabled.

### Try a demo

Start the game, then open `/?project=projects/WorldOfMaxxia/project.json&catalogue=mp27-proof/perception-lab.maxxia-build.json` on the same origin. Inspect the Bells, search for illusory passages, and experiment with Rings and Stars.

### Known limitations

The MP27 automatic logic tests are included, but manual interactive cross-browser, touch, GPU and native editor acceptance have **not** been independently established for this release. Existing browser save data is scoped to the page's origin, so moving from localhost to GitHub Pages does not automatically migrate it. Export a portable save first if you want to move between origins.

### Attribution

Original game and source © 2026 Michael Robinson / Witches Mirror Games; no open-source license is granted. Bundled third-party runtimes and fonts have their own licenses. See the notices and `LICENSE` file included with the archives.
