import {questReader} from './quest-state.ts';
import type {QuestDocument} from '../content/quest-definitions.ts';
/** MP14 authoritative conversation and service transactions. Definitions never mutate. */
import { SocialFault, validateSocialDocument, type SocialDocument, type NpcDefinition, type NpcService, type SocialEffect, type DialogueChoice } from '../content/social-definitions.ts';
import { ITEMS } from '../content/items.ts';
import { validateCampaign, type CampaignState, type MapRegistry } from './campaign.ts';
import { applyScopedAction, readScopedValue, validateScopedState, type ScopedState } from './scoped-state.ts';
import { entityReachable, entityVisible } from './objects.ts';
import { evaluateCondition } from './conditions.ts';
import { giveItem } from './inventory.ts';
import { derived, heal, training, ABILITIES, selectMember } from './party.ts';
import { progression } from '../content/progression.ts';
import { trainAdventurer } from './training.ts';
import { settleExpeditionTime } from './expedition.ts';
import type { Ability } from '../content/party.ts';
export interface SocialCommand {
    type: 'social';
    entityId: string;
    action: 'talk' | 'choose' | 'leave' | 'select-hero' | 'buy' | 'sell' | 'heal' | 'train' | 'tribute' | 'barter';
    nodeId?: string;
    choiceId?: string;
    serviceId?: string;
    itemId?: string;
    itemInstanceId?: string;
    offerId?: string;
    heroId?: string;
    quantity?: number;
    ability?: Ability;
}
export interface ServiceView {
    id: string;
    kind: NpcService['kind'];
    name: string;
    enabled: boolean;
    reason?: string;
    stock?: {
        itemId: string;
        name: string;
        price: number;
        remaining: number;
    }[];
    sell?: {
        instanceId: string;
        name: string;
        count: number;
        price: number;
    }[];
    cost?: number;
    offers?: {
        id: string;
        name: string;
        enabled: boolean;
        reason?: string;
        give: {
            name: string;
            count: number;
        }[];
        receive: {
            name: string;
            count: number;
        }[];
        costGold: number;
    }[];
    amount?: number;
    attitudeDelta?: number;
    training?: {
        eligible: boolean;
        cost: number;
        nextLevel: number | null;
        attributes: Ability[];
    };
}
export interface SocialView {
    selectedHeroId: string;
    heroes: {
        id: string;
        name: string;
        hp: number;
        maxHP: number;
    }[];
    entityId: string;
    npcId: string;
    name: string;
    available: boolean;
    reason?: string;
    attitude: number;
    facts: string[];
    nodeId: string | null;
    text: string;
    ended: boolean;
    choices: {
        id: string;
        text: string;
        enabled: boolean;
        reason?: string;
    }[];
    services: ServiceView[];
}
export interface SocialResult {
    state: CampaignState;
    scoped: ScopedState;
    changed: boolean;
    message: string;
    blocked?: boolean;
    routine?: DialogueChoice['routine'];
}
function fail(message: string): never { throw new SocialFault('E_SOCIAL', message); }
const address = { scope: 'campaign' } as const;
function key(n: NpcDefinition, kind: 'flag' | 'counter' | 'collection', suffix: string): string { const [ns, , name] = n.id.split(':'); return `${ns}:${kind}:${name}_${suffix}`; }
function read(scope: ScopedState, n: NpcDefinition, kind: 'flag' | 'counter' | 'collection', suffix: string, maps: MapRegistry) { return readScopedValue(scope, address, kind, key(n, kind, suffix), maps); }
export function npcRelationship(scope: ScopedState, n: NpcDefinition, maps: MapRegistry): {
    attitude: number;
    facts: string[];
} { return { attitude: Math.max(-100, Math.min(100, n.initialAttitude + (read(scope, n, 'counter', 'attitude', maps) as number))), facts: [...(read(scope, n, 'collection', 'facts', maps) as string[])] }; }
function cursor(scope: ScopedState, n: NpcDefinition, maps: MapRegistry): string | null { const entries = read(scope, n, 'collection', 'node', maps) as string[]; if (entries.length > 1)
    fail('Conversation cursor is invalid.'); return entries[0] ?? null; }
function setCursor(scope: ScopedState, n: NpcDefinition, node: string | null, maps: MapRegistry): ScopedState { let next = scope; for (const value of read(scope, n, 'collection', 'node', maps) as string[])
    next = applyScopedAction(next, { kind: 'collection-remove', address, key: key(n, 'collection', 'node'), value }, maps); if (node)
    next = applyScopedAction(next, { kind: 'collection-add', address, key: key(n, 'collection', 'node'), value: node }, maps); return next; }
