import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readEncounterGroups,readEncounterPlacements,installEncounters,resetEncounters,ENCOUNTER_SEEDS,ENCOUNTER_PLACEMENTS,validateEncounterReferences,respawnOnEntry} from '../src/shared/content/encounters.ts';
import {ENEMY_KINDS,currentEnemies,beginEncounter} from '../src/shared/rules/combat.ts';
import {newCampaign,validateCampaign,validateMapRegistry,parseCampaign,serializeCampaign} from '../src/shared/rules/campaign.ts';
import {loadProjectEncounters,loadProjectBoot,createProjectCampaign} from '../src/client/project-boot.ts';
const base=new URL('../public/projects/WorldOfMaxxia/',import.meta.url);
const groups=readEncounterGroups(readFileSync(new URL('database/encounter-groups.json',base),'utf8'));
const placements=readEncounterPlacements(readFileSync(new URL('maps/encounter-placements.json',base),'utf8'));
const registry=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL(`../public/content/${n}.json`,import.meta.url),'utf8'))));
const clone=()=>[structuredClone(groups),structuredClone(placements)];

test('MM14 ten original encounter/monster IDs, coordinates, rewards and boss tags migrate without change',()=>{
 assert.equal(groups.groups.length,10);assert.equal(placements.placements.length,10);
 assert.equal(ENCOUNTER_SEEDS.length,10);
 assert.deepEqual(ENCOUNTER_SEEDS.map(v=>v.id),placements.placements.map(v=>v.id));
 assert.equal(ENCOUNTER_SEEDS.find(v=>v.id==='enc_gallery_entry').enemies[0].id,'enemy_imp_1');
 assert.equal(ENCOUNTER_SEEDS.find(v=>v.id==='enc_bell_heart').enemies[0].kindId,'bell_heart');
 assert.equal(groups.groups.find(v=>v.id==='group_bell_heart').boss,true);
 const state=newCampaign(registry);assert.equal(state.combat.encounters.enc_bell_heart.enemies[0].hp,ENEMY_KINDS.bell_heart.hp);
 assert.equal(parseCampaign(serializeCampaign(state,registry),registry).combat.encounters.enc_bell_heart.id,'enc_bell_heart');
});

test('MM14 one reusable group at two independent placements has independent persistent state',()=>{
 const [g,p]=clone();g.groups.push({id:'group_test_pack',name:'Two Dust Imps',boss:false,musicTag:null,members:[{kindId:'dust_imp',dx:0,dy:0}]});
 p.placements.push({id:'enc_test_a',mapId:'map_diagnostic_galleries',groupId:'group_test_pack',x:3,y:8,triggerRange:2,respawn:'never',enemyIds:['enemy_test_a']});
 p.placements.push({id:'enc_test_b',mapId:'map_diagnostic_galleries',groupId:'group_test_pack',x:7,y:8,triggerRange:1,respawn:'never',enemyIds:['enemy_test_b']});
 try{
  installEncounters(g,p);validateEncounterReferences(registry);
  const state=newCampaign(registry),a=state.combat.encounters.enc_test_a,b=state.combat.encounters.enc_test_b;
  assert.notEqual(a,b);assert.notEqual(a.enemies[0],b.enemies[0]);
  a.enemies[0].hp=0;a.cleared=true;a.rewarded=true;
  assert.equal(b.enemies[0].hp,ENEMY_KINDS.dust_imp.hp);assert.equal(b.cleared,false);
  assert.equal(validateCampaign(state,registry),state);
  assert.equal(parseCampaign(serializeCampaign(state,registry),registry).combat.encounters.enc_test_b.cleared,false);
 }finally{resetEncounters();}
});

test('MM14 a newly authored group can enter live combat without registering a new encounter in TypeScript',()=>{
 const g={format:'maxxia-encounter-groups',version:1,groups:[{id:'group_new_a',name:'New Sentry',boss:false,musicTag:null,members:[{kindId:'dust_imp',dx:0,dy:0}]}]};
 const p={format:'maxxia-encounter-placements',version:1,placements:[{id:'enc_new_a',mapId:'map_diagnostic_galleries',groupId:'group_new_a',x:3,y:8,triggerRange:1,respawn:'never',enemyIds:['enemy_new_a']}]};
 try{
  installEncounters(g,p);validateEncounterReferences(registry);
  const state=newCampaign(registry);state.currentMapId='map_diagnostic_galleries';
  const result=beginEncounter(state,registry);
  assert.equal(result.state.combat.active.encounterId,'enc_new_a');
  assert.equal(result.state.combat.encounters.enc_new_a.enemies[0].kindId,'dust_imp');
  assert.equal(validateCampaign(result.state,registry),result.state);
 }finally{resetEncounters();}
});

