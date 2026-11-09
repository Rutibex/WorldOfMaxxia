/** Pure authored-condition policies shared by hero, enemy, spell and item rules. */
import { packCondition, EffectFault } from '../content/effect-definitions.ts';
import type { Condition } from './party.ts';
export function validateAuthoredCondition(c: Condition): boolean {
    const d = packCondition(c.id);
    if (!d)
        return false;
    if (c.unit !== (d.clock === 'rounds' ? 'turns' : d.clock) || d.clock === 'persistent' && c.remaining !== null || d.clock !== 'persistent' && (!Number.isSafeInteger(c.remaining) || c.remaining! < 1 || c.remaining! > d.maxDuration) || !Number.isSafeInteger(c.stacks ?? 1) || (c.stacks ?? 1) < 1 || (c.stacks ?? 1) > d.maxStacks)
        throw new EffectFault('Invalid saved condition ' + c.id);
    return true;
}
export function conditionModifier(conditions: readonly Condition[], field: 'attack' | 'defense' | 'save'): number { return Math.max(-10, Math.min(10, conditions.reduce((n, c) => n + (packCondition(c.id)?.modifiers[field] ?? 0) * (c.stacks ?? 1), 0))); }
export function conditionResistance(conditions: readonly Condition[], family: string): number { return Math.max(-50, Math.min(50, conditions.reduce((n, c) => n + (packCondition(c.id)?.modifiers.resistance[family] ?? 0) * (c.stacks ?? 1), 0))); }
export function conditionIsImmune(conditions: readonly Condition[], tags: readonly string[]): boolean { return conditions.some(c => packCondition(c.id)?.immuneTags.some(t => tags.includes(t))); }
export function mergeAuthoredCondition(existing: readonly Condition[], next: Condition): {
    conditions: Condition[];
    outcome: string;
} { const def = packCondition(next.id); if (!def)
    throw new EffectFault('Unknown authored condition ' + next.id); validateAuthoredCondition(next); if (conditionIsImmune(existing, def.tags))
    return { conditions: [...existing], outcome: 'immune' }; const old = existing.find(c => c.id === next.id); if (old && def.stacking === 'reject')
    return { conditions: [...existing], outcome: 'already-active' }; let result = { ...next, stacks: 1 }; if (old) {
    if (def.stacking === 'extend' && old.remaining !== null && next.remaining !== null)
        result.remaining = Math.min(def.maxDuration, old.remaining + next.remaining);
    if (def.stacking === 'stack')
        result.stacks = Math.min(def.maxStacks, (old.stacks ?? 1) + 1);
} if (!old && existing.length >= 16)
    throw new EffectFault('Target condition capacity exceeded'); return { conditions: [...existing.filter(c => c.id !== next.id), result], outcome: old ? 'reapplied' : 'applied' }; }
