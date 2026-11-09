import {actPuzzle,type PuzzleCommand} from './perception.ts';
import {changeTerrain,TerrainFault} from './terrain.ts';
import {activateAbility,checkAbility,abilityGranted} from './abilities.ts';
import {currentEffectDocument} from '../content/effect-definitions.ts';
import {applyEffect,settleUnifiedTime,pruneUnifiedConditions} from './effects.ts';
import {EffectFault,effectDefinition} from '../content/effect-definitions.ts';
import {DirectorFault,type EncounterDocument} from '../content/encounter-director.ts';
import {actEncounter,advanceEncounterDirector,encounterMenu,type EncounterCommand,type DirectorEvent} from './encounter-director.ts';
import {actQuest,refreshQuests,type QuestCommand,type QuestEvent,type QuestBudget} from './quest-engine.ts';
import {QuestFault,type QuestDocument} from '../content/quest-definitions.ts';
import {actSocial,type SocialCommand} from './social.ts';
import {SocialFault,type SocialDocument} from '../content/social-definitions.ts';
import {ConditionFault} from './conditions.ts';
import {actOnEntity,interactionMenu,entityReachable,entityVisible,ObjectFault,type ObjectAction} from './objects.ts';
import {executeRoutine,RoutineFault,type RoutineDocument,type RoutineBudget} from './routines.ts';
import {newScopedState,type ScopedState} from './scoped-state.ts';
/** MP11: authoritative, browser-free command/event simulation boundary.
 * No DOM, storage, timers, network or pack-supplied JavaScript. Untrusted content
 * cannot register triggers; trusted engine code may do so until MP12's bounded DSL.
 */
import {validateCampaign,travelCampaign,type CampaignState,type MapRegistry,type TravelMap} from './campaign.ts';
import {DIRECTIONS,isOpaque,type GridAction} from './grid.ts';
import {moveExpedition,restExpedition,bashExpedition,lockpickExpedition,searchExpedition,interactExpedition} from './expedition.ts';
import {settleConditionDeaths,beginEncounter,combatAction,quickFight,shootVolley,chooseTarget,recoverParty,castCombatSpell,afterItemUse,currentEnemies} from './combat.ts';
import {castExploration,readySpell,learnClassSpell,type CastRequest} from './magic.ts';
import {itemAction,claimCache,cacheHere,groundDropHere,type ItemCommand} from './inventory.ts';
import {craftRecipe,type CraftRequest} from './crafting.ts';
import {lootGround,nearbyGround,type LootRequest} from './ground.ts';
import {serviceAction,nearbyService,type ServiceRequest} from './services.ts';
import {inspectTownScene,inspectUpperScene,inspectVaultScene} from './quests.ts';
import {SeededRng} from './rng.ts';
import {selectMember,exchangeMembers,updateMember,type QuickAction,type PreparedStyle} from './party.ts';
import {setPrepared,setQuickAction} from './noncaster.ts';
import type {PresentationEvent} from './presentation.ts';

export type SimulationCommand =
 | PuzzleCommand
 | {type:'terrain';configurationId:string}
 | {type:'effect';effectId:string;casterId?:string;targetId?:string}
 | {type:'ability';abilityId:string;casterId?:string;targetId?:string}
 | EncounterCommand
 | QuestCommand
 | SocialCommand
 | {type:'object';entityId:string;action:ObjectAction}
 | {type:'routine';routineId:string;args:Record<string,unknown>}
 | {type:'grid'; action:GridAction}
 | {type:'expedition'; action:'rest'|'bash'|'lockpick'|'search'}
 | {type:'combat'; action:'engage'|'attack'|'block'|'run'|'mug'|'shoot'|'quick_fight'|'recover'|'target'; targetId?:string}
 | {type:'spell'; request:CastRequest}
 | {type:'learn-spell'|'ready-spell'; casterId:string; spellId:string}
 | {type:'item'; request:ItemCommand}
 | {type:'craft'; request:CraftRequest}
 | {type:'loot'; request:LootRequest}
 | {type:'service'; request:ServiceRequest}
 | {type:'roll'; min:number; max:number}
 | {type:'party'; action:'select'|'exchange'|'prepared'|'quick'; heroId:string; otherId?:string; style?:PreparedStyle; quickAction?:QuickAction};

