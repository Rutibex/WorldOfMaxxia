# MP17 — The Brass Bell Cistern

Runtime **0.62.0** · 7 November 2026 (America/Toronto)

Pack A is now a complete functional adventure authored through ordinary pack definitions. It has a four-location village yard, a ten-area cistern with a loop and optional secret route, three NPCs, three enemy types plus a boss, one main quest with two optional objectives, and two endings. The Bellwarden class, Resonant Buckler and Siltglass Charm are exported. The Bell Clapper remains campaign-bound. Art uses existing labelled review scenery and reused appearances; final artwork is scheduled for later phases.

## Launch and play

The browser release is prebuilt. With Node22.18+, run `Start-World-of-Maxxia.cmd` or `sh start-world-of-maxxia.sh`, open the printed address and visit `/cistern.html`. From source use `npm run build:game`, then `npm run start:game`. The offline builder needs no dependency install.

Choose the recommended party, or create a Bellwarden using the ordinary character creation screen. The class is a defensive martial variant with CON primary,16 base HP,8 HP per level and martial mastery. Normal CON modifiers and level rules apply. Bastion and Measured prepared styles are supported. It starts with the Buckler and compatible ordinary equipment. New Resonance-resource and active guard mechanics remain scheduled for MP19–20; they are not claimed in this phase.

The yard starts at (4,5), facing north. Keeper Edda is at (3,4); trader Mara is at (5,4); the sealed well door is at (4,3); the stair portal is at (4,1). Move north to (4,4), face Edda and Interact → Talk. Accept the request to receive the key and a Siltglass Charm. Open the well with the key, or pick/force it using normal object actions. Unsuccessful attempts can be retried. Costs and physical consequences use the existing object rules. Proceed beyond the door and interact with the stair.

Mara sells torches and healing draughts. Buy a torch before descending if you want the offering route. Edda supplies ordinary healing and training services. The yard arrival/exit marker is at (4,7); normal save/title controls end the expedition safely.

| Cistern area | Position | Purpose |
|---|---|---|
|Entry stair|2,10|Return portal at2,11 |
|Flooded landing|2,8|Connects the western approaches |
|Pump room|2,6|Approach to the gallery |
|Vermin nest|2,3|Silt-rat encounter |
|Keeper’s alcove|4,3|Maintenance spirit; signed record at4,2 |
|Three-valve gallery|4,5|Intake4,5; Return4,6; Bell5,5; inscription3,5 |
|Maintenance store|3,9|Tool chest; pressure trap on3,8 |
|Secret infirmary conduit|6,9|Search from the west side; optional alternate crossing |
|Sentinel chamber|9,7|Brass sentinel |
|Bell regulator|10,3|Bell-Heart and clapper housing |

The vertical barrier has a normal gallery gate at (6,5) and the hidden conduit at (6,9). Either crossing rejoins the eastern route. The secret is never required to finish.

## Solutions, alternatives and endings

The inscription and signed record give the complete valve solution: **Intake → Return → Bell**. Any wrong input deals1 pressure damage to each active hero and resets the sequence to zero. Read the clue, heal/rest if needed, and retry. Successful alignment provides an access token for the gallery gate. Reusing a solved valve does not award another token.

The alternative shutoff bypass at (5,8) costs10 gold,1 food and20 game minutes. It prepares regulator power and gives the same access token. Insufficient resources roll back the whole attempt. It is an alternative to the sequence, not an exclusive prerequisite. Search the conduit for another physical route; activating Siltglass guarantees discovery of this eligible hidden mechanism, while ordinary WIS searching is also available.

The signed record identifies former bursar **Harl Venn** as the saboteur. It enables a peaceful questioning option with the maintenance spirit. Alternatively offer one unequipped torch, which is consumed once. Challenging the spirit produces a normal combat encounter; winning also releases the interlock. These options do not force either ending.

Open and claim the tool chest for the optional tool objective. Its approach trap can be investigated through ordinary exploration procedures, endured once, or approached from another side. Claim the tool reward in the journal:35 gold and60 XP per active hero, consuming the roll. Claim the sabotage reward separately:25 gold and50 XP. Both have persistent once-only guards.

The Bell-Heart has two waves: its brass shell at100% health, then exposed heart at50%. The second wave uses the same existing combat rules and IDs. Intermediate waves grant no loot or XP. Defeat the boss, collect the clapper from its housing and return to Edda. Both choices require the clapper, regulator power, spirit resolution and boss victory:

- **Restore village supply:** the well fills, and Edda commits to public accounts and rebuilding the infirmary line.
- **Power the infirmary:** lamps and sterilizers wake, while the village accepts rationing.

The ending is recorded in quest state and Edda’s follow-up dialogue. Claim **Keeper’s thanks** in the journal:150 gold,300 XP per active hero and a Resonant Buckler; this consumes the clapper. Failed/full-inventory claims remain retryable and never duplicate rewards. Exploration and optional claims can continue after the epilogue.

