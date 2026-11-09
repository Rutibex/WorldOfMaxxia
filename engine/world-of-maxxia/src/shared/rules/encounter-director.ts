/** Persistent exploration director; runs only inside the shared transaction. */
import { encounterSeedId, DirectorFault, type AuthoredEncounter, type EncounterDocument } from '../content/encounter-director.ts';
import { MONSTERS } from '../content/monsters.ts';
import { beginSpecificEncounter, type EncounterState } from './combat.ts';
import { SeededRng } from './rng.ts';
import { evaluateCondition } from './conditions.ts';
import { questReader } from './quest-state.ts';
import type { QuestDocument } from '../content/quest-definitions.ts';
import { readScopedValue, applyScopedAction, type ScopedState } from './scoped-state.ts';
import { settleExpeditionTime } from './expedition.ts';
import { modifier } from './party.ts';
import type { CampaignState, MapRegistry } from './campaign.ts';
export type EncounterCommand = {
    type: 'encounter';
    action: 'menu';
} | {
    type: 'encounter';
    action: 'fight' | 'bribe' | 'avoid';
    encounterId: string;
} | {
    type: 'wait';
    minutes: number;
};
export type DirectorEvent = {
    type: 'encounter.offered';
    encounterId: string;
} | {
    type: 'encounter.resolved';
    encounterId: string;
    outcome: string;
};
const address = { scope: 'campaign' } as const;
function key(e: AuthoredEncounter, kind: 'collection' | 'counter', suffix: string) { const [ns, , name] = e.id.split(':'); return `${ns}:${kind}:e_${name}_${suffix}`; }
export function encounterStatus(scope: ScopedState, e: AuthoredEncounter, maps: MapRegistry): string { const values = readScopedValue(scope, address, 'collection', key(e, 'collection', 'status'), maps) as string[]; if (values.length > 1 || values.some(v => !['idle', 'pending', 'fighting', 'won', 'bribed', 'avoided'].includes(v)))
    throw new DirectorFault('Invalid saved encounter outcome'); return values[0] ?? 'idle'; }
function counter(scope: ScopedState, e: AuthoredEncounter, suffix: string, maps: MapRegistry) { const n = readScopedValue(scope, address, 'counter', key(e, 'counter', suffix), maps) as number; if (n < 0)
    throw new DirectorFault('Invalid saved encounter timer'); return n; }
function writeCounter(scope: ScopedState, e: AuthoredEncounter, suffix: string, n: number, maps: MapRegistry) { return applyScopedAction(scope, { kind: 'counter', address, key: key(e, 'counter', suffix), delta: n - counter(scope, e, suffix, maps) }, maps); }
function status(scope: ScopedState, e: AuthoredEncounter, value: string, maps: MapRegistry) { let s = scope; for (const old of readScopedValue(s, address, 'collection', key(e, 'collection', 'status'), maps) as string[])
    s = applyScopedAction(s, { kind: 'collection-remove', address, key: key(e, 'collection', 'status'), value: old }, maps); return applyScopedAction(s, { kind: 'collection-add', address, key: key(e, 'collection', 'status'), value }, maps); }
