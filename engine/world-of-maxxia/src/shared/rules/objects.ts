import {edgeBlocked,elevationAt} from '../project/terrain-contracts.ts';
import {ObjectFault,validatePlacedEntities,type PlacedEntity} from './placed-entities.ts';
import {capabilityProvider,capabilityCanReveal,capabilityInMenu,executeCapability} from './exploration-capabilities.ts';
export {ObjectFault,validatePlacedEntities,type PlacedEntity} from './placed-entities.ts';
function fail(message:string):never{throw new ObjectFault('E_OBJECT',message);}
/** MP13 generic placed entities. Immutable definitions; mutable values use campaign map state and MP07 scopes. */
import { DIRECTIONS, isOpaque, type GridMap } from './grid.ts';
import { validateCampaign, type CampaignState, type MapRegistry } from './campaign.ts';
import { applyScopedAction, readScopedValue, validateScopedState, type ScopedState } from './scoped-state.ts';
import { giveItem } from './inventory.ts';
import { derived, modifier } from './party.ts';
import { SeededRng } from './rng.ts';
import { settleExpeditionTime } from './expedition.ts';
export type ObjectAction = `cap:${string}` | 'inspect' | 'use' | 'search' | 'open' | 'close' | 'unlock' | 'pick' | 'force' | 'claim' | 'talk';
export interface InteractionChoice {
    id: ObjectAction;
    label: string;
    enabled: boolean;
    reason?: string;
}
export interface EntityView {
    id: string;
    name: string;
    description: string;
    kind: PlacedEntity['kind'];
    state: 'idle' | 'used' | 'closed' | 'open' | 'claimed';
    locked: boolean;
    choices: InteractionChoice[];
}
export interface InteractionMenu {
    mapId: string;
    entities: EntityView[];
}
function key(e: PlacedEntity, suffix: string): string { const [ns, , name] = e.id.split(':'); return `${ns}:flag:${name}_${suffix}`; }
function flag(scope: ScopedState, map: GridMap, e: PlacedEntity, suffix: string, registry: MapRegistry): boolean { return readScopedValue(scope, { scope: 'local', mapId: map.id }, 'flag', key(e, suffix), registry) as boolean; }
function set(scope: ScopedState, map: GridMap, e: PlacedEntity, suffix: string, registry: MapRegistry): ScopedState { return applyScopedAction(scope, { kind: 'flag', address: { scope: 'local', mapId: map.id }, key: key(e, suffix), value: true }, registry); }
export function entityVisible(s: CampaignState, scope: ScopedState, map: GridMap, e: PlacedEntity, registry: MapRegistry): boolean { return e.kind === 'secret' ? !!s.maps[map.id].secrets[e.secretId!] : !e.hidden || flag(scope, map, e, 'found', registry); }
export function entityReachable(s: CampaignState, map: GridMap, e: PlacedEntity): boolean {
    const w = s.maps[map.id], d = DIRECTIONS[w.facing];
    if (e.x === w.x && e.y === w.y)
        return true;
    if (e.x !== w.x + d.x || e.y !== w.y + d.y)
        return false;
    if(edgeBlocked(map,w,w.x,w.y,e.x,e.y)||Math.abs(elevationAt(map,w,w.x,w.y)-elevationAt(map,w,e.x,e.y))>1)return false;
    return e.kind === 'door' || e.kind === 'secret' || !isOpaque(map, w, e.x, e.y);
}
function open(s: CampaignState, scope: ScopedState, map: GridMap, e: PlacedEntity, registry: MapRegistry): boolean { return e.kind === 'door' ? s.maps[map.id].doors[e.doorId!] : flag(scope, map, e, 'opened', registry); }
export function entityView(s: CampaignState, scope: ScopedState, map: GridMap, e: PlacedEntity, registry: MapRegistry): EntityView {
    const isOpen = open(s, scope, map, e, registry), locked = !!e.lock && !isOpen && !flag(scope, map, e, 'unlocked', registry);
    const claimed = e.kind === 'container' && flag(scope, map, e, 'claimed', registry), used = flag(scope, map, e, 'used', registry);
    const status: EntityView['state'] = claimed ? 'claimed' : e.kind === 'door' || e.kind === 'container' ? (isOpen ? 'open' : 'closed') : used ? 'used' : 'idle';
    const choices: InteractionChoice[] = [{ id: 'inspect', label: 'Inspect', enabled: true }, { id: 'search', label: 'Search', enabled: true }];
    const add = (id: ObjectAction, label: string, enabled = true, reason?: string) => choices.push({ id, label, enabled, ...(!enabled ? { reason } : {}) });
    if (e.kind === 'door' || e.kind === 'container') {
        if (locked) {
            if (e.lock?.keyItemId)
                add('unlock', 'Unlock with key', s.inventory.items.some(i => i.definitionId === e.lock!.keyItemId && i.count > 0), 'Required key is not carried.');
            if (e.lock?.pickDC)
                add('pick', `Pick lock (DC ${e.lock.pickDC})`, s.party.resources.food > 0, 'Needs 1 food.');
            if (e.lock?.forceDC)
                add('force', `Force open (DC ${e.lock.forceDC})`, s.party.resources.food > 0, 'Needs 1 food.');
        }
        else if (!claimed) {
            if (isOpen) {
                if (e.kind === 'door')
                    add('close', 'Close door', !(s.maps[map.id].x === e.x && s.maps[map.id].y === e.y), 'The party occupies this doorway.');
                else
                    add('claim', 'Take contents');
            }
            else
                add('open', 'Open');
        }
    }
    else if(e.kind==='npc')add('talk','Talk');
    else if (e.kind === 'object')
        add('use', used ? 'Use again' : 'Use');
    if(!entityVisible(s,scope,map,e,registry)){choices.splice(0,choices.length);}
    for(const m of e.capabilities??[]){const available=capabilityProvider(s,scope,map,e,m,registry);add(`cap:${m.id}`,m.label,!!available.provider,available.reason);}
    return { id:e.id, name:entityVisible(s,scope,map,e,registry)?e.name:'Obscured feature',description:entityVisible(s,scope,map,e,registry)?e.description:'A concealed feature may be revealed by a capability.',kind:e.kind,state:status,locked,choices };
}
export function interactionMenu(s: CampaignState, scope: ScopedState, registry: MapRegistry, entityId?: string): InteractionMenu {
    const map = registry[s.currentMapId];
    validatePlacedEntities(map);
    validateScopedState(scope, registry);
    const entities = (map.entities ?? []).filter(e => (!entityId || e.id === entityId) && (entityReachable(s,map,e)||capabilityInMenu(s,scope,map,e,registry)) && (entityVisible(s,scope,map,e,registry)||capabilityCanReveal(s,scope,map,e,registry)));
    return { mapId: map.id, entities: entities.map(e => entityView(s, scope, map, e, registry)) };
}
export function entityPresentationMap(map: GridMap, s: CampaignState, scope: ScopedState, registry: MapRegistry): GridMap {
    if (!map.entities?.length)
        return map;
    const props = [...map.props];
    for (const e of map.entities) {
        if (map.spritePlacements?.some(p=>p.entityId===e.id) || e.kind === 'door' || e.kind === 'secret' || !entityVisible(s, scope, map, e, registry))
            continue;
        const v = entityView(s, scope, map, e, registry), kind = e.appearance?.[v.state] ?? e.appearance?.idle ?? (e.kind==='npc'?'npc':e.kind === 'container' ? (v.state === 'closed' ? 'chest_closed' : v.state === 'open' ? 'chest_open' : 'marker') : v.state === 'used' ? 'lever_on' : 'lever_off');
        props.push({ id: e.id, kind, x: e.x, y: e.y, name: e.name, description: e.description });
    }
    return { ...map, props };
}
export interface ObjectResult {
    state: CampaignState;
    scoped: ScopedState;
    changed: boolean;
    message: string;
    blocked?: boolean;
    routine?: PlacedEntity['onUse'];
}
export function actOnEntity(source: CampaignState, scope: ScopedState, registry: MapRegistry, id: string, action: ObjectAction): ObjectResult {
    const map = registry[source.currentMapId];
    validatePlacedEntities(map);
    validateScopedState(scope, registry);
    const e = map.entities?.find(e => e.id === id);
    const no = (message: string): ObjectResult => ({ state: source, scoped: scope, changed: false, message, blocked: true });
    if (source.combat.active || source.combat.defeated)
        return no('Objects are unavailable during combat or defeat.');
    if (!source.party.order.some(id => source.party.characters[id].hp > 0))
        return no('No conscious adventurer can act.');
    if (!e)return no('Unknown object.');
    if(action.startsWith('cap:'))return executeCapability(source,scope,registry,e,action.slice(4));
    if (!entityReachable(source, map, e))return no('That object is not within reach.');
    if (action !== 'search' && !entityVisible(source, scope, map, e, registry))
        return no('No discovered object is available there.');
    const view = entityView(source, scope, map, e, registry);
    if (action !== 'search') {
        const choice = view.choices.find(c => c.id === action);
        if (!choice || !choice.enabled)
            return no(choice?.reason ?? 'That action is unavailable in the current object state.');
    }
    if(action==='talk')return no('Talking requires the social simulation context.');
    if (action === 'inspect')
        return { state: source, scoped: scope, changed: false, message: e.description };
    let s = structuredClone(source), nextScope = structuredClone(scope), message = '';
    const setFlag = (suffix: string) => { nextScope = set(nextScope, map, e, suffix, registry); };
    const spend = (minutes: number) => { s.elapsedMinutes += minutes; s.maps[map.id].minutes += minutes; settleExpeditionTime(s); };
    const roll = (attribute: 'STR' | 'DEX' | 'WIS', dc: number): boolean => { const hero = s.party.order.map(id => s.party.characters[id]).filter(c => c.hp > 0 && !c.conditions.some(v => v.id === 'asleep')).sort((a, b) => derived(b).attributes[attribute] - derived(a).attributes[attribute])[0]; if (!hero)
        fail('No conscious actor can attempt this check.'); const rng = new SeededRng(1); rng.restore(s.rng); const die = rng.integer(1, 20); s.rng = rng.snapshot(); s.rollCount++; const bonus = modifier(derived(hero).attributes[attribute]); message = `${hero.name}: ${die} + ${bonus} vs DC ${dc}. `; return die + bonus >= dc; };
    if (action === 'search') {
        if (entityVisible(source, scope, map, e, registry))
            return { state: source, scoped: scope, changed: false, message: 'Nothing further is concealed here.' };
        if (s.party.resources.food < 1)
            return no('Searching needs 1 food.');
        s.party.resources.food--;
        const found = s.magic.effects.some(v=>v.kind==='glass_eye'&&v.expiresAtMinute!>s.elapsedMinutes)||roll('WIS', e.searchDC ?? 10);
        spend(10);
        if (found) {
            setFlag('found');
            if (e.kind === 'secret')
                s.maps[map.id].secrets[e.secretId!] = true;
            message += `Discovered ${e.name}.`;
        }
        else
            message += 'Nothing found; you may search again.';
    }
    else if (action === 'unlock') {
        if (e.lock?.consumeKey) {
            const item = s.inventory.items.find(i => i.definitionId === e.lock!.keyItemId && i.count > 0 && !i.equipped);
            if (!item)
                return no('Unequip the required key before consuming it.');
            if (--item.count === 0)
                s.inventory.items = s.inventory.items.filter(i => i.id !== item.id);
        }
        setFlag('unlocked');
        if (e.kind === 'door')
            s.maps[map.id].doors[e.doorId!] = true;
        else
            setFlag('opened');
        spend(1);
        message = `Unlocked and opened ${e.name}.`;
    }
    else if (action === 'pick' || action === 'force') {
        if (s.party.resources.food < 1)
            return no('This attempt needs 1 food.');
        s.party.resources.food--;
        const success = roll(action === 'pick' ? 'DEX' : 'STR', action === 'pick' ? e.lock!.pickDC! : e.lock!.forceDC!);
        if (action === 'force') {
            const [ns, , name] = e.id.split(':');
            nextScope = applyScopedAction(nextScope, { kind: 'counter', address: { scope: 'local', mapId: map.id }, key: `${ns}:counter:${name}_noise`, delta: 1 }, registry);
            const hero = s.party.characters[s.party.order.find(id => s.party.characters[id].hp > 0)!];
            hero.hp = Math.max(0, hero.hp - 1);
        }
        if (success) {
            setFlag('unlocked');
            if (e.kind === 'door')
                s.maps[map.id].doors[e.doorId!] = true;
            else
                setFlag('opened');
            message += `Opened ${e.name}.`;
        }
        else
            message += 'The lock holds. You may try again.';
        spend(1);
    }
    else if (action === 'open') {
        if (e.kind === 'door')
            s.maps[map.id].doors[e.doorId!] = true;
        else
            setFlag('opened');
        spend(1);
        message = `Opened ${e.name}.`;
    }
    else if (action === 'close') {
        setFlag('unlocked');
        s.maps[map.id].doors[e.doorId!] = false;
        spend(1);
        message = `Closed ${e.name}.`;
    }
    else if (action === 'claim') {
        const owner = s.party.selectedId;
        if (!s.party.order.includes(owner) || s.party.characters[owner].hp <= 0)
            return no('Select a conscious party member to receive the contents.');
        for (const reward of e.rewards ?? [])
            if (!giveItem(s.inventory, owner, reward.itemId, reward.count))
                fail('Container contents could not fit or reference an unknown item; nothing was claimed.');
        setFlag('claimed');
        spend(1);
        message = `Claimed the contents of ${e.name}.`;
    }
    else if (action === 'use') {
        setFlag('used');
        spend(1);
        message = `Used ${e.name}.`;
    }
    return { state: validateCampaign(s, registry), scoped: validateScopedState(nextScope, registry), changed: true, message, ...(action === 'use' && e.onUse ? { routine: e.onUse } : {}) };
}