function marked(scope: ScopedState, n: NpcDefinition, suffix: string, maps: MapRegistry): boolean { return read(scope, n, 'flag', suffix, maps) as boolean; }
function mark(scope: ScopedState, n: NpcDefinition, suffix: string, maps: MapRegistry): ScopedState { return applyScopedAction(scope, { kind: 'flag', address, key: key(n, 'flag', suffix), value: true }, maps); }
function context(state: CampaignState, scoped: ScopedState, registry: MapRegistry) { let count = 0; return { state, scoped, registry, tick: () => { if (++count > 256)
        fail('Condition evaluation budget exceeded.'); } }; }
function condition(value: unknown, state: CampaignState, scope: ScopedState, maps: MapRegistry, npc: NpcDefinition,quests?:QuestDocument): boolean { return value === undefined || evaluateCondition(value, { ...context(state, scope, maps), relationship: npcRelationship(scope, npc, maps),questReader:quests?questReader(quests,scope,maps):undefined }); }
function carried(s: CampaignState, itemId: string): number { return s.inventory.items.filter(i => s.party.order.includes(i.ownerId) && !i.equipped && i.definitionId === itemId).reduce((sum, i) => sum + i.count, 0); }
function take(s: CampaignState, itemId: string, count: number): void { if (carried(s, itemId) < count)
    fail('Required unequipped carried items are missing.'); let remaining = count; for (const item of s.inventory.items) {
    if (!remaining)
        break;
    if (item.definitionId !== itemId || item.equipped || !s.party.order.includes(item.ownerId))
        continue;
    const amount = Math.min(remaining, item.count);
    item.count -= amount;
    remaining -= amount;
} s.inventory.items = s.inventory.items.filter(i => i.count > 0); }
function choiceReason(s: CampaignState, scope: ScopedState, n: NpcDefinition, c: DialogueChoice, maps: MapRegistry,quests?:QuestDocument): string | undefined { if (c.once && marked(scope, n, 'choice_' + c.id, maps))
    return 'Already resolved.'; if (!condition(c.condition, s, scope, maps, n,quests))
    return c.unavailableText ?? 'Requirements are not met.'; for (const e of c.effects ?? []) {
    if (e.op === 'gold' && e.delta < 0 && s.party.resources.gold < -e.delta)
        return 'Not enough carried gold.';
    if (e.op === 'take-item' && carried(s, e.itemId) < e.count)
        return 'Required carried items are missing.';
} return undefined; }
function serviceReason(s: CampaignState, scope: ScopedState, n: NpcDefinition, service: NpcService, maps: MapRegistry,quests?:QuestDocument): string | undefined { if (npcRelationship(scope, n, maps).attitude < (service.minAttitude ?? -100))
    return 'This NPC does not trust the party enough.'; if (!condition(service.condition, s, scope, maps, n,quests))
    return 'Service requirements are not met.'; if (service.kind === 'tribute' && service.once && marked(scope, n, service.id + '_paid', maps))
    return 'This tribute has already been paid.'; return undefined; }
export function shopStock(doc: SocialDocument, service: Extract<NpcService, {
    kind: 'shop';
}>): {
    itemId: string;
    quantity: number;
    price: number;
}[] {
    const stock = service.stock.map(s => ({ ...s, price: s.price ?? Math.max(1, ITEMS[s.itemId]?.price ?? 0) }));
    if (service.generic) {
        const policy = service.generic;
        const matches = doc.eligibleItems.filter(i => policy.tags.every(tag => i.tags.includes(tag)) && !stock.some(s => s.itemId === i.itemId)).sort((a, b) => a.itemId.localeCompare(b.itemId)).slice(0, policy.maxItems);
        for (const i of matches)
            stock.push({ itemId: i.itemId, quantity: policy.quantity, price: Math.max(1, ITEMS[i.itemId]?.price ?? 0) });
    }
    return stock;
}
function resolve(s: CampaignState, scope: ScopedState, maps: MapRegistry, doc: SocialDocument, entityId: string) { const map = maps[s.currentMapId], entity = map.entities?.find(e => e.id === entityId && e.kind === 'npc'), npc = entity && doc.npcs.find(n => n.id === entity.npcId); if (!entity || !npc)
    fail('NPC definition or placement is unavailable.'); const available = !s.combat.active && !s.combat.defeated && s.party.order.some(id => s.party.characters[id].hp > 0) && entityReachable(s, map, entity) && entityVisible(s, scope, map, entity, maps); const dialogue = doc.dialogues.find(d => d.id === npc.dialogueId); if (!dialogue)
    fail('Dialogue is not installed.'); return { map, entity, npc, dialogue, available }; }
