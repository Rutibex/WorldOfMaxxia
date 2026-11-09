# MP22 Validation Results — Monsters, Behaviours and Companions

**Date:** 7 November 2026  
**Source checkpoint:** Maxxia Maker 0.22.0-mp22  
**Browser engine:** World of Maxxia 0.67.0  
**Save format:** 18 (unchanged; new encounter/companion state is additive and optional)

## Acceptance outcomes

| Gate | Evidence | Status |
|---|---|---|
| Strict TypeScript | `tsc -p engine/world-of-maxxia/tsconfig.check-local.json` | PASS |
| Full gameplay | `node --experimental-strip-types --test --test-concurrency=2 engine/world-of-maxxia/tests/*.test.mjs` | **828/828 passing** |
| MP22 focused gameplay | `node --experimental-strip-types --test engine/world-of-maxxia/tests/monsters-mp22.test.mjs` | **12/12 passing** |
| Generated contracts | `npm run generate:contracts` and `npm run check:generated` | PASS |
| Composed proof catalogue | `node tools/build-mp22-catalogues.mjs` | PASS, Bell and separate receiving adventure |
| Standalone browser | `npm run build:game` | PASS, portable offline build |
| Server/asset integrity | `npm run verify:game` | PASS, Node launcher and **611 files** byte-identical over HTTP; missing file returns 404 |
| Source vs compiled simulation | `node --experimental-strip-types tools/run-mp22-scenarios.mjs --production` | PASS, matching replay and scenario hash `b33078b2e0f911c3949b704efecfb01c616208a5309fbec319a8267e5935869e` |
| Source/workspace manifest | `npm run check:workspace` | PASS, 28 source files hashed and verified |
| ZIP integrity | `python3 tools/package-mp22.py` | PASS, ZIP CRC and archive hash verification |

## Tested MP22 behaviours

The focused suite covers: three installed authored behaviours and health phases, malformed AI and unsafe summon limits, generic rat approach, echo threshold/defensive guard and save persistence, injured sentinel limited summon and no extra initiative actor, Chime Wisp ownership and ability grants, resource/cooldown/failed re-cast transaction safety, companion duration/expiry, summon cleanup and no extra loot or XP on victory, receiving-adventure composition, rejection of forged companion owners/kinds/IDs/expiries, rejection of summoned full initiative entries and cleanup on total party defeat. The replay additionally covers source-vs-production deterministic state, save/reload, victory settlement and portable Echo Sentinel copying with ability available in the receiving adventure.

## Compatibility

- MP21 data/old monsters without `behavior` still use their original AI and weighted strike choices. Old MP17–MP21 packs are retained.
- The original game's special Bell-Heart resonance telegraph remains a legacy compatibility branch; MP32 is scheduled to remove remaining campaign-specific assumptions.
- Summoned enemies and companions have **no full extra turn**; support is capped and non-rewardable. Temporary companions are encounter-owned and do not become portable roster members.
- New monster visuals use existing approved atlas keys, pending the final unique art phases.
- The authored class ability is grant-gated through the MP19 ability system. It is not an unrestricted effect script.

## Remaining limitations and unverified gates

1. **AJV toolkit semantic suite:** not independently rerun; the root offline workspace lacks the installed `ajv` 8.17.1 npm dependency. The native TypeScript readers, catalogue composition and executable focused/full gameplay suites pass, but that is not a substitute for independently running the AJV tools after restoring npm dependencies.
2. **Interactive graphical/Chromium playthrough:** not independently verified. The built browser modules, deterministic production replay, HTTP server and launcher have been exercised; visual input/resolution verification is a later acceptance gate.
3. **Native Windows/.NET editor:** not built or visually checked here. The browser game plus command-line pack toolkit is the primary delivery target at this roadmap stage.
4. **Persistent follower commands:** MP22 intentionally implements encounter-bound allied supports, not recruitable campaign-long NPCs, pet inventories or extra initiative turns. Further exploration commands belong to MP23 and generic NPC behaviour to the later social phases.
5. **Final art:** remains temporary as required by the MP39–40 art plan.

## Source artefacts

- `engine/world-of-maxxia/src/shared/content/monsters.ts` — validated priority/condition and phase records.
- `engine/world-of-maxxia/src/shared/rules/combat.ts` — bounded action processing, summons, companions, phase modifiers, save guards, reward semantics.
- `engine/world-of-maxxia/src/shared/content/effect-definitions.ts` and `rules/effects.ts` — class-granted combat companion operation.
- `engine/world-of-maxxia/src/shared/content/catalogue.ts` — reference validation for exported ability/monster graph.
- `engine/world-of-maxxia/src/shared/rules/inventory.ts` — never generate loot from summoned units.
- `toolkit/schemas/{monster,ability}.schema.json` — strict authored contracts.
- `examples/mp22/brass-bell` and `engine/world-of-maxxia/public/mp22-proof` — packaged playable example.
- `engine/world-of-maxxia/tests/monsters-mp22.test.mjs` — 12 focused cases.

**Next phase:** MP23 — Exploration abilities and physical interactions.