test('MM14 group members use relative coordinates and editor-selected range in encounter discovery',()=>{
 const [g,p]=clone();g.groups.push({id:'group_offset',name:'Offset Test',boss:false,musicTag:'danger',members:[{kindId:'stone_mite',dx:0,dy:0},{kindId:'dust_imp',dx:1,dy:0}]});
 p.placements.push({id:'enc_offset',mapId:'map_diagnostic_galleries',groupId:'group_offset',x:3,y:8,triggerRange:4,respawn:'never',enemyIds:['offset_a','offset_b']});
 try{installEncounters(g,p);const seed=ENCOUNTER_SEEDS.find(v=>v.id==='enc_offset');assert.equal(seed.enemies[1].x,4);assert.equal(seed.enemies[1].y,8);assert.equal(ENCOUNTER_PLACEMENTS.enc_offset.triggerRange,4);}
 finally{resetEncounters();}
});

test('MM14 on-reentry respawn resets only opted-in cleared placement and does not reset never placements',()=>{
 const [g,p]=clone();p.placements[0].respawn='on-reentry';
 try{installEncounters(g,p);const state=newCampaign(registry),a=state.combat.encounters.enc_gallery_entry,b=state.combat.encounters.enc_gallery_east;
  a.enemies.forEach(v=>v.hp=0);a.cleared=true;a.rewarded=true;b.enemies.forEach(v=>v.hp=0);b.cleared=true;b.rewarded=true;
  respawnOnEntry(state,'map_diagnostic_galleries');assert.equal(a.cleared,false);assert.equal(a.rewarded,false);
  assert.equal(a.enemies[0].hp,ENEMY_KINDS.dust_imp.hp);assert.equal(b.cleared,true);
  assert.equal(validateCampaign(state,registry),state);
 }finally{resetEncounters();}
});

test('MM14 on-reentry does not erase unlooted corpse contents and cleans empty remains on a subsequent entry',()=>{
 const [g,p]=clone();p.placements[0].respawn='on-reentry';
 try{installEncounters(g,p);const state=newCampaign(registry),e=state.combat.encounters.enc_gallery_entry;
  e.enemies.forEach(v=>v.hp=0);e.cleared=true;e.rewarded=true;
  state.ground.containers.push({id:'ground_corpse_enemy_imp_1',mapId:e.mapId,x:3,y:8,kind:'corpse',name:'Imp remains',enemyId:'enemy_imp_1',gold:12,entries:[]});
  respawnOnEntry(state,e.mapId);assert.equal(e.cleared,true);assert.equal(state.ground.containers.at(-1).gold,12);
  state.ground.containers.at(-1).gold=0;
  respawnOnEntry(state,e.mapId);assert.equal(e.cleared,false);assert.equal(state.ground.containers.find(c=>c.enemyId==='enemy_imp_1'),undefined);
  assert.equal(validateCampaign(state,registry),state);
 }finally{resetEncounters();}
});

test('MM14 invalid groups, duplicate IDs, stale group references, duplicate enemy IDs and bounded data reject safely',()=>{
 const cases=[
  ([g,p])=>g.groups.push(structuredClone(g.groups[0])),
  ([g,p])=>g.groups[0].members[0].kindId='../escape',
  ([g,p])=>g.groups[0].members.push(...Array.from({length:4},()=>({kindId:'dust_imp',dx:0,dy:0}))),
  ([g,p])=>p.placements[0].groupId='missing_group',
  ([g,p])=>p.placements[1].enemyIds=[p.placements[0].enemyIds[0]],
  ([g,p])=>p.placements[0].triggerRange=99,
 ];
 for(const change of cases){const [g,p]=clone();change([g,p]);assert.throws(()=>installEncounters(g,p),/E_(ID|MEMBERS|MEMBER|GROUP_REFERENCE|COUNT|ENEMY_ID|PLACEMENT)/);}
 resetEncounters();
});

test('MM14 unknown maps, missing monsters and wall placements reject before entering gameplay',()=>{
 const [g,p]=clone();
 try{
  p.placements[0].mapId='map_missing';installEncounters(g,p);assert.throws(()=>validateEncounterReferences(registry),/E_MAP_REFERENCE/);
  p.placements[0].mapId='map_diagnostic_galleries';p.placements[0].x=0;p.placements[0].y=0;installEncounters(g,p);assert.throws(()=>validateEncounterReferences(registry),/E_LOCATION/);
  p.placements[0].x=3;p.placements[0].y=8;g.groups[0].members[0].kindId='monster_missing';installEncounters(g,p);assert.throws(()=>validateEncounterReferences(),/E_MONSTER_REFERENCE/);
 }finally{resetEncounters();}
});

test('MM14 loader installs both project-owned encounter files, rejects half configuration, and resets legacy content',async()=>{
 const urls={encounterGroupsUrl:'https://example.test/groups.json',encounterPlacementsUrl:'https://example.test/placements.json'};
 const fake=async url=>new Response(JSON.stringify(url.includes('groups')?groups:placements));
 await loadProjectEncounters(urls,fake);assert.equal(ENCOUNTER_SEEDS.length,10);
 await assert.rejects(()=>loadProjectEncounters({...urls,encounterPlacementsUrl:null},fake),/E_ENCOUNTER_PAIR/);
 await loadProjectEncounters({encounterGroupsUrl:null,encounterPlacementsUrl:null},async()=>{throw Error('Unexpected request');});
 assert.equal(ENCOUNTER_SEEDS.length,10);
});
