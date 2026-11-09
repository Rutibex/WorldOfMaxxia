# Phase34 Verification

Release0.34.0; schema18.

TypeScript and313/313 automated rules/model/render/save checks pass. Ground checks cover exact state retention, no mutation on rejection, reach, combat/equipment restrictions, independent per-creature corpses, manual loot/gold, empty bodies, full bags, protected quest gates, old overflow and partial-battle migration, and invalid save data.

Actual Chromium checks exercise button/native-drag drops, reload persistence, pickup, real combat leaving corpse loot/gold, Take All, quest pickups, portrait availability, and800/1360 layouts. Final ZIP checks use a clean extraction and its own server/runtime, plus a cache-warmed v0.33.0 upgrade with existing saved XP. Previous message, thievery/Quick Fight and inventory/expedition browser suites also run against the extracted build.

Offline build, module graph, art references, production HTTP/health/404 checks pass. Rendered corpse and loot layouts visually inspected. Full campaign balancing and Firefox/Safari certification remain future work.
