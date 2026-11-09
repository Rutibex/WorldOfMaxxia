import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMPAIGN_VERSION,newCampaign,validateMapRegistry,parseCampaign,serializeCampaign,travelCampaign} from '../src/shared/rules/campaign.ts';
import {TOWN_SERVICES,nearbyService,serviceAction} from '../src/shared/rules/services.ts';
import {MAIN_STAGES,OPTIONAL_QUESTS,PLOT_ITEMS,acceptMain,acceptOptional,inspectTownScene} from '../src/shared/rules/quests.ts';
import {tileAt} from '../src/shared/rules/grid.ts';
import {currentEnemies} from '../src/shared/rules/combat.ts';
import {EXPLORATION_COMMANDS,explorationShortcut} from '../src/client/ui-contract.ts';
const town=JSON.parse(readFileSync(new URL('../public/content/town.json',import.meta.url)));
const galleries=JSON.parse(readFileSync(new URL('../public/content/galleries.json',import.meta.url)));
const vault=JSON.parse(readFileSync(new URL('../public/content/vault.json',import.meta.url)));
const maps=validateMapRegistry([town,galleries,vault]);
const fresh=()=>newCampaign(maps);
const persist=s=>parseCampaign(serializeCampaign(s,maps),maps);
const visit=(s,x,y,facing=0)=>{const w=s.maps.map_town;s.currentMapId='map_town';w.x=x;w.y=y;w.facing=facing;const k=`${x},${y}`;if(!w.visited.includes(k))w.visited.push(k);return s;};
const byNpc=(s,id)=>{const n=TOWN_SERVICES.find(n=>n.id===id);return visit(s,n.x,n.y);};
test('authored 16x16 Firstlight: 8 service anchors, fountain, portal and street network connected',()=>{
 assert.equal(town.rows.length,16);assert.ok(town.rows.every(row=>row.length===16));
 assert.deepEqual(town.spawn,{x:7,y:12,facing:0});
 const points=[...TOWN_SERVICES.map(n=>[n.x,n.y]),[7,7],[13,2]];
 const start=[town.spawn.x,town.spawn.y],seen=new Set([start.join(',')]),q=[start];
 // Treat doors as eventually openable; no shortcut bypassing the wall layout.
 while(q.length){const [x,y]=q.shift();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=`${a},${b}`;
  if((tileAt(town,a,b)==='.'||tileAt(town,a,b)==='D')&&!seen.has(k)){seen.add(k);q.push([a,b]);}}}
 for(const [x,y] of points)assert.ok(seen.has(`${x},${y}`),`${x},${y} cannot be reached`);
 assert.ok(currentEnemies(fresh()).length===0,'no combat encounter spawns in town');
 assert.equal(TOWN_SERVICES.length,8);assert.equal(town.portals[0].targetX,2);assert.equal(town.portals[0].targetY,8);
 for(const npc of TOWN_SERVICES)assert.equal(nearbyService(byNpc(fresh(),npc.id),maps)?.id,npc.id);
});
test('six main quest stages have unique IDs and three side quests each have distinct owners',()=>{
 assert.equal(MAIN_STAGES.length,6);assert.equal(OPTIONAL_QUESTS.length,3);
 assert.equal(new Set(MAIN_STAGES.map(q=>q.id)).size,6);assert.equal(new Set(OPTIONAL_QUESTS.map(q=>q.giver)).size,3);
 const s=fresh();assert.equal(s.quests.mainStage,0);assert.ok(OPTIONAL_QUESTS.every(q=>s.quests.optional[q.id]==='available'));
 assert.ok(s.quests.questItems.length===0);assert.deepEqual(persist(s),s);
});
test('Iona accepts once, gives a plot key outside bags, and entering the dungeon completes MQ02 only',()=>{
 let s=fresh(),w=s.maps.map_town;w.x=13;w.y=3;w.facing=0;w.visited.push('13,3');
 assert.equal(travelCampaign(s,maps),null,'stair key gating is enforced');
 s=byNpc(s,'npc_iona_reed');const before=structuredClone(s.inventory);const request=serviceAction(s,maps,{serviceId:'npc_iona_reed',action:'quest'});
 assert.equal(request.changed,true);s=request.state;assert.equal(s.quests.mainStage,2);
 assert.deepEqual(s.quests.completedStages,['quest_main_01']);assert.ok(s.quests.questItems.includes('item_quest_cistern_key'));
 assert.deepEqual(s.inventory,before,'plot key does not occupy character inventory');
 const again=serviceAction(s,maps,{serviceId:'npc_iona_reed',action:'quest'});assert.equal(again.changed,false);assert.deepEqual(again.state,s);
 visit(s,13,3,0);const entered=travelCampaign(s,maps);assert.ok(entered);s=entered.state;
 assert.equal(s.quests.mainStage,3);assert.deepEqual(s.quests.completedStages,['quest_main_01','quest_main_02']);
 assert.equal(s.currentMapId,'map_diagnostic_galleries');assert.ok(s.quests.notes.some(n=>n.includes('Upper Galleries')));
 assert.equal(s.party.resources.gold,300);assert.deepEqual(persist(s),s);
 const againTravel=travelCampaign(s,maps);assert.equal(againTravel,null,'no immediate bounce to town');
});
test('optional quests can be acquired independently at Tessa, Orro and Nera, without duplicate flags or early rewards',()=>{
 let s=fresh(),gold=s.party.resources.gold;
 for(const [id,quest] of [['npc_tessa_bell','quest_optional_ledger'],['npc_orro_vane','quest_optional_tools'],['npc_nera_salt','quest_optional_echo']]){
  s=byNpc(s,id);const result=serviceAction(s,maps,{serviceId:id,action:'quest_optional'});assert.equal(result.changed,true);s=result.state;
  assert.equal(s.quests.optional[quest],'active');assert.equal(serviceAction(s,maps,{serviceId:id,action:'quest_optional'}).changed,false);
 }
 assert.equal(s.quests.notes.length,3);assert.equal(s.party.resources.gold,gold);assert.equal(s.quests.questItems.length,0);
 assert.ok(s.quests.flags.every((v,i)=>s.quests.flags.indexOf(v)===i));assert.deepEqual(persist(s),s);
 assert.equal(serviceAction(byNpc(s,'npc_pell_glass'),maps,{serviceId:'npc_pell_glass',action:'quest_optional'}).changed,false);
});
test('inspecting town landmarks writes one durable note, consumes one minute and does not duplicate it',()=>{
 let s=visit(fresh(),7,12,2),start=s.elapsedMinutes;
 const found=inspectTownScene(s,maps);assert.equal(found.changed,true);assert.ok(found.message.includes('South Gate Notice'));
 s=found.state;assert.equal(s.quests.notes.length,1);assert.equal(s.quests.seenScenes.length,1);assert.equal(s.elapsedMinutes,start+1);
 assert.equal(inspectTownScene(s,maps),null);assert.deepEqual(persist(s),s);
 assert.equal(inspectTownScene(visit(s,8,8,1),maps),null,'service tile does not masquerade as quest landmark');
});
test('Phase 15 v10 save migrates town geometry, old Iona task, RNG, inventory and dungeon progress safely',()=>{
 const original=fresh(),legacy=structuredClone(original);
 legacy.version=10;legacy.quests={flags:['flag_iona_cistern_task'],notes:['An old rumor survived the import.']};
 const w=legacy.maps.map_town;w.x=2;w.y=2;w.facing=1;w.visited=['2,2','4,2','5,2','7,8'];w.doors.town_north_gate=true;w.doors.town_south_gate=false;
 legacy.party.resources.gold=123;legacy.maps.map_diagnostic_galleries.doors.door_north=true;
 const restored=parseCampaign(JSON.stringify(legacy),maps);
 assert.equal(restored.version,CAMPAIGN_VERSION);assert.equal(restored.party.resources.gold,123);
 assert.equal(restored.maps.map_town.x,7);assert.equal(restored.maps.map_town.y,12);
 assert.equal(restored.maps.map_town.doors.town_north_gate,true);
 assert.equal(restored.maps.map_diagnostic_galleries.doors.door_north,true);
 assert.equal(restored.quests.mainStage,2);assert.ok(restored.quests.questItems.includes('item_quest_cistern_key'));
 assert.ok(restored.quests.notes.includes('An old rumor survived the import.'));
 assert.deepEqual(restored.rng,original.rng);assert.deepEqual(restored.inventory,original.inventory);
 assert.deepEqual(parseCampaign(serializeCampaign(restored,maps),maps),restored);
});
test('bad quest ledger state is rejected on import without rewriting valid source bytes',()=>{
 const base=fresh();for(const mutate of [q=>q.mainStage=6,q=>q.questItems.push('item_quest_regulator'),q=>q.seenScenes.push('scene_undefined'),q=>q.optional.quest_optional_ledger='injected',q=>q.completedStages.push('quest_main_05'),q=>q.mainStage=-1]){
  const corrupt=structuredClone(base);mutate(corrupt.quests);assert.throws(()=>parseCampaign(JSON.stringify(corrupt),maps));
 }
 assert.equal(base.quests.mainStage,0);assert.deepEqual(persist(base),base);
});

test('V dispatches Search; journal remains available in the expedition workspace',()=>{const cmd=EXPLORATION_COMMANDS.find(c=>c.id==='search');assert.ok(cmd);assert.equal(cmd.reason,'');assert.equal(explorationShortcut({code:'KeyV'}),'search');});
