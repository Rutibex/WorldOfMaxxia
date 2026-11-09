# Composable spell effects (MM11)

After building the Windows editor source with .NET 10, open **Edit → Spells database** (Ctrl+L) and click **New Effects**. In the **Effect primitives** tab, add/reorder operations and edit their parameters. Use **Preview** to evaluate a sample amount with the actual TypeScript evaluator (Node.js and complete source checkout required); it shows fixed sample stats rather than your game character. Accept with **Apply** and persist via **Save**. Existing 36 spells remain attached to legacy behavior handlers; duplication keeps those handlers intact.

## JSON format (optional additional spell, `maxxia-spells` v1)

```json
{
  "id": "spell_custom_mend_and_guard", "name": "Mend and Guard", "classId": "priest", "level": 1, "sp": 3,
  "target": "ally", "context": "both", "effect": "composed", "behaviorKey": "composed",
  "description": "Restore an ally and steady their courage.",
  "effects": [
    {"operation": "heal", "target": "selected", "amount": "2d6 + WIS_MOD"},
    {"operation": "condition", "target": "selected", "conditionId": "frightened", "unit": "turns", "remaining": 2}
  ]
}
```

Add the spell ID to the relevant `classAccess.<class>.spellIds` list and optionally to `starterSpellIds` (max 12). The condition example applies the existing `frightened` condition, not a new positive ward; to **remove fear**, use an existing legacy cure/Steadfast behavior until MM12. Existing conditions: poisoned, asleep, frightened, cursed, drunk, hungry.

## Primitives

| operation | recipient | fields | behavior |
| --- | --- | --- | --- |
| `damage` | selected enemy / enemies (requires matching spell target) | `amount`, optional `damageType` | Subtract HP, break binding when hit |
| `heal` | selected living ally / caster / party | `amount` | Restore HP to derived maximum |
| `resource` | selected living ally / caster / party | `amount`, `resource` (`hp` or `sp`) | Signed addition, clamped to current maximum/zero |
| `condition` | selected living ally / caster / party | `conditionId`, `unit`, `remaining` | Replace an existing same-ID condition; persistent uses `remaining: null` |

Expression grammar: integers 0–1000, `1d6` or `2d8` (1–12 dice, d2/d4/d6/d8/d10/d12/d20), parentheses, `+`, `-`, `*`, and whitelisted caster variables `LEVEL`, `PROFICIENCY`, `STR_MOD`, `DEX_MOD`, `CON_MOD`, `INT_MOD`, `WIS_MOD`, `CHA_MOD`. Limits: 120 source characters, 64 tokens, 12 nesting levels, 10,000 estimated magnitude, 48 dice rolls across all operations in one cast. The runtime evaluates only once per target and consumes the campaign RNG, never `eval()` or `Math.random()`.

One spell has at most 8 primitives. Conditions require explicit duration `ticks`/`turns`/`minutes` (1–999), or `persistent` with null duration. Damage is currently enemy-only and conditions currently ally-only. Existing combat attacks, art and save format 18 remain unchanged. More complex effects are MM12.
