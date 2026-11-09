/** Shared bounded effect kernel. Callers stage a clone and own final commit/rollback. */
import { packCondition, effectDefinition, EffectFault, type UnifiedOperation } from '../content/effect-definitions.ts';
import { conditionModifier, conditionResistance, conditionIsImmune, mergeAuthoredCondition } from './condition-effects.ts';
import { derived, modifier, type Character, type Condition } from './party.ts';
import { monsterSaveAttribute, MONSTERS } from '../content/monsters.ts';
import { SeededRng } from './rng.ts';
import type { CampaignState } from './campaign.ts';
import type { EnemyState } from './combat.ts';
import {summonCompanion} from './combat.ts';
export interface EffectBudget {
    operations: number;
    rolls: number;
}
export type EffectOutcome = {
    targetId: string;
    operation: string;
    outcome: string;
    amount?: number;
    conditionId?: string;
};
const contexts = new WeakMap<CampaignState, SeededRng>();
export function withEffectRng<T>(s: CampaignState, rng: SeededRng, run: () => T): T { const old = contexts.get(s); contexts.set(s, rng); try {
    return run();
}
finally {
    if (old)
        contexts.set(s, old);
    else
        contexts.delete(s);
} }
type Actor = Character | EnemyState;
const conditions = (a: Actor): Condition[] => a.conditions ?? [];
function actor(s: CampaignState, id: string): Actor | undefined { return s.party.characters[id] ?? Object.values(s.combat.encounters).flatMap(e => e.enemies).find(e => e.id === id); }
function roll(s: CampaignState, b: EffectBudget, external?: ((a: number, z: number) => number)): number { if (++b.rolls > 256)
    throw new EffectFault('Effect saving-throw budget exceeded'); if (external)
    return external(1, 20); const active = contexts.get(s); if (active) {
    s.rollCount++;
    return active.integer(1, 20);
} const r = new SeededRng(1); r.restore(s.rng); const n = r.integer(1, 20); s.rollCount++; s.rng = r.snapshot(); return n; }
function saving(s: CampaignState, a: Actor, ability: 'CON' | 'DEX' | 'WIS', dc: number, b: EffectBudget, external?: ((a: number, z: number) => number)): boolean { const score = 'classId' in a ? derived(a).attributes[ability] : monsterSaveAttribute(a.kindId, ability); return roll(s, b, external) + modifier(score) + conditionModifier(conditions(a), 'save') >= dc; }
export function sharedDamage(a: Actor, raw: number, family: string): number { const base = 'classId' in a ? derived(a).resistances[family as keyof Character['baseResistances']] ?? 0 : MONSTERS[a.kindId].resistances[family] ?? 0; const r = Math.max(-50, Math.min(75, base + ('classId' in a ? 0 : conditionResistance(conditions(a), family)))); const amount = Math.max(0, Math.ceil(Math.max(0, raw) * (100 - r) / 100)); a.hp = Math.max(0, a.hp - amount); return amount; }
/** Lower-level condition adapter is also used by composed spell primitives. */
export function applyUnifiedCondition(s: CampaignState, targetId: string, id: string, duration: number | null, b: EffectBudget, external?: ((a: number, z: number) => number)): string { settleUnifiedTime(s); if (s.magic.effectClock === undefined)
    s.magic.effectClock = s.elapsedMinutes; const a = actor(s, targetId), d = packCondition(id); if (!a || a.hp <= 0)
    throw new EffectFault('Condition target is unavailable'); if (!d)
    throw new EffectFault('Unknown condition ' + id); if (d.clock === 'rounds' && !s.combat.active)
    throw new EffectFault('Round conditions require combat'); if (conditionIsImmune(conditions(a), d.tags))
    return 'immune'; if (d.stacking === 'reject' && conditions(a).some(c => c.id === id))
    return 'already-active'; if (d.save?.timing === 'apply' && saving(s, a, d.save.ability, d.save.dc, b, external))
    return 'saved'; const next: Condition = { id, unit: d.clock === 'rounds' ? 'turns' : d.clock, remaining: duration }; const result = mergeAuthoredCondition(conditions(a), next); a.conditions = result.conditions; return result.outcome; }
