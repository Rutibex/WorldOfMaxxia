import {withEffectRng} from './effects.ts';
import {advanceAbilityRound} from './abilities.ts';
import {validateAuthoredCondition,conditionModifier,conditionResistance} from './condition-effects.ts';
import type {Condition} from './party.ts';
import {authoredEncounterForSeed} from '../content/encounter-director.ts';
import {progression,milestone} from '../content/progression.ts';
import {hasTrait} from '../content/classes.ts';
import {stealBonus} from './thievery.ts';
import {emitPresentation,takePresentation,type PresentationEvent} from './presentation.ts';
/** Phase 7: deterministic, map-bound fast encounters. No tactical battle scene. */
import {edgeBlocked,terrainEverFloor,terrainCell,terrainTransportSafe} from '../project/terrain-contracts.ts';
import {DIRECTIONS,isOpaque,canCross,tileAt,type GridMap} from './grid.ts';
import {derived,modifier,damage,updateMember,type Character} from './party.ts';
import {rewardLoot,wearEquipped} from './inventory.ts';
import {SeededRng} from './rng.ts';
import {strikeProfile} from './noncaster.ts';
import {checkCast,applyCast,expireMagic,enemyAttackPenalty,enemyDefensePenalty,specialAttackSuppressed,thornMantleActive,enemyFinishedTurn,consumeBinding,breakBinding,partyDefenseBonus,partyAttackBonus,finishCombatRound,enemyIsFrightened,mitigateArcane,type CastRequest} from './magic.ts';
import type {CampaignState,MapRegistry,TravelMap} from './campaign.ts';

import {MONSTERS,pickMonsterAbility,monsterDamageAfterResistance,type MonsterDefinition,type MonsterBehaviorRule} from '../content/monsters.ts';
import {ENCOUNTER_SEEDS,ENCOUNTER_PLACEMENTS} from '../content/encounters.ts';
export {ENCOUNTER_SEEDS} from '../content/encounters.ts';
export type EnemyKind=MonsterDefinition;
export const ENEMY_KINDS=MONSTERS;
export interface EnemyState {conditions?:Condition[];id:string;kindId:string;x:number;y:number;hp:number;phase?:number;guardUntilRound?:number;behaviorUses?:Record<string,number>;summoned?:{ownerId:string;expiresAtRound:number};}
/** Summoned companions are encounter-scoped assists, not extra initiative actors or roster members. */
export interface CompanionState {id:string;kindId:string;ownerId:string;hp:number;encounterId:string;expiresAtRound:number;lastActedRound:number;}

