import {trainAdventurer} from './training.ts';
import {progression} from '../content/progression.ts';
/** Phase 15: deterministic, atomic town service economy; no DOM dependencies. */
import {acceptMain,acceptOptional,completeUpperOptional,completeEchoOptional,resolveEnding} from './quests.ts';
import {ITEMS} from '../content/items.ts';
import type {Ability} from '../content/party.ts';
import {SPELLS,STARTER_SPELLS} from './magic.ts';
import {spellAllowed,starterSpellsForClass} from '../content/spells.ts';
import {makeHero,nextHeroId,validateBlueprint,ROSTER_LIMIT,RECRUIT_COST,type HeroBlueprint} from './creation.ts';
import {CLASSES,ABILITIES,derived,training,heal} from './party.ts';
import {giveItem,itemCategoryCount,ITEM_LIMIT_PER_CATEGORY} from './inventory.ts';
import {settleExpeditionTime} from './expedition.ts';
import {isOpaque,DIRECTIONS} from './grid.ts';
import type {CampaignState,MapRegistry} from './campaign.ts';

export type ServiceKind='tavern'|'merchant'|'temple'|'trainer'|'wizard'|'priest'|'witch'|'quest'|'quest_optional';
export interface TownService {id:string;kind:ServiceKind;name:string;role:string;x:number;y:number;description:string;}
/** Phase 16 permanent town service anchors; map_town is a connected 16x16 street network. */
export const TOWN_SERVICES:readonly TownService[]=[
 {id:'npc_tessa_bell',kind:'tavern',name:'Tessa Bell',role:'The Silver Lantern tavern',x:4,y:11,description:'Food, rest, rumors, banking and the adventuring roster.'},
 {id:'npc_orro_vane',kind:'merchant',name:'Orro Vane',role:'Market blacksmith',x:10,y:11,description:'Browse, buy, sell, identify and repair equipment.'},
 {id:'npc_sister_vale',kind:'temple',name:'Sister Vale',role:'Village temple',x:4,y:6,description:'Healing, curses, resurrection and blessings.'},
 {id:'npc_captain_brann',kind:'trainer',name:'Captain Brann',role:'Training yard',x:11,y:6,description:'Train qualified adventurers up to level five.'},
 {id:'npc_pell_glass',kind:'wizard',name:'Pell Glass',role:'Wizard guild',x:2,y:3,description:'Spell lessons for Wizards.'},
 {id:'npc_nera_salt',kind:'priest',name:'Nera Salt',role:'Shrine of the tide',x:6,y:3,description:'Spell lessons for Priests.'},
 {id:'npc_aunt_vell',kind:'witch',name:'Aunt Vell',role:'Witch hearth',x:10,y:3,description:'Spell lessons for Witches.'},
 {id:'npc_iona_reed',kind:'quest',name:'Iona Reed',role:'Cistern keeper',x:8,y:8,description:'The strange ringing below the village must be investigated.'}
];
export const SHOP_STOCK:Readonly<Record<string,number>>={
 item_sword:3,item_dagger:4,item_staff:3,item_mace:3,item_spear:2,item_crossbow:2,
 item_cloth_robe:3,item_leather_coat:3,item_ring_mail:2,item_round_shield:2,
 item_healing_draught:8,item_antidote:6,item_torch:12
};
export const RUMORS=[
 'The galleries sing when no one is below. Some say their metal remembers names.',
 'The glass lens near the gallery mirror belongs to the old cistern machinery.',
 'The eastern galleries hold a watcher that hates the dawn.',
 'There is a passage hidden behind masonry in the lower gallery.'
] as const;
export interface ServicesState {stock:Record<string,number>;rumorsHeard:number;}
export function initialServices():ServicesState{return {stock:{...SHOP_STOCK},rumorsHeard:0};}
export function validateServices(raw:unknown):ServicesState{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('Invalid town service state.');const s=raw as ServicesState;
 if(!Number.isSafeInteger(s.rumorsHeard)||s.rumorsHeard<0||s.rumorsHeard>RUMORS.length||!s.stock||typeof s.stock!=='object'||Array.isArray(s.stock)||Object.keys(s.stock).length!==Object.keys(SHOP_STOCK).length)throw new TypeError('Invalid merchant stock.');
 for(const [id,qty] of Object.entries(SHOP_STOCK))if(!Number.isSafeInteger(s.stock[id])||s.stock[id]<0||s.stock[id]>qty)throw new TypeError('Invalid stock quantity.');return s;
}
export function nearbyService(s:CampaignState,registry:MapRegistry):TownService|null{
 if(s.currentMapId!=='map_town'||s.combat.active||s.combat.defeated)return null;
 const w=s.maps.map_town,map=registry.map_town,d=DIRECTIONS[w.facing];
 return TOWN_SERVICES.find(n=>n.x===w.x&&n.y===w.y)??TOWN_SERVICES.find(n=>n.x===w.x+d.x&&n.y===w.y+d.y&&!isOpaque(map,w,n.x,n.y))??null;
}
export type ServiceAction='drink'|'food'|'tip'|'rest'|'deposit'|'withdraw'|'dismiss'|'recruit'|'register'|'buy'|'sell'|'identify'|'repair'|'heal'|'cure'|'revive'|'uncurse'|'donate'|'train'|'learn'|'quest'|'quest_optional'|'turn_in'|'ending_repair'|'ending_disconnect';
export interface ServiceRequest{serviceId:string;action:ServiceAction;amount?:number;characterId?:string;itemId?:string;definitionId?:string;ability?:Ability;condition?:string;blueprint?:HeroBlueprint;}
export interface ServiceResult{state:CampaignState;changed:boolean;message:string;}
const reject=(s:CampaignState,message:string):ServiceResult=>({state:s,changed:false,message});
const integer=(x:unknown,max=1000000)=>Number.isSafeInteger(x)&&(x as number)>=1&&(x as number)<=max;
export function serviceAction(source:CampaignState,registry:MapRegistry,r:ServiceRequest):ServiceResult{
 const npc=TOWN_SERVICES.find(n=>n.id===r.serviceId);
 if(!npc||!nearbyService(source,registry)||nearbyService(source,registry)!.id!==npc.id)return reject(source,'Approach and face this town service to use it.');
 if(source.combat.active||source.combat.defeated)return reject(source,'Town services are unavailable during combat.');
 const p=source.party,resources=p.resources,id=r.characterId??p.selectedId,hero=p.characters[id],amount=r.amount??1;
 const active=p.order.includes(id);
 const needGold=(gold:number)=>!Number.isSafeInteger(gold)||gold<0||resources.gold<gold;
 const next=()=>structuredClone(source);
 const withResult=(s:CampaignState,msg:string):ServiceResult=>({state:s,changed:true,message:msg});
 if(npc.kind==='quest'){
  if(r.action==='ending_repair'||r.action==='ending_disconnect')return resolveEnding(source,r.action==='ending_repair'?'repair':'disconnect');
  if(r.action!=='quest')return reject(source,'Ask Iona about the cistern or the recovered regulator.');
  return acceptMain(source);
 }
 if(r.action==='turn_in'){
  if(npc.kind==='tavern')return completeUpperOptional(source,'quest_optional_ledger');
  if(npc.kind==='merchant')return completeUpperOptional(source,'quest_optional_tools');
  if(npc.id==='npc_nera_salt')return completeEchoOptional(source);
  return reject(source,'No upper-cistern quest reward is available here.');
 }
 if(r.action==='quest_optional'){
  const target=npc.kind==='tavern'?'quest_optional_ledger':npc.kind==='merchant'?'quest_optional_tools':npc.id==='npc_nera_salt'?'quest_optional_echo':null;
  if(!target)return reject(source,'This person has no optional request.');
  return acceptOptional(source,target);
 }
 if(npc.kind==='tavern'){
  if(r.action==='food'){if(!integer(amount,200)||needGold(amount)||p.resources.food+amount>1000)return reject(source,'Choose 1–200 food portions; each costs one gold (max 1,000 carried).');const s=next();s.party.resources.gold-=amount;s.party.resources.food+=amount;return withResult(s,`Bought ${amount} food portions for ${amount} gold.`);}
  if(r.action==='drink'){if(needGold(1)||!active||!hero||hero.hp<=0)return reject(source,'A living active hero and one gold are required.');const s=next();s.party.resources.gold--;s.party.characters[id].conditions=s.party.characters[id].conditions.filter(c=>c.id!=='drunk');s.party.characters[id].conditions.push({id:'drunk',remaining:60,unit:'minutes'});return withResult(s,`${hero.name} drinks for one gold and becomes drunk for one hour.`);}
  if(r.action==='tip'){if(source.services.rumorsHeard>=RUMORS.length)return reject(source,'Tessa has no more new rumors.');if(needGold(2))return reject(source,'A tip costs two gold.');const s=next(),rumor=RUMORS[s.services.rumorsHeard++];s.party.resources.gold-=2;s.quests.notes.push('Tessa Bell: '+rumor);return withResult(s,`Tessa says: “${rumor}”`);}
  if(r.action==='deposit'||r.action==='withdraw'){
   const available=r.action==='deposit'?resources.gold:resources.bankGold;
   if(!integer(amount)||amount>available)return reject(source,`Choose a positive gold amount up to ${available}.`);
   const s=next();s.party.resources.gold+=(r.action==='deposit'?-amount:amount);s.party.resources.bankGold+=(r.action==='deposit'?amount:-amount);
   return withResult(s,`${r.action==='deposit'?'Deposited':'Withdrew'} ${amount} gold. Bank: ${s.party.resources.bankGold}.`);
  }
  if(r.action==='dismiss'){
   if(!active||p.order.length<=1||p.order.filter(x=>x!==id).every(x=>p.characters[x].hp===0))return reject(source,'At least one living adventurer must remain active.');
   const s=next();s.party.order=s.party.order.filter(x=>x!==id);if(s.party.selectedId===id)s.party.selectedId=s.party.order[0];return withResult(s,`${hero.name} waits at Tessa’s tavern with equipment and spells intact.`);
  }
  if(r.action==='recruit'){
   if(!hero||active||p.order.length>=6)return reject(source,'Choose a stored companion and ensure an active slot is free.');
   const s=next();s.party.order.push(id);return withResult(s,`${hero.name} rejoins the adventuring party.`);
  }
  if(r.action==='register'){
   if(!r.blueprint||Object.keys(p.characters).length>=ROSTER_LIMIT)return reject(source,`The tavern roster is full (${ROSTER_LIMIT} characters).`);
   if(needGold(RECRUIT_COST))return reject(source,`Registering a new companion costs ${RECRUIT_COST} gold.`);
   let blueprint:HeroBlueprint;try{blueprint=validateBlueprint(r.blueprint);}catch(error){return reject(source,error instanceof Error?error.message:'Invalid recruit.');}
   if(Object.values(p.characters).some(c=>c.name.toLocaleLowerCase()===blueprint.name.toLocaleLowerCase()))return reject(source,'Adventurer names must be unique.');
   const s=next(),newId=nextHeroId(s.party),c=makeHero(blueprint,newId);
   s.party.characters[newId]=c;s.magic.known[newId]=[...starterSpellsForClass(c.classId)];
   s.magic.readied[newId]=s.magic.known[newId][0]??null;s.magic.itemCurses[newId]=[];
   for(const slot of ['melee','ranged','body','offhand'] as const){const definitionId=c.equipment[slot];if(definitionId&&!giveItem(s.inventory,newId,definitionId,1,slot))return reject(source,'No space remains for the starter equipment.');}
   s.party.resources.gold-=RECRUIT_COST;
   return withResult(s,`${c.name} joins the tavern roster as a level 1 ${CLASSES[c.classId].name}. Recruit them into an open party slot when ready.`);
  }
  if(r.action==='rest'){
   if(needGold(6))return reject(source,'A room for the whole party costs six gold.');
   const s=next();s.party.resources.gold-=6;s.elapsedMinutes+=480;s.maps.map_town.minutes+=480;settleExpeditionTime(s);
   for(const hid of s.party.order){const h=s.party.characters[hid];if(h.hp){h.hp=derived(h).maxHP;h.sp=derived(h).maxSP;h.conditions=h.conditions.filter(c=>!['drunk','asleep','frightened','hungry'].includes(c.id));}}
   s.expedition.lastMealAtMinute=s.elapsedMinutes;return withResult(s,'An eight-hour stay at the Silver Lantern restores living heroes. No food spent.');
  }
  return reject(source,'Tessa offers food, drink, room, rumors, banking and roster management.');
 }
 if(npc.kind==='merchant'){
  if(r.action==='buy'){
   const def=r.definitionId&&ITEMS[r.definitionId];if(!def||!Object.hasOwn(SHOP_STOCK,def.id)||source.services.stock[def.id]<=0)return reject(source,'This item is not in stock.');
   if(!active||needGold(def.price))return reject(source,'Select an active buyer with enough carried gold.');
   const s=next();if(!giveItem(s.inventory,id,def.id))return reject(source,'The buyer’s bag is full.');s.party.resources.gold-=def.price;s.services.stock[def.id]--;return withResult(s,`Bought ${def.name} for ${def.price} gold (${s.services.stock[def.id]} remaining).`);
  }
  if(['sell','identify','repair'].includes(r.action)){
   const item=source.inventory.items.find(x=>x.id===r.itemId),def=item&&ITEMS[item.definitionId];
   if(!item||!def||!active||item.ownerId!==id)return reject(source,'Select an owned item.');
   if(r.action==='sell'){
    if(item.equipped)return reject(source,'Unequip the item before selling.');
    const gold=Math.max(1,Math.floor(def.price/2))*item.count;
    const s=next();s.inventory.items=s.inventory.items.filter(x=>x.id!==item.id);s.party.resources.gold+=gold;return withResult(s,`Sold ${def.name} for ${gold} gold.`);
   }
   if(r.action==='identify'){
    if(item.identified||needGold(10))return reject(source,'Identify requires an unknown item and ten gold.');
    const s=next();s.inventory.items.find(x=>x.id===item.id)!.identified=true;s.party.resources.gold-=10;return withResult(s,`Identified ${def.name} for ten gold.`);
   }
   const cost=Math.max(1,Math.ceil(def.price*.2));if(def.maxDurability===0||item.durability>=def.maxDurability||needGold(cost))return reject(source,`Repair requires damaged gear and ${cost} carried gold.`);
   const s=next();s.inventory.items.find(x=>x.id===item.id)!.durability=def.maxDurability;s.party.resources.gold-=cost;return withResult(s,`Repaired ${def.name} for ${cost} gold.`);
  }
  return reject(source,'Orro buys, sells, identifies and repairs equipment.');
 }
 if(npc.kind==='temple'){
  if(!active||!hero)return reject(source,'Choose a member of the active party.');
  if(r.action==='donate'){
   if(needGold(10))return reject(source,'Donation costs ten gold.');
   if(source.magic.effects.some(e=>e.kind==='temple_blessing'&&e.expiresAtMinute!>source.elapsedMinutes))return reject(source,'The shrine blessing is already active.');
   const s=next();s.party.resources.gold-=10;s.magic.effects.push({kind:'temple_blessing',targetId:'party',expiresAtMinute:s.elapsedMinutes+60});return withResult(s,'Donated ten gold: +1 party Defense for sixty minutes.');
  }
  if(r.action==='revive'){
   const cost=50*hero.level;if(hero.hp!==0||needGold(cost))return reject(source,`Reviving ${hero.name} requires ${cost} gold and a dead hero.`);
   const s=next(),h=s.party.characters[id];s.party.resources.gold-=cost;h.hp=derived(h).maxHP;h.sp=0;return withResult(s,`${hero.name} returns to life with full HP and zero SP for ${cost} gold.`);
  }
  if(hero.hp<=0)return reject(source,'This hero is dead. Choose Revive.');
  if(r.action==='heal'){
   const missing=derived(hero).maxHP-hero.hp;if(missing<=0||needGold(missing))return reject(source,`Healing requires ${missing} gold for ${missing} missing HP.`);
   const s=next();s.party.resources.gold-=missing;s.party.characters[id]=heal(s.party.characters[id],missing);return withResult(s,`Healed ${hero.name} for ${missing} HP and ${missing} gold.`);
  }
  if(r.action==='cure'){
   const condition=r.condition??'poisoned';if(!['poisoned','asleep','frightened','drunk','hungry','cursed'].includes(condition)||!hero.conditions.some(c=>c.id===condition)||needGold(10))return reject(source,'Choose a present condition; cures cost ten gold each.');
   const s=next();s.party.characters[id].conditions=s.party.characters[id].conditions.filter(c=>c.id!==condition);s.party.resources.gold-=10;return withResult(s,`Removed ${condition} from ${hero.name} for ten gold.`);
  }
  if(r.action==='uncurse'){
   const cursed=source.magic.itemCurses[id]??[],bound=source.inventory.items.filter(i=>i.ownerId===id&&i.cursed);if(cursed.length===0&&bound.length===0||needGold(25))return reject(source,'No cursed equipment or insufficient gold (25).');
   const s=next();s.magic.itemCurses[id]=[];for(const item of s.inventory.items)if(item.ownerId===id)item.cursed=false;s.party.resources.gold-=25;return withResult(s,`Lifted the equipment curse from ${hero.name} for 25 gold.`);
  }
  return reject(source,'Sister Vale offers healing, curing, revival, uncursing and blessings.');
 }
 if(npc.kind==='trainer'){
  if(r.action!=='train'||!active||!hero)return reject(source,'Select an active adventurer to train.');
  return trainAdventurer(source,id,r.ability);
 }
 if(['wizard','priest','witch'].includes(npc.kind)){
  if(r.action!=='learn'||!active||!hero||hero.classId!==npc.kind)return reject(source,`This guild teaches ${npc.kind} magic to active ${npc.kind}s only.`);
  const spell=r.definitionId&&SPELLS[r.definitionId];if(!spell||spell.classId!==npc.kind||!spellAllowed(hero.classId,spell.id)||hero.level<spell.level||source.magic.known[id]?.includes(spell.id))return reject(source,'This spell is unknown, already learned, or above your current level.');
  const cost=15*spell.level;if(needGold(cost))return reject(source,`Learning ${spell.name} requires ${cost} gold.`);
  const s=next();s.party.resources.gold-=cost;s.magic.known[id].push(spell.id);return withResult(s,`${hero.name} learns ${spell.name} for ${cost} gold.`);
 }
 return reject(source,'Unknown service.');
}
