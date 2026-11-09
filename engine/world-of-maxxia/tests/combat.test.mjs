import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateCampaign,validateMapRegistry,upgradeCampaign} from '../src/shared/rules/campaign.ts';
import {ENEMY_KINDS,currentEnemies,activeActor,combatTargets,closeEncounter,beginEncounter,combatAction,chooseTarget,shootVolley,recoverParty,availableShotTargets} from '../src/shared/rules/combat.ts';
const town=JSON.parse(readFileSync(new URL('../public/content/town.json',import.meta.url)));
const galleries=JSON.parse(readFileSync(new URL('../public/content/galleries.json',import.meta.url)));
const vault=JSON.parse(readFileSync(new URL('../public/content/vault.json',import.meta.url)));
const registry=validateMapRegistry([town,galleries,vault]);
const fresh=()=>newCampaign(registry);
const dungeon=()=>{const s=fresh();s.currentMapId='map_diagnostic_galleries';return s;};
const distance=(w,v)=>Math.abs(w.x-v.x)+Math.abs(w.y-v.y);

test('Phase 6 v1 imports migrate exactly once; future versions are refused',()=>{
 const old=fresh();delete old.combat;delete old.magic;old.inventory={items:[]};old.party.resources.supplies={item_healing_draught:2,item_antidote:2};old.version=1;for(const id of old.party.order)delete old.party.characters[id].combatSetup;
 const upgraded=parseCampaign(JSON.stringify(old),registry);
 assert.equal(upgraded.version,18);assert.equal(Object.keys(upgraded.combat.encounters).length,10);
 for(const id of old.party.order){assert.deepEqual({...upgraded.party.characters[id],combatSetup:undefined},{...old.party.characters[id],combatSetup:undefined});assert.equal(upgraded.party.characters[id].combatSetup.quickAction,'attack');}assert.deepEqual(upgraded.maps,old.maps);
 assert.deepEqual(parseCampaign(serializeCampaign(upgraded,registry),registry),upgraded);
 assert.throws(()=>parseCampaign(JSON.stringify({...upgraded,version:99}),registry),/version/);
 assert.throws(()=>parseCampaign(JSON.stringify({...old,combat:{}}),registry),/version/);
});
test('encounters are fixed in specific maps, beginning adjacent to the party',()=>{
 const s=fresh();assert.equal(closeEncounter(s),null);
 s.currentMapId='map_diagnostic_galleries';const e=closeEncounter(s);assert.equal(e.id,'enc_gallery_entry');
 const result=beginEncounter(s,registry);assert.equal(result.changed,true);assert.ok(result.state.combat.active);
 assert.equal(result.state.combat.active.encounterId,'enc_gallery_entry');
 assert.equal(result.state.combat.active.turnOrder.length,8);assert.equal(result.state.combat.active.round>=1,true);
 assert.equal(result.state.combat.active.turnOrder.includes('hero_tarin'),true);
 assert.equal(validateCampaign(result.state,registry),result.state);
});
test('initiative and first enemy action replay deterministically from same RNG state',()=>{
 const s=dungeon(),a=beginEncounter(s,registry),b=beginEncounter(s,registry);
 assert.deepEqual(a,b);assert.equal(s.combat.active,null);assert.equal(a.state.rng.state,b.state.rng.state);
});
test('combat attack/block advance acting heroes and preserve state through save and load',()=>{
 let s=beginEncounter(dungeon(),registry).state;
 const id=activeActor(s),gold=s.party.resources.gold;assert.ok(id.startsWith('hero_'));
 const blocked=combatAction(s,registry,'block');assert.ok(blocked.changed);
 assert.equal(blocked.state.elapsedMinutes,s.elapsedMinutes+1);assert.equal(blocked.state.party.resources.gold,gold);
 assert.ok(blocked.state.rng.state!==s.rng.state||blocked.state.combat.active?.turnIndex!==s.combat.active.turnIndex);
 s=parseCampaign(serializeCampaign(blocked.state,registry),registry);assert.deepEqual(s,blocked.state);
});
test('target selection only accepts living members of the current fight',()=>{
 const s=beginEncounter(dungeon(),registry).state;assert.ok(s.combat.active);
 assert.equal(chooseTarget(s,'enemy_nonexistent').changed,false);
 const target=combatTargets(s)[1];const chosen=chooseTarget(s,target.id);
 assert.equal(chosen.state.combat.active.targetId,target.id);
 assert.equal(s.combat.active.targetId,'enemy_imp_1');
});
test('melee victory awards exactly once; defeated enemies never respawn after reloading',()=>{
 let s=beginEncounter(dungeon(),registry).state,rounds=0,initial=s.party.resources.gold;
 while(s.combat.active&&rounds++<140){
  const w=s.maps[s.currentMapId],adj=combatTargets(s).find(v=>distance(w,v)<=1);
  if(adj)s=chooseTarget(s,adj.id).state;
  const result=combatAction(s,registry,adj?'attack':'block');
  assert.equal(result.changed,true);s=result.state;
  assert.equal(validateCampaign(s,registry),s);
 }
 assert.ok(rounds<140,'combat eventually completes');assert.equal(s.combat.defeated,false);
 assert.equal(s.combat.encounters.enc_gallery_entry.cleared,true);
 assert.equal(s.combat.encounters.enc_gallery_entry.rewarded,true);
 assert.equal(s.combat.active,null);
 assert.equal(s.party.resources.gold,initial);
 assert.ok(s.party.order.some(id=>s.party.characters[id].xp>=80));
 const persisted=parseCampaign(serializeCampaign(s,registry),registry);
 assert.equal(closeEncounter(persisted),null);
 assert.equal(beginEncounter(persisted,registry).changed,false);
 assert.equal(persisted.party.resources.gold,initial);
});
test('ranged volley uses facing and line of sight, consumes deterministic RNG and advances foe',()=>{
 const s=dungeon(),w=s.maps.map_diagnostic_galleries;w.x=5;w.y=8;w.facing=1;w.visited.push('5,8');w.doors.door_south=true;
 assert.equal(availableShotTargets(s,registry)[0].id,'enemy_watcher_1');
 const before=s.combat.encounters.enc_gallery_east.enemies[0].hp;
 const shot=shootVolley(s,registry);assert.equal(shot.changed,true);assert.ok(shot.state.rollCount>s.rollCount);
 assert.ok(shot.state.combat.encounters.enc_gallery_east.enemies[0].hp<=before);
 assert.ok(shot.state.elapsedMinutes>=1);
 assert.equal(validateCampaign(shot.state,registry),shot.state);
 w.facing=3;assert.equal(availableShotTargets(s,registry).some(v=>v.id==='enemy_watcher_1'),false);
});
test('flee eventually disengages to entrance without clearing enemy or granting gold',()=>{
 let s=beginEncounter(dungeon(),registry).state,attempts=0,initial=s.party.resources.gold;
 while(s.combat.active&&attempts++<20){s=combatAction(s,registry,'run').state;}
 assert.equal(s.combat.active,null);assert.equal(s.combat.defeated,false);
 assert.ok(s.maps.map_diagnostic_galleries.x===2&&s.maps.map_diagnostic_galleries.y===8);
 assert.equal(s.combat.encounters.enc_gallery_entry.cleared,false);
 assert.equal(s.party.resources.gold,initial);
});
test('defeat recovery returns to town and deducts capped cost',()=>{
 const s=dungeon();s.combat.defeated=true;
 for(const id of s.party.order)s.party.characters[id].hp=0;
 const result=recoverParty(s,registry);assert.equal(result.changed,true);
 assert.equal(result.state.currentMapId,'map_town');assert.equal(result.state.combat.defeated,false);
 assert.ok(result.state.party.order.every(id=>result.state.party.characters[id].hp>0));
 assert.equal(result.state.party.resources.gold,250);
 assert.equal(validateCampaign(result.state,registry),result.state);
});
test('tampered combat states and out-of-bounds enemies cannot be loaded',()=>{
 const corrupt=[s=>s.combat.encounters.enc_gallery_entry.enemies[0].x=999,s=>s.combat.encounters.enc_gallery_entry.enemies[0].hp=10000,s=>s.combat.active={encounterId:'missing',turnOrder:['hero_tarin'],turnIndex:0,round:1,targetId:null,guarding:[]},s=>s.combat.encounters.enc_gallery_entry.rewarded=true];
 for(const mutate of corrupt){const s=fresh();mutate(s);assert.throws(()=>parseCampaign(JSON.stringify(s),registry));}
});