export function socialView(s: CampaignState, scope: ScopedState, maps: MapRegistry, input: SocialDocument, entityId: string,quests?:QuestDocument): SocialView {
    const doc = validateSocialDocument(input);
    validateScopedState(scope, maps);
    const { npc, dialogue, available } = resolve(s, scope, maps, doc, entityId), nodeId = cursor(scope, npc, maps), node = nodeId ? dialogue.nodes.find(n => n.id === nodeId) : undefined;
    if (nodeId && !node)
        fail('Conversation node is unavailable.');
    const relation = npcRelationship(scope, npc, maps), ended = !node || node.terminal === true;
    const hero = s.party.characters[s.party.selectedId];
    const choices = available && !ended ? node!.choices.flatMap(c => { const reason = choiceReason(s, scope, npc, c, maps,quests); return reason && (c.unavailable ?? 'disable') === 'hide' ? [] : [{ id: c.id, text: c.text, enabled: !reason, ...(reason ? { reason } : {}) }]; }) : [];
    const services: ServiceView[] = available && !ended ? npc.services.map(service => {
        let reason = serviceReason(s, scope, npc, service, maps,quests);
        if(!hero||hero.hp<=0)reason??='Select a conscious active hero.';
        const view: ServiceView = { id: service.id, kind: service.kind, name: service.name, enabled: !reason, ...(reason ? { reason } : {}) };
        if (service.kind === 'shop') {
            const stock = shopStock(doc, service);
            view.stock = stock.map((item, i) => ({ itemId: item.itemId, name: ITEMS[item.itemId]?.name ?? item.itemId, price: item.price, remaining: Math.max(0, item.quantity - (read(scope, npc, 'counter', service.id + '_stock_' + i, maps) as number)) }));
            view.sell = s.inventory.items.filter(i => i.ownerId === s.party.selectedId && !i.equipped && stock.some(v => v.itemId === i.definitionId)).map(i => ({ instanceId: i.id, name: ITEMS[i.definitionId].name, count: i.count, price: Math.floor(ITEMS[i.definitionId].price * (service.buybackPercent ?? 50) / 100) }));
        }
        if (service.kind === 'healing') {
            view.cost = service.cost;
            view.amount = service.amount;
            if (!hero || hero.hp <= 0 || hero.hp >= derived(hero).maxHP)
                reason ??= 'Select an injured conscious hero.';
            else if (s.party.resources.gold < service.cost)
                reason ??= 'Not enough carried gold.';
        }
        if (service.kind === 'training' && hero) {
            const t = training(hero);
            view.cost = t.cost;
            view.training = { eligible: t.eligible, cost: t.cost, nextLevel: t.nextLevel, attributes: progression().attributeMilestoneLevels.includes(t.nextLevel ?? 0) ? ABILITIES.filter(a => hero.attributes[a] < 18) : [] };
            if (!t.eligible || hero.hp <= 0 || s.party.resources.gold < t.cost)
                reason ??= 'Training needs a conscious hero, enough XP and carried gold.';
        }
        if (service.kind === 'tribute') {
            view.cost = service.cost;
            view.attitudeDelta = service.attitudeDelta;
            if (s.party.resources.gold < service.cost)
                reason ??= 'Not enough carried gold.';
        }
        if (service.kind === 'barter')
            view.offers = service.offers.map((offer, i) => { let why = reason; if (offer.once && marked(scope, npc, service.id + '_offer_' + i, maps))
                why ??= 'Already traded.'; if (s.party.resources.gold < offer.costGold || offer.give.some(i => carried(s, i.itemId) < i.count))
                why ??= 'Required gold or carried items are missing.'; return { id: offer.id, name: offer.name, give: offer.give.map(i => ({ name: ITEMS[i.itemId]?.name ?? i.itemId, count: i.count })), receive: offer.receive.map(i => ({ name: ITEMS[i.itemId]?.name ?? i.itemId, count: i.count })), costGold: offer.costGold, enabled: !why, ...(why ? { reason: why } : {}) }; });
        view.enabled = !reason;
        if (reason)
            view.reason = reason;
        return view;
    }) : [];
    return { selectedHeroId: s.party.selectedId, heroes: s.party.order.map(id => ({ id, name: s.party.characters[id].name, hp: s.party.characters[id].hp, maxHP: derived(s.party.characters[id]).maxHP })), entityId, npcId: npc.id, name: npc.name, available, ...(!available ? { reason: 'Conversation was interrupted: approach the NPC outside combat.' } : {}), ...relation, nodeId, text: node?.text ?? 'Conversation ended. Speak again to begin anew.', ended, choices, services };
}
export function actSocial(source: CampaignState, scope: ScopedState, maps: MapRegistry, input: SocialDocument, c: SocialCommand,quests?:QuestDocument): SocialResult {
    const doc = validateSocialDocument(input);
    validateScopedState(scope, maps);
    const { npc, dialogue, available } = resolve(source, scope, maps, doc, c.entityId), no = (message: string): SocialResult => ({ state: source, scoped: scope, changed: false, message, blocked: true });
    if (c.action === 'leave')
        return { state: source, scoped: setCursor(scope, npc, null, maps), changed: true, message: 'Conversation ended.' };
    if (!available)
        return no('Conversation is unavailable or interrupted.');
    let s = structuredClone(source), nextScope = structuredClone(scope), message = '', routine: DialogueChoice['routine'];
    const effect = (e: SocialEffect) => { if (e.op === 'attitude') {
        const current = npcRelationship(nextScope, npc, maps).attitude, delta = Math.max(-100, Math.min(100, current + e.delta)) - current;
        nextScope = applyScopedAction(nextScope, { kind: 'counter', address, key: key(npc, 'counter', 'attitude'), delta }, maps);
    }
    else if (e.op === 'remember' || e.op === 'forget')
        nextScope = applyScopedAction(nextScope, { kind: e.op === 'remember' ? 'collection-add' : 'collection-remove', address, key: key(npc, 'collection', 'facts'), value: e.fact }, maps);
    else if (e.op === 'gold') {
        if (s.party.resources.gold + e.delta < 0)
            fail('Not enough carried gold.');
        s.party.resources.gold += e.delta;
    }
    else if (e.op === 'take-item')
        take(s, e.itemId, e.count);
    else if (e.op === 'give-item') {
        const owner = s.party.selectedId;
        if (!s.party.order.includes(owner) || s.party.characters[owner].hp <= 0 || !giveItem(s.inventory, owner, e.itemId, e.count))
            fail('The reward could not fit or references an unavailable item.');
    } };
    const spend = () => { s.elapsedMinutes++; s.maps[s.currentMapId].minutes++; settleExpeditionTime(s); };
    if (c.action === 'talk') {
        nextScope = setCursor(nextScope, npc, dialogue.entry, maps);
        effect({ op: 'remember', fact: 'met' });
        message = dialogue.nodes.find(n => n.id === dialogue.entry)!.text;
    }
    else {
        const nodeId = cursor(scope, npc, maps), node = dialogue.nodes.find(n => n.id === nodeId);
        if (!node || node.terminal || c.nodeId !== nodeId)
            return no('That conversation choice is stale or the conversation has ended.');
        if (c.action === 'select-hero') {
            if (!c.heroId || !s.party.order.includes(c.heroId))
                return no('Select an active hero.');
            s.party = selectMember(s.party, c.heroId);
            message = `Selected ${s.party.characters[c.heroId].name}.`;
        }
        else if (c.action === 'choose') {
            const choice = node.choices.find(x => x.id === c.choiceId);
            if (!choice)
                return no('Unknown dialogue choice.');
            const why = choiceReason(source, scope, npc, choice, maps,quests);
            if (why)
                return no(why);
            for (const e of choice.effects ?? [])
                effect(e);
            if (choice.once)
                nextScope = mark(nextScope, npc, 'choice_' + choice.id, maps);
            nextScope = setCursor(nextScope, npc, choice.next, maps);
            routine = choice.routine;
            spend();
            message = choice.next ? dialogue.nodes.find(n => n.id === choice.next)!.text : 'Conversation ended.';
        }
        else {
            const service = npc.services.find(x => x.id === c.serviceId);
            if (!service)
                return no('Unknown service.');
            const why = serviceReason(source, scope, npc, service, maps,quests);
            if (why)
                return no(why);
            const heroId = c.heroId ?? s.party.selectedId, hero = s.party.characters[heroId];
            if (!s.party.order.includes(heroId) || !hero || hero.hp <= 0)
                return no('Select a conscious active hero.');
            if (service.kind === 'shop' && (c.action === 'buy' || c.action === 'sell')) {
                const quantity = c.quantity ?? 1;
                if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20)
                    return no('Quantity must be 1–20.');
                const stock = shopStock(doc, service);
                if (c.action === 'buy') {
                    const index = stock.findIndex(x => x.itemId === c.itemId), item = stock[index];
                    if (!item || !ITEMS[item.itemId])
                        return no('This item is not eligible for this shop.');
                    const sold = read(scope, npc, 'counter', service.id + '_stock_' + index, maps) as number;
                    if (item.quantity - sold < quantity)
                        return no('Not enough stock.');
                    const cost = item.price * quantity;
                    if (s.party.resources.gold < cost)
                        return no('Not enough carried gold.');
                    if (!giveItem(s.inventory, heroId, item.itemId, quantity))
                        fail('The buyer cannot carry this purchase.');
                    s.party.resources.gold -= cost;
                    nextScope = applyScopedAction(nextScope, { kind: 'counter', address, key: key(npc, 'counter', service.id + '_stock_' + index), delta: quantity }, maps);
                    message = `Bought ${quantity} ${ITEMS[item.itemId].name} for ${cost} gold.`;
                }
                else {
                    const item = s.inventory.items.find(i => i.id === c.itemInstanceId), def = item && ITEMS[item.definitionId];
                    if (!item || !def || item.ownerId !== heroId || item.equipped || item.count < quantity || !stock.some(x => x.itemId === item.definitionId))
                        return no('Choose an owned, unequipped item accepted by this shop.');
                    const amount = Math.floor(def.price * (service.buybackPercent ?? 50) / 100) * quantity;
                    if (amount < 1)
                        return no('This item has no buyback value.');
                    item.count -= quantity;
                    s.inventory.items = s.inventory.items.filter(i => i.count > 0);
                    s.party.resources.gold += amount;
                    message = `Sold ${quantity} ${def.name} for ${amount} gold.`;
                }
            }
            else if (service.kind === 'healing' && c.action === 'heal') {
                if (hero.hp >= derived(hero).maxHP)
                    return no('That hero does not need healing.');
                if (s.party.resources.gold < service.cost)
                    return no('Not enough carried gold.');
                s.party.resources.gold -= service.cost;
                s.party.characters[heroId] = heal(hero, service.amount);
                message = `Healed ${hero.name} for ${service.cost} gold.`;
            }
            else if (service.kind === 'training' && c.action === 'train') {
                const result = trainAdventurer(s, heroId, c.ability);
                if (!result.changed)
                    return no(result.message);
                s = result.state;
                message = result.message;
            }
            else if (service.kind === 'tribute' && c.action === 'tribute') {
                if (s.party.resources.gold < service.cost)
                    return no('Not enough carried gold.');
                effect({ op: 'gold', delta: -service.cost });
                effect({ op: 'attitude', delta: service.attitudeDelta });
                if (service.once)
                    nextScope = mark(nextScope, npc, service.id + '_paid', maps);
                message = `Paid ${service.cost} gold in tribute.`;
            }
            else if (service.kind === 'barter' && c.action === 'barter') {
                const index = service.offers.findIndex(o => o.id === c.offerId), offer = service.offers[index];
                if (!offer)
                    return no('Unknown barter offer.');
                if (offer.once && marked(scope, npc, service.id + '_offer_' + index, maps))
                    return no('This exchange has already been claimed.');
                if (s.party.resources.gold < offer.costGold || offer.give.some(i => carried(s, i.itemId) < i.count))
                    return no('Required gold or carried items are missing.');
                effect({ op: 'gold', delta: -offer.costGold });
                for (const i of offer.give)
                    effect({ op: 'take-item', ...i });
                for (const i of offer.receive)
                    effect({ op: 'give-item', ...i });
                if (offer.attitudeDelta)
                    effect({ op: 'attitude', delta: offer.attitudeDelta });
                if (offer.once)
                    nextScope = mark(nextScope, npc, service.id + '_offer_' + index, maps);
                message = `Completed ${offer.name}.`;
            }
            else
                return no('That action does not match this service.');
            spend();
        }
    }
    return { state: validateCampaign(s, maps), scoped: validateScopedState(nextScope, maps), changed: true, message, ...(routine ? { routine } : {}) };
}
