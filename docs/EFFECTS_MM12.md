# Maxxia Maker — MM12 advanced effects and conditions

A composed spell (`effect: "composed"`, `behaviorKey: "composed"`) can contain 1–8 operations. All amount expressions use the bounded MM11 parser and the game simulation's seeded RNG. All operations have fixed schema and target restrictions; no user scripting.

| Operation | Fields | Valid target/context | Behavior |
|---|---|---|---|
| `cure` | `conditionId` | `selected` ally, `caster` or `party` on ally/party spells | Remove selected character condition; cursed also clears worn-item curse state |
| `revive` | none | `selected` on `dead_ally`, exploration | Fallen hero returns with 1 HP and 0 SP |
| `ward` | `wardKind`, `unit: minutes`, `remaining` | `caster` / `party` on ally/party spells | Refresh one existing party ward; maximum time depends on kind |
| `hex` | `hexKind`, `unit: turns`, `remaining` | enemy selected/group, combat | Apply existing timed enemy effect, with optional supported spell `save` |
| `reveal` | `unit: minutes`, `remaining` | `caster` on world/object, exploration | Refresh `glass_eye` ward |
| `unseal` | none | `caster` on world/object, exploration | Unlock adjacent permitted door |
| `fold` | none | `caster` on world/object, exploration | Move 1–2 squares forward when path is clear and visited |

Existing MM11 `damage`, `heal`, `resource`, and `condition` remain. Spell context/target are chosen at the top-level spell definition. Party wards allow `stone_skin`, `mirror_ward`, `blessing`, `sheltering_hand`, `steadfast`, `briar_mantle`, `light`, `glass_eye`, `borrowed_face` with duration limits. Hex kinds are `ill_omen`, `binding_thread`, `sleep_thorns`, `crooked_bones`, `bottle_echo`, `hollow_fear` with short turn limits from the original game. Recast wards/hexes replace the same active kind on the same target, not unrelated ones.

## Example composed party ward

```json
{
  "id":"spell_custom_stoneguard","name":"Stoneguard","classId":"priest","level":1,"sp":3,
  "target":"party","context":"both","effect":"composed","behaviorKey":"composed",
  "description":"Shield every hero with stone.",
  "effects":[{"operation":"ward","target":"party","wardKind":"stone_skin","unit":"minutes","remaining":12}]
}
```

Add this spell to the permitted class's `classAccess.priest.spellIds`, and optionally to `starterSpellIds`. To expose condition records, the project `database/spells.json` adds `"conditionsFile":"conditions.json"` (a filename within the same directory); leave absent in older projects to use defaults.

## Condition database format

`database/conditions.json` has `"format":"maxxia-conditions"`, `"version":1`, `"conditions": [...]`. Exactly six definitions are required: `poisoned`, `asleep`, `frightened`, `cursed`, `drunk`, `hungry`. Each record has a permanent `id`, `name` (1–80 chars), `description` (0–500 chars), and `reapply` (`replace` or `extend`). `extend` only adds finite same-unit durations and clamps at 999; different units and persistent conditions replace. These definitions do not change underlying status mechanics, serialized condition IDs or old saves.

The WinForms source exposes **Edit → Spells database** (Ctrl+L) and **Edit → Conditions database** (Ctrl+D). .NET compilation and interactive UI testing must be performed on Windows before distributing the editor as a runnable build.