function nearby(s: CampaignState, e: AuthoredEncounter) { const w = s.maps[s.currentMapId]; return e.nativeMapId === s.currentMapId && Math.abs(e.x - w.x) + Math.abs(e.y - w.y) <= e.range; }
function roll(s: CampaignState, max: number) { const rng = new SeededRng(1); rng.restore(s.rng); const n = rng.integer(1, max); s.rollCount++; s.rng = rng.snapshot(); return n; }
export function encounterMenu(s: CampaignState, scope: ScopedState, maps: MapRegistry, doc: EncounterDocument) { return doc.encounters.filter(e => encounterStatus(scope, e, maps) === 'pending' && nearby(s, e)).map(e => ({ id: e.id, name: e.name, description: e.description, bribe: e.bribe, avoidDC: e.avoidDC })); }
export function actEncounter(source: CampaignState, scope: ScopedState, maps: MapRegistry, doc: EncounterDocument, command: EncounterCommand) {
    let s = structuredClone(source), scoped = scope;
    const events: DirectorEvent[] = [];
    const no = (message: string) => ({ state: source, scoped: scope, changed: false, blocked: true, message, events: [] as DirectorEvent[] });
    if (command.type === 'wait') {
        if (s.combat.active || s.combat.defeated || encounterMenu(s, scope, maps, doc).length)
            return no('Resolve the nearby encounter before waiting.');
        s.elapsedMinutes += command.minutes;
        s.maps[s.currentMapId].minutes += command.minutes;
        settleExpeditionTime(s);
        return { state: s, scoped, changed: true, message: `Waited ${command.minutes} minutes.`, events };
    }
    if (command.action === 'menu')
        return { state: source, scoped, changed: false, message: '', events };
    const e = doc.encounters.find(e => e.id === command.encounterId);
    if (!e || !nearby(s, e) || encounterStatus(scope, e, maps) !== 'pending' || s.combat.active || s.combat.defeated || !s.party.order.some(id => s.party.characters[id].hp > 0))
        return no('That encounter choice is no longer available.');
    const entry = s.combat.encounters[encounterSeedId(e.id)];
    if (!entry)
        throw new DirectorFault('Encounter seed is missing');
    let message = '';
    if (command.action === 'bribe') {
        if (e.bribe === null || s.party.resources.gold < e.bribe)
            return no('The bribe is unavailable or unaffordable.');
        s.party.resources.gold -= e.bribe;
        scoped = status(scoped, e, 'bribed', maps);
        message = `${e.name}: the bribe is accepted.`;
    }
    else if (command.action === 'avoid') {
        if (e.avoidDC === null)
            return no('This encounter cannot be avoided.');
        const dex = Math.max(...s.party.order.filter(id => s.party.characters[id].hp > 0).map(id => modifier(s.party.characters[id].attributes.DEX)));
        if (roll(s, 20) + dex >= e.avoidDC) {
            scoped = status(scoped, e, 'avoided', maps);
            message = `${e.name}: the party slips away.`;
        }
        else
            message = `${e.name}: evasion fails; combat begins.`;
    }
    if (command.action === 'fight' || command.action === 'avoid' && encounterStatus(scoped, e, maps) === 'pending') {
        if (entry.cleared) {
            entry.phase = 0;
            entry.enemies.forEach((enemy, i) => { enemy.hp = Math.max(1, Math.floor(MONSTERS[enemy.kindId].hp * e.phases[0].healthPercent / 100)); enemy.x = e.x + e.members[i].dx; enemy.y = e.y + e.members[i].dy; });
            entry.cleared = false;
            entry.rewarded = false;
        }
        scoped = status(scoped, e, 'fighting', maps);
        const r = beginSpecificEncounter(s, maps, entry.id);
        if (!r.changed)
            throw new DirectorFault('Combat could not begin');
        s = r.state;
        message = [message, ...r.messages].filter(Boolean).join(' ');
    }
    else {
        entry.enemies.forEach(v => v.hp = 0);
        entry.cleared = true;
        entry.rewarded = true;
        scoped = writeCounter(scoped, e, 'resolved', s.elapsedMinutes, maps);
        events.push({ type: 'encounter.resolved', encounterId: e.id, outcome: encounterStatus(scoped, e, maps) });
    }
    return { state: s, scoped, changed: true, message, events };
}
/** Missed intervals coalesce into one check per table, never a burst after rest or reload. */
export function advanceEncounterDirector(before: CampaignState, source: CampaignState, scope: ScopedState, maps: MapRegistry, doc: EncounterDocument, rest: boolean, quests?: QuestDocument) {
    const s = structuredClone(source);
    let scoped = scope, evaluations = 0;
    const events: DirectorEvent[] = [];
    for (const e of doc.encounters) {
        let value = encounterStatus(scoped, e, maps);
        const entry = s.combat.encounters[encounterSeedId(e.id)];
        if (!entry)
            throw new DirectorFault('Missing authored encounter state');
        if (value === 'fighting' && entry.cleared) {
            value = 'won';
            scoped = status(scoped, e, value, maps);
            scoped = writeCounter(scoped, e, 'resolved', s.elapsedMinutes, maps);
            events.push({ type: 'encounter.resolved', encounterId: e.id, outcome: value });
        }
        else if (value === 'fighting' && !s.combat.active && !s.combat.defeated)
            scoped = status(scoped, e, 'pending', maps);
        if (['won', 'bribed', 'avoided'].includes(value) && e.respawn.kind !== 'never') {
            const corpses = s.ground.containers.filter(c => entry.enemies.some(v => v.id === c.enemyId));
            const ready = e.respawn.kind === 'reentry' ? before.currentMapId !== s.currentMapId && e.nativeMapId === s.currentMapId : s.elapsedMinutes - counter(scoped, e, 'resolved', maps) >= e.respawn.minutes;
            if (ready && !corpses.some(c => c.gold || c.entries.length)) {
                s.ground.containers = s.ground.containers.filter(c => !corpses.includes(c));
                entry.enemies.forEach(v => v.hp = 0);
                entry.cleared = true;
                entry.rewarded = true;
                entry.phase = 0;
                scoped = status(scoped, e, 'idle', maps);
            }
        }
    }
    if (s.combat.active || s.combat.defeated)
        return { state: s, scoped, events };
    const tables = new Map<string, AuthoredEncounter[]>();
    for (const e of doc.encounters.filter(e => e.nativeMapId === s.currentMapId)) {
        const k = e.id.split(':')[0] + ':' + e.trigger.table;
        tables.set(k, [...(tables.get(k) ?? []), e]);
    }
    for (const group of [...tables.values()].sort((a, b) => a[0].id.localeCompare(b[0].id))) {
        const anchor = [...group].sort((a, b) => a.id.localeCompare(b.id))[0], t = anchor.trigger;
        const elapsed = s.elapsedMinutes > before.elapsedMinutes, entered = s.currentMapId !== before.currentMapId;
        const due = t.kind === 'proximity' ? elapsed || entered : t.kind === 'rest' ? rest && elapsed : elapsed && s.elapsedMinutes >= (counter(scoped, anchor, 'next', maps) || t.interval);
        if (!due)
            continue;
        if (t.kind === 'clock')
            scoped = writeCounter(scoped, anchor, 'next', s.elapsedMinutes + t.interval, maps);
        if (doc.encounters.some(e => encounterStatus(scoped, e, maps) === 'pending' || encounterStatus(scoped, e, maps) === 'fighting'))
            continue;
        const eligible = group.filter(e => encounterStatus(scoped, e, maps) === 'idle' && nearby(s, e) && (e.condition === undefined || evaluateCondition(e.condition, { state: s, scoped, registry: maps, params: {}, variables: {}, tick: () => { if (++evaluations > 1024)
                throw new DirectorFault('Encounter condition budget exceeded'); }, questReader: quests ? questReader(quests, scoped, maps) : undefined }))).sort((a, b) => a.id.localeCompare(b.id));
        if (!eligible.length)
            continue;
        const total = eligible.reduce((n, e) => n + e.weight, 0);
        let pick = roll(s, total);
        const selected = eligible.find(e => (pick -= e.weight) <= 0)!;
        scoped = status(scoped, selected, 'pending', maps);
        events.push({ type: 'encounter.offered', encounterId: selected.id });
        break;
    }
    return { state: s, scoped, events };
}
