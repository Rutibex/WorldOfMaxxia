import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMapRegistry,newCampaign,serializeCampaign,parseCampaign,travelCampaign,CAMPAIGN_VERSION} from '../src/shared/rules/campaign.ts';
import {initialGridState,isOpaque,DIRECTIONS} from '../src/shared/rules/grid.ts';
import {inspectUpperScene,acceptMain,acceptOptional,UPPER_CLUES} from '../src/shared/rules/quests.ts';
import {serviceAction} from '../src/shared/rules/services.ts';
import {interactExpedition,moveExpedition} from '../src/shared/rules/expedition.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(id=>JSON.parse(readFileSync(new URL(`../public/content/${id}.json`,import.meta.url)))));
const map=registry.map_diagnostic_galleries;
const fresh=()=>newCampaign(registry);
const at=(s,x,y,facing=0,mapId='map_diagnostic_galleries')=>{
 s.currentMapId=mapId;const w=s.maps[mapId];w.x=x;w.y=y;w.facing=facing;
 const k=`${x},${y}`;if(!w.visited.includes(k))w.visited.push(k);return s;
};
const begin=()=>{
 let s=acceptMain(fresh()).state;const w=s.maps.map_town;w.x=13;w.y=3;w.facing=0;w.visited.push('13,3');
 const t=travelCampaign(s,registry);assert.ok(t);assert.equal(t.state.quests.mainStage,3);return t.state;
};
const persist=s=>parseCampaign(serializeCampaign(s,registry),registry);
const inspect=(s,x,y)=>inspectUpperScene(at(s,x,y),registry);

