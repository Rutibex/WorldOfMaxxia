/** MP19: data-defined class grants and resources. Effect calls remain the atomic operation kernel. */
import {listedEffects,EffectFault,type EffectDefinition} from '../content/effect-definitions.ts';
import {applyEffect,type EffectOutcome} from './effects.ts';
import {CLASSES} from '../content/classes.ts';
import {ITEMS} from '../content/items.ts';
import {raceFor} from '../content/races.ts';
import type {CampaignState} from './campaign.ts';
import type {Character} from './party.ts';
export interface AbilityState {pools:Record<string,number>;cooldowns:Record<string,{clock:'minutes'|'rounds';readyAt:number}>;learned:string[];combatClock?:number;}
const fail=(message:string):never=>{throw new EffectFault(message);};
export function abilityGranted(hero:Character,e:EffectDefinition):boolean {const a=e.activation;if(!a||hero.level<a.minLevel)return false;const classDef=CLASSES[hero.classId],choice=classDef?.creationChoices?.find(c=>c.id===hero.creationChoiceId);return a.classes.includes(hero.classId)||hero.abilityState?.learned.includes(e.id)===true||[...(classDef?.abilityGrants??[]),...(raceFor(hero).abilityGrants??[]),...(choice?.abilityGrants??[])].some(g=>g.id===e.id&&hero.level>=g.minLevel);}
export function usableAbilities(hero:Character,combat:boolean):EffectDefinition[]{return listedEffects().filter(e=>e.activation?.mode==='active'&&abilityGranted(hero,e)&&(e.context==='both'||e.context===(combat?'combat':'exploration')));}
export function poolDefinition(id:string){return listedEffects().map(e=>e.activation?.resource).find(r=>r?.id===id);}
export function maxPool(hero:Character,id:string):number {const r=poolDefinition(id);if(!r)return fail('Missing resource provider '+id);return Math.min(r.maximum,r.base+Math.max(0,hero.level-1)*r.perLevel);}
export function poolCurrent(hero:Character,id:string):number {return hero.abilityState?.pools[id]??maxPool(hero,id);}
export function ensureAbilityState(hero:Character):AbilityState {if(!hero.abilityState)hero.abilityState={pools:{},cooldowns:{},learned:[]};return hero.abilityState;}
export function passiveModifiers(hero:Pick<Character,'classId'|'raceId'|'creationChoiceId'|'level'|'abilityState'>):{attack:number;defense:number} {
 const result={attack:0,defense:0};for(const id of Object.values((hero as Character).equipment??{})){const d=typeof id==='string'?ITEMS[id]:undefined;if(d?.passive){result.attack+=d.passive.attack??0;result.defense+=d.passive.defense??0;}}for(const e of listedEffects()){const a=e.activation;if(a?.mode==='passive'&&hero.level>=a.minLevel&&abilityGranted(hero as Character,e)&&a.passive){result.attack+=a.passive.attack;result.defense+=a.passive.defense;}}return {attack:Math.max(-10,Math.min(10,result.attack)),defense:Math.max(-10,Math.min(10,result.defense))};
}
export function checkAbility(hero:Character,e:EffectDefinition,s:CampaignState):string|null {
 const a=e.activation;if(!a||a.mode!=='active'&&a.mode!=='triggered')return 'Ability cannot be activated';if(!abilityGranted(hero,e))return 'Ability is not learned at this level';
 if(a.cost && poolCurrent(hero,a.cost.id)<a.cost.amount)return 'Insufficient '+a.cost.id;
 const cd=hero.abilityState?.cooldowns[e.id];if(cd&&cd.readyAt>(cd.clock==='minutes'?s.elapsedMinutes:hero.abilityState?.combatClock??0))return 'Ability is cooling down';return null;
}
/** Called only on a staged campaign; dispatch owns rollback and the turn action. */
export function activateAbility(s:CampaignState,id:string,heroId:string,targetId?:string,trigger=false):EffectOutcome[] {
 const e=listedEffects().find(e=>e.id===id),hero=s.party.characters[heroId];if(!e||!hero||!s.party.order.includes(heroId)||hero.hp<=0)return fail('Unknown or unavailable character ability');
 if(!e.activation || e.activation.mode!==(trigger?'triggered':'active'))return fail('Not a character-activated ability');
 if(!trigger && ((s.combat.active && e.context==='exploration') || (!s.combat.active && e.context==='combat')))return fail('Ability is unavailable in this context');
 if(!trigger && s.combat.active && s.combat.active.turnOrder[s.combat.active.turnIndex]!==heroId)return fail('It is not that character\'s turn');
 if(!trigger&&e.exploration)return fail('Target an exploration object using its capability interaction');
 const error=checkAbility(hero,e,s);if(error)return fail(error);
 const a=e.activation;if(a.cooldown?.clock==='rounds'&&!s.combat.active)return fail('Round cooldown requires active combat');
 const result=applyEffect(s,id,heroId,targetId);
 const st=ensureAbilityState(hero);
 if(a.cost)st.pools[a.cost.id]=poolCurrent(hero,a.cost.id)-a.cost.amount;
 if(a.cooldown)st.cooldowns[id]={clock:a.cooldown.clock,readyAt:(a.cooldown.clock==='minutes'?s.elapsedMinutes:st.combatClock??0)+a.cooldown.amount};
 return result;
}
export function advanceAbilityRound(s:CampaignState):void {for(const id of s.party.order){const st=s.party.characters[id].abilityState;if(st)st.combatClock=(st.combatClock??0)+1;}}
export function recoverRestAbilities(s:CampaignState):void{for(const id of s.party.order){const h=s.party.characters[id];if(h.hp<=0)continue;const st=ensureAbilityState(h);for(const e of listedEffects()){const r=e.activation?.resource;if(r&&r.recovery==='rest'&&abilityGranted(h,e))st.pools[r.id]=maxPool(h,r.id);}}}
export function refreshLevelResources(before:Character,hero:Character):void{const st=ensureAbilityState(hero);for(const [id,value] of Object.entries(st.pools)){const d=poolDefinition(id);if(!d)continue;st.pools[id]=Math.min(maxPool(hero,id),value+Math.max(0,maxPool(hero,id)-maxPool(before,id)));}}
export function checkAbilityState(h:Character):void{const st=h.abilityState;if(!st)return;const bad=()=>fail('Invalid character ability state');if(st.combatClock!==undefined&&(!Number.isSafeInteger(st.combatClock)||st.combatClock<0||st.combatClock>100000000))bad();if(!st.pools||!st.cooldowns||!Array.isArray(st.learned)||Object.keys(st.pools).length>32||Object.keys(st.cooldowns).length>64||st.learned.length>64||new Set(st.learned).size!==st.learned.length)bad();for(const [id,value]of Object.entries(st.pools)){if(!/^[a-z][a-z0-9_]{0,31}:pool:[a-z][a-z0-9_]{0,31}$/.test(id)||!Number.isSafeInteger(value)||value<0||value>300)bad();const definition=poolDefinition(id);if(definition&&value>maxPool(h,id))bad();}for(const [id,v]of Object.entries(st.cooldowns)){if(!/^[a-z][a-z0-9_]*:ability:[a-z][a-z0-9_]*$/.test(id)||!v||!['minutes','rounds'].includes(v.clock)||!Number.isSafeInteger(v.readyAt)||v.readyAt<0||v.readyAt>100000000)bad();}for(const id of st.learned)if(typeof id!=='string'||!/^[a-z][a-z0-9_]*:ability:[a-z][a-z0-9_]*$/.test(id))bad();}

/** Spend an exploration-only grant in a staged command; never use applyEffect on empty operations. */
export function spendExplorationAbility(s:CampaignState,id:string,heroId:string,minutes:number):void {
 const e=listedEffects().find(e=>e.id===id),hero=s.party.characters[heroId];
 if(!e?.exploration||!hero||!s.party.order.includes(heroId)||hero.hp<=0||s.combat.active||s.combat.defeated)return fail('Exploration ability unavailable');
 const reason=checkAbility(hero,e,s);if(reason)return fail(reason);
 const a=e.activation!;if(a.cooldown?.clock==='rounds')return fail('Exploration abilities cannot use a round cooldown');
 const st=ensureAbilityState(hero);
 if(a.cost)st.pools[a.cost.id]=poolCurrent(hero,a.cost.id)-a.cost.amount;
 if(a.cooldown)st.cooldowns[id]={clock:'minutes',readyAt:s.elapsedMinutes+minutes+a.cooldown.amount};
}
