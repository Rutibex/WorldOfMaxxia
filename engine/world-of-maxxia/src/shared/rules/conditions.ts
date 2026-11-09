/** Shared, side-effect-free MP12/MP14 typed queries and comparisons. */
import { readScopedValue, type ScopedState, type ScopeAddress } from './scoped-state.ts';
import type { CampaignState, MapRegistry } from './campaign.ts';
export type Condition = boolean | Record<string, unknown>;
export class ConditionFault extends Error {
    readonly code = 'E_CONDITION';
}
function bad(path: string, message: string): never { throw new ConditionFault(`${path}: ${message}`); }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const scalar = (v: unknown): boolean => typeof v === 'string' ? v.length <= 2048 : typeof v === 'boolean' || typeof v === 'number' && Number.isSafeInteger(v) && Math.abs(v) <= 100000000;
export function validateExpression(v: unknown, path = '$'): void {
    if (scalar(v))
        return;
    if (!object(v))
        bad(path, 'expected typed expression');
    if (Object.keys(v).length === 1 && ((typeof v.param === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(v.param)) || (typeof v.variable === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(v.variable)) || ['gold', 'attitude'].includes(String(v.query))))
        return;
    if(v.query==='puzzle-solved'&&Object.keys(v).sort().join(',')==='puzzleId,query'&&typeof v.puzzleId==='string'&&/^[a-z][a-z0-9_]{0,31}$/.test(v.puzzleId))return;
    if(v.query==='has-condition'&&typeof v.conditionId==='string'&&(v.targetId===undefined||typeof v.targetId==='string'))return;
    if(['quest-state','objective','quest-claimed'].includes(String(v.query))&&typeof v.questId==='string'&&/^[a-z][a-z0-9_]{0,47}:quest:[a-z][a-z0-9_]{0,31}$/.test(v.questId)&&(v.query==='quest-state'||v.query==='objective'&&typeof v.objectiveId==='string'&&/^[a-z][a-z0-9_]{0,23}$/.test(v.objectiveId)||v.query==='quest-claimed'&&typeof v.rewardId==='string'&&/^[a-z][a-z0-9_]{0,23}$/.test(v.rewardId)))return;
    if (v.query === 'state' && ['flag', 'counter', 'collection'].includes(String(v.kind)) && typeof v.key === 'string' && object(v.address) && ['campaign', 'local'].includes(String(v.address.scope)))
        return;
    if (v.query === 'fact' && typeof v.fact === 'string' && /^[a-z][a-z0-9_]{0,23}$/.test(v.fact))
        return;
    if (v.query === 'has-item' && typeof v.item === 'string')
        return;
    bad(path, 'unsupported expression');
}
export function validateCondition(v: unknown, path = '$'): void {
    let nodes = 0;
    const visit = (v: unknown, path: string, depth: number): void => {
        if (++nodes > 128 || depth > 16)
            bad(path, 'condition complexity limit');
        if (typeof v === 'boolean')
            return;
        if (!object(v))
            bad(path, 'expected condition');
        if (v.not !== undefined) {
            visit(v.not, path + '.not', depth + 1);
            return;
        }
        for (const k of ['all', 'any'])
            if (Array.isArray(v[k])) {
                for (const [i, c] of (v[k] as unknown[]).entries())
                    visit(c, `${path}.${k}[${i}]`, depth + 1);
                return;
            }
        if (!['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'contains'].includes(String(v.op)))
            bad(path, 'unknown comparison');
        validateExpression(v.left, path + '.left');
        validateExpression(v.right, path + '.right');
        const type = (x: unknown): string => { if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean')
            return typeof x; const q = x as Record<string, unknown>; if(q.query==='puzzle-solved'||q.query==='has-condition')return 'boolean';if(q.query==='quest-state')return 'string';if(q.query==='objective'||q.query==='quest-claimed')return 'boolean';if (q.query === 'state')
            return q.kind === 'flag' ? 'boolean' : q.kind === 'counter' ? 'number' : 'collection'; if (q.query === 'gold' || q.query === 'attitude')
            return 'number'; if (q.query === 'fact' || q.query === 'has-item')
            return 'boolean'; return 'unknown'; };
        const a = type(v.left), b = type(v.right);
        if (v.op === 'contains') {
            if (a !== 'unknown' && a !== 'collection' || b !== 'unknown' && b !== 'string')
                bad(path, 'contains requires collection and string');
        }
        else if (v.op === 'eq' || v.op === 'ne') {
            if (a !== 'unknown' && b !== 'unknown' && (a !== b || a === 'collection'))
                bad(path, 'comparison types differ');
        }
        else if (a !== 'unknown' && a !== 'number' || b !== 'unknown' && b !== 'number')
            bad(path, 'ordered comparisons require numbers');
    };
    visit(v, path, 0);
}
export interface QueryContext {
    state: CampaignState;
    scoped: ScopedState;
    registry: MapRegistry;
    questReader?:(query:Record<string,unknown>)=>unknown;
    params?: Record<string, unknown>;
    variables?: Record<string, unknown>;
    tick?: () => void;
    relationship?: {
        attitude: number;
        facts: string[];
    };
}
export function evaluateExpression(v: unknown, c: QueryContext): unknown {
    c.tick?.();
    if (scalar(v))
        return v;
    if (!object(v))
        bad('$', 'invalid expression');
    if (typeof v.param === 'string') {
        if (!Object.hasOwn(c.params ?? {}, v.param))
            bad('$', 'unknown parameter ' + v.param);
        return c.params![v.param];
    }
    if (typeof v.variable === 'string') {
        if (!Object.hasOwn(c.variables ?? {}, v.variable))
            bad('$', 'unbound variable ' + v.variable);
        return c.variables![v.variable];
    }
    if(v.query==='puzzle-solved'){const map=c.registry[c.state.currentMapId];if(!map.perception?.puzzles.some(p=>p.id===v.puzzleId))bad('$','Unknown local puzzle');return c.state.maps[map.id].perception?.puzzles[String(v.puzzleId)]?.solved===true;}
    if(v.query==='has-condition'){const id=String(v.targetId??c.state.party.selectedId),hero=c.state.party.characters[id],enemy=c.state.combat.active?c.state.combat.encounters[c.state.combat.active.encounterId].enemies.find(e=>e.id===id):undefined;return (hero?.conditions??enemy?.conditions??[]).some(e=>e.id===v.conditionId);}
    if(['quest-state','objective','quest-claimed'].includes(String(v.query))){if(!c.questReader)bad('$','Quest query context is unavailable');return c.questReader(v);}
    if (v.query === 'gold')
        return c.state.party.resources.gold;
    if (v.query === 'attitude' || v.query === 'fact') {
        if (!c.relationship)
            bad('$', 'NPC relationship context is unavailable');
        return v.query === 'attitude' ? c.relationship.attitude : c.relationship.facts.includes(String(v.fact));
    }
    if (v.query === 'state')
        return readScopedValue(c.scoped, v.address as ScopeAddress, v.kind as 'flag' | 'counter' | 'collection', String(v.key), c.registry);
    if (v.query === 'has-item')
        return c.state.inventory.items.some(i => i.definitionId === v.item && i.count > 0);
    return bad('$', 'unknown query');
}
export function evaluateCondition(v: unknown, c: QueryContext): boolean {
    c.tick?.();
    if (typeof v === 'boolean')
        return v;
    const q = v as Record<string, unknown>;
    if (q.not !== undefined)
        return !evaluateCondition(q.not, c);
    if (Array.isArray(q.all))
        return q.all.every(v => evaluateCondition(v, c));
    if (Array.isArray(q.any))
        return q.any.some(v => evaluateCondition(v, c));
    const a = evaluateExpression(q.left, c), b = evaluateExpression(q.right, c);
    if (q.op === 'contains') {
        if (!Array.isArray(a) || typeof b !== 'string')
            bad('$', 'contains requires collection and string');
        return a.includes(b);
    }
    if (typeof a !== typeof b || !scalar(a) || !scalar(b))
        bad('$', 'comparison types differ');
    if (q.op === 'eq')
        return a === b;
    if (q.op === 'ne')
        return a !== b;
    if (typeof a !== 'number' || typeof b !== 'number')
        bad('$', 'ordered comparisons require numbers');
    if (q.op === 'lt')
        return a < b;
    if (q.op === 'lte')
        return a <= b;
    if (q.op === 'gt')
        return a > b;
    if (q.op === 'gte')
        return a >= b;
    return bad('$', 'unknown comparison');
}
