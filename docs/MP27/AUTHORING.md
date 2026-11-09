# MP27 — Illusions, perception and puzzle presentation

Engine 0.72.0 · Workspace 0.27.0-mp27 · Campaign format 18

MP27 separates presentation from authoritative collision, adds discoverable false features, and provides reusable sequence, alignment and combination controls. The independent core-only Counterfeit Gallery pack defines every clue, solution, incorrect response and reset response in JSON. It reuses existing temporary scenery; final art remains a later phase.

## Try the example

Start the supplied browser server with Node 22.18 or newer, then open:

`index.html?project=projects/WorldOfMaxxia/project.json&catalogue=mp27-proof/perception-lab.maxxia-build.json`

At the start, press Space or Interact for the Bells mechanism. Read its inscription: enter **Dawn, Noon, Dusk**, then Submit. The false wall east of the mechanism fades. Alternatively, move one cell east from the start and use Search to discover the same passage without solving the puzzle. Moving through the false wall is physically possible and records the discovery through exploration history.

The painted doorway at (3,3) looks open but is solid stone. Search from an adjacent cardinal cell reveals it. The ghostly plinth at (5,2) is temporary false scenery; it disappears when searched. Rings at (2,4) uses three alignment slots; Stars at (2,6) uses an unordered combination. Approach a mechanism and press Space for the shared controls. The hint names nearby puzzles. Keyboard Tab/Enter and ordinary selects operate the controls; Close or Escape returns to play. Browser interaction remains an unverified platform gate on this host.

The browser includes the retained MP26 Terrain Lab, Bell and Lantern Gallery catalogues under `mp27-proof/` as well. The examples remain separate adventure instances.

## Authored definitions

Add `perception` to a native GridMap record, or `objects.perception` in a map document. The structure is:

```json
{
  "version": 1,
  "illusions": [
    {
      "id": "veil",
      "x": 3,
      "y": 1,
      "appearance": "wall",
      "name": "Marble wall",
      "description": "Your hand passes through the marble veil.",
      "searchable": true,
      "revealPuzzleId": "bells"
    }
  ],
  "puzzles": [
    {
      "id": "bells",
      "x": 2,
      "y": 1,
      "name": "Three bells",
      "kind": "sequence",
      "clue": "Dawn rings before Noon; Dusk answers last.",
      "tokens": ["Dawn", "Noon", "Dusk"],
      "solution": ["Dawn", "Noon", "Dusk"],
      "incorrect": "The bells clash. The input clears.",
      "success": "The bells chime and the veil fades.",
      "reset": "The bells fall silent. Start again."
    }
  ]
}
```

| Contract | Behaviour |
| --- | --- |
| Illusions | Up to 32 per map; local unique IDs, inner-map coordinates |
| Puzzles | Up to 16 per map; share the illusion ID namespace |
| IDs | Lower snake case, 1–32 characters; reserved prototype names rejected |
| Appearance `wall` | Requires real floor; appears opaque until revealed |
| Appearance `opening` | Requires real wall; appears open until revealed; movement still blocks |
| Appearance `scenery` | Adds a presentation-only marker, with no rewards or authority |
| Revelation | Searchable cardinal neighbour, solved local puzzle, or visiting its real floor cell |
| Text | Nonempty name, clue, success, incorrect and reset text, at most 1,000 characters each |
| Tokens | 2–8 unique labels, each at most 40 characters |
| Solution | 1–8 tokens from the declared vocabulary; combination solutions cannot repeat a token |
| Placement | Puzzle floor must remain stable; illusion geometry cannot overlap mutable terrain, doors or secrets |

Illusions need a search route or a valid local puzzle dependency. The example provides both. Revealing a feature does not alter base rows, collision, combat line of sight, rewards, RNG, or terrain configuration. Geometry-changing effects continue to use MP26 terrain commands. Doors and native secret passages retain their existing contracts.

For a visible mechanism, author an ordinary prop or MP25 sprite at the puzzle coordinate. The fixture includes three lever props. False scenery uses the shared procedural marker placeholder; custom illusion sprite variants are not part of this phase.