Both proof routes start at level1 and earn enough for normal level2 training at Edda. The proof Bellwarden earns455 XP on the restore route and475 XP on the bypass/secret route, then trains to level2 using normal costs. Training is a separate player action. Game-clock totals are81 and115 minutes; these are not measured human play durations. The planned30–45-minute first-play target still needs human balance/playtesting.

If the party falls inside the cistern, ordinary recovery uses the map-authored yard arrival, half-health recovery, normal gold cost and eight-hour delay. Quest/door/object progress survives. Rest and healing remain available under the existing safety rules.

## Export contract and receiving fixture

| Export | Current mechanics |
|---|---|
|Bellwarden|CON-primary defensive martial class;16 base HP,8 HP gain; Bastion/Measured; normal equipment/progression rules |
|Resonant Buckler|Shield armor1 while equipped;3 total charges; activation grants existing Stone Skin: party defense+2 for5 minutes; one charge and normal combat item action; no automatic recharge |
|Siltglass Charm|Accessory with3 charges; activation grants20 minutes of Glass Eye; eligible reachable hidden entities are guaranteed when searched; food/time costs remain; map reveal uses existing Glass Eye presentation |

Activations use shared item effects `ward` and `reveal`, not Bell-specific branches. Repeating an already-active identical effect is blocked without spending a charge. The Buckler does not stack with an active Stone Skin effect. Existing unrelated wards retain their normal interaction. Charge counts, wear, equipment and XP persist in portable copies. Both equipment definitions are tagged for appropriate future/generic stock inclusion; fixed quest rewards remain deliberately placed.

Open `/receiving.html` to launch an independent receiving adventure with the Bell pack enabled as a dependency. Its story/quest state is separate; only the exported class/equipment definitions are made available. It contains a practice echo and a hidden test hinge at (2,1).

To export your own Bellwarden, finish the reward claim so the clapper is consumed. Transfer any unused local well key or access token to another source-party member first: campaign-bound support items cannot accompany the traveller. Save, select the Bellwarden in the portable roster panel and export. Open/create a receiving-yard instance, then use **Copy character file into current reserve**. Use the existing Reserve swap panel to activate the arriving hero. Original staging-only import remains available separately.

A ready-made `examples/Bellwarden-Example-Character.json` is included in the browser ZIP; the cumulative source stores it at `examples/mp17/Bellwarden-Example-Character.json`. It was exported from the completed restore-route proof, trained to level2, with local keys left with another source hero. Use it with the receiving fixture to try the copy flow directly.

Cross-catalogue copying is explicit and creates fresh permanent character/item identities. The source is never removed. New exports can include exact definition snapshots for the class, carried items and known spells. Every snapshot must match the installed destination definition and provider version before catalogue provenance is rebound for the new copy. Changed/missing definitions, missing providers, campaign-bound inventory, full rosters and malformed files are rejected. Legacy exports without snapshots remain inspectable/stageable; export again for cross-catalogue copying.

A deterministic local import marker blocks copying the same original file identity into the same destination twice. The new autosave is fully validated before writing, with the old autosave retained as backup. Ordinary save operations retain the MP09 roster-membership guard; they cannot impersonate an import. Local move/copy transfers and their receipt recovery remain unchanged. Exported files are inherently copyable across different destinations; this feature is not an anti-cheat guarantee or a cross-catalogue move protocol.

After copying, activate the Buckler, wait for the practice echo and fight. Move north to (2,2), activate the Charm and search the hinge. The proof saves and reloads this state, verifies the new identity and duplicate-import refusal, and confirms that source quest flags were not imported.

## Authoring and verification

Source packs are `examples/mp17/brass-bell` and `examples/mp17/receiving-yard`. Compiled catalogues are alongside them. Validate/build with:

```sh
node tools/maxxia.mjs validate examples/mp17/brass-bell --engine 0.62.0
node tools/maxxia.mjs build examples/mp17/brass-bell --engine 0.62.0 --out examples/mp17/brass-bell.maxxia-build.json
node tools/maxxia.mjs build examples/mp17/receiving-yard --dependency examples/mp17/brass-bell --engine 0.62.0 --out examples/mp17/receiving.maxxia-build.json
npm run check:mp17
node --experimental-strip-types tools/run-mp17-scenarios.mjs --production
node --experimental-strip-types tools/run-mp17-portability.mjs --production
```

Generic mechanism routines now support bounded `cost` actions: gold0–10000, food/damage0–20 and minutes0–60, plus an optional unequipped active-party item offering. Costs are checked before mutation and the enclosing simulation transaction owns rollback. Map `recovery` names a destination native map and arrival; it is validated with the map registry. Ward/reveal activations reuse existing timed magic and search rules. The schema now exposes the already-supported item portability field. Catalogue composition no longer requires private, inactive foreign quest rewards to be installed.

The runtime has no branches keyed to Bell pack IDs. Existing save18 and instance envelope2 remain in use. New WinForms authoring forms, finished art, a measured first-play duration and interactive visual acceptance are not claimed here. This release provides complete content, JSON authoring, headless/production proofs and offline distribution. MP18 is next: unified effects and extensible conditions.
