/** Phase 18: complete town-to-vault adventure, quest items and branch endings. */
import type {CampaignState,MapRegistry} from './campaign.ts';
import {DIRECTIONS,isOpaque} from './grid.ts';
export const MAIN_STAGES=[
 {id:'quest_main_01',title:'The Keeper’s Request',objective:'Speak to Iona Reed at the cistern office.',detail:'The waterworks are ringing beneath Firstlight.'},
 {id:'quest_main_02',title:'The Cistern Key',objective:'Carry Iona’s brass key through the northern gate and enter the galleries.',detail:'Iona entrusts the party with the key; the staircase stands at (13,2).'},
 {id:'quest_main_03',title:'A Sequence of Bells',objective:'Discover the regulator sequence and descend from the upper cistern.',detail:'Read three bell inscriptions—Copper, Moon, Glass—and find the lower stair. The resonator stair opens once all three inscriptions are learned.'},
 {id:'quest_main_04',title:'The Shut Valves',objective:'Reset the deep valves and open the sealed chamber.',detail:'The deep valve sequence is Copper → Moon → Glass; wrong input resets the mechanism.'},
 {id:'quest_main_05',title:'The Bell-Heart',objective:'Defeat the Bell-Heart Custodian and recover the regulator.',detail:'The regulator rests behind the Bell-Heart Custodian in the resonator chamber.'},
 {id:'quest_main_06',title:'Firstlight’s Choice',objective:'Return to Iona, choose repair or disconnect, and claim the ending.',detail:'Choose to repair the town waterworks or isolate the dangerous resonator; side quests remain accessible.'},
] as const;
export const OPTIONAL_QUESTS=[
 {id:'quest_optional_ledger',title:'Tessa’s Lost Ledger',giver:'npc_tessa_bell',objective:'Find the inn’s lost ledger in a secret upper-gallery room and return it to Tessa.',detail:'Search behind the western secret arch, retrieve the ledger, and return to Tessa for 25 gold and 60 XP.'},
 {id:'quest_optional_tools',title:'Orro’s Tool Roll',giver:'npc_orro_vane',objective:'Recover the smith’s tool roll from the trapped side chamber and return it to Orro.',detail:'Search the trapped southern tool chamber, retrieve the roll, and return to Orro for 40 gold and 60 XP.'},
 {id:'quest_optional_echo',title:'Nera’s Bottled Echo',giver:'npc_nera_salt',objective:'Retrieve a bottled echo from the vault shrine and return it to Nera.',detail:'The echo shrine lies in the west of the Resonator Vault; seek the memory without breaking it.'},
] as const;
export type OptionalQuestId=typeof OPTIONAL_QUESTS[number]['id'];
export type OptionalStatus='available'|'active'|'ready'|'completed';
export const PLOT_ITEMS=['item_quest_cistern_key','item_quest_regulator','item_quest_tessa_ledger','item_quest_orro_tools','item_quest_nera_echo'] as const;
export const UPPER_SCENES=['scene_upper_copper','scene_upper_moon','scene_upper_glass','scene_upper_ledger','scene_upper_tools','scene_upper_descent','scene_upper_waterwheel','scene_upper_cistern_map','scene_upper_echo_chamber'] as const;
export const UPPER_CLUES=['scene_upper_copper','scene_upper_moon','scene_upper_glass'] as const;
export const VAULT_SCENES=['scene_vault_maintenance','scene_vault_copper','scene_vault_moon','scene_vault_glass','scene_vault_echo','scene_vault_regulator','scene_vault_rest','scene_vault_bypass','scene_vault_warning'] as const;
export const VALVE_ORDER=['scene_vault_copper','scene_vault_moon','scene_vault_glass'] as const;
export const TOWN_SCENES=['scene_old_foundry','scene_river_steps','scene_south_notice','scene_north_clock','scene_market_stalls','scene_well','scene_cistern_stair','scene_lantern_alley','scene_stone_marker'] as const;
export interface QuestState{
 flags:string[];notes:string[];
 /** 0: not accepted; 2: enter galleries; 3: dungeon sequence; 4–6: future dungeon stages. */
 mainStage:number;
 completedStages:string[];
 optional:Record<OptionalQuestId,OptionalStatus>;
 questItems:string[];
 seenScenes:string[];
 valveSequence:string[];
 ending:null|'repair'|'disconnect';
}
export const initialQuests=():QuestState=>({flags:[],notes:[],mainStage:0,completedStages:[],optional:Object.fromEntries(OPTIONAL_QUESTS.map(q=>[q.id,'available'])) as Record<OptionalQuestId,OptionalStatus>,questItems:[],seenScenes:[],valveSequence:[],ending:null});
export function migrateQuests(legacy:{flags:string[];notes:string[]}):QuestState{
 const q=initialQuests();q.flags=[...legacy.flags];q.notes=[...legacy.notes];
 if(q.flags.includes('flag_iona_cistern_task')){q.mainStage=2;q.completedStages=['quest_main_01'];q.questItems=['item_quest_cistern_key'];}
 return q;
}
const unique=(a:string[])=>new Set(a).size===a.length;
export function validateQuests(value:unknown):QuestState{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid quest ledger.');
 const q=value as QuestState;
 if(!Array.isArray(q.flags)||q.flags.length>256||!unique(q.flags)||q.flags.some(v=>typeof v!=='string'||v.length>128)||
 !Array.isArray(q.notes)||q.notes.length>256||q.notes.some(v=>typeof v!=='string'||v.length>1024)||
 !Number.isSafeInteger(q.mainStage)||q.mainStage<0||q.mainStage>6||
 !Array.isArray(q.valveSequence)||q.valveSequence.length>2||q.valveSequence.some((v,i)=>v!==VALVE_ORDER[i])||!([null,'repair','disconnect'] as unknown[]).includes(q.ending)||
 !Array.isArray(q.completedStages)||!unique(q.completedStages)||q.completedStages.some(id=>!MAIN_STAGES.some(s=>s.id===id))||
 !q.optional||typeof q.optional!=='object'||Array.isArray(q.optional)||Object.keys(q.optional).length!==OPTIONAL_QUESTS.length||
 OPTIONAL_QUESTS.some(entry=>!['available','active','ready','completed'].includes(q.optional[entry.id]))||
 !Array.isArray(q.questItems)||q.questItems.length>128||!unique(q.questItems)||q.questItems.some(id=>typeof id!=='string'||(!PLOT_ITEMS.includes(id as typeof PLOT_ITEMS[number])&&!/^item_quest_[a-z0-9_]{1,65}$/.test(id)))||
 !Array.isArray(q.seenScenes)||!unique(q.seenScenes)||q.seenScenes.some(id=>!([...TOWN_SCENES,...UPPER_SCENES,...VAULT_SCENES] as string[]).includes(id)))throw new TypeError('Invalid quest ledger contents.');
 const accepted=q.flags.includes('flag_iona_cistern_task');
 if((q.mainStage>0)!==accepted||(q.mainStage>0)!==q.questItems.includes('item_quest_cistern_key')||
  (q.mainStage>0)!==q.completedStages.includes('quest_main_01')||
  (q.mainStage>=3)!==q.completedStages.includes('quest_main_02')||
  q.completedStages.length!==(q.mainStage===0?0:q.mainStage-1+(q.ending?1:0))||
  MAIN_STAGES.slice(0,Math.max(0,q.mainStage-1)).some(stage=>!q.completedStages.includes(stage.id)))throw new TypeError('Contradictory main quest progress.');
 for(const entry of OPTIONAL_QUESTS){if((q.optional[entry.id]!=='available')!==q.flags.includes('flag_'+entry.id))throw new TypeError('Contradictory side quest state.');}
 for(const [id,scene,item] of [['quest_optional_ledger','scene_upper_ledger','item_quest_tessa_ledger'],['quest_optional_tools','scene_upper_tools','item_quest_orro_tools']] as const){
  const status=q.optional[id],has=q.questItems.includes(item),seen=q.seenScenes.includes(scene);
  if((status==='ready')!==has || (status==='ready'||status==='completed')!==seen)throw new TypeError('Contradictory upper-cistern recovery record.');
 }
 if(q.flags.includes('flag_upper_descent_ready')&&(!UPPER_CLUES.every(id=>q.seenScenes.includes(id))||!q.seenScenes.includes('scene_upper_descent')||q.mainStage<3))throw new TypeError('Descent was unlocked without the bell clues.');
 if(q.questItems.includes('item_quest_regulator')&&q.mainStage<6)throw new TypeError('The regulator is not yet obtainable.');
 if(q.mainStage>=4&&!q.flags.includes('flag_upper_descent_ready'))throw new TypeError('Vault entered without upper seal.');
 if(q.mainStage>=5&&(!q.flags.includes('flag_vault_valves')||!VALVE_ORDER.every(id=>q.seenScenes.includes(id))))throw new TypeError('Valve stage skipped.');
 if(q.mainStage===6&&!q.seenScenes.includes('scene_vault_regulator'))throw new TypeError('Boss reward not collected.');
 if(q.ending&&(!q.flags.includes('flag_ending_'+q.ending)||!q.completedStages.includes('quest_main_06')||q.mainStage!==6))throw new TypeError('Invalid ending record.');
 if(!q.ending&&(q.flags.includes('flag_ending_repair')||q.flags.includes('flag_ending_disconnect')||q.completedStages.includes('quest_main_06')))throw new TypeError('Ending flag without resolution.');
 if(q.mainStage<6&&q.ending)throw new TypeError('Ending before the regulator.');
 if(q.mainStage<5&&(q.flags.includes('flag_vault_valves')||q.seenScenes.some(x=>x==='scene_vault_regulator')))throw new TypeError('Regulator sequence skipped.');
 if(q.optional.quest_optional_echo==='ready'!==q.questItems.includes('item_quest_nera_echo')||
    (['ready','completed'].includes(q.optional.quest_optional_echo))!==q.seenScenes.includes('scene_vault_echo'))throw new TypeError('Contradictory echo quest record.');
 if(q.mainStage<4&&q.valveSequence.length)throw new TypeError('Valve input before entering vault.');
 for(const [item,quest] of [['item_quest_tessa_ledger','quest_optional_ledger'],['item_quest_orro_tools','quest_optional_tools'],['item_quest_nera_echo','quest_optional_echo']] as const){if(q.questItems.includes(item)&&q.optional[quest]==='available')throw new TypeError('Side quest item without its quest.');}
 return q;
}
export interface QuestResult{state:CampaignState;changed:boolean;message:string;}
const reject=(s:CampaignState,message:string):QuestResult=>({state:s,changed:false,message});
export function acceptMain(s:CampaignState):QuestResult{
 if(s.quests.mainStage!==0)return reject(s,'Iona has already given you the cistern key. Read your journal with V.');
 const next=structuredClone(s);next.quests.mainStage=2;next.quests.completedStages.push('quest_main_01');next.quests.flags.push('flag_iona_cistern_task');next.quests.questItems.push('item_quest_cistern_key');
 next.quests.notes.push('Iona Reed: The brass key opens the old cistern approach. Enter the galleries at the northern stair (13,2). The regulator is missing.');
 return {state:next,changed:true,message:'Iona lends you the brass cistern key. The request and first completed stage are recorded in your journal (V).'};
}
export function acceptOptional(s:CampaignState,id:OptionalQuestId):QuestResult{
 const q=OPTIONAL_QUESTS.find(q=>q.id===id);if(!q)return reject(s,'Unknown request.');
 if(s.quests.optional[id]!=='available')return reject(s,`${q.title} is already in your journal.`);
 const next=structuredClone(s);next.quests.optional[id]='active';next.quests.flags.push('flag_'+id);next.quests.notes.push(`${q.title}: ${q.objective}`);
 return {state:next,changed:true,message:`New optional quest: ${q.title}. ${q.objective}`};
}
/** Called only on a confirmed town -> dungeon portal. Future dungeon phases extend this function. */
export function onTravelQuest(s:CampaignState,from:string,to:string):void{
 if(from==='map_town'&&to==='map_diagnostic_galleries'&&s.quests.mainStage===2&&s.quests.questItems.includes('item_quest_cistern_key')){
  s.quests.mainStage=3;s.quests.completedStages.push('quest_main_02');s.quests.notes.push('Entered the Upper Galleries of the Upper Cistern. Three bells—Copper, Moon, Glass—hold the key to the lower resonator stair.');
 }
 if(from==='map_diagnostic_galleries'&&to==='map_resonator_vault'&&s.quests.mainStage===3&&s.quests.flags.includes('flag_upper_descent_ready')){
  s.quests.mainStage=4;s.quests.completedStages.push('quest_main_03');s.quests.notes.push('Descended into the Resonator Vault. A maintenance score by the valves repeats Copper → Moon → Glass.');
 }
}
/** Inspect only a nearby, visible scene. First inspection generates exactly one permanent note. */
export function inspectTownScene(s:CampaignState,registry:MapRegistry):QuestResult|null{
 if(s.currentMapId!=='map_town'||s.combat.active||s.combat.defeated)return null;
 const map=registry.map_town,w=s.maps.map_town,d=DIRECTIONS[w.facing];
 const candidate=map.props.find(p=>TOWN_SCENES.includes(p.id as typeof TOWN_SCENES[number])&&((p.x===w.x&&p.y===w.y)||(p.x===w.x+d.x&&p.y===w.y+d.y&&!isOpaque(map,w,p.x,p.y))));
 if(!candidate)return null;
 if(s.quests.seenScenes.includes(candidate.id))return null; // let fountains, portals and ordinary scenery remain interactive
 const next=structuredClone(s);next.quests.seenScenes.push(candidate.id);next.quests.notes.push(`${candidate.name}: ${candidate.description}`);
 next.elapsedMinutes+=1;next.maps.map_town.minutes+=1;
 return {state:next,changed:true,message:`${candidate.name}: ${candidate.description} (Added to Auto Notes.)`};
}

