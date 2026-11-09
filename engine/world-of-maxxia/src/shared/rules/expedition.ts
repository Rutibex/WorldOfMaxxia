import {revealBySearch} from './perception.ts';
import {edgeBlocked} from '../project/terrain-contracts.ts';
import {terrainEntryPlan} from './terrain.ts';
import {packCondition} from '../content/effect-definitions.ts';
import {settleUnifiedTime} from './effects.ts';
import {bestThief,stealBonus,chestDC,hiddenCache} from './thievery.ts';
import {LOOT_CACHES} from './inventory.ts';
import {nearbyService} from './services.ts';
/** Phase 14 deterministic expedition actions; all commands are atomic and return a new state. */
import type {CampaignState,MapRegistry} from './campaign.ts';
import {DIRECTIONS,doorAt,isOpaque,canCross,applyGridAction,type GridAction,type GridMap,type GridState} from './grid.ts';
import {derived,damage,modifier,type Character} from './party.ts';
import {SeededRng} from './rng.ts';
import {currentEnemies} from './combat.ts';
import {expireMagic} from './magic.ts';

export interface ExpeditionState {
 settledAtMinute:number;lastMealAtMinute:number;triggeredTraps:string[];fountainDays:Record<string,number>;
}
export const initialExpedition=():ExpeditionState=>({settledAtMinute:0,lastMealAtMinute:0,triggeredTraps:[],fountainDays:{}});
export interface ExpeditionResult{state:CampaignState;changed:boolean;message:string;moved?:boolean;}
const no=(s:CampaignState,message:string):ExpeditionResult=>({state:s,changed:false,message});
export const expeditionDay=(minutes:number):number=>Math.floor((480+minutes)/1440)+1;
const key=(mapId:string,id:string)=>`${mapId}:${id}`;
const nextRng=(s:CampaignState)=>{const rng=new SeededRng(1);rng.restore(s.rng);return rng;};
const saveRoll=(s:CampaignState,rng:SeededRng)=>{s.rng=rng.snapshot();s.rollCount++;};
/** Settle *only* unprocessed elapsed time; safe to call on every loaded or new state. */
export function settleExpeditionTime(s:CampaignState):void {
 const ticks=s.elapsedMinutes-s.expedition.settledAtMinute;
 if(ticks<=0)return;
 settleUnifiedTime(s);
 for(const id of s.party.order){const c=s.party.characters[id];const conditions=c.conditions.flatMap(condition=>{
  if(packCondition(condition.id)||condition.remaining===null||!['minutes','ticks'].includes(condition.unit))return [condition];
  const amount=condition.unit==='minutes'?ticks:Math.min(ticks,condition.remaining);
  if(condition.id==='poisoned'&&c.hp>0)c.hp=Math.max(0,c.hp-Math.min(3,amount));
  const remaining=condition.remaining-amount;return remaining>0?[{...condition,remaining}]:[];
 });c.conditions=conditions;
 if(s.elapsedMinutes-s.expedition.lastMealAtMinute>=1440&&c.hp>0&&!c.conditions.some(v=>v.id==='hungry'))c.conditions.push({id:'hungry',remaining:null,unit:'persistent'});
 }
 if(!s.combat.active&&s.party.order.every(id=>s.party.characters[id].hp===0))s.combat.defeated=true;
 s.expedition.settledAtMinute=s.elapsedMinutes;
 expireMagic(s);
}
export function validateExpedition(value:unknown,s:CampaignState,registry:MapRegistry):ExpeditionState {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid expedition state.');
 const v=value as ExpeditionState;
 if(!Number.isSafeInteger(v.settledAtMinute)||v.settledAtMinute<0||v.settledAtMinute>s.elapsedMinutes||!Number.isSafeInteger(v.lastMealAtMinute)||v.lastMealAtMinute<0||v.lastMealAtMinute>s.elapsedMinutes)throw new TypeError('Invalid expedition clock.');
 if(!Array.isArray(v.triggeredTraps)||v.triggeredTraps.length>512||new Set(v.triggeredTraps).size!==v.triggeredTraps.length||!v.fountainDays||typeof v.fountainDays!=='object'||Array.isArray(v.fountainDays)||Object.keys(v.fountainDays).length>256)throw new TypeError('Invalid expedition events.');
 const traps=new Set(Object.values(registry).flatMap(m=>(m.traps??[]).map(t=>key(m.id,t.id))));
 const fountains=new Set(Object.values(registry).flatMap(m=>(m.fountains??[]).map(f=>key(m.id,f.id))));
 if(v.triggeredTraps.some(x=>typeof x!=='string'||!traps.has(x)))throw new TypeError('Unknown triggered trap.');
 for(const [id,day] of Object.entries(v.fountainDays))if(!fountains.has(id)||!Number.isSafeInteger(day)||day<1||day>expeditionDay(s.elapsedMinutes))throw new TypeError('Invalid fountain use.');
 return v;
}
function spendMinute(s:CampaignState){s.elapsedMinutes++;s.maps[s.currentMapId].minutes++;settleExpeditionTime(s);}
function engaged(s:CampaignState){return !!s.combat.active||!!s.combat.defeated;}
function living(s:CampaignState):Character[]{return s.party.order.map(id=>s.party.characters[id]).filter(c=>c.hp>0);}
function reach(map:GridMap,world:GridState,x:number,y:number):boolean {
 if(x===world.x&&y===world.y)return true;
 const d=DIRECTIONS[world.facing];return x===world.x+d.x&&y===world.y+d.y&&canCross(map,world,world.x,world.y,x,y);
}
/** 8 hours, one food portion per active member, only when no enemy watches the party. */
export function campError(source:CampaignState):string|null {
 if(engaged(source))return 'Cannot rest during an encounter or defeat.';
 const w=source.maps[source.currentMapId];
 if(currentEnemies(source).some(e=>Math.abs(e.x-w.x)+Math.abs(e.y-w.y)<=3))return 'Rest is unsafe while nearby monsters are alert.';
 if(living(source).length===0)return 'No conscious hero can prepare camp.';
 const foodNeeded=source.party.order.length;
 if(source.party.resources.food<foodNeeded)return `Rest needs ${foodNeeded} food portions; only ${source.party.resources.food} remain.`;
 return null;
}
import {recoverRestAbilities} from './abilities.ts';
export function restExpedition(source:CampaignState,registry:MapRegistry):ExpeditionResult {
 const problem=campError(source);if(problem)return no(source,problem);const w=source.maps[source.currentMapId],map=registry[source.currentMapId],foodNeeded=source.party.order.length;
 const s=structuredClone(source);s.party.resources.food-=foodNeeded;s.elapsedMinutes+=480;s.maps[s.currentMapId].minutes+=480;
 settleExpeditionTime(s);
 for(const id of s.party.order){const c=s.party.characters[id];if(c.hp<=0)continue;c.hp=derived(c).maxHP;c.sp=derived(c).maxSP;c.conditions=c.conditions.filter(cond=>!['asleep','frightened','drunk','hungry'].includes(cond.id));}
 recoverRestAbilities(s);
 s.expedition.lastMealAtMinute=s.elapsedMinutes;
 return {state:s,changed:true,message:`The party rests for eight hours in ${map.name}. ${foodNeeded} food consumed; living heroes recover HP and SP. Magical effects expire with time.`};
}
/** Deliberate field work costs supplies and advances the same clock as camping. */
function fieldError(s:CampaignState):string|null {if(engaged(s))return 'Unavailable during combat or defeat.';if(!bestThief(s))return 'No conscious adventurer can act.';if(s.party.resources.food<1)return 'This attempt needs 1 food portion.';return null;}
function spendWork(s:CampaignState,minutes:number):void{s.party.resources.food--;s.elapsedMinutes+=minutes;s.maps[s.currentMapId].minutes+=minutes;settleExpeditionTime(s);}
function reachableCache(s:CampaignState,registry:MapRegistry){const m=registry[s.currentMapId],w=s.maps[s.currentMapId],d=DIRECTIONS[w.facing];return LOOT_CACHES.find(c=>c.mapId===m.id&&!s.inventory.claimed.includes(c.id)&&(!hiddenCache(c.id)||s.thievery.discovered.includes(c.id))&&((c.x===w.x&&c.y===w.y)||(c.x===w.x+d.x&&c.y===w.y+d.y&&!isOpaque(m,w,c.x,c.y))));}
export function lockpickExpedition(source:CampaignState,registry:MapRegistry):ExpeditionResult {
 const boundaryMap=registry[source.currentMapId],boundaryWorld=source.maps[source.currentMapId],direction=DIRECTIONS[boundaryWorld.facing];if(edgeBlocked(boundaryMap,boundaryWorld,boundaryWorld.x,boundaryWorld.y,boundaryWorld.x+direction.x,boundaryWorld.y+direction.y))return no(source,'A closed boundary blocks this field action.');
 const problem=fieldError(source);if(problem)return no(source,problem);
 const m=registry[source.currentMapId],w=source.maps[m.id],d=DIRECTIONS[w.facing],x=w.x+d.x,y=w.y+d.y,door=doorAt(m,x,y),chest=reachableCache(source,registry),hero=bestThief(source)!;
 if(door&&!w.doors[door.id]&&door.questLocked)return no(source,'This quest seal requires its story key or mechanism.');
 const lock=door&&!w.doors[door.id]?{id:door.id,dc:door.lockDC??10,door:true}:chest&&chestDC(chest.id)&&!source.thievery.unlocked.includes(chest.id)?{id:chest.id,dc:chestDC(chest.id),door:false}:null;
 const npc=nearbyService(source,registry),enemy=currentEnemies(source).find(e=>e.x===x&&e.y===y&&!isOpaque(m,w,x,y));
 if(!lock&&!npc&&!enemy)return no(source,'Face a locked door, chest, NPC or monster to use Pick Lock / Pickpocket.');
 const target=npc?.id??enemy?.id;if(!lock&&target&&source.thievery.stolen.includes(target))return no(source,'Already stolen: this target has no bonus item left.');
 const s=structuredClone(source),rng=nextRng(s);let message='';
 if(lock){const roll=rng.integer(1,20),bonus=modifier(derived(hero).attributes.DEX);saveRoll(s,rng);if(roll+bonus>=lock.dc){if(lock.door)s.maps[m.id].doors[lock.id]=true;else s.thievery.unlocked.push(lock.id);message=`${hero.name} picks the ${lock.door?'door':'chest'} lock`; }else message=`${hero.name} fails to pick the lock`;message+=` (d20 ${roll} ${bonus>=0?'+':''}${bonus} vs DC ${lock.dc}).`;}
 else {message=stealBonus(s,rng,hero,target!,enemy?.kindId??'npc',12);s.rng=rng.snapshot();}
 spendWork(s,10);return {state:s,changed:true,message:message+' 10 minutes and 1 food consumed.'};
}
export function searchExpedition(source:CampaignState,registry:MapRegistry):ExpeditionResult {
 const problem=fieldError(source);if(problem)return no(source,problem);
 const s=structuredClone(source),m=registry[s.currentMapId],w=s.maps[m.id],found:string[]=[];
 found.push(...revealBySearch(m,w));
 // Include all eight surrounding cells, but do not search through sealed doors or corners.
 const near=(x:number,y:number)=>!edgeBlocked(m,w,w.x,w.y,x,y)&&Math.max(Math.abs(x-w.x),Math.abs(y-w.y))<=1&&(x===w.x||y===w.y||(!edgeBlocked(m,w,w.x,w.y,x,w.y)&&!edgeBlocked(m,w,w.x,w.y,w.x,y)&&!edgeBlocked(m,w,x,w.y,x,y)&&!edgeBlocked(m,w,w.x,y,x,y)&&!isOpaque(m,w,x,w.y)&&!isOpaque(m,w,w.x,y)));
 for(const secret of m.secrets??[])if(near(secret.x,secret.y)&&!w.secrets[secret.id]){w.secrets[secret.id]=true;found.push('Secret passage: '+secret.description);}
 for(const cache of LOOT_CACHES)if(cache.mapId===m.id&&near(cache.x,cache.y)&&!isOpaque(m,w,cache.x,cache.y)&&!s.inventory.claimed.includes(cache.id)&&!s.thievery.discovered.includes(cache.id)){s.thievery.discovered.push(cache.id);found.push('Treasure chest discovered'+(chestDC(cache.id)?' (locked)':'')+'.');}
 for(const trap of m.traps??[])if(near(trap.x,trap.y)&&!isOpaque(m,w,trap.x,trap.y)){const id=`trap:${m.id}:${trap.id}`;if(!s.expedition.triggeredTraps.includes(key(m.id,trap.id))&&!s.thievery.discovered.includes(id)){s.thievery.discovered.push(id);found.push('Trap spotted: '+trap.description+' Face it and interact to disarm.');}}
 spendWork(s,10);return {state:s,changed:true,message:(found.join(' ')||'A careful search finds nothing new.')+' 10 minutes and 1 food consumed.'};
}
/** Force a suitable lock, risking every hero and the chest contents on every attempt. */
export function bashExpedition(source:CampaignState,registry:MapRegistry):ExpeditionResult {
 const boundaryMap=registry[source.currentMapId],boundaryWorld=source.maps[source.currentMapId],direction=DIRECTIONS[boundaryWorld.facing];if(edgeBlocked(boundaryMap,boundaryWorld,boundaryWorld.x,boundaryWorld.y,boundaryWorld.x+direction.x,boundaryWorld.y+direction.y))return no(source,'A closed boundary blocks this field action.');
 const problem=fieldError(source);if(problem)return no(source,problem);
 const m=registry[source.currentMapId],w=source.maps[m.id],d=DIRECTIONS[w.facing],door=doorAt(m,w.x+d.x,w.y+d.y),chest=reachableCache(source,registry);
 if(door?.questLocked&&!w.doors[door.id])return no(source,'A quest seal cannot be smashed open.');
 const lock=door&&!w.doors[door.id]?{id:door.id,dc:door.lockDC??10,door:true}:chest&&chestDC(chest.id)&&!source.thievery.unlocked.includes(chest.id)?{id:chest.id,dc:chestDC(chest.id),door:false}:null;
 if(!lock)return no(source,'Face a locked chest or closed door to bash.');
 const s=structuredClone(source),rng=nextRng(s),roll=rng.integer(1,20),might=living(s).slice(0,2).reduce((v,c)=>v+modifier(derived(c).attributes.STR),0);s.rollCount++;
 const success=roll+might>=lock.dc;let broken=false;
 if(!lock.door&&!s.thievery.bashed.includes(lock.id)){s.rollCount++;if(rng.integer(1,100)<=50){s.thievery.bashed.push(lock.id);broken=true;}}
 // A damaged chest stays damaged even when an initial attempt fails.
 if(success){if(lock.door)s.maps[m.id].doors[lock.id]=true;else s.thievery.unlocked.push(lock.id);}
 for(const c of living(s))c.hp=Math.max(0,c.hp-1);
 s.rng=rng.snapshot();spendWork(s,5);
 return {state:s,changed:true,message:`Bashing ${success?'succeeds':'fails'} (d20 ${roll} ${might>=0?'+':''}${might} vs DC ${lock.dc}). Every conscious hero suffers 1 HP.${broken?' One chest item is destroyed.':''} 5 minutes and 1 food consumed.`};
}
/** Inspect a face-on concealed doorway, trap or fountain; otherwise caller uses ordinary Space interaction. */
export function interactExpedition(source:CampaignState,registry:MapRegistry):ExpeditionResult|null {
 if(engaged(source))return null;
 const map=registry[source.currentMapId],w=source.maps[source.currentMapId],d=DIRECTIONS[w.facing],x=w.x+d.x,y=w.y+d.y;
 if(edgeBlocked(map,w,w.x,w.y,x,y))return null;
 const secret=map.secrets?.find(o=>o.x===x&&o.y===y);
 if(secret){if(w.secrets[secret.id])return null;
  const s=structuredClone(source);s.maps[s.currentMapId].secrets[secret.id]=true;spendMinute(s);
  return {state:s,changed:true,message:`Secret found: ${secret.description}`};
 }
 const trap=map.traps?.find(o=>o.x===x&&o.y===y);
 if(trap&&!source.expedition.triggeredTraps.includes(key(map.id,trap.id))){
  if(isOpaque(map,w,x,y))return null;
  const s=structuredClone(source),rng=nextRng(s),leader=living(s)[0];if(!leader)return no(source,'No one can search for traps.');
  const score=rng.integer(1,20)+modifier(derived(leader).attributes.DEX);saveRoll(s,rng);spendMinute(s);
  if(score>=trap.dc){s.expedition.triggeredTraps.push(key(map.id,trap.id));return {state:s,changed:true,message:`${leader.name} disarms a concealed trap (DC ${trap.dc}).`};}
  return {state:s,changed:true,message:`A suspicious mechanism resists disarming (DC ${trap.dc}).`};
 }
 const fountain=map.fountains?.find(o=>reach(map,w,o.x,o.y));
 if(fountain){const today=expeditionDay(source.elapsedMinutes),id=key(map.id,fountain.id),oneUse=id==='map_town:town_well_spring';
  if(oneUse&&source.expedition.fountainDays[id]!==undefined)return no(source,`${fountain.name} has already granted its one blessing this adventure.`);
  if(!oneUse&&source.expedition.fountainDays[id]===today)return no(source,`${fountain.name} has already granted its blessing today.`);
  if(!living(source).some(c=>c.hp<derived(c).maxHP||c.sp<derived(c).maxSP))return no(source,`${fountain.name} shimmers, but everyone is already restored.`);
  const s=structuredClone(source);s.expedition.fountainDays[id]=today;spendMinute(s);
  for(const c of living(s)){c.hp=Math.min(derived(c).maxHP,oneUse?derived(c).maxHP:c.hp+fountain.heal);c.sp=Math.min(derived(c).maxSP,oneUse?derived(c).maxSP:c.sp+fountain.sp);}
  return {state:s,changed:true,message:oneUse?`${fountain.name} fully restores every living party member. Its one blessing is spent.`:`${fountain.name} restores up to ${fountain.heal} HP and ${fountain.sp} SP to each living hero. Once per day.`};
 }
 return null;
}
/** Successful movement can trigger an undisarmed trap once; does not rewrite the grid geometry. */
export function moveExpedition(source:CampaignState,registry:MapRegistry,action:GridAction):ExpeditionResult {
 const map=registry[source.currentMapId],w=source.maps[source.currentMapId];
 if(engaged(source))return no(source,'Cannot explore during combat.');
 const result=applyGridAction(map,w,action);if(!result.changed)return no(source,result.message);
 const plan=result.moved&&map.terrain?terrainEntryPlan(map,result.state,currentEnemies(source)):{cells:result.moved?[{x:result.state.x,y:result.state.y}]:[],minutes:0,damage:0,messages:[],facing:undefined};
 const s=structuredClone(source);s.maps[s.currentMapId]=result.state;s.elapsedMinutes+=result.state.minutes-w.minutes+plan.minutes;s.maps[map.id].minutes+=plan.minutes;
 if(result.moved){for(const p of plan.cells){const key=p.x+','+p.y;if(!s.maps[map.id].visited.includes(key))s.maps[map.id].visited.push(key);}const last=plan.cells.at(-1)!;Object.assign(s.maps[map.id],last);if(plan.facing!==undefined)s.maps[map.id].facing=plan.facing;}
 for(const c of living(s))c.hp=Math.max(0,c.hp-plan.damage);
 settleExpeditionTime(s);
 let message=[result.message,...plan.messages,...(plan.damage?[`Each conscious hero suffers ${plan.damage} terrain damage.`]:[])].join(' ');
 for(const entered of plan.cells){const trap=map.traps?.find(t=>t.x===entered.x&&t.y===entered.y);
  if(trap&&!s.expedition.triggeredTraps.includes(key(map.id,trap.id))){
   s.expedition.triggeredTraps.push(key(map.id,trap.id));const hero=living(s)[0];
   if(hero){const rng=nextRng(s),roll=rng.integer(1,20),bonus=modifier(derived(hero).attributes.DEX);saveRoll(s,rng);
    const dealt=roll+bonus>=trap.dc?Math.ceil(trap.damage/2):trap.damage;hero.hp=Math.max(0,hero.hp-dealt);
    message+=` TRAP! ${trap.description} ${hero.name} takes ${dealt} damage (${roll+bonus>=trap.dc?'save':'failed save'}).`;
   }
  }
 }
 if(!s.combat.active&&s.party.order.every(id=>s.party.characters[id].hp===0)){s.combat.defeated=true;message+=' The party has fallen! Recover in town or load a save.';}
 return {state:s,changed:true,moved:result.moved,message};
}
export function expeditionMapSymbols(s:CampaignState,map:GridMap):{x:number;y:number;symbol:string;label:string}[]{
 const w=s.maps[map.id],seen=new Set(w.visited);
 return [
  ...LOOT_CACHES.filter(c=>c.mapId===map.id&&s.thievery.discovered.includes(c.id)&&!s.inventory.claimed.includes(c.id)).map(c=>({x:c.x,y:c.y,symbol:'C',label:'Discovered treasure chest'})),
  ...(map.fountains??[]).filter(f=>seen.has(`${f.x},${f.y}`)).map(f=>({x:f.x,y:f.y,symbol:'✦',label:f.name})),
  ...(map.traps??[]).filter(t=>(s.expedition.triggeredTraps.includes(key(map.id,t.id))||s.thievery.discovered.includes(`trap:${map.id}:${t.id}`))).map(t=>({x:t.x,y:t.y,symbol:'!',label:'Discovered trap'})),
  ...(map.secrets??[]).filter(t=>w.secrets[t.id]).map(t=>({x:t.x,y:t.y,symbol:'S',label:'Found passage'}))
 ];
}