export interface EncounterState {phase?:number;id:string;mapId:string;enemies:EnemyState[];cleared:boolean;rewarded:boolean;}
export interface ActiveCombat {encounterId:string;turnOrder:string[];turnIndex:number;round:number;targetId:string|null;guarding:string[];}
export interface CombatState {encounters:Record<string,EncounterState>;active:ActiveCombat|null;defeated:boolean;companions?:CompanionState[];}
export function initialCombatState(registry?:MapRegistry):CombatState{return {companions:[],encounters:Object.fromEntries(ENCOUNTER_SEEDS.filter(e=>!registry||Object.hasOwn(registry,e.mapId)).map(e=>[e.id,{id:e.id,mapId:e.mapId,enemies:e.enemies.map(v=>({...v,hp:e.authored?0:ENEMY_KINDS[v.kindId].hp})),cleared:!!e.authored,rewarded:!!e.authored}])),active:null,defeated:false};}
const dist=(x:number,y:number,a:number,b:number)=>Math.abs(x-a)+Math.abs(y-b);
function living(e:EncounterState){return e.enemies.filter(v=>v.hp>0);}
function primaryLiving(e:EncounterState){return e.enemies.filter(v=>v.hp>0&&!v.summoned);}
function encounterForEnemy(state:CampaignState,enemyId:string):EncounterState|undefined{return Object.values(state.combat.encounters).find(e=>e.enemies.some(v=>v.id===enemyId));}
export function currentEnemies(s:CampaignState):EnemyState[]{return Object.values(s.combat.encounters).filter(e=>e.mapId===s.currentMapId).flatMap(living);}
export function closeEncounter(s:CampaignState):EncounterState|null {
 const {x,y}=s.maps[s.currentMapId];return Object.values(s.combat.encounters).find(e=>e.mapId===s.currentMapId&&!authoredEncounterForSeed(e.id)&&living(e).some(v=>dist(x,y,v.x,v.y)<=(ENCOUNTER_PLACEMENTS[e.id]?.triggerRange??1)))??null;
}
export function activeActor(s:CampaignState):string|null {const c=s.combat.active;return c?.turnOrder[c.turnIndex]??null;}
export function combatTargets(s:CampaignState):EnemyState[]{if(!s.combat.active)return [];return living(s.combat.encounters[s.combat.active.encounterId]).slice(0,3);}
function seedRoll(rng:SeededRng,s:CampaignState,min:number,max:number){s.rollCount++;return rng.integer(min,max);}
function dice(expression:string,rng:SeededRng,s:CampaignState):number {
 const m=/^(\d+)d(\d+)$/.exec(expression);if(!m)return Number(expression)||1;
 let total=0;for(let i=0;i<Number(m[1]);i++)total+=seedRoll(rng,s,1,Number(m[2]));return total;
}
function pathStep(map:GridMap,s:CampaignState,enemy:EnemyState,all:EnemyState[]):{x:number;y:number}|null {
 const goal=s.maps[s.currentMapId],start=`${enemy.x},${enemy.y}`,seen=new Set([start]),queue=[{x:enemy.x,y:enemy.y,first:null as {x:number;y:number}|null}];
 for(let head=0;head<queue.length&&head<4096;head++){
  const node=queue[head];for(const d of DIRECTIONS){const x=node.x+d.x,y=node.y+d.y,key=`${x},${y}`;if(seen.has(key))continue;seen.add(key);
   if(!canCross(map,goal,node.x,node.y,x,y)||!terrainTransportSafe(map,goal,x,y))continue;
   if(x===goal.x&&y===goal.y)return node.first??null;
   if(isOpaque(map,goal,x,y)||all.some(v=>v.id!==enemy.id&&v.hp>0&&v.x===x&&v.y===y))continue;
   queue.push({x,y,first:node.first??{x,y}});
  }
 }
 return null;
}
function rewardIfClear(s:CampaignState,e:EncounterState,lines:string[]):void{
 const definition=authoredEncounterForSeed(e.id);
 if(definition){
  if(primaryLiving(e).length)return;
  const next=(e.phase??0)+1;
  if(next<definition.phases.length){e.enemies=e.enemies.filter(enemy=>!enemy.summoned);e.phase=next;for(const enemy of e.enemies)enemy.hp=Math.max(1,Math.floor(ENEMY_KINDS[enemy.kindId].hp*definition.phases[next].healthPercent/100));lines.push('Boss phase: '+definition.phases[next].title);return;}
 }
 e.enemies=e.enemies.filter(enemy=>!enemy.summoned);
 const loot=rewardLoot(s,e.id);if(loot)lines.push(loot);
 if(primaryLiving(e).length)return;
 e.cleared=true;expireMagic(s);
 if(!e.rewarded){e.rewarded=true;const xp=e.enemies.filter(v=>!v.summoned).reduce((a,v)=>a+ENEMY_KINDS[v.kindId].xp,0),gold=e.enemies.filter(v=>!v.summoned).reduce((a,v)=>a+ENEMY_KINDS[v.kindId].gold,0);
  const heroes=s.party.order.filter(id=>s.party.characters[id].hp>0);
  for(const id of heroes){const c=s.party.characters[id];s.party=updateMember(s.party,{...c,xp:c.xp+xp});}
  lines.push(`Victory! ${xp} XP per surviving adventurer. Loot and gold remain on the corpses.`);
 }
 if(s.combat.active?.encounterId===e.id){s.combat.active=null;s.combat.companions=[];}
}
/** MP22 shared auto-assist: at most two friends, one bounded strike each per owner's ordinary turn. */
function friendlySupport(s:CampaignState,rng:SeededRng,lines:string[],ownerId:string):void{
 const a=s.combat.active;if(!a)return;const e=s.combat.encounters[a.encounterId];
 for(const ally of (s.combat.companions??[]).filter(v=>v.encounterId===e.id&&v.ownerId===ownerId&&v.hp>0&&v.expiresAtRound>=a.round&&v.lastActedRound<a.round).slice(0,2)){
  ally.lastActedRound=a.round;const target=primaryLiving(e)[0];if(!target)break;const kind=MONSTERS[ally.kindId];
  if(seedRoll(rng,s,1,20)+kind.attack>=MONSTERS[target.kindId].defense){const amount=Math.max(1,dice(kind.damage,rng,s));target.hp=Math.max(0,target.hp-amount);lines.push(`${kind.name} assists ${s.party.characters[ownerId].name}, striking ${MONSTERS[target.kindId].name} for ${amount}.`);emitPresentation(s,{actorId:ally.id,targetIds:[target.id],family:'physical',hit:true});}
  else lines.push(`${kind.name} assists, but misses.`);
 }
 rewardIfClear(s,e,lines);
}
/** Enemy summons are targetable but grant neither extra turns nor additional loot. */
function enemySupport(s:CampaignState,rng:SeededRng,lines:string[],owner:EnemyState):void{
 const a=s.combat.active;if(!a||owner.hp<=0)return;const e=s.combat.encounters[a.encounterId];
 for(const ally of e.enemies.filter(v=>v.hp>0&&v.summoned?.ownerId===owner.id&&v.summoned.expiresAtRound>=a.round).slice(0,2)){
  const kind=MONSTERS[ally.kindId],targets=s.party.order.filter(id=>s.party.characters[id].hp>0);if(!targets.length)break;
  const hero=s.party.characters[targets[seedRoll(rng,s,0,targets.length-1)]];
  if(seedRoll(rng,s,1,20)+kind.attack<derived(hero).defense){lines.push(`${kind.name} assists ${MONSTERS[owner.kindId].name} but misses ${hero.name}.`);continue;}
  const amount=Math.max(0,Math.ceil(dice(kind.damage,rng,s)*(100-derived(hero).resistances.physical)/100));s.party=updateMember(s.party,damage(hero,amount));lines.push(`${kind.name} supports ${MONSTERS[owner.kindId].name}, hitting ${hero.name} for ${amount}.`);emitPresentation(s,{actorId:ally.id,targetIds:[hero.id],family:'physical',hit:true});
 }
}
function expireSupport(s:CampaignState):void{
 const a=s.combat.active;if(!a)return;const e=s.combat.encounters[a.encounterId];
 const aliveOwners=new Set(e.enemies.filter(v=>v.hp>0&&!v.summoned).map(v=>v.id));
 e.enemies=e.enemies.filter(v=>!v.summoned||(v.hp>0&&v.summoned.expiresAtRound>=a.round&&aliveOwners.has(v.summoned.ownerId)));
 s.combat.companions=(s.combat.companions??[]).filter(v=>v.hp>0&&v.encounterId===e.id&&v.expiresAtRound>=a.round&&s.party.characters[v.ownerId]?.hp>0);
 if(a.targetId&&!e.enemies.some(v=>v.id===a.targetId&&v.hp>0))a.targetId=primaryLiving(e)[0]?.id??null;
}

