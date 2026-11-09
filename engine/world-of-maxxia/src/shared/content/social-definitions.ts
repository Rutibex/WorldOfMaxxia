/** Immutable NPC/dialogue/service contracts. No browser or mutable registry access. */
import { validateCondition, type Condition } from '../rules/conditions.ts';
export type SocialEffect = {
    op: 'attitude';
    delta: number;
} | {
    op: 'remember' | 'forget';
    fact: string;
} | {
    op: 'gold';
    delta: number;
} | {
    op: 'give-item' | 'take-item';
    itemId: string;
    count: number;
};
export interface DialogueChoice {
    id: string;
    text: string;
    next: string | null;
    condition?: Condition;
    unavailable?: 'hide' | 'disable';
    unavailableText?: string;
    once?: boolean;
    effects?: SocialEffect[];
    routine?: {
        routineId: string;
        args: Record<string, string | number | boolean>;
    };
}
export interface DialogueNode {
    id: string;
    text: string;
    terminal?: boolean;
    choices: DialogueChoice[];
}
export interface DialogueDefinition {
    id: string;
    entry: string;
    nodes: DialogueNode[];
}
export interface StockEntry {
    itemId: string;
    quantity: number;
    price?: number;
}
interface ServiceBase {
    id: string;
    name: string;
    condition?: Condition;
    minAttitude?: number;
}
export type NpcService = ServiceBase & ({
    kind: 'shop';
    stock: StockEntry[];
    generic?: {
        tags: string[];
        quantity: number;
        maxItems: number;
    };
    buybackPercent?: number;
} | {
    kind: 'healing';
    cost: number;
    amount: number;
} | {
    kind: 'training';
} | {
    kind: 'tribute';
    cost: number;
    attitudeDelta: number;
    once?: boolean;
} | {
    kind: 'barter';
    offers: {
        id: string;
        name: string;
        give: {
            itemId: string;
            count: number;
        }[];
        receive: {
            itemId: string;
            count: number;
        }[];
        costGold: number;
        once?: boolean;
        attitudeDelta?: number;
    }[];
});
export interface NpcDefinition {
    id: string;
    name: string;
    dialogueId: string;
    initialAttitude: number;
    services: NpcService[];
}
export interface SocialDocument {
    version: 1;
    npcs: NpcDefinition[];
    dialogues: DialogueDefinition[];
    eligibleItems: {
        itemId: string;
        tags: string[];
    }[];
}
export class SocialFault extends Error {
    readonly code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
}
function bad(path: string, message: string): never { throw new SocialFault('E_SOCIAL', `${path}: ${message}`); }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const local = (v: unknown) => typeof v === 'string' && /^[a-z][a-z0-9_]{0,23}$/.test(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function fields(v: unknown, allowed: string[], required: string[], path: string): asserts v is Record<string, unknown> { if (!object(v) || Object.keys(v).some(k => !allowed.includes(k)) || required.some(k => !Object.hasOwn(v, k)))
    bad(path, 'invalid fields'); }
export function validateSocialCondition(v: unknown, path: string): void { validateCondition(v, path); const walk = (v: unknown): void => { if (Array.isArray(v))
    v.forEach(walk);
else if (object(v)) {
    if (v.param !== undefined || v.variable !== undefined)
        bad(path, 'dialogue conditions use scoped queries, not routine locals');
    Object.values(v).forEach(walk);
} }; walk(v); }
function itemList(v: unknown, path: string): void { if (!Array.isArray(v) || v.length > 8)
    bad(path, 'expected at most eight item entries'); for (const [i, x] of v.entries()) {
    fields(x, ['itemId', 'count'], ['itemId', 'count'], `${path}[${i}]`);
    if (!text(x.itemId, 128) || !integer(x.count, 1, 20))
        bad(path, 'invalid item grant/cost');
} }
export function validateNpcDefinition(raw: unknown, path = '$'): NpcDefinition {
    fields(raw, ['id', 'name', 'dialogueId', 'initialAttitude', 'services'], ['id', 'name', 'dialogueId', 'initialAttitude', 'services'], path);
    const n = raw as unknown as NpcDefinition;
    if (!/^[a-z][a-z0-9_]{0,47}:npc:[a-z][a-z0-9_]{0,31}$/.test(n.id) || !text(n.name, 100) || !text(n.dialogueId, 128) || !integer(n.initialAttitude, -100, 100) || !Array.isArray(n.services) || n.services.length > 8)
        bad(path, 'invalid NPC');
    const ids = new Set<string>();
    for (const [i, s] of n.services.entries()) {
        const p = `${path}.services[${i}]`;
        if (!object(s) || !local(s.id) || ids.has(s.id) || !text(s.name, 100) || !['shop', 'healing', 'training', 'tribute', 'barter'].includes(s.kind) || s.minAttitude !== undefined && !integer(s.minAttitude, -100, 100))
            bad(p, 'invalid or duplicate service');
        ids.add(s.id);
        if (s.condition !== undefined)
            validateSocialCondition(s.condition, p + '.condition');
        const common = ['id', 'kind', 'name', 'condition', 'minAttitude'];
        if (s.kind === 'shop') {
            fields(s, [...common, 'stock', 'generic', 'buybackPercent'], ['id', 'kind', 'name', 'stock'], p);
            if (!Array.isArray(s.stock) || s.stock.length > 32 || new Set(s.stock.map(x => x.itemId)).size !== s.stock.length || s.stock.some(x => !object(x) || Object.keys(x).some(k => !['itemId', 'quantity', 'price'].includes(k)) || !text(x.itemId, 128) || !integer(x.quantity, 1, 1000) || x.price !== undefined && !integer(x.price, 1, 1000000)) || s.buybackPercent !== undefined && !integer(s.buybackPercent, 0, 50))
                bad(p, 'invalid stock');
            if (s.generic) {
                fields(s.generic, ['tags', 'quantity', 'maxItems'], ['tags', 'quantity', 'maxItems'], p + '.generic');
                if (!Array.isArray(s.generic.tags) || s.generic.tags.length < 1 || s.generic.tags.length > 8 || s.generic.tags.some(t => !text(t, 80)) || !integer(s.generic.quantity, 1, 1000) || !integer(s.generic.maxItems, 1, 32))
                    bad(p, 'invalid generic stock policy');
            }
        }
        else if (s.kind === 'healing') {
            fields(s, [...common, 'cost', 'amount'], ['id', 'kind', 'name', 'cost', 'amount'], p);
            if (!integer(s.cost, 0, 1000000) || !integer(s.amount, 1, 1000))
                bad(p, 'invalid healing');
        }
        else if (s.kind === 'training')
            fields(s, common, ['id', 'kind', 'name'], p);
        else if (s.kind === 'tribute') {
            fields(s, [...common, 'cost', 'attitudeDelta', 'once'], ['id', 'kind', 'name', 'cost', 'attitudeDelta'], p);
            if (!integer(s.cost, 1, 1000000) || !integer(s.attitudeDelta, -100, 100) || s.once !== undefined && typeof s.once !== 'boolean')
                bad(p, 'invalid tribute');
        }
        else {
            fields(s, [...common, 'offers'], ['id', 'kind', 'name', 'offers'], p);
            if (!Array.isArray(s.offers) || s.offers.length < 1 || s.offers.length > 16 || new Set(s.offers.map(o => o.id)).size !== s.offers.length)
                bad(p, 'invalid barter offers');
            for (const o of s.offers) {
                fields(o, ['id', 'name', 'give', 'receive', 'costGold', 'once', 'attitudeDelta'], ['id', 'name', 'give', 'receive', 'costGold'], p);
                if (!local(o.id) || !text(o.name, 100) || !integer(o.costGold, 0, 1000000) || o.once !== undefined && typeof o.once !== 'boolean' || o.attitudeDelta !== undefined && !integer(o.attitudeDelta, -100, 100))
                    bad(p, 'invalid barter');
                itemList(o.give, p + '.give');
                itemList(o.receive, p + '.receive');
            }
        }
    }
    return structuredClone(n);
}
export function validateDialogueDefinition(raw: unknown, path = '$'): DialogueDefinition {
    fields(raw, ['id', 'entry', 'nodes'], ['id', 'entry', 'nodes'], path);
    const d = raw as unknown as DialogueDefinition;
    if (!/^[a-z][a-z0-9_]{0,47}:dialogue:[a-z][a-z0-9_]{0,63}$/.test(d.id) || !local(d.entry) || !Array.isArray(d.nodes) || !d.nodes.length || d.nodes.length > 32)
        bad(path, 'invalid dialogue');
    const ids = new Set<string>(), choices = new Set<string>();
    let count = 0;
    for (const [i, n] of d.nodes.entries()) {
        const p = `${path}.nodes[${i}]`;
        fields(n, ['id', 'text', 'terminal', 'choices'], ['id', 'text', 'choices'], p);
        if (!local(n.id) || ids.has(n.id) || !text(n.text) || !Array.isArray(n.choices) || n.choices.length > 8 || n.terminal !== undefined && typeof n.terminal !== 'boolean' || (n.terminal === true) !== (n.choices.length === 0))
            bad(p, 'invalid/duplicate node or terminal state');
        ids.add(n.id);
        for (const [j, c] of n.choices.entries()) {
            const q = `${p}.choices[${j}]`;
            fields(c, ['id', 'text', 'next', 'condition', 'unavailable', 'unavailableText', 'once', 'effects', 'routine'], ['id', 'text', 'next'], q);
            if (!local(c.id) || choices.has(c.id) || ++count > 96 || !text(c.text, 300) || c.next !== null && !local(c.next) || c.unavailable !== undefined && !['hide', 'disable'].includes(c.unavailable) || c.unavailableText !== undefined && !text(c.unavailableText, 300) || c.once !== undefined && typeof c.once !== 'boolean')
                bad(q, 'invalid/duplicate choice');
            choices.add(c.id);
            if (c.condition !== undefined)
                validateSocialCondition(c.condition, q + '.condition');
            if (c.effects !== undefined) {
                if (!Array.isArray(c.effects) || c.effects.length > 16)
                    bad(q, 'too many effects');
                for (const e of c.effects) {
                    if (!object(e))
                        bad(q, 'invalid effect');
                    if (e.op === 'attitude' || e.op === 'gold') {
                        fields(e, ['op', 'delta'], ['op', 'delta'], q);
                        if (!integer(e.delta, e.op === 'attitude' ? -100 : -1000000, e.op === 'attitude' ? 100 : 1000000))
                            bad(q, 'invalid numeric effect');
                    }
                    else if (e.op === 'remember' || e.op === 'forget') {
                        fields(e, ['op', 'fact'], ['op', 'fact'], q);
                        if (!local(e.fact))
                            bad(q, 'invalid fact');
                    }
                    else if (e.op === 'give-item' || e.op === 'take-item') {
                        fields(e, ['op', 'itemId', 'count'], ['op', 'itemId', 'count'], q);
                        itemList([{ itemId: e.itemId, count: e.count }], q);
                    }
                    else
                        bad(q, 'unknown effect');
                }
            }
            if (c.routine) {
                fields(c.routine, ['routineId', 'args'], ['routineId', 'args'], q + '.routine');
                if (!text(c.routine.routineId, 128) || !object(c.routine.args) || Object.keys(c.routine.args).length > 16 || Object.values(c.routine.args).some(v => !['string', 'boolean', 'number'].includes(typeof v) || typeof v === 'number' && !integer(v, -100000000, 100000000) || typeof v === 'string' && v.length > 2048))
                    bad(q, 'invalid routine hook');
            }
        }
    }
    if (!ids.has(d.entry))
        bad(path + '.entry', 'unknown entry node');
    for (const n of d.nodes)
        for (const c of n.choices)
            if (c.next !== null && !ids.has(c.next))
                bad(path, 'unknown next node ' + c.next);
    return structuredClone(d);
}
export function validateSocialDocument(raw: SocialDocument): SocialDocument {
    if (raw.version !== 1 || !Array.isArray(raw.npcs) || raw.npcs.length > 64 || !Array.isArray(raw.dialogues) || raw.dialogues.length > 64 || !Array.isArray(raw.eligibleItems) || raw.eligibleItems.length > 1024)
        bad('$', 'invalid social document');
    const npcs = raw.npcs.map((n, i) => validateNpcDefinition(n, `npcs[${i}]`)), dialogues = raw.dialogues.map((d, i) => validateDialogueDefinition(d, `dialogues[${i}]`));
    if (new Set(npcs.map(n => n.id)).size !== npcs.length || new Set(dialogues.map(d => d.id)).size !== dialogues.length)
        bad('$', 'duplicate social IDs');
    for (const n of npcs)
        if (!dialogues.some(d => d.id === n.dialogueId))
            bad(n.id, 'missing dialogue');
    return structuredClone({ ...raw, npcs, dialogues });
}
