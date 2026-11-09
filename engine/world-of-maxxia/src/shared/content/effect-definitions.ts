/** MP18 immutable data-only effect contracts. */
export interface PackCondition {
    id: string;
    name: string;
    description: string;
    clock: 'minutes' | 'rounds' | 'persistent';
    maxDuration: number;
    stacking: 'refresh' | 'extend' | 'stack' | 'reject';
    maxStacks: number;
    tags: string[];
    immuneTags: string[];
    dispelTags: string[];
    modifiers: {
        attack: number;
        defense: number;
        save: number;
        resistance: Partial<Record<string, number>>;
    };
    periodic?: {
        amount: number;
        damageType: string;
    };
    save?: {
        ability: 'CON' | 'DEX' | 'WIS';
        dc: number;
        timing: 'apply' | 'minute' | 'round-end';
    };
}
export type UnifiedOperation = {
    op: 'condition';
    conditionId: string;
    duration: number | null;
} | {
    op: 'damage';
    amount: number;
    damageType: string;
    save?: {
        ability: 'CON' | 'DEX' | 'WIS';
        dc: number;
        half: boolean;
    };
} | {
    op: 'heal';
    amount: number;
} | {
    op: 'summon-companion';
    kindId: string;
    lifetimeRounds: number;
} | {
    op: 'dispel';
    tags: string[];
    max: number;
};
/** MP19 author-owned resource, grant and activation; legacy MP18 records omit activation. */
export interface AbilityActivation {
    mode: 'active' | 'passive' | 'triggered';
    classes: string[];
    minLevel: number;
    resource?: { id: string; base: number; perLevel: number; maximum: number; recovery: 'rest' };
    cost?: { id: string; amount: number };
    cooldown?: { clock: 'minutes' | 'rounds'; amount: number };
    passive?: { attack: number; defense: number };
    trigger?: 'block';
}
import type {ExplorationProfile} from './exploration-contract.ts';
import {validateExplorationProfile} from './exploration-contract.ts';
export interface EffectDefinition {
    id: string;
    name: string;
    description: string;
    context: 'both' | 'combat' | 'exploration';
    target: 'self' | 'hero' | 'party' | 'enemy' | 'enemies';
    operations: UnifiedOperation[];
    activation?: AbilityActivation;
    exploration?: ExplorationProfile;
}
export interface EffectDocument {
    version: 1;
    conditions: PackCondition[];
    effects: EffectDefinition[];
}
export class EffectFault extends Error {
    readonly code = 'E_EFFECT';
}
const bad = (s: string): never => { throw new EffectFault(s); };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const int = (v: unknown, a: number, b: number) => Number.isSafeInteger(v) && (v as number) >= a && (v as number) <= b;
const text = (v: unknown, n: number) => typeof v === 'string' && v.length > 0 && v.length <= n;
function fields(v: unknown, keys: string[], required = keys) { if (!obj(v) || Object.keys(v).some(k => !keys.includes(k)) || required.some(k => !Object.hasOwn(v, k)))
    bad('Missing or unknown effect contract field'); }
export const EFFECT_DAMAGE_TYPES = ['physical', 'fire', 'cold', 'lightning', 'poison', 'arcane', 'holy', 'necrotic'];
const tags = (v: unknown) => Array.isArray(v) && v.length <= 8 && new Set(v).size === v.length && v.every(x => typeof x === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(x));
function checkSave(v: unknown, damage = false) { fields(v, ['ability', 'dc', damage ? 'half' : 'timing']); const s = v as Record<string, unknown>; if (!['CON', 'DEX', 'WIS'].includes(String(s.ability)) || !int(s.dc, 1, 30) || (damage ? typeof s.half !== 'boolean' : !['apply', 'minute', 'round-end'].includes(String(s.timing))))
    bad('Invalid saving throw'); }