function nextTurn(s:CampaignState,rng?:SeededRng,lines?:string[]):void{
 const a=s.combat.active;if(!a)return;
 const actor=a.turnOrder[a.turnIndex];if(rng&&lines&&actor?.startsWith('hero_'))friendlySupport(s,rng,lines,actor);if(!s.combat.active)return;
 a.turnIndex++;if(a.turnIndex>=a.turnOrder.length){a.turnIndex=0;a.round++;advanceAbilityRound(s);finishCombatRound(s);expireSupport(s);}
}
function skipDead(s:CampaignState):void {
 const a=s.combat.active;if(!a)return;
 for(let n=0;n<a.turnOrder.length;n++){
  const id=activeActor(s);if(!id)break;
  if(id.startsWith('hero_')?s.party.characters[id]?.hp>0:encounterForEnemy(s,id)?.enemies.some(v=>v.id===id&&v.hp>0))break;
  nextTurn(s);
 }
}
function enemyTurn(s:CampaignState,map:GridMap,rng:SeededRng,lines:string[]):void{
 const a=s.combat.active;if(!a)return;
 const id=activeActor(s);if(!id||id.startsWith('hero_'))return;
 const e=encounterForEnemy(s,id),enemy=e?.enemies.find(v=>v.id===id);if(!enemy||enemy.hp<=0){nextTurn(s);return;}
 const kind=ENEMY_KINDS[enemy.kindId],pos=s.maps[s.currentMapId];
 if(enemy.summoned){nextTurn(s);return;} // Supports never receive their own full turns.
 // Health phases are stateful, signalled once, and may alter attack and defense within narrow bounds.
 if(kind.behavior?.phases){const percent=Math.ceil(100*enemy.hp/kind.hp);let phase=0;for(const threshold of kind.behavior.phases)if(percent<=threshold.atOrBelowPercent)phase++;
  if(phase>(enemy.phase??0)){enemy.phase=phase;lines.push(`${kind.name} shifts phase: ${kind.behavior.phases[phase-1].title}.`);}
 }
 const phaseBonus=kind.behavior?.phases?.[(enemy.phase??0)-1];
 if(kind.behavior){
  const distance=dist(pos.x,pos.y,enemy.x,enemy.y),uses=enemy.behaviorUses??{};
  const eligible=(r:MonsterBehaviorRule)=>r.when==='always'||r.when==='hurt'&&enemy.hp*2<kind.hp||r.when==='healthy'&&enemy.hp*2>=kind.hp||r.when==='adjacent'&&distance<=1||r.when==='distant'&&distance>1||r.when==='odd_round'&&a.round%2===1||r.when==='even_round'&&a.round%2===0;
  const rules=[...kind.behavior.rules].sort((x,y)=>y.priority-x.priority||x.id.localeCompare(y.id));
  for(const rule of rules){if(!eligible(rule))continue;
   if(rule.action==='summon'){
    if((uses[rule.id]??0)>=(rule.maxUses??0)||e!.enemies.filter(v=>v.summoned&&v.hp>0).length>=2||e!.enemies.some(v=>v.summoned?.ownerId===enemy.id&&v.hp>0))continue;
    const definition=MONSTERS[rule.kindId!];if(!definition)continue;
    const n=(uses[rule.id]??0)+1;enemy.behaviorUses={...uses,[rule.id]:n};
    e!.enemies.push({id:`${enemy.id}_summon_${rule.id}_${n}`,kindId:definition.id,x:enemy.x,y:enemy.y,hp:definition.hp,summoned:{ownerId:enemy.id,expiresAtRound:a.round+(rule.lifetimeRounds??1)-1}});
    lines.push(`${kind.name} summons ${definition.name} (support, ${rule.lifetimeRounds} rounds).`);enemyFinishedTurn(s,id);nextTurn(s);return;
   }
   if(rule.action==='heal'){if(enemy.hp>=kind.hp)continue;const before=enemy.hp;enemy.hp=Math.min(kind.hp,enemy.hp+(rule.amount??0));lines.push(`${kind.name} repairs ${enemy.hp-before} HP.`);enemySupport(s,rng,lines,enemy);enemyFinishedTurn(s,id);nextTurn(s);return;}
   if(rule.action==='guard'){enemy.guardUntilRound=a.round;lines.push(`${kind.name} braces behind its defenses.`);enemySupport(s,rng,lines,enemy);enemyFinishedTurn(s,id);nextTurn(s);return;}
   if(rule.action==='approach'){if(distance<=1)continue;const step=pathStep(map,s,enemy,currentEnemies(s));if(!step)continue;enemy.x=step.x;enemy.y=step.y;lines.push(`${kind.name} advances cautiously.`);enemySupport(s,rng,lines,enemy);enemyFinishedTurn(s,id);nextTurn(s);return;}
   if(rule.action==='strike'){if(distance>1)continue;break;}
  }
 }

 if(kind.aiPattern==='resonance'&&dist(pos.x,pos.y,enemy.x,enemy.y)<=2&&!specialAttackSuppressed(s,id)){
  // 1: visible warning; 2: resonant discharge (guardable); 0: recovery/vulnerability.
  if(a.round%3===1){lines.push('BELL-HEART TELEGRAPH — its brass ribs glow. A resonant discharge is coming; Block to brace!');enemyFinishedTurn(s,id);nextTurn(s);return;}
  if(a.round%3===2){
   lines.push('The Bell-Heart Custodian releases a thunderous resonant wave!');
   for(const heroId of s.party.order){const h=s.party.characters[heroId];if(h.hp<=0)continue;
    const guard=a.guarding.includes(heroId),raw=seedRoll(rng,s,2,7)+(guard?0:2),amount=Math.max(1,raw-(guard?4:0));s.party=updateMember(s.party,damage(h,amount));
    emitPresentation(s,{actorId:id,targetIds:[heroId],family:'arcane',hit:true,guarded:guard});
    lines.push(`${h.name} takes ${amount} resonance damage${guard?' (guarded)':''}.`);
   }
   a.guarding=[];enemyFinishedTurn(s,id);nextTurn(s);return;
  }
  lines.push('The Custodian cools and exposes its regulator core. Its defenses falter for one round.');enemyFinishedTurn(s,id);nextTurn(s);return;
 }
 if(edgeBlocked(map,pos,pos.x,pos.y,enemy.x,enemy.y)){lines.push(`${kind.name} cannot strike through the closed boundary.`);enemyFinishedTurn(s,id);nextTurn(s);return;}
 if(consumeBinding(s,id)){lines.push(`${kind.name} struggles against Binding Thread and loses its action.`);enemyFinishedTurn(s,id);nextTurn(s);return;}
 if(dist(pos.x,pos.y,enemy.x,enemy.y)>1){const step=pathStep(map,s,enemy,currentEnemies(s));if(step&&!enemyIsFrightened(s,id)){enemy.x=step.x;enemy.y=step.y;lines.push(`${kind.name} approaches.`);}else if(enemyIsFrightened(s,id))lines.push(`${kind.name} recoils in supernatural fear.`);else lines.push(`${kind.name} cannot reach the party.`);}
 else {const targets=s.party.order.filter(id=>s.party.characters[id].hp>0);
  if(targets.length){const targetId=targets[seedRoll(rng,s,0,targets.length-1)],target=s.party.characters[targetId],guard=a.guarding.includes(targetId),defense=derived(target).defense+partyDefenseBonus(s)+(guard?4:0),hit=seedRoll(rng,s,1,20)+kind.attack+(phaseBonus?.attackBonus??0)+conditionModifier(enemy.conditions??[],'attack')+enemyAttackPenalty(s,id)>=defense;
   if(hit){const ability=pickMonsterAbility(kind,a.round,enemy.hp,(min,max)=>seedRoll(rng,s,min,max));const spectral=ability.kind==='spectral'&&!specialAttackSuppressed(s,id);const raw=Math.max(1,dice(kind.damage,rng,s)+(phaseBonus?.damageBonus??0)+ability.bonusDamage*(spectral||ability.kind==='strike'?1:0)-(guard?2:0));const amount=spectral?mitigateArcane(s,raw,targetId):Math.max(0,Math.ceil(raw*(100-derived(target).resistances.physical)/100));s.party=updateMember(s.party,damage(target,amount));const worn=wearEquipped(s,targetId,'body');if(worn)lines.push(worn);lines.push(`${kind.name} hits ${target.name} for ${amount}${spectral?' arcane (spectral pulse)':''}${guard?' (guarded)':''}.`);
    emitPresentation(s,{actorId:id,targetIds:[targetId],family:spectral?'arcane':'physical',hit:true,guarded:guard});
    if(thornMantleActive(s)&&enemy.hp>0){enemy.hp=Math.max(0,enemy.hp-2);emitPresentation(s,{actorId:targetId,targetIds:[enemy.id],family:'physical',hit:true});lines.push(`Briar Mantle returns 2 physical damage to ${kind.name}.`);rewardIfClear(s,e!,lines);if(!s.combat.active)return;}
    if(hasTrait(target.classId,'thornhide')&&target.combatSetup.prepared==='carapace'&&milestone(target.level)){const reflected=progression().traitBonuses.thornhide.reflectAtMilestone;enemy.hp=Math.max(0,enemy.hp-reflected);emitPresentation(s,{actorId:targetId,targetIds:[enemy.id],family:'physical',hit:true});lines.push(`${target.name}'s thornhide cuts ${kind.name} for ${reflected}${enemy.hp===0?' — defeated':''}.`);rewardIfClear(s,e!,lines);if(!s.combat.active)return;}
   }else {emitPresentation(s,{actorId:id,targetIds:[targetId],family:'physical',hit:false,guarded:guard});lines.push(`${kind.name} misses ${target.name}${guard?' behind a guard':''}.`);}
   a.guarding=a.guarding.filter(v=>v!==targetId);
  }
 }
 enemySupport(s,rng,lines,enemy);enemyFinishedTurn(s,id);nextTurn(s);
}
function processEnemyTurns(s:CampaignState,registry:MapRegistry,rng:SeededRng,lines:string[]):void{
 for(let n=0;n<24&&s.combat.active;n++){
  skipDead(s);if(s.party.order.every(id=>s.party.characters[id].hp===0)){s.combat.defeated=true;s.combat.active=null;s.combat.companions=[];lines.push('The party has fallen! Recover in town or load a previous save.');break;}
  if(primaryLiving(s.combat.encounters[s.combat.active.encounterId]).length===0){rewardIfClear(s,s.combat.encounters[s.combat.active.encounterId],lines);break;}
  const actor=activeActor(s);if(actor?.startsWith('hero_')){s.party.selectedId=actor;break;}
  enemyTurn(s,registry[s.currentMapId],rng,lines);
 }
}
export interface CombatResult {state:CampaignState;messages:string[];changed:boolean;events?:PresentationEvent[];}
function mutate(source:CampaignState,fn:(s:CampaignState,rng:SeededRng,lines:string[])=>void):CombatResult {
 const s=structuredClone(source),rng=new SeededRng(1),lines:string[]=[];rng.restore(s.rng);withEffectRng(s,rng,()=>fn(s,rng,lines));s.rng=rng.snapshot();return {state:s,messages:lines,changed:lines.length>0,events:takePresentation(s)};
}
/** Starts when party and one enemy share adjacent cells, preserving the first-person view. */
function startInto(s:CampaignState,registry:MapRegistry,rng:SeededRng,lines:string[],encounterId:string):void{
  const e=s.combat.encounters[encounterId];const heroes=s.party.order.filter(id=>s.party.characters[id].hp>0),enemies=living(e).map(v=>v.id);
  if(!heroes.length){s.combat.defeated=true;lines.push('The party has fallen.');return;}
  const speed=(id:string)=>id.startsWith('hero_')?s.party.characters[id].attributes.DEX:ENEMY_KINDS[e.enemies.find(v=>v.id===id)!.kindId].speed;
  const initiative=[...heroes,...enemies].map(id=>({id,score:speed(id)+seedRoll(rng,s,1,6)})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  s.combat.companions=[];s.combat.active={encounterId:e.id,turnOrder:initiative.map(v=>v.id),turnIndex:0,round:1,targetId:enemies[0]??null,guarding:[]};
  lines.push(`Encounter! ${enemies.map(id=>ENEMY_KINDS[e.enemies.find(v=>v.id===id)!.kindId].name).join(' and ')}. Initiative rolled.`);
  processEnemyTurns(s,registry,rng,lines);
}
export function beginSpecificEncounter(source:CampaignState,registry:MapRegistry,id:string):CombatResult{
 if(source.combat.active||source.combat.defeated||!source.combat.encounters[id]||!living(source.combat.encounters[id]).length)return {state:source,messages:['Encounter is unavailable.'],changed:false};
 return mutate(source,(s,rng,lines)=>startInto(s,registry,rng,lines,id));
}
export function beginEncounter(source:CampaignState,registry:MapRegistry):CombatResult {
 if(source.combat.active||source.combat.defeated)return {state:source,messages:[],changed:false};
 const encounter=closeEncounter(source);if(!encounter)return {state:source,messages:[],changed:false};
 return mutate(source,(s,rng,lines)=>startInto(s,registry,rng,lines,encounter.id));
}
export function chooseTarget(source:CampaignState,id:string):CombatResult{
 const c=source.combat.active;if(!c||!combatTargets(source).some(v=>v.id===id))return {state:source,messages:['That target is unavailable.'],changed:false};
 const s=structuredClone(source);s.combat.active!.targetId=id;return {state:s,messages:[`Target: ${ENEMY_KINDS[encounterForEnemy(s,id)!.enemies.find(v=>v.id===id)!.kindId].name}.`],changed:true};
}
function attackHero(s:CampaignState,rng:SeededRng,hero:Character,enemy:EnemyState,range:'melee'|'ranged',lines:string[]):void {
 const kind=ENEMY_KINDS[enemy.kindId],p=strikeProfile(hero,range);
 const guarded=enemy.guardUntilRound!==undefined&&enemy.guardUntilRound>=s.combat.active!.round?2:0;
 const phaseDefense=kind.behavior?.phases?.[(enemy.phase??0)-1]?.defenseBonus??0;
 const exposed=kind.aiPattern==='resonance'&&s.combat.active?.round!%3===0?3:0;
 const hit=seedRoll(rng,s,1,20)+p.attackBonus+partyAttackBonus(s)>=kind.defense+phaseDefense+guarded+conditionModifier(enemy.conditions??[],'defense')+enemyDefensePenalty(s,enemy.id)-p.ignoreDefense-exposed;
 if(hit){const amount=monsterDamageAfterResistance(enemy.kindId,p.damageType??'physical',Math.max(1,dice(p.dice,rng,s)+p.damageBonus),conditionResistance(enemy.conditions??[],p.damageType??'physical'));enemy.hp=Math.max(0,enemy.hp-amount);if(amount)breakBinding(s,enemy.id);lines.push(`${hero.name} uses ${p.label} on ${kind.name} for ${amount}${p.damageType==='lightning'?' lightning':''} damage${enemy.hp===0?' — defeated':''}.`);}
 else lines.push(`${hero.name}'s ${p.label} misses ${kind.name}.`);
 emitPresentation(s,{actorId:hero.id,targetIds:[enemy.id],family:p.damageType??'physical',missile:range==='ranged',hit});
 const wear=wearEquipped(s,hero.id,range);if(wear)lines.push(wear);
}

export function combatAction(source:CampaignState,registry:MapRegistry,action:'attack'|'block'|'run'|'mug'):CombatResult {
 if(!source.combat.active||source.combat.defeated)return {state:source,messages:['There is no active combat.'],changed:false};
 const id=activeActor(source);if(!id?.startsWith('hero_'))return {state:source,messages:['Wait for your turn.'],changed:false};
 if(action==='run'&&source.combat.active.encounterId==='enc_bell_heart')return {state:source,messages:['The Bell-Heart seals its chamber. Retreat is impossible; defend or fight.'],changed:false};
 if(action==='attack'||action==='mug'){const target=combatTargets(source).find(v=>v.id===source.combat.active!.targetId)??combatTargets(source)[0];const pos=source.maps[source.currentMapId];if(!target||dist(pos.x,pos.y,target.x,target.y)>1||edgeBlocked(registry[source.currentMapId],pos,pos.x,pos.y,target.x,target.y))return {state:source,messages:['Target is out of melee reach. Wait for it to approach, or choose a closer enemy.'],changed:false};}
 return mutate(source,(s,rng,lines)=>{
  const a=s.combat.active!,hero=s.party.characters[id];
  if(action==='run'){
   if(seedRoll(rng,s,1,20)+modifier(hero.attributes.DEX)>=9){const map=registry[s.currentMapId],w=s.maps[s.currentMapId];const k=`${map.spawn.x},${map.spawn.y}`;s.maps[s.currentMapId]={...w,...map.spawn,visited:w.visited.includes(k)?w.visited:[...w.visited,k]};s.combat.active=null;s.combat.companions=[];s.combat.encounters[a.encounterId].enemies=s.combat.encounters[a.encounterId].enemies.filter(v=>!v.summoned);s.elapsedMinutes+=5;expireMagic(s);lines.push(`${hero.name} leads an escape. The party regroups at the area's entrance.`);return;}
   lines.push(`${hero.name} fails to escape.`);
  }
  if(action==='block'){a.guarding=[...new Set([...a.guarding,id])];lines.push(`${hero.name} blocks, raising defense by 4 until attacked.`);}
  if(action==='mug'){const target=combatTargets(s).find(v=>v.id===a.targetId)??combatTargets(s)[0];lines.push(stealBonus(s,rng,hero,target.id,target.kindId,10+Math.floor(ENEMY_KINDS[target.kindId].speed/3)));}
  if(action==='attack'){
   const target=combatTargets(s).find(v=>v.id===a.targetId)??combatTargets(s)[0];attackHero(s,rng,hero,target,'melee',lines);
   rewardIfClear(s,s.combat.encounters[a.encounterId],lines);
  }
  s.elapsedMinutes++;expireMagic(s);
  if(!s.combat.active)return;
  nextTurn(s,rng,lines);processEnemyTurns(s,registry,rng,lines);
 });
}
/** Commit one spell as the currently acting hero, then apply regular turn sequencing. */
export function castCombatSpell(source:CampaignState,registry:MapRegistry,request:CastRequest):CombatResult{
 const problem=checkCast(source,request,registry);
 if(problem)return {state:source,messages:[problem],changed:false};
 if(!source.combat.active)return {state:source,messages:['No encounter is active.'],changed:false};
 return mutate(source,(s,rng,lines)=>{
  lines.push(...applyCast(s,rng,request,registry));
  const enc=s.combat.encounters[s.combat.active!.encounterId];rewardIfClear(s,enc,lines);
  if(!s.combat.active)return;
  nextTurn(s,rng,lines);processEnemyTurns(s,registry,rng,lines);
 });
}
/** Quick Fight resolves at most one action per living party member, stopping on victory,
 * escape, defeat, or after every living hero has acted once. No SP or inventory is spent.
 * Invalid/out-of-range Attack safely falls back to Block rather than retrying forever.
 */
export function quickFight(source:CampaignState,registry:MapRegistry):CombatResult {
 if(!source.combat.active||source.combat.defeated)return {state:source,messages:['No active encounter to Quick Fight.'],changed:false};
 let s=source;const allMessages:string[]=[],allEvents:PresentationEvent[]=[],acted=new Set<string>();let changed=false;
 for(let step=0;step<source.party.order.length;step++){
  if(!s.combat.active||s.combat.defeated)break;
  const actor=activeActor(s);
  if(!actor?.startsWith('hero_')||acted.has(actor))break;
  const hero=s.party.characters[actor];if(!hero||hero.hp<=0)break;
  acted.add(actor);
  let choice=hero.combatSetup.quickAction;
  if(choice==='cast'){
   const spellId=s.magic.readied[actor];
   // Choose an injured ally for healing, otherwise the selected living enemy.
   const ally=s.party.order.map(id=>s.party.characters[id]).filter(c=>c.hp>0&&c.hp<derived(c).maxHP).sort((a,b)=>(a.hp/derived(a).maxHP)-(b.hp/derived(b).maxHP))[0];
   const ready=spellId?spellId:'';
   const targetId=['spell_priest_mend_flesh','spell_priest_cleanse_venom','spell_priest_break_malison'].includes(ready)?(ready==='spell_priest_mend_flesh'?ally?.id:s.party.order.find(id=>{const h=s.party.characters[id];return h.hp>0&&(ready==='spell_priest_cleanse_venom'?h.conditions.some(v=>v.id==='poisoned'):h.conditions.some(v=>v.id==='cursed')||s.magic.itemCurses[id]?.length);})):s.combat.active.targetId??combatTargets(s)[0]?.id;
   const request={casterId:actor,spellId,targetId};
   const invalid=checkCast(s,request,registry);
   if(!invalid){const result=castCombatSpell(s,registry,request);s=result.state;allMessages.push(...result.messages);allEvents.push(...(result.events??[]));changed=true;continue;}
   choice='block';allMessages.push(`${hero.name} cannot quick-cast (${invalid}); guards instead.`);
  }
  if(choice==='attack'){
   const p=s.maps[s.currentMapId],nearby=combatTargets(s).find(t=>dist(p.x,p.y,t.x,t.y)<=1);
   if(nearby&&nearby.id!==s.combat.active.targetId){const selected=chooseTarget(s,nearby.id);s=selected.state;}
   if(!nearby){choice='block';allMessages.push(`${hero.name} cannot reach a target and guards instead.`);}
  }
  const result=combatAction(s,registry,choice);
  if(!result.changed){if(choice!=='block'){
    const fallback=combatAction(s,registry,'block');if(!fallback.changed)break;
    s=fallback.state;allEvents.push(...(fallback.events??[]));allMessages.push(`${hero.name}'s ${choice} is unavailable; guards instead.`,...fallback.messages);changed=true;
   }else break;
  }else{s=result.state;allMessages.push(...result.messages);allEvents.push(...(result.events??[]));changed=true;}
 }
 return {state:s,messages:allMessages,changed,events:allEvents};
}
function visibleShot(s:CampaignState,map:GridMap,enemy:EnemyState):boolean{
 const p=s.maps[s.currentMapId],d=DIRECTIONS[p.facing];for(let n=1;n<=3;n++){
  const x=p.x+d.x*n,y=p.y+d.y*n;
  if(isOpaque(map,p,x,y)||edgeBlocked(map,p,x-d.x,y-d.y,x,y))return false;
  if(x===enemy.x&&y===enemy.y)return true;
 }return false;
}
export function availableShotTargets(s:CampaignState,registry:MapRegistry):EnemyState[]{return !s.combat.active?currentEnemies(s).filter(e=>visibleShot(s,registry[s.currentMapId],e)).sort((a,b)=>dist(s.maps[s.currentMapId].x,s.maps[s.currentMapId].y,a.x,a.y)-dist(s.maps[s.currentMapId].x,s.maps[s.currentMapId].y,b.x,b.y)):[];}
/** Xeen-style exploration volley: each conscious hero with a ranged weapon fires, then enemies advance one square. */
export function shootVolley(source:CampaignState,registry:MapRegistry):CombatResult {
 if(source.combat.active||source.combat.defeated)return {state:source,messages:['Use the combat commands now.'],changed:false};
 const target=availableShotTargets(source,registry)[0];if(!target)return {state:source,messages:['No enemy in the three-square forward firing lane.'],changed:false};
 const shooters=source.party.order.filter(id=>source.party.characters[id].hp>0&&source.party.characters[id].equipment.ranged);
 if(!shooters.length)return {state:source,messages:['Nobody has a missile weapon equipped.'],changed:false};
 return mutate(source,(s,rng,lines)=>{
  const e=encounterForEnemy(s,target.id)!;const victim=e.enemies.find(v=>v.id===target.id)!;
  for(const id of shooters){if(victim.hp===0)break;attackHero(s,rng,s.party.characters[id],victim,'ranged',lines);}
  rewardIfClear(s,e,lines);s.elapsedMinutes++;expireMagic(s);
  for(const enemy of living(e)){
   const step=pathStep(registry[s.currentMapId],s,enemy,currentEnemies(s));if(step){enemy.x=step.x;enemy.y=step.y;lines.push(`${ENEMY_KINDS[enemy.kindId].name} advances!`);}
  }
  const nearby=closeEncounter(s);if(nearby)startInto(s,registry,rng,lines,nearby.id);
 });
}
export function recoverParty(source:CampaignState,registry:MapRegistry):CombatResult{
 if(!source.combat.defeated)return {state:source,messages:['The party has not fallen.'],changed:false};
 return mutate(source,(s,_rng,lines)=>{
  s.combat.defeated=false;s.combat.active=null;s.combat.companions=[];const recovery=registry[source.currentMapId].recovery;const destination=recovery?registry[recovery.mapId]:undefined;const arrival=recovery&&(destination as TravelMap)?.arrivals?.find(a=>a.id===recovery.arrivalId);if(recovery&&!arrival)throw new TypeError('Invalid recovery arrival');s.currentMapId=recovery?recovery.mapId:registry.map_town?'map_town':source.currentMapId;const w=s.maps[s.currentMapId],map=registry[s.currentMapId],pose=arrival??map.spawn,k=`${pose.x},${pose.y}`;
  s.maps[s.currentMapId]={...w,...pose,visited:w.visited.includes(k)?w.visited:[...w.visited,k]};
  for(const id of s.party.order){const c=s.party.characters[id];s.party=updateMember(s.party,{...c,hp:Math.max(1,Math.ceil(derived(c).maxHP/2))});}
  const cost=Math.min(s.party.resources.gold,50);s.party.resources.gold-=cost;s.elapsedMinutes+=480;expireMagic(s);
  lines.push(`The party awakens in ${map.name} with half health after eight hours. ${cost} gold spent on recovery.`);
 });
}
export function validateCombat(value:unknown,registry:MapRegistry,partyIds:string[],mapId:string):CombatState{
 const seeds=ENCOUNTER_SEEDS.filter(e=>Object.hasOwn(registry,e.mapId));const initial=initialCombatState(registry);if(!value||typeof value!=='object')throw new TypeError('Missing combat state.');const c=value as CombatState;
 if(!c.encounters||typeof c.encounters!=='object'||Array.isArray(c.encounters)||Object.keys(c.encounters).length!==seeds.length||typeof c.defeated!=='boolean')throw new TypeError('Invalid encounters.');
 for(const seed of seeds){const e=c.encounters[seed.id];if(!e||e.id!==seed.id||e.mapId!==seed.mapId||!registry[e.mapId]||!Array.isArray(e.enemies)||(e.enemies.length<seed.enemies.length||e.enemies.length>seed.enemies.length+2)||typeof e.cleared!=='boolean'||typeof e.rewarded!=='boolean'||(e.rewarded&&!e.cleared))throw new TypeError('Invalid encounter definition.');
  if(e.phase!==undefined&&(!Number.isInteger(e.phase)||e.phase<0||e.phase>=(authoredEncounterForSeed(e.id)?.phases.length??1)))throw new TypeError('Invalid boss phase');
  const primaryIds=new Set(seed.enemies.map(v=>v.id));const extra=e.enemies.filter(v=>!primaryIds.has(v.id));
  if(new Set(e.enemies.map(v=>v.id)).size!==e.enemies.length||extra.some(v=>!v.summoned||!primaryIds.has(v.summoned.ownerId)||!Number.isSafeInteger(v.summoned.expiresAtRound)||v.summoned.expiresAtRound<1||v.summoned.expiresAtRound>100006||!MONSTERS[v.kindId]||!Number.isSafeInteger(v.hp)||v.hp<0||v.hp>MONSTERS[v.kindId].hp||!Number.isSafeInteger(v.x)||!Number.isSafeInteger(v.y)||!terrainEverFloor(registry[e.mapId],v.x,v.y)))throw new TypeError('Invalid summoned support.');
  for(const enemy of e.enemies){if(enemy.phase!==undefined&&(!Number.isSafeInteger(enemy.phase)||enemy.phase<0||enemy.phase>(MONSTERS[enemy.kindId].behavior?.phases?.length??0)))throw new TypeError('Invalid monster phase');if(enemy.guardUntilRound!==undefined&&(!Number.isSafeInteger(enemy.guardUntilRound)||enemy.guardUntilRound<0||enemy.guardUntilRound>100000))throw new TypeError('Invalid monster guard');if(enemy.behaviorUses!==undefined&&(!enemy.behaviorUses||typeof enemy.behaviorUses!=='object'||Object.entries(enemy.behaviorUses).length>8||Object.entries(enemy.behaviorUses).some(([key,count])=>!MONSTERS[enemy.kindId].behavior?.rules.some(r=>r.id===key&&r.action==='summon'&&count<=r.maxUses!)||!Number.isSafeInteger(count)||count<1)))throw new TypeError('Invalid monster behavior ledger');if(enemy.conditions!==undefined&&(!Array.isArray(enemy.conditions)||enemy.conditions.length>16||new Set(enemy.conditions.map(c=>c.id)).size!==enemy.conditions.length||enemy.conditions.some(c=>!validateAuthoredCondition(c))))throw new TypeError('Invalid enemy conditions');}
  for(const original of seed.enemies){const v=e.enemies.find(v=>v.id===original.id);if(!v||v.kindId!==original.kindId||!Number.isSafeInteger(v.x)||!Number.isSafeInteger(v.y)||!terrainEverFloor(registry[e.mapId],v.x,v.y)||!Number.isSafeInteger(v.hp)||v.hp<0||v.hp>ENEMY_KINDS[v.kindId].hp)throw new TypeError('Invalid enemy state.');}
  if(e.cleared!==e.enemies.every(v=>v.hp===0))throw new TypeError('Encounter clear state does not match enemies.');
 }
 if(c.companions!==undefined){if(!Array.isArray(c.companions)||c.companions.length>2||(!c.active&&c.companions.length))throw new TypeError('Invalid companions');for(const ally of c.companions){if(!ally||typeof ally.id!=='string'||!/^comp_[a-z0-9_]+$/.test(ally.id)||!MONSTERS[ally.kindId]||!partyIds.includes(ally.ownerId)||!c.active||ally.encounterId!==c.active.encounterId||!Number.isSafeInteger(ally.hp)||ally.hp<1||ally.hp>MONSTERS[ally.kindId].hp||!Number.isSafeInteger(ally.expiresAtRound)||ally.expiresAtRound<1||ally.expiresAtRound>100006||!Number.isSafeInteger(ally.lastActedRound)||ally.lastActedRound<0||ally.lastActedRound>100000)throw new TypeError('Invalid summoned companion');}if(new Set(c.companions.map(v=>v.id)).size!==c.companions.length||new Set(c.companions.map(v=>v.ownerId)).size!==c.companions.length)throw new TypeError('Duplicate companion/owner');}
 if(c.defeated&&c.active)throw new TypeError('Defeated party cannot be active.');
 if(c.active!==null){const a=c.active;if(!a||!initial.encounters[a.encounterId]||c.encounters[a.encounterId].mapId!==mapId||c.encounters[a.encounterId].cleared||!Array.isArray(a.turnOrder)||a.turnOrder.length>9||a.turnOrder.length<1||new Set(a.turnOrder).size!==a.turnOrder.length||a.turnOrder.some(id=>!partyIds.includes(id)&&!c.encounters[a.encounterId].enemies.some(v=>v.id===id&&!v.summoned))||!Number.isSafeInteger(a.turnIndex)||a.turnIndex<0||a.turnIndex>=a.turnOrder.length||!Number.isSafeInteger(a.round)||a.round<1||a.round>100000||!Array.isArray(a.guarding)||a.guarding.some(v=>!partyIds.includes(v))||(a.targetId!==null&&!c.encounters[a.encounterId].enemies.some(v=>v.id===a.targetId)))throw new TypeError('Invalid active combat turn.');}
 return c;
}

/** MP22: authoritative, bounded companion from a granted ability. No new hero turn. */
export function summonCompanion(s:CampaignState,heroId:string,kindId:string,duration:number):CompanionState{
 const a=s.combat.active,owner=s.party.characters[heroId],kind=MONSTERS[kindId];
 if(!a||!owner||owner.hp<=0||a.turnOrder[a.turnIndex]!==heroId||!kind||!Number.isSafeInteger(duration)||duration<1||duration>6)throw new TypeError('Companion requires current conscious owner, known species and bounded combat lifetime.');
 const companions=s.combat.companions??[];
 if(companions.length>=2||companions.some(v=>v.ownerId===heroId))throw new TypeError('Companion slots are full or owner already has support.');
 const ally:CompanionState={id:`comp_${heroId}_${a.round}_${companions.length+1}`,kindId,ownerId:heroId,hp:kind.hp,encounterId:a.encounterId,expiresAtRound:a.round+duration-1,lastActedRound:a.round-1};
 s.combat.companions=[...companions,ally];return ally;
}

/** Finish a successfully used consumable as one combat action (the item transaction is already committed). */
export function afterItemUse(source:CampaignState,registry:MapRegistry):CombatResult{
 if(!source.combat.active)return {state:source,messages:[],changed:false};
 return mutate(source,(s,rng,lines)=>{
  const a=s.combat.active!;rewardIfClear(s,s.combat.encounters[a.encounterId],lines);if(!s.combat.active)return;
  s.elapsedMinutes++;expireMagic(s);nextTurn(s,rng,lines);processEnemyTurns(s,registry,rng,lines);
  lines.push('Item action completed.');
 });
}

/** Reconcile damage from the shared condition clock without adding another turn. */
export function settleConditionDeaths(s:CampaignState):string[]{const lines:string[]=[];for(const e of Object.values(s.combat.encounters))if(!e.cleared&&primaryLiving(e).length===0)rewardIfClear(s,e,lines);if(s.party.order.every(id=>s.party.characters[id].hp===0)){s.combat.defeated=true;s.combat.active=null;s.combat.companions=[];}return lines;}