export type SimulationEvent =
 | {type:'terrain.changed';mapId:string;from:string;to:string}
 | {type:'condition.changed';targetId:string;conditionId:string;change:'applied'|'removed'|'updated'}
 | {type:'effect.applied';effectId:string;outcomes:ReturnType<typeof applyEffect>}
 | DirectorEvent
 | QuestEvent
 | {type:'command.accepted'; commandType:SimulationCommand['type']}
 | {type:'command.blocked'; reason:string}
 | {type:'command.failed'; code:string; reason:string}
 | {type:'message'; text:string}
 | {type:'state.changed'; areas:string[]}
 | {type:'time.advanced'; minutes:number}
 | {type:'rng.advanced'; rolls:number}
 | {type:'position.changed'; from:{mapId:string;x:number;y:number}; to:{mapId:string;x:number;y:number}; moved:boolean}
 | {type:'combat.changed'; active:boolean; defeated:boolean}
 | {type:'ui.open'; screen:'loot'|'service'|'interaction'|'social'|'journal'|'encounter'; id?:string}
 | {type:'roll.result'; value:number; min:number; max:number}
 | {type:'presentation'; value:PresentationEvent};

export interface SimulationResult {
 state:CampaignState;
 scoped?:ScopedState;
 status:'applied'|'blocked'|'failed';
 changed:boolean;
 messages:string[];
 events:SimulationEvent[];
 presentation:PresentationEvent[];
 errorCode?:string;
}
/** Trusted engine triggers only. Listeners return commands; they cannot mutate state. */
export interface SimulationTrigger {
 id:string;
 priority:number;
 onEvent:(event:Readonly<SimulationEvent>,state:Readonly<CampaignState>)=>SimulationCommand|readonly SimulationCommand[]|null|undefined;
}
export interface SimulationOptions { encounters?:EncounterDocument; quests?:QuestDocument; social?:SocialDocument; routines?:RoutineDocument; scoped?:ScopedState; triggers?:readonly SimulationTrigger[]; maxCommands?:number; maxEvents?:number; maxTriggerCalls?:number; }
type Stage={state:CampaignState;changed:boolean;messages:string[];extra:SimulationEvent[];presentation:PresentationEvent[];blocked?:boolean;readOnly?:boolean};
const staged=(state:CampaignState,changed=false,messages:string[]=[],extra:SimulationEvent[]=[],presentation:PresentationEvent[]=[]):Stage=>({state,changed,messages,extra,presentation});
function object(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v);}
const fail=(code:string,reason:string):never=>{throw new SimulationFault(code,reason);};
export class SimulationFault extends Error {readonly code:string;constructor(code:string,message:string){super(message);this.code=code;this.name='SimulationFault';}}
function boundedText(v:unknown,field:string):asserts v is string{if(typeof v!=='string'||!v||v.length>128)fail('E_COMMAND',`Invalid ${field}.`);}
export function validateSimulationCommand(raw:unknown):SimulationCommand {
 if(!object(raw))return fail('E_COMMAND','Command must be an object.');
 switch(raw.type){
  case 'puzzle':if(Object.keys(raw).some(k=>!['type','puzzleId','action','token','slot'].includes(k))||typeof raw.puzzleId!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(raw.puzzleId)||!['inspect','input','submit','reset'].includes(String(raw.action))||raw.token!==undefined&&(typeof raw.token!=='string'||raw.token.length>40)||raw.slot!==undefined&&(!Number.isInteger(raw.slot)||Number(raw.slot)<0||Number(raw.slot)>7)||raw.action!=='input'&&(raw.token!==undefined||raw.slot!==undefined))break;return raw as PuzzleCommand;
  case 'terrain':if(Object.keys(raw).some(k=>!['type','configurationId'].includes(k))||typeof raw.configurationId!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(raw.configurationId))break;return {type:'terrain',configurationId:raw.configurationId};
  case 'ability':boundedText(raw.abilityId,'abilityId');if(raw.casterId!==undefined)boundedText(raw.casterId,'casterId');if(raw.targetId!==undefined)boundedText(raw.targetId,'targetId');return raw as SimulationCommand;
  case 'effect':boundedText(raw.effectId,'effectId');if(raw.casterId!==undefined)boundedText(raw.casterId,'casterId');if(raw.targetId!==undefined)boundedText(raw.targetId,'targetId');return raw as SimulationCommand;
  case 'wait':if(!Number.isSafeInteger(raw.minutes)||(raw.minutes as number)<1||(raw.minutes as number)>60)break;return raw as SimulationCommand;
  case 'encounter':if(raw.action==='menu')return {type:'encounter',action:'menu'};if(!['fight','bribe','avoid'].includes(String(raw.action)))break;boundedText(raw.encounterId,'encounterId');return raw as SimulationCommand;
  case 'quest':if(raw.action==='journal')return {type:'quest',action:'journal'};boundedText(raw.questId,'questId');if(raw.action==='transition'){boundedText(raw.transitionId,'transitionId');if(raw.expectedState!==undefined)boundedText(raw.expectedState,'expectedState');return raw as unknown as QuestCommand;}if(raw.action==='claim'){boundedText(raw.rewardId,'rewardId');if(raw.heroId!==undefined)boundedText(raw.heroId,'heroId');return raw as unknown as QuestCommand;}break;

  case 'social':
   boundedText(raw.entityId,'entityId');if(!['talk','choose','leave','select-hero','buy','sell','heal','train','tribute','barter'].includes(String(raw.action)))break;
   if(!['talk','leave'].includes(String(raw.action)))boundedText(raw.nodeId,'nodeId');
   if(raw.action==='select-hero')boundedText(raw.heroId,'heroId');
   if(raw.action==='choose')boundedText(raw.choiceId,'choiceId');
   if(['buy','sell','heal','train','tribute','barter'].includes(String(raw.action)))boundedText(raw.serviceId,'serviceId');
   if(raw.action==='buy')boundedText(raw.itemId,'itemId');if(raw.action==='sell')boundedText(raw.itemInstanceId,'itemInstanceId');if(raw.action==='barter')boundedText(raw.offerId,'offerId');
   if(raw.heroId!==undefined)boundedText(raw.heroId,'heroId');if(raw.quantity!==undefined&&(!Number.isInteger(raw.quantity)||(raw.quantity as number)<1||(raw.quantity as number)>20))break;
   if(raw.ability!==undefined&&!['STR','DEX','CON','INT','WIS','CHA'].includes(String(raw.ability)))break;return raw as unknown as SocialCommand;

  case 'object':boundedText(raw.entityId,'entityId');if(!['inspect','use','search','open','close','unlock','pick','force','claim','talk'].includes(String(raw.action))&&!(typeof raw.action==='string'&&/^cap:[a-z][a-z0-9_]{0,31}$/.test(raw.action)))break;return raw as SimulationCommand;
  case 'routine':boundedText(raw.routineId,'routineId');if(!object(raw.args))break;return raw as SimulationCommand;
  case 'grid':if(!['forward','backward','strafe_left','strafe_right','turn_left','turn_right','interact'].includes(String(raw.action)))break;return raw as SimulationCommand;
  case 'expedition':if(!['rest','bash','lockpick','search'].includes(String(raw.action)))break;return raw as SimulationCommand;
  case 'combat':if(!['engage','attack','block','run','mug','shoot','quick_fight','recover','target'].includes(String(raw.action)))break;if(raw.action==='target')boundedText(raw.targetId,'targetId');return raw as SimulationCommand;
  case 'spell':if(!object(raw.request))break;boundedText(raw.request.casterId,'casterId');if(raw.request.spellId!==undefined&&raw.request.spellId!==null)boundedText(raw.request.spellId,'spellId');return raw as SimulationCommand;
  case 'ready-spell':case 'learn-spell':boundedText(raw.casterId,'casterId');boundedText(raw.spellId,'spellId');return raw as SimulationCommand;
  case 'craft':if(!object(raw.request))break;boundedText(raw.request.recipeId,'recipeId');if(raw.request.crafterId!==undefined)boundedText(raw.request.crafterId,'crafterId');return raw as SimulationCommand;
  case 'item':if(!object(raw.request))break;boundedText(raw.request.itemId,'itemId');if(!['attune','unattune','drop','equip','remove','transfer','discard','use','identify','repair','sell','split','sort','move'].includes(String(raw.request.action)))break;return raw as SimulationCommand;
  case 'loot':if(!object(raw.request))break;boundedText(raw.request.containerId,'containerId');return raw as SimulationCommand;
  case 'service':if(!object(raw.request))break;boundedText(raw.request.serviceId,'serviceId');boundedText(raw.request.action,'service action');return raw as SimulationCommand;
  case 'party':boundedText(raw.heroId,'heroId');if(!['select','exchange','prepared','quick'].includes(String(raw.action)))break;if(raw.action==='exchange')boundedText(raw.otherId,'otherId');if(raw.action==='prepared')boundedText(raw.style,'style');if(raw.action==='quick')boundedText(raw.quickAction,'quickAction');return raw as SimulationCommand;
  case 'roll':if(!Number.isSafeInteger(raw.min)||!Number.isSafeInteger(raw.max)||(raw.min as number)<0||(raw.max as number)>100000000||(raw.max as number)<(raw.min as number))break;return raw as SimulationCommand;
 }
 return fail('E_COMMAND',`Unsupported or malformed simulation command (${String(raw.type)}).`);
}
function processOne(state:CampaignState,registry:MapRegistry,command:SimulationCommand):Stage {
 const blocked=(message:string):Stage=>({...staged(state,false,[message]),blocked:true});
 if(command.type==='puzzle'){const r=actPuzzle(state,registry,command);return r.changed?staged(r.state,true,[r.message]):blocked(r.message);}
 if(command.type==='terrain'){const r=changeTerrain(state,registry,command.configurationId);return r.changed?staged(r.state,true,[r.message],[{type:'terrain.changed',mapId:state.currentMapId,from:r.from!,to:r.to!}]):blocked(r.message);}
 if(command.type==='ability'){const s=structuredClone(state),outcomes=activateAbility(s,command.abilityId,command.casterId??(s.combat.active?.turnOrder[s.combat.active.turnIndex]??s.party.selectedId),command.targetId??(s.combat.active?.targetId??s.party.selectedId));if(s.combat.active){const r=afterItemUse(s,registry);return staged(r.state,true,[...outcomes.map(o=>`${o.targetId}: ${o.operation} ${o.outcome}`),...r.messages],[{type:'effect.applied',effectId:command.abilityId,outcomes}],r.events??[]);}return staged(s,true,outcomes.map(o=>`${o.targetId}: ${o.operation} ${o.outcome}`),[{type:'effect.applied',effectId:command.abilityId,outcomes}]);}
 if(command.type==='effect'){if(effectDefinition(command.effectId)?.activation)throw new EffectFault('Grant-restricted abilities use the ability command');const s=structuredClone(state),outcomes=applyEffect(s,command.effectId,command.casterId??(s.combat.active?.turnOrder[s.combat.active.turnIndex]??s.party.selectedId),command.targetId??(s.combat.active?.targetId??s.party.selectedId));if(s.combat.active){const r=afterItemUse(s,registry);return staged(r.state,true,[...outcomes.map(o=>`${o.targetId}: ${o.operation} ${o.outcome}`),...r.messages],[{type:'effect.applied',effectId:command.effectId,outcomes}],r.events??[]);}return staged(s,true,outcomes.map(o=>`${o.targetId}: ${o.operation} ${o.outcome}`),[{type:'effect.applied',effectId:command.effectId,outcomes}]);}
 if(command.type==='encounter'||command.type==='wait')return fail('E_ENCOUNTER','Encounter command needs content context');
 if(command.type==='quest')return fail('E_QUEST','Quest command requires its scoped context');
 if(command.type==='social')return fail('E_SOCIAL','Social commands require their content/scoped context');
 if(command.type==='object')return fail('E_OBJECT','Object action requires scoped simulation context');
 if(command.type==='routine')return fail('E_ROUTINE','Routine requires simulation context');
 if(command.type==='party'){
  const next=structuredClone(state),party=next.party;
  if(command.action==='select')next.party=selectMember(party,command.heroId);
  else if(command.action==='exchange')next.party=exchangeMembers(party,command.heroId,command.otherId!);
  else {const c=party.characters[command.heroId];if(!c)return blocked('Unknown party member.');next.party=updateMember(party,command.action==='prepared'?setPrepared(c,command.style!):setQuickAction(c,command.quickAction!));}
  const changed=JSON.stringify(party)!==JSON.stringify(next.party);return staged(next,changed,changed?[]:['Party selection is unchanged.']);
 }
 if(command.type==='roll'){
  const next=structuredClone(state),rng=new SeededRng(1);rng.restore(next.rng);
  const value=rng.integer(command.min,command.max);next.rollCount++;next.rng=rng.snapshot();
  return staged(next,true,[`Roll ${next.rollCount} · ${command.min}–${command.max} → ${value}`],[{type:'roll.result',value,min:command.min,max:command.max}]);
 }
 if(command.type==='expedition'){
  const fn={rest:restExpedition,bash:bashExpedition,lockpick:lockpickExpedition,search:searchExpedition}[command.action];
  const result=fn(state,registry);return staged(result.state,result.changed,[result.message]);
 }
 if(command.type==='combat'){
  const r=command.action==='engage'?beginEncounter(state,registry):command.action==='quick_fight'?quickFight(state,registry):command.action==='shoot'?shootVolley(state,registry):command.action==='recover'?recoverParty(state,registry):command.action==='target'?chooseTarget(state,command.targetId!):combatAction(state,registry,command.action);
  if(command.action==='block'&&r.changed&&!state.combat.defeated){
   const heroId=state.combat.active?.turnOrder[state.combat.active.turnIndex],h=heroId?r.state.party.characters[heroId]:undefined;
   if(h){for(const e of currentEffectDocument().effects.filter(e=>e.activation?.mode==='triggered'&&e.activation.trigger==='block').slice(0,8)){
    if(!abilityGranted(h,e)||checkAbility(h,e,r.state))continue;
    const outcomes=activateAbility(r.state,e.id,h.id,h.id,true);r.messages.push(`${e.name}: `+outcomes.map(o=>o.outcome).join(', '));
   }}
  }
  return staged(r.state,r.changed,r.messages,[],r.events??[]);
 }
 if(command.type==='spell'){
  const r=state.combat.active?castCombatSpell(state,registry,command.request):castExploration(state,command.request,registry);
  return staged(r.state,r.changed,r.messages,[],r.events??[]);
 }
 if(command.type==='ready-spell'||command.type==='learn-spell'){
  const r=command.type==='ready-spell'?readySpell(state,command.casterId,command.spellId):learnClassSpell(state,command.casterId,command.spellId);
  return staged(r.state,r.changed,[r.message]);
 }
 if(command.type==='loot'){
  const r=lootGround(state,registry,command.request);return staged(r.state,r.changed,[r.message]);
 }
 if(command.type==='service'){
  const r=serviceAction(state,registry,command.request);return staged(r.state,r.changed,[r.message]);
 }
 if(command.type==='craft'){const r=craftRecipe(state,command.request,registry);return r.changed?staged(r.state,true,[r.message]):blocked(r.message);}
 if(command.type==='item'){
  const r=itemAction(state,command.request);if(!r.changed)return blocked(r.message);
  let next=r.state,additional:string[]=[],presentation:PresentationEvent[]=[];
  if(r.usedTurn&&next.combat.active){const following=afterItemUse(next,registry);next=following.state;additional=following.messages;presentation=following.events??[];}
  for(const id of state.party.order){const old=state.party.characters[id],now=next.party.characters[id];if(now&&(now.hp>old.hp||now.conditions.length<old.conditions.length))presentation.unshift({actorId:id,targetIds:[id],family:'heal',hit:true});}
  return staged(next,true,[r.message,...additional],[],presentation);
 }
 if(command.type==='grid'){
  const action=command.action;
  if(action==='interact'&&!state.combat.active&&!state.combat.defeated){
   if(nearbyGround(state,registry).length)return staged(state,false,[],[{type:'ui.open',screen:'loot'}]);
   const npc=nearbyService(state,registry);if(npc)return staged(state,false,[`Speaking with ${npc.name}.`],[{type:'ui.open',screen:'service',id:npc.id}]);
   const map=registry[state.currentMapId] as TravelMap,where=state.maps[state.currentMapId],d=DIRECTIONS[where.facing];
   const portal=map.portals?.find(p=>(p.activation??'interact')==='interact'&&((p.x===where.x&&p.y===where.y)||(p.x===where.x+d.x&&p.y===where.y+d.y&&!isOpaque(map,where,p.x,p.y))));
   if(portal?.id==='portal_town_to_dungeon'&&!state.quests.questItems.includes('item_quest_cistern_key'))return blocked('The stair is secured. Ask Iona Reed at the cistern office (8,8) for the brass key; review the Journal in Information (I).');
   const travel=travelCampaign(state,registry);if(travel)return staged(travel.state,true,[travel.message]);
   const treasure=claimCache(state);if(treasure.changed||cacheHere(state)||groundDropHere(state))return staged(treasure.state,treasure.changed,[treasure.message]);
   for(const inspect of [inspectVaultScene,inspectUpperScene,inspectTownScene]){
    const r=inspect(state,registry);if(r)return staged(r.state,r.changed,[r.message]);
   }
   const interaction=interactExpedition(state,registry);if(interaction)return staged(interaction.state,interaction.changed,[interaction.message]);
  }
  const moved=moveExpedition(state,registry,action);
  if(!moved.changed)return blocked(moved.message);
  if(moved.moved){
   const pos=moved.state.maps[state.currentMapId];if(currentEnemies(moved.state).some(e=>e.x===pos.x&&e.y===pos.y))return blocked('An enemy blocks the passage. Prepare to fight!');
   const before=state.maps[state.currentMapId];const travel=travelCampaign(moved.state,registry,'step',{mapId:state.currentMapId,x:before.x,y:before.y});
   if(travel)return staged(travel.state,true,[travel.message]);
  }
  return staged(moved.state,true,[moved.message]);
 }
 return fail('E_COMMAND','Unknown command.');
}
const MAX_COMMANDS=16,MAX_EVENTS=128,MAX_TRIGGER_CALLS=64;
/** Entire command/trigger cascade is transactional. On any error, original state is returned. */
export function dispatchSimulation(source:CampaignState,registry:MapRegistry,raw:unknown,options:SimulationOptions={}):SimulationResult {
 const failure=(code:string,reason:string):SimulationResult=>({state:source,status:'failed',changed:false,messages:[reason],events:[{type:'command.failed',code,reason}],presentation:[],errorCode:code});
 try{
  const command=validateSimulationCommand(raw),maxCommands=Math.min(MAX_COMMANDS,options.maxCommands??MAX_COMMANDS),maxEvents=Math.min(MAX_EVENTS,options.maxEvents??MAX_EVENTS),maxTriggerCalls=Math.min(MAX_TRIGGER_CALLS,options.maxTriggerCalls??MAX_TRIGGER_CALLS);
  if(!Number.isInteger(maxCommands)||maxCommands<1||!Number.isInteger(maxEvents)||maxEvents<2||!Number.isInteger(maxTriggerCalls)||maxTriggerCalls<0)return fail('E_LIMIT','Invalid simulation limits.');
  const triggers=[...(options.triggers??[])].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
  if(triggers.length>32||new Set(triggers.map(t=>t.id)).size!==triggers.length||triggers.some(t=>!/^[a-z][a-z0-9_.-]{0,63}$/.test(t.id)||!Number.isFinite(t.priority)))return fail('E_TRIGGER','Invalid trigger registry.');
  const pending:SimulationCommand[]=[command],events:SimulationEvent[]=[],messages:string[]=[],presentation:PresentationEvent[]=[];
  let state=source,commands=0,triggerCalls=0,changed=false,scoped=options.scoped;
  const routineBudget:RoutineBudget={steps:0,calls:0,commands:0};
  const questBudget:QuestBudget={evaluations:0,operations:0};
  const emit=(evt:SimulationEvent)=>{
   if(events.length>=maxEvents)fail('E_EVENT_LIMIT','Simulation event budget exceeded.');
   events.push(evt);
   for(const trigger of triggers){
    if(++triggerCalls>maxTriggerCalls)fail('E_REENTRY','Simulation trigger re-entry limit exceeded.');
    const generated=trigger.onEvent(Object.freeze(structuredClone(evt)),structuredClone(state));
    for(const candidate of generated===undefined||generated===null?[]:Array.isArray(generated)?generated:[generated]){
     const next=validateSimulationCommand(candidate);if(pending.length+commands>=maxCommands)fail('E_COMMAND_LIMIT','Simulation command re-entry limit exceeded.');pending.push(next);
    }
   }
  };
  while(pending.length){
   if(++commands+routineBudget.commands>maxCommands)fail('E_COMMAND_LIMIT','Simulation command budget exceeded.');
   const next=pending.shift()!,prev=state;
   let stage:Stage;
   const activeMap=registry[prev.currentMapId],scope=scoped??newScopedState();
   let objectCommand:Extract<SimulationCommand,{type:'object'}>|undefined=next.type==='object'?next:undefined;
   if(next.type==='expedition'&&activeMap.entities?.length){
    const candidates=activeMap.entities.filter(e=>entityReachable(prev,activeMap,e)).sort((a,b)=>a.id.localeCompare(b.id));
    const target=next.action==='search'?candidates.find(e=>!entityVisible(prev,scope,activeMap,e,registry)):candidates.find(e=>(e.kind==='door'||e.kind==='container')&&entityVisible(prev,scope,activeMap,e,registry));
    if(target&&next.action!=='rest')objectCommand={type:'object',entityId:target.id,action:next.action==='search'?'search':next.action==='bash'?'force':'pick'};
   }
   const socialCommand:SocialCommand|undefined=next.type==='social'?next:objectCommand?.action==='talk'?{type:'social',entityId:objectCommand.entityId,action:'talk'}:undefined;
   if(next.type==='encounter'||next.type==='wait'){
    if(!options.encounters)fail('E_ENCOUNTER','No encounter director installed');
    if(next.type==='encounter'&&next.action==='menu')stage={...staged(prev,false,[],[{type:'ui.open',screen:'encounter'}]),readOnly:true};
    else{const r=actEncounter(prev,scope,registry,options.encounters!,next);scoped=r.scoped;stage={...staged(r.state,r.changed,[r.message],r.events),blocked:'blocked' in r&&r.blocked};}
   }else if(next.type==='expedition'&&next.action==='rest'&&options.encounters&&encounterMenu(prev,scope,registry,options.encounters).length){stage={...staged(prev,false,['Resolve the nearby encounter before resting.']),blocked:true};
   }else if(next.type==='grid'&&next.action==='interact'&&options.encounters&&encounterMenu(prev,scope,registry,options.encounters).length){stage={...staged(prev,false,[],[{type:'ui.open',screen:'encounter'}]),readOnly:true};
   }else if(next.type==='quest'){
    if(next.action==='journal')stage={...staged(prev,false,[],[{type:'ui.open',screen:'journal'}]),readOnly:true};
    else{if(!options.quests)fail('E_QUEST','No authored quests installed');const result=actQuest(prev,scope,registry,options.quests!,next,questBudget);scoped=result.scoped;stage={...staged(result.state,result.changed,[result.message],result.events),blocked:result.blocked};}
   }else if(socialCommand){
    if(!options.social)fail('E_SOCIAL','No NPC/dialogue content installed');
    const result=actSocial(prev,scope,registry,options.social!,socialCommand,options.quests);scoped=result.scoped;
    stage={...staged(result.state,result.changed,[result.message],!result.blocked&&socialCommand.action==='talk'?[{type:'ui.open',screen:'social',id:socialCommand.entityId}]:[]),blocked:result.blocked,readOnly:!result.changed&&!result.blocked};
    if(result.routine){if(!options.routines)fail('E_ROUTINE','Dialogue routine not installed');
     const r=executeRoutine(result.state,result.scoped,registry,options.routines!,result.routine.routineId,result.routine.args,(s,c)=>{if(['object','social','quest','encounter','wait'].includes(String((c as {type?:string})?.type)))fail('E_ROUTINE','Routine adapters cannot invoke object/social transactions');return dispatchSimulation(s,registry,c);},routineBudget,options.quests?{document:options.quests,budget:questBudget}:undefined);
     if(commands+routineBudget.commands>maxCommands)fail('E_COMMAND_LIMIT','Combined social/routine command limit exceeded');
     scoped=r.scoped;stage=staged(r.state,true,[result.message],r.events.filter(e=>e.type!=='presentation'),r.events.filter((e):e is Extract<SimulationEvent,{type:'presentation'}>=>e.type==='presentation').map(e=>e.value));
    }
   }else if(objectCommand){
    const result=actOnEntity(prev,scope,registry,objectCommand.entityId,objectCommand.action);
    scoped=result.scoped;stage={...staged(result.state,result.changed,[result.message]),blocked:result.blocked,readOnly:!result.blocked&&!result.changed};
    if(result.routine){
     if(!options.routines)fail('E_ROUTINE','Object use routine is not installed');
     const args={...result.routine.args};
     const r=executeRoutine(result.state,result.scoped,registry,options.routines!,result.routine.routineId,args,(s,c)=>{if(['object','social','quest','encounter','wait'].includes(String((c as {type?:string})?.type)))fail('E_ROUTINE','Routine adapters cannot invoke object commands');return dispatchSimulation(s,registry,c);},routineBudget,options.quests?{document:options.quests,budget:questBudget}:undefined);
     if(commands+routineBudget.commands>maxCommands)fail('E_COMMAND_LIMIT','Combined object/routine command limit exceeded');
     scoped=r.scoped;stage=staged(r.state,true,[result.message],r.events.filter(e=>e.type!=='presentation'),r.events.filter((e):e is Extract<SimulationEvent,{type:'presentation'}>=>e.type==='presentation').map(e=>e.value));
    }
   }else if(next.type==='grid'&&next.action==='interact'&&!prev.combat.active&&!prev.combat.defeated&&interactionMenu(prev,scope,registry).entities.length){
    stage=staged(prev,false,[],[{type:'ui.open',screen:'interaction'}]);
   }else if(next.type==='routine'){
    if(!options.routines)fail('E_ROUTINE','No authored routine document installed');
    const r=executeRoutine(prev,scoped??newScopedState(),registry,options.routines!,next.routineId,next.args,(s,c)=>{if(['object','social','quest','encounter','wait'].includes(String((c as {type?:string})?.type)))fail('E_ROUTINE','Routine adapters cannot invoke object commands');return dispatchSimulation(s,registry,c);},routineBudget,options.quests?{document:options.quests,budget:questBudget}:undefined);
    if(commands+routineBudget.commands>maxCommands)fail('E_COMMAND_LIMIT','Combined simulation/routine command limit exceeded');
    scoped=r.scoped;stage=staged(r.state,true,[],r.events.filter(e=>e.type!=='presentation'),r.events.filter((e):e is Extract<SimulationEvent,{type:'presentation'}>=>e.type==='presentation').map(e=>e.value));stage.messages=[];
   }else stage=processOne(prev,registry,next);
   if(!stage.readOnly&&!stage.changed&&!stage.extra.some(e=>e.type==='ui.open')&&stage.messages.length)stage.blocked=true;
   if(stage.blocked){
    if(changed)return failure('E_ATOMIC',`Triggered command was blocked: ${stage.messages.join(' ')}`);
    return {state:source,status:'blocked',changed:false,messages:stage.messages,events:[{type:'command.blocked',reason:stage.messages.join(' ')}],presentation:[]};
   }
   if(stage.changed){settleUnifiedTime(stage.state);stage.messages.push(...settleConditionDeaths(stage.state));pruneUnifiedConditions(stage.state);}
   if(stage.changed&&options.encounters?.encounters.length){const r=advanceEncounterDirector(prev,stage.state,scoped??newScopedState(),registry,options.encounters,next.type==='expedition'&&next.action==='rest',options.quests);stage.state=r.state;scoped=r.scoped;stage.extra.push(...r.events);}
   if(stage.changed&&options.quests?.quests.length){const refreshed=refreshQuests(stage.state,scoped??newScopedState(),registry,options.quests,questBudget);scoped=refreshed.scoped;stage.extra.push(...refreshed.events);}
   if(stage.changed){
    // Detect invalid rule output before committing any event or follow-up action.
    state=validateCampaign(stage.state,registry);changed=true;
   }
   emit({type:'command.accepted',commandType:next.type});
   const localEvents:SimulationEvent[]=[...stage.extra];
   if(stage.changed){const snapshot=(s:CampaignState)=>new Map([...Object.values(s.party.characters),...Object.values(s.combat.encounters).flatMap(e=>e.enemies)].flatMap(a=>(a.conditions??[]).filter(c=>c.id.includes(':')).map(c=>[a.id+'|'+c.id,{targetId:a.id,conditionId:c.id,value:JSON.stringify(c)}] as const)));const a=snapshot(prev),b=snapshot(state);for(const [k,v]of a)if(!b.has(k))localEvents.push({type:'condition.changed',targetId:v.targetId,conditionId:v.conditionId,change:'removed'});for(const [k,v]of b)if(a.get(k)?.value!==v.value)localEvents.push({type:'condition.changed',targetId:v.targetId,conditionId:v.conditionId,change:a.has(k)?'updated':'applied'});}
   if(stage.changed){
    const areas=['campaign'];if(prev.currentMapId!==state.currentMapId||JSON.stringify(prev.maps)!==JSON.stringify(state.maps))areas.push('maps');
    if(JSON.stringify(prev.party)!==JSON.stringify(state.party))areas.push('party');
    if(JSON.stringify(prev.inventory)!==JSON.stringify(state.inventory))areas.push('inventory');
    if(JSON.stringify(prev.quests)!==JSON.stringify(state.quests))areas.push('quests');
    localEvents.push({type:'state.changed',areas});
    if(state.elapsedMinutes!==prev.elapsedMinutes)localEvents.push({type:'time.advanced',minutes:state.elapsedMinutes-prev.elapsedMinutes});
    if(state.rollCount!==prev.rollCount)localEvents.push({type:'rng.advanced',rolls:state.rollCount-prev.rollCount});
    const was=prev.maps[prev.currentMapId],now=state.maps[state.currentMapId];
    if(prev.currentMapId!==state.currentMapId||was.x!==now.x||was.y!==now.y)localEvents.push({type:'position.changed',from:{mapId:prev.currentMapId,x:was.x,y:was.y},to:{mapId:state.currentMapId,x:now.x,y:now.y},moved:true});
    if(JSON.stringify(prev.combat)!==JSON.stringify(state.combat))localEvents.push({type:'combat.changed',active:!!state.combat.active,defeated:state.combat.defeated});
   }
   for(const message of stage.messages){messages.push(message);localEvents.push({type:'message',text:message});}
   for(const value of stage.presentation){presentation.push(value);localEvents.push({type:'presentation',value});}
   for(const evt of localEvents){if(evt.type==='message'&&!stage.messages.includes(evt.text))messages.push(evt.text);emit(evt);}
  }
  return {state,...(scoped?{scoped}:{}),status:'applied',changed,messages,events,presentation};
 }catch(error){return failure(error instanceof TerrainFault||error instanceof SimulationFault||error instanceof RoutineFault||error instanceof ObjectFault||error instanceof SocialFault||error instanceof ConditionFault||error instanceof QuestFault||error instanceof DirectorFault||error instanceof EffectFault?error.code:'E_HANDLER',error instanceof Error?error.message:String(error));}
}
/** Replay deterministic commands using the exact function used in browser gameplay. */
export function replaySimulation(source:CampaignState,registry:MapRegistry,commands:readonly SimulationCommand[],options:SimulationOptions={}):{state:CampaignState;results:SimulationResult[]}{
 let state=source,scoped=options.scoped;const results:SimulationResult[]=[];
 for(const command of commands){const result=dispatchSimulation(state,registry,command,{...options,scoped});results.push(result);if(result.status==='failed')break;state=result.state;scoped=result.scoped??scoped;}
 return {state,results};
}