test('Upper Cistern is a bounded, fully connected 16×16 map with reachable secrets, gates, props, traps and caches',()=>{
 assert.equal(map.rows.length,16);assert.ok(map.rows.every(x=>x.length===16));
 assert.ok(map.props.length>=13);assert.ok(map.doors.length>=5);assert.ok(map.traps.length>=5);
 const w=initialGridState(map);for(const d of map.doors)w.doors[d.id]=true;for(const sec of map.secrets)w.secrets[sec.id]=true;
 const visited=new Set([`${w.x},${w.y}`]),todo=[[w.x,w.y]];
 while(todo.length){const [x,y]=todo.shift();for(const dir of DIRECTIONS){const nx=x+dir.x,ny=y+dir.y,key=`${nx},${ny}`;if(isOpaque(map,w,nx,ny)||visited.has(key))continue;visited.add(key);todo.push([nx,ny]);}}
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(map.rows[y][x]!== '#')assert.ok(visited.has(`${x},${y}`),`unreachable (${x},${y})`);
 for(const prop of map.props)assert.ok(visited.has(`${prop.x},${prop.y}`),`${prop.id} unreachable`);
 assert.equal(map.portals.find(x=>x.id==='portal_dungeon_to_town').targetMapId,'map_town');
});
test('all three bell inscriptions are one-time, preserve distinct notes, and never prematurely complete MQ03',()=>{
 let s=begin();for(const [x,y] of [[2,2],[8,2],[13,3]]){
  const before=s.elapsedMinutes,r=inspect(s,x,y);assert.ok(r?.changed);s=r.state;assert.equal(s.elapsedMinutes,before+1);
  assert.equal(inspect(s,x,y),null);assert.equal(s.quests.mainStage,3);
 }
 assert.ok(UPPER_CLUES.every(id=>s.quests.seenScenes.includes(id)));
 assert.equal(s.quests.notes.filter(n=>/Bell Inscription|Moon-Cut Plaque|Glass Chime Diagram/.test(n)).length,3);
 assert.deepEqual(persist(s),s);
});
test('lower stair rejects missing clues and unlocks once; no unbuilt Phase 18 area can be entered',()=>{
 let s=begin();const early=inspect(s,13,13);assert.equal(early.changed,false);assert.match(early.message,/three bell inscriptions/i);
 for(const [x,y] of [[2,2],[8,2],[13,3]])s=inspect(s,x,y).state;
 const r=inspect(s,13,13);assert.equal(r.changed,true);assert.match(r.message,/Resonator Vault/);s=r.state;
 assert.ok(s.quests.flags.includes('flag_upper_descent_ready'));assert.equal(s.quests.mainStage,3);
 assert.equal(inspect(s,13,13).changed,false);assert.deepEqual(persist(s),s);
 assert.equal(travelCampaign(s,registry)?.state.currentMapId,'map_resonator_vault');
});
test('Tessa’s ledger is hidden behind a real secret wall and is inaccessible before quest acceptance',()=>{
 let s=begin();const before=inspect(s,4,12);assert.equal(before.changed,false);assert.equal(s.quests.questItems.length,1);
 s=acceptOptional(s,'quest_optional_ledger').state;
 const secret=s.maps.map_diagnostic_galleries.secrets;assert.equal(secret.upper_ledger_arch,false);
 at(s,6,12,3);let reached=interactExpedition(s,registry);assert.ok(reached?.changed);s=reached.state;
 assert.equal(s.maps.map_diagnostic_galleries.secrets.upper_ledger_arch,true);
 const open=moveExpedition(s,registry,'forward');assert.equal(open.state.maps.map_diagnostic_galleries.x,5);
 s=inspect(open.state,4,12).state;assert.equal(s.quests.optional.quest_optional_ledger,'ready');
 assert.ok(s.quests.questItems.includes('item_quest_tessa_ledger'));
 assert.equal(inspect(s,4,12).changed,false);assert.deepEqual(persist(s),s);
});
test('Orro’s trapped tool chamber must be disarmed or triggered before picking up quest tool roll',()=>{
 let s=acceptOptional(begin(),'quest_optional_tools').state;
 at(s,12,13,0);assert.equal(inspectUpperScene(s,registry),null,'trap interaction should handle the tool before pickup');
 for(let n=0;n<100&&!s.expedition.triggeredTraps.includes('map_diagnostic_galleries:upper_tool_snare');n++){
  const result=interactExpedition(s,registry);assert.ok(result);s=result.state;
 }
 assert.ok(s.expedition.triggeredTraps.includes('map_diagnostic_galleries:upper_tool_snare'));
 const recover=inspect(s,12,12);assert.equal(recover.changed,true);s=recover.state;
 assert.equal(s.quests.optional.quest_optional_tools,'ready');assert.ok(s.quests.questItems.includes('item_quest_orro_tools'));
 assert.deepEqual(persist(s),s);
});
test('both town turn-ins consume protected quest items and award gold/XP once, after recovery',()=>{
 let s=acceptOptional(acceptOptional(begin(),'quest_optional_ledger').state,'quest_optional_tools').state;
 // Mark the dungeon objective recovered using its real interaction rules.
 s.maps.map_diagnostic_galleries.secrets.upper_ledger_arch=true;
 s=inspect(s,4,12).state;s.expedition.triggeredTraps.push('map_diagnostic_galleries:upper_tool_snare');s=inspect(s,12,12).state;
 const startGold=s.party.resources.gold,startXP=s.party.characters[s.party.order[0]].xp;
 at(s,4,11,0,'map_town');
 let result=serviceAction(s,registry,{serviceId:'npc_tessa_bell',action:'turn_in'});assert.equal(result.changed,true);s=result.state;
 assert.equal(s.party.resources.gold,startGold+25);assert.equal(s.party.characters[s.party.order[0]].xp,startXP+60);
 assert.equal(serviceAction(s,registry,{serviceId:'npc_tessa_bell',action:'turn_in'}).changed,false);
 at(s,10,11,0,'map_town');result=serviceAction(s,registry,{serviceId:'npc_orro_vane',action:'turn_in'});assert.equal(result.changed,true);s=result.state;
 assert.equal(s.party.resources.gold,startGold+65);assert.equal(s.party.characters[s.party.order[0]].xp,startXP+120);
 assert.ok(!s.quests.questItems.includes('item_quest_tessa_ledger')&&!s.quests.questItems.includes('item_quest_orro_tools'));
 assert.deepEqual(persist(s),s);
});
test('migration from actual Phase 16 save structure preserves old progress and adds new dungeon state',()=>{
 const s=begin();s.maps.map_diagnostic_galleries.doors.door_south=true;s.maps.map_diagnostic_galleries.visited.push('5,8');
 s.combat.encounters.enc_gallery_entry.cleared=true;s.combat.encounters.enc_gallery_entry.rewarded=true;
 for(const enemy of s.combat.encounters.enc_gallery_entry.enemies)enemy.hp=0;
 s.inventory.claimed.push('cache_gallery_mirror');s.party.resources.gold=443;
 const old=structuredClone(s);old.version=11;
 old.maps.map_diagnostic_galleries.doors={door_south:true,door_north:false};
 old.maps.map_diagnostic_galleries.secrets={gallery_hidden_arch:false};
 for(const id of ['enc_upper_pumps','enc_upper_archive','enc_upper_sluice'])delete old.combat.encounters[id];
 const upgraded=parseCampaign(JSON.stringify(old),registry);
 assert.equal(upgraded.version,CAMPAIGN_VERSION);
 assert.equal(upgraded.maps.map_diagnostic_galleries.doors.door_south,true);
 assert.equal(upgraded.maps.map_diagnostic_galleries.doors.door_tool_ward,false);
 assert.equal(upgraded.combat.encounters.enc_gallery_entry.cleared,true);
 assert.equal(upgraded.combat.encounters.enc_upper_pumps.cleared,false);
 assert.equal(upgraded.party.resources.gold,443);
 assert.ok(upgraded.inventory.claimed.includes('cache_gallery_mirror'));
 assert.deepEqual(persist(upgraded),upgraded);
});
test('invalid plot pickups, fabricated completed rewards, and false stair authorization are rejected on load',()=>{
 const a=begin();const corrupt=[
   s=>s.quests.optional.quest_optional_ledger='ready',
   s=>{s.quests.optional.quest_optional_tools='completed';},
   s=>s.quests.questItems.push('item_quest_orro_tools'),
   s=>s.quests.flags.push('flag_upper_descent_ready'),
   s=>s.quests.seenScenes.push('scene_fake_chamber'),
 ];
 for(const change of corrupt){const c=structuredClone(a);change(c);assert.throws(()=>parseCampaign(JSON.stringify(c),registry));}
});
test('new pump encounter starts in-place and persists enemy position/HP and loot claims without cloning treasure',async()=>{
 const {beginEncounter}=await import('../src/shared/rules/combat.ts');
 const {rewardLoot}=await import('../src/shared/rules/inventory.ts');
 let s=at(begin(),11,5,1);s.maps.map_diagnostic_galleries.doors.door_pump_grate=true;
 const first=beginEncounter(s,registry);assert.equal(first.changed,true);s=first.state;
 assert.equal(s.combat.active.encounterId,'enc_upper_pumps');
 const health=s.combat.encounters.enc_upper_pumps.enemies[0].hp;
 s.combat.encounters.enc_upper_pumps.enemies[0].hp=Math.max(1,health-2);
 const restored=persist(s);assert.equal(restored.combat.active.encounterId,'enc_upper_pumps');
 assert.equal(restored.combat.encounters.enc_upper_pumps.enemies[0].hp,Math.max(1,health-2));
 restored.combat.encounters.enc_upper_pumps.enemies[0].hp=0;const granted=rewardLoot(restored,'enc_upper_pumps');assert.match(granted,/corpse/);
 const inventoryCount=restored.inventory.items.reduce((n,v)=>n+v.count,0);
 assert.equal(rewardLoot(restored,'enc_upper_pumps'),'');
 assert.equal(restored.inventory.items.reduce((n,v)=>n+v.count,0),inventoryCount);
 assert.deepEqual(persist(restored),restored);
});
test('Phase 16 v11 active combat migrates without resetting the fighting turn or original defeated enemy records',async()=>{
 const {beginEncounter}=await import('../src/shared/rules/combat.ts');
 let s=beginEncounter(begin(),registry).state;
 const old=structuredClone(s);old.version=11;
 old.maps.map_diagnostic_galleries.doors={door_south:false,door_north:false};
 old.maps.map_diagnostic_galleries.secrets={gallery_hidden_arch:false};
 for(const id of ['enc_upper_pumps','enc_upper_archive','enc_upper_sluice'])delete old.combat.encounters[id];
 const restored=parseCampaign(JSON.stringify(old),registry);
 assert.deepEqual(restored.combat.active,s.combat.active);
 assert.equal(restored.combat.encounters.enc_gallery_entry.enemies[0].hp,s.combat.encounters.enc_gallery_entry.enemies[0].hp);
 assert.deepEqual(restored.rng,s.rng);
 assert.deepEqual(persist(restored),restored);
});