export function applyEffect(s: CampaignState, effectId: string, casterId: string, targetId?: string, b: EffectBudget = { operations: 0, rolls: 0 }): EffectOutcome[] {
    const e = effectDefinition(effectId), caster = s.party.characters[casterId];
    if (!e || !caster || !s.party.order.includes(casterId) || caster.hp <= 0 || s.combat.defeated)
        throw new EffectFault('Effect or conscious active caster unavailable');
    if (s.combat.active && s.combat.active.turnOrder[s.combat.active.turnIndex] !== casterId)
        throw new EffectFault('Only the current hero can use an effect');
    if (e.context === 'combat' && !s.combat.active || e.context === 'exploration' && s.combat.active)
        throw new EffectFault('Effect context is unavailable');
    const enemies = s.combat.active ? s.combat.encounters[s.combat.active.encounterId].enemies.filter(v => v.hp > 0) : [];
    const ids = e.target === 'self' ? [casterId] : e.target === 'party' ? s.party.order.filter(id => s.party.characters[id].hp > 0) : e.target === 'enemies' ? enemies.map(v => v.id) : e.target === 'enemy' && enemies.some(v => v.id === targetId) ? [targetId!] : e.target === 'hero' && targetId && s.party.order.includes(targetId) && s.party.characters[targetId].hp > 0 ? [targetId] : [];
    if (!ids.length)
        throw new EffectFault('No valid effect target');
    const outcomes: EffectOutcome[] = [];
    for (const op of e.operations)
        for (const id of ids) {
            if (++b.operations > 128)
                throw new EffectFault('Effect operation budget exceeded');
            const a = actor(s, id)!;
            if (a.hp <= 0) {
                outcomes.push({ targetId: id, operation: op.op, outcome: 'fallen' });
                continue;
            }
            if (op.op === 'condition')
                outcomes.push({ targetId: id, operation: op.op, conditionId: op.conditionId, outcome: applyUnifiedCondition(s, id, op.conditionId, op.duration, b) });
            else if (op.op === 'damage') {
                const save = op.save && saving(s, a, op.save.ability, op.save.dc, b);
                const raw = save ? (op.save!.half ? Math.floor(op.amount / 2) : 0) : op.amount;
                outcomes.push({ targetId: id, operation: op.op, outcome: save ? 'saved' : 'hit', amount: sharedDamage(a, raw, op.damageType) });
            }
            else if(op.op==='summon-companion'){
                if(id!==casterId)throw new EffectFault('Summoning companion requires self target');
                const companion=summonCompanion(s,casterId,op.kindId,op.lifetimeRounds);
                outcomes.push({targetId:id,operation:op.op,outcome:'summoned',conditionId:companion.kindId});
            }
            else if (op.op === 'heal') {
                const max = 'classId' in a ? derived(a).maxHP : MONSTERS[a.kindId].hp, before = a.hp;
                a.hp = Math.min(max, a.hp + op.amount);
                outcomes.push({ targetId: id, operation: op.op, outcome: 'healed', amount: a.hp - before });
            }
            else {
                let removed = 0;
                a.conditions = conditions(a).filter(c => { const match = packCondition(c.id)?.dispelTags.some(t => op.tags.includes(t)); if (match && removed < op.max) {
                    removed++;
                    return false;
                } return true; });
                outcomes.push({ targetId: id, operation: op.op, outcome: removed ? 'dispelled' : 'no-match', amount: removed });
            }
        }
    return outcomes;
}
/** Minute conditions use elapsed game minutes; round conditions use global round-end.
 * Per-tick saves precede damage, then duration decrements. No menu tick exists. */
export function tickUnifiedConditions(s: CampaignState, amount: number, clock: 'minutes' | 'rounds', b: EffectBudget = { operations: 0, rolls: 0 }): void { if (!Number.isSafeInteger(amount) || amount < 0)
    throw new EffectFault('Invalid effect clock'); const actors: Actor[] = [...s.party.order.map(id => s.party.characters[id]), ...(clock === 'rounds' ? (s.combat.active ? s.combat.encounters[s.combat.active.encounterId].enemies : []) : Object.values(s.combat.encounters).flatMap(e => e.enemies))]; for (const a of actors) {
    if (a.conditions === undefined)
        continue;
    const keep: Condition[] = [];
    for (const original of conditions(a)) {
        const d = packCondition(original.id);
        if (!d || d.clock !== clock) {
            keep.push(original);
            continue;
        }
        let c = { ...original }, ended = false;
        for (let n = 0; n < Math.min(amount, original.remaining ?? 0); n++) {
            if (++b.operations > 1024)
                throw new EffectFault('Condition tick budget exceeded');
            if (d.save?.timing === (clock === 'minutes' ? 'minute' : 'round-end') && a.hp > 0 && saving(s, a, d.save.ability, d.save.dc, b)) {
                ended = true;
                break;
            }
            if (d.periodic && a.hp > 0)
                sharedDamage(a, d.periodic.amount * (c.stacks ?? 1), d.periodic.damageType);
            c.remaining!--;
            if (c.remaining === 0) {
                ended = true;
                break;
            }
        }
        if (!ended)
            keep.push(c);
    }
    a.conditions = keep;
} }
export function pruneUnifiedConditions(s: CampaignState): void { for (const a of [...Object.values(s.party.characters), ...Object.values(s.combat.encounters).flatMap(e => e.enemies)])
    if (a.conditions)
        a.conditions = a.conditions.filter(c => !packCondition(c.id) || a.hp > 0 && (packCondition(c.id)!.clock !== 'rounds' || !!s.combat.active)); }
export function settleUnifiedTime(s: CampaignState): void { if (s.magic.effectClock === undefined)
    return; const ticks = s.elapsedMinutes - s.magic.effectClock; if (ticks < 0)
    throw new EffectFault('Effect clock exceeds campaign clock'); if (ticks)
    tickUnifiedConditions(s, ticks, 'minutes'); s.magic.effectClock = s.elapsedMinutes; }
