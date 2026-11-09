# MP20 — Races, Classes and Character Creation

**World of Maxxia 0.65.0 / Maxxia Maker 0.20.0-mp20 — 7 November 2026**

MP20 permits adventure packs to export mechanically distinct races, classes, starting specializations and prepared combat styles without a pack-specific branch in the engine. JSON is still the canonical authoring format. Use the cumulative source archive for development and the standalone browser archive for offline play. The new records are in `examples/mp20/brass-bell`; the earlier MP17, MP18 and MP19 examples remain separate for compatibility.

## Launch the MP20 proof

Unpack `World-of-Maxxia-MP20-Browser.zip`, run `Start-World-of-Maxxia.cmd` on Windows or `sh start-world-of-maxxia.sh` on Linux/macOS, and open the local address printed by the launcher. **Node.js 22.18 or later** is the supported engine requirement; the current validation host only supplied 22.16 and its `--experimental-strip-types` flag was used for source checks. Choose **Adventure Library → MP20: Brass Bell Cistern — Bellforged and Echo Sentinel**. The composed catalogue is served as `/mp20-proof/brass-bell.maxxia-build.json`; `/mp20-proof/receiving.maxxia-build.json` installs the same Bellforged/Echo Sentinel exports alongside the receiving adventure.

The original `/cistern.html` is still the older standalone example. It is intentionally not silently replaced by the MP20 version. Existing saves also keep their captured pack versions; create a new campaign to use the new content or use the explicit migration/transfer flow.

## Record format and namespaces

A race has kind `race`, namespace `bell:race:<slug>`, and the payload wrapper:

```json
{
  "format": "maxxia-authored-race", "formatVersion": 1,
  "id": "bell:race:bellforged",
  "record": {
    "id": "bell:race:bellforged", "name": "Bellforged",
    "description": "A bronze-resonant folk.",
    "attributeBonuses": {"CON": 1},
    "resistances": {"lightning": 15},
    "traits": ["bell:trait:echo_blood"],
    "abilityGrants": [{"id": "bell:ability:chime_instinct", "minLevel": 1}]
  }
}
```

Racial ability grants resolve against the same shared MP19 ability catalogue as class grants. Numeric race attribute bonuses are bounded to −3…+3 each, resistance modifiers −25…+25, and source attributes remain the unmodified 76-point character-creation inputs. Missing race IDs in earlier characters resolve to `core:race:human`.

A class uses the existing `maxxia-authored-class` wrapper with extended `record`. It provides six-point attribute labels and class HP/SP parameters, equipment `equipmentTags`, `traits`, `preparedStyles`, optional `styleDefinitions`, `abilityGrants`, and optional `creationChoices`. New class/choice grants are records of `{ "id": "pack:ability:name", "minLevel": 1 }` that must reference installed ability definitions.

Example starting specialization from `class_echo_sentinel.json`:

```json
{
  "id": "watcher", "name": "Watcher",
  "description": "Careful defence.",
  "attributeBonuses": {"CON": 1},
  "starterEquipment": {"offhand": "bell:item:resonant_buckler"}
}
```

A separate `runner` specialization grants +1 DEX and starts with a core staff. A class declares an array of creation choices, and a new character explicitly selects one; otherwise the first is the default. Starter items must pass the class equipment permissions or they are not equipped.

An authored attack style requires a `pack:style:<slug>` ID in both `preparedStyles` and `styleDefinitions`, an associated class trait if required, and a bounded declaration of attack/damage/defense modifiers and supported damage type. Sonorous Needle uses a DEX-oriented device attack dealing lightning damage, with 1d6 → 1d8 progression. This is implemented through the standard `strikeProfile` combat path, not a special `bell` combat branch. Other pre-existing core styles remain unchanged.

## Example content

| Definition | ID | Mechanics |
|---|---|---|
| Race | `bell:race:bellforged` | +1 CON; +15 lightning resistance; Chime Instinct passive |
| Class | `bell:class:echo_sentinel` | DEX combat, Sonorous Needle, Echo Pulse ability, Echoes pool |
| Choice | `watcher` | +1 CON and Resonant Buckler |
| Choice | `runner` | +1 DEX and staff |
| Existing class | `bell:class:bellwarden` | Resonance, Resonant Guard, Counter-Chime, Stillwater Stance |

At first creation the user can choose an enabled race, class and specialization on the shared six-character builder. Character information displays race and specialization, plus authored powers. At advancement, class/choice/race grants become available through their declared `minLevel` and run through MP19 rules. For a portable export, a race, class, style, ability and starting choice must all have valid provider identity and matching definition snapshots. Imports do not manufacture missing provider definitions.

## Build and test from the source archive

From its root, with supported Node.js available:

```bash
node tools/build-mp20-catalogues.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/creation-mp20.test.mjs
node --experimental-strip-types --test engine/world-of-maxxia/tests/*.test.mjs
node tools/generate-contracts.mjs --check
node --experimental-strip-types tools/run-mp20-scenarios.mjs --production
npm run build:game
npm run verify:game
```

`npm run check:mp20` combines the catalogue-build and focused tests. `npm run package:mp20 /mnt/data` can prepare release archives when the documented gate logs are present; see `tools/package-mp20.py`. The AJV-powered toolkit CLI has an external npm dependency, so its full suite should be rerun after `npm ci` on a machine with packages available. Do not treat its unavailable offline checks as passes.

**Scope boundary:** MP20 uses the existing fixed classic core rules profile and equipment categories. Unrestricted scripted class logic, independently scalable equipment tags and artifacts/crafting are not promised. Equipment/artifact contracts expand in MP21; monster behaviours follow in MP22. No interactive rendered browser inspection or Windows editor build was performed in this environment.
