import {effectDefinition} from '../content/effect-definitions.ts';
import {applyEffect} from './effects.ts';
import {settleExpeditionTime} from './expedition.ts';
import {actQuest,type QuestBudget,type QuestCommand} from './quest-engine.ts';
import {questReader} from './quest-state.ts';
import type {QuestDocument} from '../content/quest-definitions.ts';
import {evaluateExpression,evaluateCondition,validateExpression,validateCondition} from './conditions.ts';
/** MP12: JSON-only bounded routines. All writes belong to the enclosing simulation transaction. */
import { applyScopedAction, readScopedValue, validateScopedState, type ScopedState, type ScopeAddress } from './scoped-state.ts';
import { validateCampaign, type CampaignState, type MapRegistry } from './campaign.ts';
import { giveItem } from './inventory.ts';
import type { SimulationCommand, SimulationResult, SimulationEvent } from './simulation.ts';
type Scalar = string | number | boolean;
export type RoutineDocument = {
    version: 1;
    routines: RoutineDefinition[];
};
export type RoutineDefinition = {
    id: string;
    parameters: Record<string, 'string' | 'number' | 'boolean'>;
    actions: Record<string, unknown>[];
};
export class RoutineFault extends Error {
    readonly code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
}
function bad(path: string, message: string): never { throw new RoutineFault('E_ROUTINE', `${path}: ${message}`); }
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const name = /^[a-z][a-z0-9_]{0,63}$/;
const id = /^[a-z][a-z0-9_]{0,47}:routine:[a-z][a-z0-9_]{0,63}$/;
const scalar = (v: unknown): v is Scalar => typeof v === 'string' ? v.length <= 2048 : typeof v === 'boolean' || typeof v === 'number' && Number.isSafeInteger(v) && Math.abs(v) <= 100000000;
/** Structural and reference validation is also used by the CLI. Runtime validates operand types. */
export function validateRoutineDocument(raw: unknown, file = 'routines.json'): RoutineDocument {
    if (!obj(raw) || raw.version !== 1 || !Array.isArray(raw.routines) || raw.routines.length > 128)
        bad(file, 'expected version 1 and at most 128 routines');
    const doc = raw as RoutineDocument, ids = new Set<string>();
    let nodes = 0;
    const walk = (v: unknown, p: string, d = 0): void => { if (++nodes > 4096 || d > 24)
        bad(p, 'document complexity limit'); if (v === null || scalar(v))
        return; if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++)
            walk(v[i], `${p}[${i}]`, d + 1);
        return;
    } if (!obj(v))
        bad(p, 'JSON values only'); for (const [k, x] of Object.entries(v)) {
        if (['__proto__', 'prototype', 'constructor'].includes(k))
            bad(p, 'reserved property');
        walk(x, p + '.' + k, d + 1);
    } };
    walk(raw, file);
    for (const [i, r] of doc.routines.entries()) {
        const p = `${file}.routines[${i}]`;
        if (!obj(r) || !id.test(r.id) || ids.has(r.id) || !obj(r.parameters) || Object.keys(r.parameters).length > 16 || Object.entries(r.parameters).some(([k, t]) => !name.test(k) || !['string', 'number', 'boolean'].includes(t)) || !Array.isArray(r.actions))
            bad(p, 'invalid/duplicate routine ID, parameters or actions');
        ids.add(r.id);
    }
    const expr=validateExpression,cond=validateCondition;
    const actions = (a: unknown, p: string): void => { if (!Array.isArray(a) || a.length > 128)
        bad(p, 'expected bounded action array'); for (const [i, x] of a.entries()) {
        const q = `${p}[${i}]`;
        if (!obj(x))
            bad(q, 'expected action');
        switch (x.op) {
            case 'repeat':
                expr(x.count, q + '.count');
                actions(x.actions, q + '.actions');
                break;
            case 'if':
                cond(x.condition, q + '.condition');
                actions(x.then, q + '.then');
                if (x.else !== undefined)
                    actions(x.else, q + '.else');
                break;
            case 'call':
                if (!ids.has(String(x.routine)) || !obj(x.args))
                    bad(q, 'unknown routine or missing args');
                for (const [k, v] of Object.entries(x.args as object))
                    expr(v, q + '.args.' + k);
                break;
            case 'set':
                if (!name.test(String(x.variable)))
                    bad(q, 'invalid variable');
                expr(x.value, q + '.value');
                break;
            case 'message':
                expr(x.text, q + '.text');
                break;
            case 'quest':
                if(typeof x.questId!=='string'||!/^[a-z][a-z0-9_]{0,47}:quest:[a-z][a-z0-9_]{0,31}$/.test(x.questId)||!['transition','claim'].includes(String(x.action))||x.action==='transition'&&(typeof x.transitionId!=='string'||!/^[a-z][a-z0-9_]{0,23}$/.test(x.transitionId))||x.action==='claim'&&(typeof x.rewardId!=='string'||!/^[a-z][a-z0-9_]{0,23}$/.test(x.rewardId)))bad(q,'invalid quest operation');
                break;
            case 'state':
                if (!['flag', 'counter', 'collection-add', 'collection-remove'].includes(String(x.kind)) || !obj(x.address) || typeof x.key !== 'string')
                    bad(q, 'invalid scoped action');
                expr(x.value, q + '.value');
                break;
            case 'check':
                if (!name.test(String(x.variable)))
                    bad(q, 'invalid check variable');
                expr(x.target, q + '.target');
                break;
            case 'effect':
                if(typeof x.effectId!=='string'||!/^[a-z][a-z0-9_]{0,31}:ability:[a-z][a-z0-9_]{0,31}$/.test(x.effectId)||x.targetId!==undefined&&typeof x.targetId!=='string')bad(q,'Invalid effect operation');
                break;
            case 'cost':
                for(const field of ['gold','food','minutes','damage'])if(x[field]!==undefined&&(!Number.isSafeInteger(x[field])||(x[field] as number)<0||(x[field] as number)>(field==='gold'?10000:field==='minutes'?60:20)))bad(q,'Invalid bounded mechanism cost');
                if(x.item!==undefined&&(typeof x.item!=='string'||!Number.isSafeInteger(x.count)||(x.count as number)<1||(x.count as number)>20))bad(q,'Invalid item offering');
                break;
            case 'give-item':
                expr(x.owner, q + '.owner');
                expr(x.item, q + '.item');
                expr(x.count, q + '.count');
                break;
            case 'command':
                if(obj(x.command)&&x.command.type==='terrain'&&(Object.keys(x.command).some(k=>!['type','configurationId'].includes(k))||typeof x.command.configurationId!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(x.command.configurationId)))bad(q,'Invalid terrain configuration command');
                if (!obj(x.command) || (x.command.type === 'routine' || x.command.type === 'object' || x.command.type === 'social' || x.command.type === 'quest'))
                    bad(q, 'expected non-routine simulation command');
                break;
            default: bad(q, 'unknown operation');
        }
    } };
    doc.routines.forEach((r, i) => actions(r.actions, `${file}.routines[${i}].actions`));
    return structuredClone(doc);
}
export interface RoutineBudget {
    steps: number;
    calls: number;
    commands: number;
}
export function executeRoutine(source: CampaignState, scope: ScopedState, registry: MapRegistry, document: RoutineDocument, routineId: string, args: Record<string, unknown>, dispatch: (s: CampaignState, c: unknown) => SimulationResult, budget: RoutineBudget, quests?:{document:QuestDocument;budget:QuestBudget}): {
    state: CampaignState;
    scoped: ScopedState;
    events: SimulationEvent[];
    messages: string[];
} {
    const doc = validateRoutineDocument(document);
    let state = structuredClone(source), scoped = structuredClone(validateScopedState(scope, registry));
    const events: SimulationEvent[] = [], messages: string[] = [];
    const tick = () => { if (++budget.steps > 256)
        throw new RoutineFault('E_ROUTINE_LIMIT', 'Routine step budget exceeded'); };
    const command = (c: unknown): SimulationResult => { if (++budget.commands > 16)
        throw new RoutineFault('E_COMMAND_LIMIT', 'Routine command budget exceeded'); const r = dispatch(state, c); if (r.status !== 'applied')
        throw new RoutineFault('E_ATOMIC', r.messages.join(' ')); state = r.state; events.push(...r.events); messages.push(...r.messages); return r; };
    const call = (rid: string, params: Record<string, unknown>, depth: number): void => {
        tick();
        if (depth > 8 || ++budget.calls > 32)
            throw new RoutineFault('E_ROUTINE_LIMIT', 'Routine call/depth limit exceeded');
        const r = doc.routines.find(r => r.id === rid);
        if (!r)
            bad(rid, 'unknown routine');
        if (Object.keys(params).length !== Object.keys(r.parameters).length || Object.entries(r.parameters).some(([k, t]) => !Object.hasOwn(params, k) || typeof params[k] !== t || !scalar(params[k])))
            bad(rid + '.args', 'parameter names or types do not match');
        const vars: Record<string, unknown> = Object.create(null);
        const context=()=>({state,scoped,registry,params,variables:vars,tick,questReader:quests?questReader(quests.document,scoped,registry):undefined});
        const expr=(v:unknown):unknown=>evaluateExpression(v,context());
        const condition=(v:unknown):boolean=>evaluateCondition(v,context());
        const run = (actions: Record<string, unknown>[]): void => { for (const a of actions) {
            tick();
            switch (a.op) {
                case 'repeat': {
                    const count = expr(a.count);
                    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 || count > 16)
                        bad(rid, 'repeat count must be 0–16');
                    for (let i = 0; i < count; i++)
                        run(a.actions as Record<string, unknown>[]);
                    break;
                }
                case 'if':
                    run((condition(a.condition) ? a.then : a.else ?? []) as Record<string, unknown>[]);
                    break;
                case 'call':
                    call(String(a.routine), Object.fromEntries(Object.entries(a.args as object).map(([k, v]) => [k, expr(v)])), depth + 1);
                    break;
                case 'set':
                    if (Object.keys(vars).length >= 32 && !Object.hasOwn(vars, String(a.variable)))
                        bad(rid, 'local variable limit');
                    vars[String(a.variable)] = expr(a.value);
                    break;
                case 'message': {
                    const text = expr(a.text);
                    if (typeof text !== 'string')
                        bad(rid, 'message requires text');
                    messages.push(text);
                    events.push({ type: 'message', text });
                    break;
                }
                case 'quest': {
                    if(!quests)bad(rid,'Quest definitions are not installed');if(++budget.commands>16)throw new RoutineFault('E_COMMAND_LIMIT','Routine/quest command limit exceeded');const {op,...request}=a;const result=actQuest(state,scoped,registry,quests.document,{type:'quest',...request} as Exclude<QuestCommand,{action:'journal'}>,quests.budget);if(result.blocked)throw new RoutineFault('E_ATOMIC',result.message);state=result.state;scoped=result.scoped;events.push(...result.events);messages.push(result.message);break;
                }
                case 'state': {
                    const value = expr(a.value);
                    scoped = applyScopedAction(scoped, { kind: a.kind, address: a.address, key: a.key, ...(a.kind === 'counter' ? { delta: value } : { value }) } as Parameters<typeof applyScopedAction>[1], registry);
                    break;
                }
                case 'check': {
                    const target = expr(a.target);
                    if (typeof target !== 'number' || !Number.isSafeInteger(target))
                        bad(rid, 'check target must be integer');
                    const result = command({ type: 'roll', min: 1, max: 20 });
                    const roll = result.events.find(e => e.type === 'roll.result');
                    vars[String(a.variable)] = roll?.type === 'roll.result' && roll.value >= target;
                    break;
                }
                case 'effect': {if(state.combat.active)bad(rid,'Object/routine effects are exploration-only');if(effectDefinition(String(a.effectId))?.activation)bad(rid,'Character abilities cannot be called by mechanisms');const outcomes=applyEffect(state,String(a.effectId),state.party.selectedId,a.targetId===undefined?state.party.selectedId:String(a.targetId));for(const outcome of outcomes)messages.push(`${outcome.targetId}: ${outcome.operation} ${outcome.outcome}`);break;}
                case 'cost': {
                    const gold=Number(a.gold??0),food=Number(a.food??0),minutes=Number(a.minutes??0),amount=Number(a.damage??0);
                    if(state.combat.active||state.combat.defeated)bad(rid,'Mechanism costs require safe exploration');
                    if(state.party.resources.gold<gold||state.party.resources.food<food)bad(rid,'Insufficient gold or food for mechanism');
                    if(a.item){let needed=Number(a.count);const stacks=state.inventory.items.filter(i=>i.definitionId===a.item&&!i.equipped&&state.party.order.includes(i.ownerId));if(stacks.reduce((n,i)=>n+i.count,0)<needed)bad(rid,'Required offering is missing');for(const i of stacks){const n=Math.min(needed,i.count);i.count-=n;needed-=n;}state.inventory.items=state.inventory.items.filter(i=>i.count>0);}
                    state.party.resources.gold-=gold;state.party.resources.food-=food;state.elapsedMinutes+=minutes;state.maps[state.currentMapId].minutes+=minutes;
                    for(const id of state.party.order)state.party.characters[id].hp=Math.max(0,state.party.characters[id].hp-amount);settleExpeditionTime(state);if(state.party.order.every(id=>state.party.characters[id].hp===0))state.combat.defeated=true;state=validateCampaign(state,registry);break;
                }
                case 'give-item': {
                    const owner = expr(a.owner), item = expr(a.item), count = expr(a.count);
                    if (typeof owner !== 'string' || !Object.hasOwn(state.party.characters, owner) || typeof item !== 'string' || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1 || count > 20)
                        bad(rid, 'invalid reward arguments');
                    if (!giveItem(state.inventory, owner, item, count))
                        bad(rid, 'inventory cannot accept reward');
                    state = validateCampaign(state, registry);
                    break;
                }
                case 'command': {
                    const resolve = (v: unknown): unknown => { tick(); if (Array.isArray(v))
                        return v.map(resolve); if (obj(v)) {
                        if (v.param !== undefined || v.variable !== undefined || v.query !== undefined)
                            return expr(v);
                        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
                    } return v; };
                    command(resolve(a.command));
                    break;
                }
                default: bad(rid, 'unknown action');
            }
        } };
        run(r.actions);
    };
    call(routineId, args, 1);
    return { state: validateCampaign(state, registry), scoped: validateScopedState(scoped, registry), events, messages };
}
