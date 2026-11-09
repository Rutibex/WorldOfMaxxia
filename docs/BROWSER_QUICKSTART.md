# Browser quickstart

**Player download:** Extract `World-of-Maxxia-MP27-Play.zip` into a folder. Install Node.js 22.18+; double-click `Start-World-of-Maxxia.cmd` on Windows or run `./start-world-of-maxxia.sh` on macOS/Linux. Open http://localhost:3000/ in a desktop browser.

**From source:** Install npm packages (`npm ci` and `npm --prefix engine/world-of-maxxia ci`), run `npm run build:game`, then `npm run start:game`. Opening `index.html` directly as a file is unsupported.

**Controls:** Arrow keys move/turn, Ctrl+Left/Right strafe, Space interacts, V searches, M opens automap, B bashes, and R rests when appropriate. On-screen buttons and menus cover the same major actions; the UI includes additional contextual instructions.

**MP27 example:** Visit `http://localhost:3000/index.html?project=projects/WorldOfMaxxia/project.json&catalogue=mp27-proof/perception-lab.maxxia-build.json`. Inspect the Bells, then the Rings and Stars. The authored walkthrough is in [MP27/AUTHORING.md](MP27/AUTHORING.md).

**Save safety:** Saves are local to the browser profile and origin. Back up/export a portable save before switching machines, localhost ports, or moving to a hosted deployment. The game does not automatically synchronize save files.

**Known limitations:** Automated tests do not substitute for manual browser/touch/GPU and native editor acceptance. This repository's active checkpoint is MP27.
