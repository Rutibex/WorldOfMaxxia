# Repository structure and release policy

The public source repository retains engine code, editor code, game assets, authoring CLI, contract schemas and fixtures, and example campaign packs. These are part of the software, even when a path name includes an old milestone identifier.

Temporary validation output, intermediate render logs, milestone handoff states, staging ZIP files and private development reports have been removed from this public snapshot. Rebuilds generate outputs under ignored `artifacts/`, `engine/world-of-maxxia/dist/` and `_site/` directories.

The downloadable **Play** archive contains prebuilt content, the static server/launchers and third-party license notices. It does not contain developer tools or the C# editor. The GitHub Pages package contains a landing page and the same playable static files, without requiring Node on the web host.

Feature documentation is intentionally retained by topic under `docs/MPxx/`, while internal per-phase test evidence and handoff reports are not carried into the public repository. Legacy fixtures and example packs needed by tests remain in source control.
