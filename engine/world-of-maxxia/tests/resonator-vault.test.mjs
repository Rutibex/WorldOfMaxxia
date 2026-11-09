import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry,travelCampaign,CAMPAIGN_VERSION} from '../src/shared/rules/campaign.ts';
import {acceptMain,acceptOptional,inspectUpperScene,inspectVaultScene,resolveEnding} from '../src/shared/rules/quests.ts';
import {serviceAction} from '../src/shared/rules/services.ts';
import {bashExpedition} from '../src/shared/rules/expedition.ts';
import {initialGridState,isOpaque,DIRECTIONS} from '../src/shared/rules/grid.ts';
import {combatAction,beginEncounter} from '../src/shared/rules/combat.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL(`../public/content/${n}.json`,import.meta.url)))));
const fresh=()=>newCampaign(registry);
const persist=s=>parseCampaign(serializeCampaign(s,registry),registry);
const at=(s,mapId,x,y,facing=0)=>{s.currentMapId=mapId;const w=s.maps[mapId];w.x=x;w.y=y;w.facing=facing;const k=`${x},${y}`;if(!w.visited.includes(k))w.visited.push(k);return s;};
const upper=(s,x,y,f=0)=>inspectUpperScene(at(s,'map_diagnostic_galleries',x,y,f),registry);
const vault=(s,x,y,f=0)=>inspectVaultScene(at(s,'map_resonator_vault',x,y,f),registry);
const enter=()=>{
 let s=acceptMain(fresh()).state;
 at(s,'map_town',13,3,0);s=travelCampaign(s,registry).state;
 for(const [x,y] of [[2,2],[8,2],[13,3]])s=upper(s,x,y).state;
 s=upper(s,13,13).state;
 at(s,'map_diagnostic_galleries',13,13,0);s=travelCampaign(s,registry).state;
 return s;
};
test('three floor maps connect with walkable looped lower floor and a locked boss gate',()=>{
 const m=registry.map_resonator_vault;assert.equal(m.rows.length,16);assert.ok(m.rows.every(row=>row.length===16));
 const w=initialGridState(m);for(const door of m.doors)w.doors[door.id]=true;for(const sec of m.secrets)w.secrets[sec.id]=true;
 const visited=new Set([`${w.x},${w.y}`]),queue=[[w.x,w.y]];
 while(queue.length){const [x,y]=queue.shift();for(const d of DIRECTIONS){const nx=x+d.x,ny=y+d.y,k=`${nx},${ny}`;if(isOpaque(m,w,nx,ny)||visited.has(k))continue;visited.add(k);queue.push([nx,ny]);}}
 for(const p of m.props)assert.ok(visited.has(`${p.x},${p.y}`),`${p.id} is unreachable`);
 assert.ok(visited.has('12,2'));assert.ok(visited.has('7,8'));
 assert.equal(isOpaque(m,initialGridState(m),12,4),true);
 assert.ok(m.portals.some(p=>p.targetMapId==='map_diagnostic_galleries'));
});
test('upper stair cannot be used without clues and descent completes MQ03 exactly once',()=>{
 let s=acceptMain(fresh()).state;at(s,'map_town',13,3,0);s=travelCampaign(s,registry).state;
 at(s,'map_diagnostic_galleries',13,13,0);assert.equal(travelCampaign(s,registry),null);
 for(const [x,y] of [[2,2],[8,2],[13,3]])s=upper(s,x,y).state;
 s=upper(s,13,13).state;assert.deepEqual(persist(s),s);
 s=travelCampaign(at(s,'map_diagnostic_galleries',13,13,0),registry).state;
 assert.equal(s.currentMapId,'map_resonator_vault');assert.equal(s.quests.mainStage,4);
 assert.ok(s.quests.completedStages.includes('quest_main_03'));assert.deepEqual(persist(s),s);
});
test('wrong valve order resets with bounded nonlethal damage; valid sequence opens boss seal',()=>{
 let s=enter();for(const id of s.party.order)s.party.characters[id].hp=2;
 const wrong=vault(s,8,8);assert.ok(wrong.changed);assert.match(wrong.message,/Wrong sequence/);s=wrong.state;
 assert.ok(s.party.order.every(id=>s.party.characters[id].hp>=1));assert.deepEqual(s.quests.valveSequence,[]);
 for(const [x,y] of [[6,8],[7,8],[8,8]]){const r=vault(s,x,y);assert.ok(r.changed);s=r.state;}
 assert.equal(s.quests.mainStage,5);assert.equal(s.maps.map_resonator_vault.doors.door_bell_heart_seal,true);
 assert.ok(s.quests.flags.includes('flag_vault_valves'));assert.deepEqual(persist(s),s);
 const duplicate=vault(s,6,8);assert.equal(duplicate.changed,false);
});
test('sealed chamber resists bash until the puzzle is solved',()=>{
 let s=enter();at(s,'map_resonator_vault',12,5,0);
 const before=s.elapsedMinutes,gate=bashExpedition(s,registry);assert.equal(gate.changed,false);assert.equal(s.elapsedMinutes,before);
 assert.match(gate.message,/quest seal/i);
});
test('echo quest can be recovered peacefully and claimed from Nera once',()=>{
 let s=acceptOptional(enter(),'quest_optional_echo').state;
 const result=vault(s,3,4);assert.ok(result.changed);s=result.state;assert.equal(s.quests.optional.quest_optional_echo,'ready');
 assert.ok(s.quests.questItems.includes('item_quest_nera_echo'));assert.deepEqual(persist(s),s);
 at(s,'map_town',6,3,0);const claimed=serviceAction(s,registry,{serviceId:'npc_nera_salt',action:'turn_in'});assert.ok(claimed.changed);s=claimed.state;
 assert.equal(s.quests.optional.quest_optional_echo,'completed');assert.equal(serviceAction(s,registry,{serviceId:'npc_nera_salt',action:'turn_in'}).changed,false);
 assert.deepEqual(persist(s),s);
});
test('boss cannot be fled, boss core needs victory, regulator claim is one-time',()=>{
 let s=enter();for(const [x,y] of [[6,8],[7,8],[8,8]])s=vault(s,x,y).state;
 assert.equal(vault(s,13,2).changed,false);
 const enc=s.combat.encounters.enc_bell_heart;enc.enemies[0].hp=0;enc.cleared=true;enc.rewarded=true;
 let r=vault(s,13,2);assert.ok(r.changed);s=r.state;assert.equal(s.quests.mainStage,6);assert.ok(s.quests.questItems.includes('item_quest_regulator'));
 assert.equal(vault(s,13,2).changed,false);assert.deepEqual(persist(s),s);
 const active=structuredClone(s);active.combat.encounters.enc_bell_heart.cleared=false;active.combat.encounters.enc_bell_heart.rewarded=false;active.combat.encounters.enc_bell_heart.enemies[0].hp=20;
 active.combat.active={encounterId:'enc_bell_heart',turnOrder:[active.party.order[0],'enemy_bell_heart'],turnIndex:0,round:1,targetId:'enemy_bell_heart',guarding:[]};
 assert.equal(combatAction(active,registry,'run').changed,false);
});
test('both endings reward exactly once and leave optional quests accessible',()=>{
 for(const choice of ['repair','disconnect']){
 let s=enter();for(const [x,y] of [[6,8],[7,8],[8,8]])s=vault(s,x,y).state;
 const b=s.combat.encounters.enc_bell_heart;b.enemies[0].hp=0;b.cleared=true;b.rewarded=true;s=vault(s,13,2).state;
 at(s,'map_town',8,8,0);const before=s.party.resources.gold;
 const done=serviceAction(s,registry,{serviceId:'npc_iona_reed',action:`ending_${choice}`});assert.ok(done.changed);s=done.state;
 assert.equal(s.quests.ending,choice);assert.equal(s.party.resources.gold,before+150);assert.ok(s.quests.completedStages.includes('quest_main_06'));
 assert.deepEqual(persist(s),s);assert.equal(serviceAction(s,registry,{serviceId:'npc_iona_reed',action:'ending_repair'}).changed,false);
 const side=acceptOptional(s,'quest_optional_echo');assert.ok(side.changed);
 }
});
test('a real v12-shaped completed-upper save adds only the new level, encounters and quest fields',()=>{
 let s=enter();const old=structuredClone(s);old.version=12;delete old.maps.map_resonator_vault;
 delete old.quests.valveSequence;delete old.quests.ending;
 old.currentMapId='map_diagnostic_galleries';for(const id of ['enc_vault_drain','enc_vault_engine','enc_vault_echo','enc_bell_heart'])delete old.combat.encounters[id];
 // Legacy v12 could not have reached MQ04; revert its stage to the prepared stair state.
 old.quests.mainStage=3;old.quests.completedStages=old.quests.completedStages.filter(x=>x!=='quest_main_03');
 const updated=parseCampaign(JSON.stringify(old),registry);assert.equal(updated.version,CAMPAIGN_VERSION);
 assert.equal(updated.quests.mainStage,3);assert.equal(updated.maps.map_resonator_vault.x,2);
 assert.equal(updated.combat.encounters.enc_bell_heart.enemies[0].hp,65);assert.deepEqual(persist(updated),updated);
});
test('save validation rejects forged gate, boss completion and ending flags without altering original saves',()=>{
 let s=enter();s.maps.map_resonator_vault.doors.door_bell_heart_seal=true;
 assert.throws(()=>serializeCampaign(s,registry),/gate state/);
 s.maps.map_resonator_vault.doors.door_bell_heart_seal=false;
 for(const [x,y] of [[6,8],[7,8],[8,8]])s=vault(s,x,y).state;
 s.quests.mainStage=6;s.quests.completedStages.push('quest_main_05');s.quests.questItems.push('item_quest_regulator');s.quests.seenScenes.push('scene_vault_regulator');
 assert.throws(()=>serializeCampaign(s,registry),/defeated Bell-Heart/);
});

test('v12 to v13 migration preserves an unfinished upper-floor fight and its original enemy HP',()=>{
 let s=acceptMain(fresh()).state;at(s,'map_town',13,3,0);s=travelCampaign(s,registry).state;
 const battle=beginEncounter(s,registry);assert.ok(battle.changed);s=battle.state;
 const enemy=s.combat.encounters.enc_gallery_entry.enemies[0];enemy.hp=Math.max(1,enemy.hp-2);
 const old=structuredClone(s);old.version=12;delete old.maps.map_resonator_vault;delete old.quests.valveSequence;delete old.quests.ending;
 for(const id of ['enc_vault_drain','enc_vault_engine','enc_vault_echo','enc_bell_heart'])delete old.combat.encounters[id];
 const upgraded=parseCampaign(JSON.stringify(old),registry);
 assert.equal(upgraded.combat.active?.encounterId,'enc_gallery_entry');
 assert.equal(upgraded.combat.encounters.enc_gallery_entry.enemies[0].hp,enemy.hp);
 assert.deepEqual(upgraded.party,s.party);assert.deepEqual(upgraded.rng,s.rng);
 assert.deepEqual(persist(upgraded),upgraded);
});