/** Upper Cistern scene inspection, bounded to the current map and facing; no remote pickups. */
export function inspectUpperScene(s:CampaignState,registry:MapRegistry,sceneId?:string):QuestResult|null{
 if(s.currentMapId!=='map_diagnostic_galleries'||s.combat.active||s.combat.defeated)return null;
 const map=registry[s.currentMapId],w=s.maps[s.currentMapId],d=DIRECTIONS[w.facing];
 const scenes=map.props.filter(p=>(UPPER_SCENES as readonly string[]).includes(p.id));
 const available=scenes.filter(p=>!sceneId||p.id===sceneId);const prop=available.find(p=>p.x===w.x&&p.y===w.y)??available.find(p=>p.x===w.x+d.x&&p.y===w.y+d.y&&!isOpaque(map,w,p.x,p.y));
 if(!prop)return null;
 const q=s.quests;
 if(prop.id==='scene_upper_descent'){
  if(q.mainStage<3)return reject(s,'The resonator stair cannot be used before accepting Iona’s mission.');
  const missing=UPPER_CLUES.filter(id=>!q.seenScenes.includes(id));
  if(missing.length)return reject(s,`The resonator stair demands all three bell inscriptions. ${missing.length} clue${missing.length===1?' remains':'s remain'} (Copper, Moon, Glass).`);
  if(q.flags.includes('flag_upper_descent_ready'))return reject(s,'The resonator stair is open. Press Space here to descend into the Resonator Vault.');
  const next=structuredClone(s);next.quests.flags.push('flag_upper_descent_ready');next.quests.seenScenes.push(prop.id);if(next.ground)next.ground.containers=next.ground.containers.map(c=>({...c,entries:c.entries.filter(e=>e.sceneId!==prop.id)})).filter(c=>c.kind==='corpse'||c.entries.length||c.gold);
  next.quests.notes.push('The resonator stair answers Copper → Moon → Glass. The entrance to the Resonator Vault is now accessible.');
  next.elapsedMinutes++;next.maps[next.currentMapId].minutes++;
  return {state:next,changed:true,message:'Copper → Moon → Glass! The lower stair unlocks. Press Space again to descend into the Resonator Vault.'};
 }
 if(prop.id==='scene_upper_ledger'||prop.id==='scene_upper_tools'){
  const ledger=prop.id==='scene_upper_ledger',id=ledger?'quest_optional_ledger':'quest_optional_tools',item=ledger?'item_quest_tessa_ledger':'item_quest_orro_tools';
  if(q.optional[id]==='available')return reject(s,`This object belongs to ${ledger?'Tessa':'Orro'}. Accept their request in town before collecting it.`);
  if(!ledger&&!s.expedition.triggeredTraps.includes('map_diagnostic_galleries:upper_tool_snare'))return null; // Let expedition search/disarm the dangerous cache first.
  if(q.optional[id]==='completed')return reject(s,'You already returned this recovered item.');
  if(q.optional[id]==='ready')return reject(s,'The recovered item is recorded under Quest Items (V). Return to town for your reward.');
  const next=structuredClone(s);next.quests.optional[id]='ready';next.quests.questItems.push(item);next.quests.seenScenes.push(prop.id);if(next.ground)next.ground.containers=next.ground.containers.map(c=>({...c,entries:c.entries.filter(e=>e.sceneId!==prop.id)})).filter(c=>c.kind==='corpse'||c.entries.length||c.gold);
  next.quests.notes.push(`${prop.name}: ${prop.description} Return to ${ledger?'Tessa':'Orro'} for the quest reward.`);
  next.elapsedMinutes++;next.maps[next.currentMapId].minutes++;
  return {state:next,changed:true,message:`Recovered ${ledger?'Tessa’s lost ledger':'Orro’s tool roll'} as a protected quest item. Return to the quest giver for a reward.`};
 }
 if(q.seenScenes.includes(prop.id))return null;
 const next=structuredClone(s);next.quests.seenScenes.push(prop.id);if(next.ground)next.ground.containers=next.ground.containers.map(c=>({...c,entries:c.entries.filter(e=>e.sceneId!==prop.id)})).filter(c=>c.kind==='corpse'||c.entries.length||c.gold);next.quests.notes.push(`${prop.name}: ${prop.description}`);
 next.elapsedMinutes++;next.maps[next.currentMapId].minutes++;
 const extra=(UPPER_CLUES as readonly string[]).includes(prop.id)?` (${UPPER_CLUES.filter(id=>next.quests.seenScenes.includes(id)).length}/3 bell inscriptions found.)`:'';
 return {state:next,changed:true,message:`${prop.name}: ${prop.description}${extra} Added to Auto Notes.`};
}
/** Turn-in requires a ready quest item; gold and XP pay out only once. */
export function completeUpperOptional(s:CampaignState,id:'quest_optional_ledger'|'quest_optional_tools'):QuestResult{
 if(s.quests.optional[id]!=='ready')return reject(s,'The requested item has not been recovered, or the reward was already collected.');
 const ledger=id==='quest_optional_ledger',item=ledger?'item_quest_tessa_ledger':'item_quest_orro_tools',gold=ledger?25:40;
 if(!s.quests.questItems.includes(item))return reject(s,'Your quest ledger is missing the requested item.');
 const next=structuredClone(s);next.quests.optional[id]='completed';next.quests.questItems=next.quests.questItems.filter(v=>v!==item);
 next.party.resources.gold+=gold;for(const member of next.party.order)next.party.characters[member].xp+=60;
 next.quests.notes.push(`${ledger?'Tessa':'Orro'} received ${ledger?'the lost ledger':'the tool roll'} and rewarded the party with ${gold} gold and 60 XP each.`);
 return {state:next,changed:true,message:`Quest complete! ${ledger?'Tessa':'Orro'} awards ${gold} gold and 60 XP to each active adventurer.`};
}

