import { CAPABILITY_TAG } from './vault-review-shared-content-exploration-contract.js';
export class ObjectFault extends Error {
    code;
    constructor(code, message){
        super(message);
        this.code = code;
    }
}
function fail(message) {
    throw new ObjectFault('E_OBJECT', message);
}
const obj = (v)=>!!v && typeof v === 'object' && !Array.isArray(v);
const entityId = /^[a-z][a-z0-9_]{0,47}:object:[a-z][a-z0-9_]{0,47}$/;
const text = (v, max)=>typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export const SCENERY_KINDS = [
    'mirror',
    'brazier',
    'crystal',
    'banner',
    'chest_closed',
    'chest_open',
    'lever_off',
    'lever_on',
    'marker',
    'npc'
];
export function validatePlacedEntities(map) {
    if (map.entities === undefined) return;
    if (!Array.isArray(map.entities) || map.entities.length > 64) fail(`${map.id}.entities: expected at most 64 entities`);
    const ids = new Set(), doors = new Set(), secrets = new Set();
    const fields = [
        'id',
        'name',
        'description',
        'x',
        'y',
        'kind',
        'doorId',
        'secretId',
        'hidden',
        'searchDC',
        'lock',
        'rewards',
        'onUse',
        'appearance',
        'npcId',
        'capabilities',
        'hazardId'
    ];
    for (const [i, e] of map.entities.entries()){
        const at = `${map.id}.entities[${i}]`;
        if (!obj(e) || Object.keys(e).some((k)=>!fields.includes(k)) || !entityId.test(e.id) || ids.has(e.id) || !text(e.name, 100) || !text(e.description, 2000) || !Number.isInteger(e.x) || !Number.isInteger(e.y) || ![
            'object',
            'door',
            'container',
            'secret',
            'npc'
        ].includes(e.kind)) fail(at + ': invalid/duplicate entity or unknown property');
        ids.add(e.id);
        if (e.kind === 'npc' ? !e.npcId || !/^[a-z][a-z0-9_]{0,47}:npc:[a-z][a-z0-9_]{0,31}$/.test(e.npcId) : e.npcId !== undefined) fail(at + ': invalid NPC reference');
        if (e.hidden !== undefined && typeof e.hidden !== 'boolean' || e.searchDC !== undefined && (!Number.isInteger(e.searchDC) || e.searchDC < 1 || e.searchDC > 30)) fail(at + ': invalid discovery settings');
        if (e.kind === 'door') {
            const d = map.doors.find((d)=>d.id === e.doorId);
            if (!d || d.x !== e.x || d.y !== e.y || doors.has(d.id) || d.questLocked) fail(at + ': door must link a unique unsealed door on the same cell');
            doors.add(d.id);
        } else if (e.kind === 'secret') {
            const secret = map.secrets?.find((s)=>s.id === e.secretId);
            if (!secret || secret.x !== e.x || secret.y !== e.y || secrets.has(secret.id)) fail(at + ': secret must link a unique secret wall');
            secrets.add(secret.id);
        } else if ((map.rows[e.y]?.[e.x] ?? '#') !== '.') fail(at + ': object must be on an open cell');
        if (e.kind !== 'door' && e.doorId !== undefined || e.kind !== 'secret' && e.secretId !== undefined) fail(at + ': misplaced topology link');
        if (e.hazardId !== undefined && (e.kind !== 'object' || !map.traps?.some((t)=>t.id === e.hazardId && t.x === e.x && t.y === e.y))) fail(at + ': hazard must reference a trap on the same cell');
        if (e.capabilities !== undefined) {
            if (!Array.isArray(e.capabilities) || e.capabilities.length < 1 || e.capabilities.length > 8 || new Set(e.capabilities.map((m)=>m.id)).size !== e.capabilities.length) fail(at + ': invalid capability methods');
            for (const m of e.capabilities){
                if (!obj(m) || Object.keys(m).some((k)=>![
                        'id',
                        'label',
                        'minutes',
                        'outcome',
                        'tag',
                        'destination'
                    ].includes(k)) || typeof m.id !== 'string' || !CAPABILITY_TAG.test(m.id) || !text(m.label, 80) || typeof m.tag !== 'string' || !CAPABILITY_TAG.test(m.tag) || ![
                    'unlock',
                    'open',
                    'reveal',
                    'disarm',
                    'use',
                    'traverse'
                ].includes(m.outcome) || !Number.isInteger(m.minutes) || m.minutes < 1 || m.minutes > 30) fail(at + ': invalid capability method');
                if (m.outcome === 'traverse' ? !obj(m.destination) || Object.keys(m.destination).sort().join(',') !== 'x,y' || !Number.isInteger(m.destination.x) || !Number.isInteger(m.destination.y) || map.rows[m.destination.y]?.[m.destination.x] !== '.' || Math.abs(m.destination.x - e.x) + Math.abs(m.destination.y - e.y) > 3 : m.destination !== undefined) fail(at + ': invalid bounded traversal destination');
                if ([
                    'unlock',
                    'open'
                ].includes(m.outcome) && ![
                    'door',
                    'container'
                ].includes(e.kind) || m.outcome === 'reveal' && !e.hidden && e.kind !== 'secret' || m.outcome === 'disarm' && !e.hazardId || m.outcome === 'use' && e.kind !== 'object' || m.outcome === 'traverse' && e.kind !== 'object') fail(at + ': capability outcome incompatible with entity kind');
            }
        }
        if (e.lock !== undefined) {
            const l = e.lock;
            if (!obj(l) || Object.keys(l).some((k)=>![
                    'keyItemId',
                    'consumeKey',
                    'pickDC',
                    'forceDC'
                ].includes(k)) || ![
                'door',
                'container'
            ].includes(e.kind) || !l.keyItemId && l.pickDC === undefined && l.forceDC === undefined || l.keyItemId !== undefined && !text(l.keyItemId, 128) || l.consumeKey !== undefined && (typeof l.consumeKey !== 'boolean' || !l.keyItemId) || [
                l.pickDC,
                l.forceDC
            ].some((dc)=>dc !== undefined && (!Number.isInteger(dc) || dc < 1 || dc > 30))) fail(at + ': invalid lock');
        }
        if (e.rewards !== undefined && (!Array.isArray(e.rewards) || e.kind !== 'container' || e.rewards.length < 1 || e.rewards.length > 8 || e.rewards.some((v)=>!obj(v) || Object.keys(v).sort().join(',') !== 'count,itemId' || !text(v.itemId, 128) || !Number.isInteger(v.count) || v.count < 1 || v.count > 20))) fail(at + ': invalid container rewards');
        if (e.onUse !== undefined && (!obj(e.onUse) || Object.keys(e.onUse).sort().join(',') !== 'args,routineId' || e.kind !== 'object' || !/^([a-z][a-z0-9_]{0,47}):routine:[a-z][a-z0-9_]{0,63}$/.test(e.onUse.routineId) || !obj(e.onUse.args) || Object.keys(e.onUse.args).length > 16 || Object.entries(e.onUse.args).some(([k, v])=>!/^[a-z][a-z0-9_]{0,63}$/.test(k) || ![
                'string',
                'number',
                'boolean'
            ].includes(typeof v) || typeof v === 'string' && v.length > 2048 || typeof v === 'number' && (!Number.isSafeInteger(v) || Math.abs(v) > 100000000)))) fail(at + ': invalid use routine');
        if (e.appearance !== undefined && (!obj(e.appearance) || Object.entries(e.appearance).some(([k, v])=>![
                'idle',
                'used',
                'closed',
                'open',
                'claimed'
            ].includes(k) || !SCENERY_KINDS.includes(v)))) fail(at + ': invalid appearance selector');
    }
}
