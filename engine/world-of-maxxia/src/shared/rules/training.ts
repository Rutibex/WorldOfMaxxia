import {refreshLevelResources} from './abilities.ts';
import { derived, training, ABILITIES } from './party.ts';
import { progression } from '../content/progression.ts';
import type { CampaignState } from './campaign.ts';
import type { Ability } from '../content/party.ts';
export function trainAdventurer(source: CampaignState, id: string, ability?: Ability): {
    state: CampaignState;
    changed: boolean;
    message: string;
} {
    const no = (message: string) => ({ state: source, changed: false, message });
    const hero = source.party.characters[id];
    if (!source.party.order.includes(id) || !hero || hero.hp <= 0)
        return no('Select a conscious active adventurer to train.');
    const t = training(hero);
    if (!t.eligible || t.capped || source.party.resources.gold < t.cost)
        return no(`Training requires enough XP and ${t.cost} carried gold (level cap ${progression().maxLevel}).`);
    const milestone = progression().attributeMilestoneLevels.includes(t.nextLevel!);
    if (milestone && (!ability || !ABILITIES.includes(ability) || hero.attributes[ability] >= 18))
        return no('Choose one attribute below 18 for the level milestone.');
    const s = structuredClone(source), h = s.party.characters[id], before = derived(h);
    s.party.resources.gold -= t.cost;
    const oldHero=structuredClone(h);
    h.level++;
    if (milestone)
        h.attributes[ability!] += 1;
    refreshLevelResources(oldHero,h);
    const after = derived(h);
    if (h.hp > 0)
        h.hp = Math.min(after.maxHP, h.hp + Math.max(0, after.maxHP - before.maxHP));
    h.sp = Math.min(after.maxSP, h.sp + Math.max(0, after.maxSP - before.maxSP));
    return { state: s, changed: true, message: `${h.name} trains to level ${h.level} for ${t.cost} gold${milestone ? `; ${ability} increases by 1` : ''}.` };
}