/** Interact with vault scenery or enter the three-valve sequence. All commits are atomic. */
export function inspectVaultScene(s:CampaignState,registry:MapRegistry,sceneId?:string):QuestResult|null{
 if(s.currentMapId!=='map_resonator_vault'||s.combat.active||s.combat.defeated)return null;
 const map=registry[s.currentMapId],w=s.maps[s.currentMapId],d=DIRECTIONS[w.facing];
 const candidates=map.props.filter(p=>(VAULT_SCENES as readonly string[]).includes(p.id));
 const available=candidates.filter(p=>!sceneId||p.id===sceneId);const prop=available.find(p=>p.x===w.x&&p.y===w.y)??available.find(p=>p.x===w.x+d.x&&p.y===w.y+d.y&&!isOpaque(map,w,p.x,p.y));
 if(!prop)return null;
 const q=s.quests;
 if((VALVE_ORDER as readonly string[]).includes(prop.id)){
  if(q.mainStage<4)return reject(s,'The valves cannot be operated before the party descends.');
  if(q.flags.includes('flag_vault_valves'))return reject(s,'The three valves are already aligned. The Bell-Heart chamber is open.');
  const next=structuredClone(s),step=q.valveSequence.length;
  next.elapsedMinutes++;next.maps[next.currentMapId].minutes++;
  if(prop.id!==VALVE_ORDER[step]){
   next.quests.valveSequence=[];
   const names=next.party.order.map(id=>next.party.characters[id]);
   for(const c of names)if(c.hp>1)c.hp=Math.max(1,c.hp-3);
   next.quests.notes.push('The valves rejected the sequence and vented steam. The safe order is Copper → Moon → Glass.');
   return {state:next,changed:true,message:'Wrong sequence! A steam vent scorches the party (up to 3 damage each, never lethal). All three valves reset.'};
  }
  next.quests.valveSequence.push(prop.id);if(!next.quests.seenScenes.includes(prop.id))next.quests.seenScenes.push(prop.id);if(next.ground)next.ground.containers=next.ground.containers.map(c=>({...c,entries:c.entries.filter(e=>e.sceneId!==prop.id)})).filter(c=>c.kind==='corpse'||c.entries.length||c.gold);
  if(next.quests.valveSequence.length===3){
   next.quests.valveSequence=[];next.quests.flags.push('flag_vault_valves');next.quests.mainStage=5;next.quests.completedStages.push('quest_main_04');
   next.maps.map_resonator_vault.doors.door_bell_heart_seal=true;
   next.quests.notes.push('Copper, Moon and Glass aligned. The Bell-Heart chamber gate opens at (12,4).');
   return {state:next,changed:true,message:'All three valves align. The sealed Bell-Heart chamber opens! (12,4).'};
  }
  return {state:next,changed:true,message:`${prop.name} turns with a chime (${next.quests.valveSequence.length}/3). The next valve is ${step===0?'Moon':'Glass'}.`};
 }
 if(prop.id==='scene_vault_echo'){
  if(q.optional.quest_optional_echo==='available')return reject(s,'Nera can explain the bottled echo in her guild back in Bellwether Quay.');
  if(q.optional.quest_optional_echo==='completed')return reject(s,'Nera already received the bottled echo.');
  if(q.optional.quest_optional_echo==='ready')return reject(s,'The bottled echo is safely in Quest Items (V). Bring it to Nera.');
  const next=structuredClone(s);next.quests.optional.quest_optional_echo='ready';next.quests.questItems.push('item_quest_nera_echo');next.quests.seenScenes.push(prop.id);if(next.ground)next.ground.containers=next.ground.containers.map(c=>({...c,entries:c.entries.filter(e=>e.sceneId!==prop.id)})).filter(c=>c.kind==='corpse'||c.entries.length||c.gold);
  next.quests.notes.push('Echo Shrine: The old warden relinquished a bottled chime peacefully. Take the intact memory to Nera.');next.elapsedMinutes++;next.maps[next.currentMapId].minutes++;
  return {state:next,changed:true,message:'You ask the shrine for its remembrance. The bottle rings softly and is collected for Nera, without combat.'};
 }
 if(prop.id==='scene_vault_regulator'){
  if(q.mainStage<5)return reject(s,'The regulator remains behind the sealed chamber. Reset all three valves first.');
  if(!s.combat.encounters.enc_bell_heart?.cleared)return reject(s,'The Bell-Heart Custodian still guards the regulator.');
  if(q.mainStage===6)return reject(s,'You already recovered the regulator. Return to Iona Reed for the ending.');
  const next=structuredClone(s);next.quests.questItems.push('item_quest_regulator');next.quests.mainStage=6;next.quests.completedStages.push('quest_main_05');next.quests.seenScenes.push(prop.id);if(next.ground)next.ground.containers=next.ground.containers.map(c=>({...c,entries:c.entries.filter(e=>e.sceneId!==prop.id)})).filter(c=>c.kind==='corpse'||c.entries.length||c.gold);
  next.quests.flags.push('flag_bell_heart_defeated');next.quests.notes.push('Recovered the Bell-Heart regulator. Iona must choose whether the town should repair or disconnect the resonator. A shortcut back to the Upper Cistern is now accessible.');
  next.elapsedMinutes++;next.maps[next.currentMapId].minutes++;
  return {state:next,changed:true,message:'The Bell-Heart regulator is recovered! The shortcut back upstairs opens. Return to Iona to choose Bellwether’s future.'};
 }
 if(q.seenScenes.includes(prop.id))return null;
 const next=structuredClone(s);next.quests.seenScenes.push(prop.id);if(next.ground)next.ground.containers=next.ground.containers.map(c=>({...c,entries:c.entries.filter(e=>e.sceneId!==prop.id)})).filter(c=>c.kind==='corpse'||c.entries.length||c.gold);next.quests.notes.push(`${prop.name}: ${prop.description}`);next.elapsedMinutes++;next.maps[next.currentMapId].minutes++;
 return {state:next,changed:true,message:`${prop.name}: ${prop.description} (Recorded in Auto Notes.)`};
}
export function completeEchoOptional(s:CampaignState):QuestResult{
 if(s.quests.optional.quest_optional_echo!=='ready'||!s.quests.questItems.includes('item_quest_nera_echo'))return reject(s,'Nera needs the bottled echo from the deep vault shrine.');
 const next=structuredClone(s);next.quests.optional.quest_optional_echo='completed';next.quests.questItems=next.quests.questItems.filter(x=>x!=='item_quest_nera_echo');next.party.resources.gold+=50;
 for(const id of next.party.order)next.party.characters[id].xp+=75;
 next.quests.notes.push('Nera preserved the bottled echo and rewarded the party with 50 gold and 75 XP each.');
 return {state:next,changed:true,message:'Nera receives the bottled echo: +50 gold and +75 XP to each active adventurer.'};
}
export function resolveEnding(s:CampaignState,choice:'repair'|'disconnect'):QuestResult{
 if(s.quests.ending)return reject(s,'Bellwether’s fate is already decided. You may still finish optional quests.');
 if(s.quests.mainStage!==6||!s.quests.questItems.includes('item_quest_regulator'))return reject(s,'The Bell-Heart regulator must be recovered before Iona can make a choice.');
 const next=structuredClone(s);next.quests.ending=choice;next.quests.flags.push('flag_ending_'+choice);next.quests.completedStages.push('quest_main_06');next.party.resources.gold+=150;
 for(const id of next.party.order)next.party.characters[id].xp+=200;
 const epilogue=choice==='repair'?'Iona returns the regulator to the ancient machinery. Bells sound softly; clean water flows again, but the town vows to watch its power.':'Iona severs the resonator and seals it from the village. The mysterious singing ceases; the town accepts harder work for a quieter future.';
 next.quests.notes.push('ENDING — '+epilogue+' Reward: 150 gold and 200 XP to each active adventurer.');
 return {state:next,changed:true,message:`THE END — ${epilogue} Reward: 150 gold and 200 XP each. Your adventure remains playable.`};
}
