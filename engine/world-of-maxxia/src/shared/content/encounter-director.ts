/** MP16 data-only encounter schedules. Definitions never contain executable code. */
import { validateCondition } from '../rules/conditions.ts';
export interface AuthoredEncounter {
    id: string;
    name: string;
    description: string;
    mapId: string;
    nativeMapId: string;
    x: number;
    y: number;
    range: number;
    trigger: {
        kind: 'proximity' | 'clock' | 'rest';
        interval: number;
        table: string;
    };
    weight: number;
    members: {
        kindId: string;
        dx: number;
        dy: number;
    }[];
    bribe: number | null;
    avoidDC: number | null;
    condition?: unknown;
    respawn: {
        kind: 'never' | 'reentry' | 'cooldown';
        minutes: number;
    };
    phases: {
        title: string;
        healthPercent: number;
    }[];
}
export interface EncounterDocument {
    version: 1;
    encounters: AuthoredEncounter[];
}
export class DirectorFault extends Error {
    readonly code = 'E_ENCOUNTER';
}
const bad = (s: string): never => { throw new DirectorFault(s); };
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, min: number, max: number) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const text = (v: unknown, n: number) => typeof v === 'string' && v.length > 0 && v.length <= n;
export function encounterSeedId(id: string): string { const [ns, , name] = id.split(':'); return `enc16_${ns.length}_${ns}_${name}`; }
export function validateAuthoredEncounter(raw: unknown): AuthoredEncounter {
    if (!obj(raw))
        return bad('Expected encounter object');
    const e = raw as unknown as AuthoredEncounter;
    const fields = ['id', 'name', 'description', 'mapId', 'nativeMapId', 'x', 'y', 'range', 'trigger', 'weight', 'members', 'bribe', 'avoidDC', 'condition', 'respawn', 'phases'];
    if (Object.keys(raw).some(k => !fields.includes(k)) || !/^([a-z][a-z0-9_]{0,15}):encounter:([a-z][a-z0-9_]{0,23})$/.test(e.id) || !text(e.name, 100) || !text(e.description, 2000) || !text(e.mapId, 128) || !/^map_[a-z0-9_]{1,74}$/.test(e.nativeMapId) || !num(e.x, 0, 63) || !num(e.y, 0, 63) || !num(e.range, 0, 4) || !num(e.weight, 1, 1000))
        return bad('Invalid encounter identity, location or weight');
    if (!obj(e.trigger) || Object.keys(e.trigger).some(k => !['kind', 'interval', 'table'].includes(k)) || !['proximity', 'clock', 'rest'].includes(e.trigger.kind) || !num(e.trigger.interval, 1, 10080) || !/^([a-z][a-z0-9_]{0,23})$/.test(e.trigger.table))
        return bad('Invalid encounter schedule');
    if (!obj(e.respawn) || Object.keys(e.respawn).some(k => !['kind', 'minutes'].includes(k)) || !['never', 'reentry', 'cooldown'].includes(e.respawn.kind) || !num(e.respawn.minutes, 1, 10080))
        return bad('Invalid respawn policy');
    if (e.bribe !== null && !num(e.bribe, 0, 100000) || e.avoidDC !== null && !num(e.avoidDC, 1, 40))
        return bad('Invalid peaceful choice');
    if (!Array.isArray(e.members) || e.members.length < 1 || e.members.length > 3 || e.members.some(m => !obj(m) || Object.keys(m).some(k => !['kindId', 'dx', 'dy'].includes(k)) || !text(m.kindId, 128) || !num(m.dx, -4, 4) || !num(m.dy, -4, 4)))
        return bad('Expected one to three monsters');
    if (!Array.isArray(e.phases) || e.phases.length < 1 || e.phases.length > 4 || e.phases.some(p => !obj(p) || Object.keys(p).some(k => !['title', 'healthPercent'].includes(k)) || !text(p.title, 100) || !num(p.healthPercent, 1, 100)))
        return bad('Expected one to four bounded boss waves');
    if (e.condition !== undefined) {
        validateCondition(e.condition);
        const scan = (v: unknown): void => { if (Array.isArray(v)) {
            v.forEach(scan);
            return;
        } if (!obj(v))
            return; if (['param', 'variable', 'attitude', 'fact'].includes(String(v.query)))
            bad('Encounter conditions require campaign context'); Object.values(v).forEach(scan); };
        scan(e.condition);
    }
    return structuredClone(e);
}
export function validateEncounterDocument(raw: EncounterDocument): EncounterDocument {
    if (raw.version !== 1 || !Array.isArray(raw.encounters) || raw.encounters.length > 16)
        bad('Expected at most16 live encounters');
    const encounters = raw.encounters.map(validateAuthoredEncounter);
    if (new Set(encounters.map(e => e.id)).size !== encounters.length)
        bad('Duplicate encounter ID');
    const tables = new Map<string, string>();
    for (const e of encounters) {
        const key = e.id.split(':')[0] + ':' + e.nativeMapId + ':' + e.trigger.table, signature = e.trigger.kind + ':' + e.trigger.interval;
        if (tables.has(key) && tables.get(key) !== signature)
            bad('Table members must share trigger kind and interval');
        tables.set(key, signature);
    }
    return { version: 1, encounters };
}
let installed: EncounterDocument = { version: 1, encounters: [] };
export function currentEncounterDocument(): EncounterDocument { return structuredClone(installed); }
export function installEncounterDocument(doc: EncounterDocument): void { installed = validateEncounterDocument(doc); }
export function authoredEncounterForSeed(id: string): AuthoredEncounter | undefined { return installed.encounters.find(e => encounterSeedId(e.id) === id); }
