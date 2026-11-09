# MP16 — Encounters, wandering tables and time

Runtime **0.61.0** · 7 November 2026 (America/Toronto)

This phase adds data-authored encounter triggers and seeded weighted wandering tables around the existing combat, exploration and save systems. Patrols can be fought, bribed or avoided. Deadlines and decisions persist in campaign-scoped state. Menus do not advance the clock or roll an encounter.

## Play Patrols of the Drowned Watch

The browser ZIP is prebuilt. With Node22.18+, run its Windows launcher or `sh start-world-of-maxxia.sh`, open the printed local address and visit `/patrol.html`. For the source package, run `npm run build:game` and `npm run start:game`. The portable builder also works without installing dependencies.

Select the recommended party and enter the courtyard at (4,4), facing north. Information (I) contains **Encounter choices / Wait**; its menu offers **Wait5 minutes** when no nearby decision is pending. Five minutes produces one weighted patrol check. A nearby pending encounter also opens through Interact. Read-only encounter and journal menus spend no time and consume no RNG.

| Encounter | Trigger and choices | Return policy |
|---|---|---|
| Toll Patrol | Clock table every5 minutes; fight,5-gold bribe or Dexterity avoidance DC1 |20-minute cooldown |
| Watch Inspector | Same table, weight1 versus patrol weight3; fight,10-gold bribe or DC1 avoidance |Re-entry after resolution |
| Camp Disturbance | One check after a successful courtyard rest; fight,3-gold bribe or DC1 avoidance |Never |
| Silt Warden | Reach (4,1); fight through100% and50% health waves |Never |

The deliberately easy avoidance DC demonstrates a successful peaceful path with a normal starting party. Higher authored DCs can cause failure and immediate combat. Patrols use a weak custom Waterlogged Watchman so the example is approachable. Rewards use normal combat XP and corpse loot; bribes and avoidance grant neither.

The shelter portal is at (7,4). From the start, turn right, move east twice and Interact with the portal ahead. The shelter returns through the portal north of its arrival. Returning can reset a resolved inspector; the next eligible shared-table draw may choose either inspector or patrol. An unresolved encounter remains recorded when you leave its area.

Rest retains its normal eight-hour cost, food consumption and recovery. The encounter consequence happens after that successful rest; it does not retroactively cancel recovery. A pending nearby encounter prevents waiting or camping until resolved. You can close the menu, explore elsewhere and return to the decision.

## Source and command contract

The complete source pack is `examples/mp16/patrol-pack`; the build is `examples/mp16/patrol.maxxia-build.json`. Validate with `node tools/maxxia.mjs validate examples/mp16/patrol-pack --engine 0.61.0`. Build with `node tools/maxxia.mjs build examples/mp16/patrol-pack --engine 0.61.0 --out examples/mp16/patrol.maxxia-build.json`.

Encounter payloads have format `maxxia-authored-encounter`, formatVersion1, id and record. The wrapper and record IDs must match their namespaced encounter descriptor. See `toolkit/schemas/encounter.schema.json` and the finished example JSON for the complete contract.

| Field | Meaning |
|---|---|
|id, name, description|Stable identity and player-facing description |
|mapId, nativeMapId|Namespaced map definition reference and its native runtime map ID; both must agree |
|x, y, range|Member origin and Manhattan offer radius0–4 |
|trigger.kind|proximity, clock or rest |
|trigger.interval|Clock interval1–10080 minutes; other trigger types retain a positive interval as metadata |
|trigger.table|Local table name; members share namespace, native map, kind and interval |
|weight|Positive selection weight1–1000 |
|members|One to three existing monster references with offsets−4 through4, all placed on walkable floor |
|bribe|Party gold cost0–100000, or null to disable |
|avoidDC|Best conscious active hero's Dexterity modifier plus seeded d20 against DC1–40, or null to disable |
|condition|Optional shared campaign condition; false rows are excluded before the weighted roll |
|respawn.kind|never, reentry or cooldown |
|respawn.minutes|Cooldown1–10080; positive metadata for other policies |
|phases|One to four waves, each with a title and healthPercent1–100 of its monster's normal maxHP |

Commands use the shared simulation boundary:

```json
{"type":"encounter","action":"menu"}
{"type":"wait","minutes":5}
{"type":"encounter","action":"bribe","encounterId":"mp16:encounter:patrol"}
{"type":"encounter","action":"avoid","encounterId":"mp16:encounter:patrol"}
{"type":"encounter","action":"fight","encounterId":"mp16:encounter:patrol"}
```

Waiting accepts1–60 minutes and uses the existing expedition settlement for hunger, ailments and magical expiry. Combat, defeat or a pending nearby decision prevents waiting. Decisions recheck map, range, pending status, combat, conscious heroes and affordability before applying. Failed evasion starts the same encounter, without swapping enemies or granting a peaceful reward. A stale repeated bribe is blocked without charging again.

Dedicated encounter and wait commands cannot be nested through the raw routine command adapter. Encounter conditions can use global scoped values, inventory/gold and MP15 quest queries; routine parameters, local variables and NPC-local relationship queries are rejected. Use a routine to publish a scoped fact that a future timed/proximity check can read.

## Clocks, state and composition

Clock intervals use the saved campaign elapsed-minute clock. The first check is due at the interval from campaign minute0. On a due check, the saved next deadline becomes current time plus interval, even when no eligible row is selected. Missed intervals coalesce into one check, including after long rests or time spent off-map. No offline wall-clock time is added. Tables use sorted IDs and the campaign's serialized xorshift RNG; eligible weights are summed and selected by one weighted draw. No eligible row means no draw. Rest and proximity checks use the same selection machinery.

At most one unresolved authored encounter is queued across the adventure. Eligible tables are considered in stable order; a successful offer stops further offers for that command. Closing or reopening menus never creates another offer. This bounded policy avoids bursts after resting and preserves the original RNG sequence through reload.

Status is stored at `namespace:collection:e_<name>_status`, with one of pending, fighting, won, bribed or avoided; absent/idle means eligible. Cooldown resolution time is `namespace:counter:e_<name>_resolved`. A table's next deadline uses the lexically first member's `namespace:counter:e_<name>_next`. Tables and member IDs must remain stable across saves. Invalid outcomes and negative timers reject the command without erasing progress. These keys can be read through the MP12 scoped-state condition query, including MP15 quest objective conditions. The shared scope remains bounded to128 total fields.

Up to16 live authored encounters can be composed. Each definition keeps normal owner/dependency/export/reference validation. Root definitions and their explicit reference closure become live; unreferenced exported definitions are not placed merely by enabling their pack. Map, monster, item and quest condition references must be declared. Native member locations are validated before catalogue installation. The director allocates stable collision-resistant internal enemy IDs; authors continue referring to the namespaced encounter ID.

Dormant encounters have no living enemies, so they do not appear on the map or block safe rest. Fighting activates the preallocated combat state. Escape preserves surviving enemy HP and phase progress; a later fight resumes it. Peaceful resolution retires the encounter without minting corpses. Cooldown and re-entry resets never erase unclaimed corpse contents: respawn waits until loot has been collected, then removes only empty old remains. Never-respawn encounters retain their resolution indefinitely.

Boss waves reuse the same members and enemy IDs, restoring each member to the authored percentage between waves. Wave titles appear in combat messages. No intermediate XP or corpse loot is granted; the final wave awards normal monster XP once per encounter cycle. Existing attacks, spells, targeting, initiative and turn processing remain authoritative. This phase supplies bounded wave configuration, not arbitrary executable boss scripts.

Gameplay save version18 and campaign instance envelope2 remain unchanged. The optional encounter `phase` field is validated against the installed definition. Changes to placed encounter IDs, table anchors, members, map bindings or phase meanings require explicit catalogue/save migration through MP10; do not silently replace definitions under a saved instance.

## Verification and boundaries

Run `npm run check:mp16`, `npm run check:game`, `node --test toolkit/tests/*.test.mjs`, `npm run check:generated`, `npm run check:workspace`, `npm run build:game`, `npm run verify:game`, and `node --experimental-strip-types tools/run-mp16-scenarios.mjs --production`. The production proof runs six routes using ordinary commands, compares complete source/built states and events, and saves/reloads each instance. Native .NET/Windows execution and interactive browser visual acceptance remain unverified on this host. JSON pack authoring and native browser encounter menus are delivered; new WinForms encounter forms are not claimed.

MP17 remains the next phase: the functional Brass Bell Cistern example using the completed foundations.