## Puzzle commands and outcomes

```json
{"type":"puzzle","puzzleId":"bells","action":"input","token":"Dawn"}
```

Actions are `inspect`, `input`, `submit`, `reset`. Alignment input also requires a zero-based `slot`. Sequence input appends; alignment sets or edits consecutive slots; combination input toggles a selected token. Submit compares an exact sequence/alignment or an unordered combination. An incorrect submission increments attempts and clears the input. Reset clears unfinished input and retains attempt history. A correct submission latches `solved`; repeated submit/reset/input then spends no time and grants nothing again.

Each successful input, reset or submission costs one expedition minute and uses normal condition/time settlement. Inspect is read-only, returned as a blocked/no-change simulation result with the authored clue. Invalid, remote and overlong input spends no time. All changes require a conscious party outside combat/defeat and a mechanism on the current cell or an adjacent cardinal floor cell. Blocked edges and elevation differences greater than one level prevent reach. Search retains its existing ten-minute/one-food cost and reveals nearby searchable illusions without an additional perception roll.

Commands can be used through the existing bounded routine operation:

```json
{"op":"command","command":{"type":"puzzle","puzzleId":"bells","action":"submit"}}
```

Use the side-effect-free local-map condition query to gate ordinary routines, dialogue or other existing condition consumers:

```json
{"op":"eq","left":{"query":"puzzle-solved","puzzleId":"bells"},"right":true}
```

Unknown local puzzle queries fail explicitly. The widget itself does not execute reward scripts. Authors can gate existing effects or route-control routines with this condition; normal transaction and one-time reward contracts still apply. All command authorization is repeated in simulation, including after each UI choice. Pack text is inserted as text, never HTML or executable code.

## Persistence

Map state optionally contains:

```json
{"perception":{"version":1,"revealed":["veil"],"puzzles":{"bells":{"values":["Dawn"],"attempts":1,"solved":false}}}}
```

An absent extension means no explicit discoveries and no puzzle progress. Campaign format stays 18; new packs require engine 0.72.0. Unknown versions, definitions, tokens, forged solved values, invalid attempts and unexpected fields reject save validation. Partial input, attempts, solved state and exploration discoveries survive campaign serialization and actual campaign-instance save/reload. The catalogue adoption workflow remains explicit; no automatic save rewriting or cross-adventure puzzle-state sharing is introduced.

`perceivedMap` is an immutable presentation projection used only by the 3D renderer and map display. Rules continue receiving the original map. Do not feed the perceived projection into simulation or save validation. Solving a puzzle is monotone; resetting unfinished input does not undo discovered scenery or other puzzle solutions. This is an authored perception layer, not multiplayer hidden information or general sensory simulation.

## Source and verification

Complete pack: `examples/mp27/perception-lab`. Exact types and semantic admission: `src/shared/project/perception-contracts.ts`; operations: `src/shared/rules/perception.ts`; controls: `src/client/puzzle-screen.ts`. Paths beginning `src/` are relative to `engine/world-of-maxxia`. Toolkit map/routine schemas include the new contracts.

After installing locked root and engine dependencies, run from the source root:

```sh
npm run build:mp27:catalogues
npm run check:mp27
npm run test:game
node --test toolkit/tests/*.test.mjs
npm run build:game
npm run run:mp27
npm run render:mp27
npm run verify:game
npm run check:workspace
python3 tools/package-mp27.py
python3 tools/verify-release-mp27.py
```

Strict TypeScript: `node engine/world-of-maxxia/node_modules/typescript/bin/tsc -p engine/world-of-maxxia/tsconfig.check-client-offline.json`. CPU renderer proof uses the pinned root Canvas dependency. Evidence is in `validation/MP27` and `validation/MP27-legacy`.

Interactive browser/touch/GPU review and native Windows/.NET editor acceptance remain open. The host process-socket restriction observed in MP24 was not newly tested here. This phase adds JSON authoring and shared browser puzzle controls; a native terrain/perception form editor is not claimed.

Next: MP28 — Regional travel and encounter sites.