export function validatePackCondition(raw: unknown): PackCondition {
    fields(raw, ['id', 'name', 'description', 'clock', 'maxDuration', 'stacking', 'maxStacks', 'tags', 'immuneTags', 'dispelTags', 'modifiers', 'periodic', 'save'], ['id', 'name', 'description', 'clock', 'maxDuration', 'stacking', 'maxStacks', 'tags', 'immuneTags', 'dispelTags', 'modifiers']);
    const c = raw as PackCondition;
    if (!/^[a-z][a-z0-9_]{0,31}:condition:[a-z][a-z0-9_]{0,31}$/.test(c.id) || !text(c.name, 80) || !text(c.description, 500) || !['minutes', 'rounds', 'persistent'].includes(c.clock) || !int(c.maxDuration, 1, 60) || !['refresh', 'extend', 'stack', 'reject'].includes(c.stacking) || !int(c.maxStacks, 1, 3) || c.stacking !== 'stack' && c.maxStacks !== 1 || ![c.tags, c.immuneTags, c.dispelTags].every(tags))
        bad('Invalid authored condition');
    fields(c.modifiers, ['attack', 'defense', 'save', 'resistance']);
    if (!int(c.modifiers.attack, -5, 5) || !int(c.modifiers.defense, -5, 5) || !int(c.modifiers.save, -5, 5) || !obj(c.modifiers.resistance) || Object.entries(c.modifiers.resistance).some(([k, v]) => !EFFECT_DAMAGE_TYPES.includes(k) || !int(v, -50, 50)))
        bad('Invalid condition modifiers');
    if (c.periodic) {
        fields(c.periodic, ['amount', 'damageType']);
        if (!int(c.periodic.amount, 1, 10) || !EFFECT_DAMAGE_TYPES.includes(c.periodic.damageType) || c.clock === 'persistent')
            bad('Invalid periodic damage');
    }
    if (c.save) {
        checkSave(c.save);
        if (c.save.timing === 'minute' && c.clock !== 'minutes' || c.save.timing === 'round-end' && c.clock !== 'rounds')
            bad('Save timing conflicts with clock');
    }
    return structuredClone(c);
}
export function validateEffectDefinition(raw: unknown): EffectDefinition {
    fields(raw, ['id', 'name', 'description', 'context', 'target', 'operations', 'activation','exploration'], ['id', 'name', 'description', 'context', 'target', 'operations']);
    const e = raw as EffectDefinition;
    if (!/^[a-z][a-z0-9_]{0,31}:ability:[a-z][a-z0-9_]{0,31}$/.test(e.id) || !text(e.name, 100) || !text(e.description, 1000) || !['both', 'combat', 'exploration'].includes(e.context) || !['self', 'hero', 'party', 'enemy', 'enemies'].includes(e.target) || !Array.isArray(e.operations) || (!e.operations.length && e.activation?.mode!=='passive' && !e.exploration) || e.operations.length > 8)
        bad('Invalid effect definition');
    if(e.exploration && (!validateExplorationProfile(e.exploration)||e.context!=='exploration'||e.target!=='self'||e.operations.length!==0||e.activation?.mode!=='active'))bad('Exploration abilities must be active, self-targeted, exploration-only and have no ordinary effect operations');
    if (e.activation) {
        fields(e.activation, ['mode', 'classes', 'minLevel', 'resource', 'cost', 'cooldown', 'passive', 'trigger'], ['mode', 'classes', 'minLevel']);
        const a = e.activation;
        if (!['active','passive','triggered'].includes(a.mode) || !Array.isArray(a.classes) || !a.classes.length || a.classes.length > 16 || new Set(a.classes).size !== a.classes.length || a.classes.some(x => typeof x !== 'string' || !/^[a-z][a-z0-9_]*(?::class:[a-z][a-z0-9_]*)?$/.test(x)) || !int(a.minLevel,1,20)) bad('Invalid ability grants');
        if (a.resource) { fields(a.resource,['id','base','perLevel','maximum','recovery']); const r=a.resource;if (!/^[a-z][a-z0-9_]{0,31}:pool:[a-z][a-z0-9_]{0,31}$/.test(r.id)||!int(r.base,1,100)||!int(r.perLevel,0,30)||!int(r.maximum,1,300)||r.base>r.maximum||r.recovery!=='rest') bad('Invalid resource pool'); }
        if (a.cost) {fields(a.cost,['id','amount']);if (!/^[a-z][a-z0-9_]{0,31}:pool:[a-z][a-z0-9_]{0,31}$/.test(a.cost.id)||!int(a.cost.amount,1,100)) bad('Invalid resource cost'); }
        if (a.cooldown) {fields(a.cooldown,['clock','amount']);if (!['minutes','rounds'].includes(a.cooldown.clock)||!int(a.cooldown.amount,1,1000)) bad('Invalid cooldown');}
        if (a.passive) {fields(a.passive,['attack','defense']);if(a.mode!=='passive'||!int(a.passive.attack,-5,5)||!int(a.passive.defense,-5,5)) bad('Invalid passive modifiers');}
        if (a.mode==='passive' && (!a.passive||a.cost||a.cooldown||a.trigger||e.target!=='self') || a.mode!=='passive' && a.passive) bad('Invalid passive ability');
        if (a.mode==='triggered' ? a.trigger!=='block'||e.target!=='self'||e.context==='exploration' : a.trigger!==undefined) bad('Invalid ability trigger');
        if (a.mode==='active' && a.trigger!==undefined) bad('Active ability cannot have trigger');
        if (a.mode==='passive' && e.operations.length) bad('Passive abilities cannot execute effects');
    }
    for (const o of e.operations) {
        if (!obj(o))
            bad('Invalid operation');
        if (o.op === 'condition') {
            fields(o, ['op', 'conditionId', 'duration']);
            if (!text(o.conditionId, 128) || o.duration !== null && !int(o.duration, 1, 60))
                bad('Invalid condition application');
        }
        else if (o.op === 'damage') {
            fields(o, ['op', 'amount', 'damageType', 'save'], ['op', 'amount', 'damageType']);
            if (!int(o.amount, 0, 100) || !EFFECT_DAMAGE_TYPES.includes(o.damageType))
                bad('Invalid damage');
            if (o.save)
                checkSave(o.save, true);
        }
        else if (o.op === 'summon-companion') {
            fields(o,['op','kindId','lifetimeRounds']);
            if (!/^[a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79}$/.test(o.kindId) || !int(o.lifetimeRounds,1,6) || e.context!=='combat' || e.target!=='self' || e.activation?.mode!=='active') bad('Companion summoning requires active self-targeted combat ability and bounded monster reference');
        }
        else if (o.op === 'heal') {
            fields(o, ['op', 'amount']);
            if (!int(o.amount, 0, 100))
                bad('Invalid healing');
        }
        else if (o.op === 'dispel') {
            fields(o, ['op', 'tags', 'max']);
            if (!tags(o.tags) || !o.tags.length || !int(o.max, 1, 16))
                bad('Invalid dispel');
        }
        else
            bad('Unsupported effect operation');
    }
    return structuredClone(e);
}
export function validateEffectDocument(doc: EffectDocument): EffectDocument { if (doc.version !== 1 || !Array.isArray(doc.conditions) || !Array.isArray(doc.effects) || doc.conditions.length > 32 || doc.effects.length > 64)
    bad('Effect document limit'); const conditions = doc.conditions.map(validatePackCondition), effects = doc.effects.map(validateEffectDefinition); if (new Set(conditions.map(c => c.id)).size !== conditions.length || new Set(effects.map(e => e.id)).size !== effects.length)
    bad('Duplicate effect definition'); for (const e of effects)
    for (const o of e.operations)
        if (o.op === 'condition') {
            const c = conditions.find(c => c.id === o.conditionId);
            if (!c)
                throw new EffectFault('Missing condition ' + o.conditionId);
            if (c.clock === 'persistent' ? o.duration !== null : o.duration === null || o.duration > c.maxDuration)
                bad('Duration conflicts with definition');
        } const pools=new Map<string,string>();for(const e of effects){const a=e.activation;if(!a)continue;if(a.resource){const key=JSON.stringify(a.resource),was=pools.get(a.resource.id);if(was&&was!==key)bad('Conflicting resource pool declarations');pools.set(a.resource.id,key);} }
    for(const e of effects)if(e.activation?.cost){const cost=e.activation.cost;if(!pools.has(cost.id)||!effects.some(x=>x.activation?.resource?.id===cost.id && x.activation.classes.some(c=>e.activation!.classes.includes(c))))bad('Ability cost has no usable resource provider');}
    return { version: 1, conditions, effects }; }
let installed: EffectDocument = { version: 1, conditions: [], effects: [] };
export function installEffectDocument(doc: EffectDocument): void { const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};const next=validateEffectDocument(doc);freeze(next);installed=next; }
export function listedEffects():readonly EffectDefinition[]{return installed.effects;}
export function currentEffectDocument(): EffectDocument { return structuredClone(installed); }
export function packCondition(id: string): PackCondition | undefined { return installed.conditions.find(c => c.id === id); }
export function effectDefinition(id: string): EffectDefinition | undefined { return installed.effects.find(e => e.id === id); }
