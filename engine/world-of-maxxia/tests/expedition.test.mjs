import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry,validateCampaign,travelCampaign} from '../src/shared/rules/campaign.ts';
import {initialGridState,isOpaque} from '../src/shared/rules/grid.ts';
import {restExpedition,bashExpedition,interactExpedition,moveExpedition,settleExpeditionTime,expeditionDay,expeditionMapSymbols} from '../src/shared/rules/expedition.ts';
const town=JSON.parse(readFileSync(new URL('../public/content/town.json',import.meta.url)));
const dungeon=JSON.parse(readFileSync(new URL('../public/content/galleries.json',import.meta.url)));
const vault=JSON.parse(readFileSync(new URL('../public/content/vault.json',import.meta.url)));
const maps=validateMapRegistry([town,dungeon,vault]);
const fresh=()=>newCampaign(maps);
const at=(s,mapId,x,y,facing)=>{s.currentMapId=mapId;const w=s.maps[mapId];w.x=x;w.y=y;w.facing=facing;const k=`${x},${y}`;if(!w.visited.includes(k))w.visited.push(k);return s;};
const clearEnemies=(s)=>{for(const e of Object.values(s.combat.encounters))for(const v of e.enemies)v.hp=0;for(const e of Object.values(s.combat.encounters)){e.cleared=true;e.rewarded=true;}return s;};

test('new Phase 14 state has named hazards and a complete, validated v9 save round trip',()=>{
 const s=fresh();assert.equal(s.version,18);assert.deepEqual(Object.keys(s.maps.map_diagnostic_galleries.secrets),['gallery_hidden_arch','upper_smuggler_niche','upper_ledger_arch']);
 assert.deepEqual(parseCampaign(serializeCampaign(s,maps),maps),s);
 assert.equal(s.expedition.lastMealAtMinute,0);assert.equal(expeditionDay(0),1);
});
test('eight-hour rest spends food for six, heals living heroes only, restores SP and expires magic',()=>{
 const s=clearEnemies(fresh()),a=s.party.characters.hero_mora,b=s.party.order[0];
 a.hp=1;a.sp=0;s.party.characters[b].hp=0;s.magic.effects.push({kind:'light',targetId:'party',expiresAtMinute:60});
 const r=restExpedition(s,maps);assert.equal(r.changed,true);assert.equal(r.state.elapsedMinutes,480);
 assert.equal(r.state.party.resources.food,42);assert.equal(r.state.party.characters.hero_mora.hp>1,true);
 assert.equal(r.state.party.characters.hero_mora.sp>0,true);assert.equal(r.state.party.characters[b].hp,0);
 assert.equal(r.state.magic.effects.length,0);assert.equal(r.state.expedition.lastMealAtMinute,480);
 assert.equal(s.party.resources.food,48,'failed/accepted actions do not mutate their original');
 assert.deepEqual(parseCampaign(serializeCampaign(r.state,maps),maps),r.state);
});
test('rest rejects insufficient food, nearby enemies, and active combat without changing state',()=>{
 const s=fresh();s.party.resources.food=5;assert.equal(restExpedition(s,maps).changed,false);assert.equal(s.elapsedMinutes,0);
 s.party.resources.food=48;at(s,'map_diagnostic_galleries',3,8,1);assert.match(restExpedition(s,maps).message,/unsafe/);
 s.combat.defeated=true;assert.equal(restExpedition(s,maps).changed,false);
});
test('food deprivation causes persistent hunger after 24 hours, and eating at camp clears it',()=>{
 const s=clearEnemies(fresh());s.elapsedMinutes=1440;settleExpeditionTime(s);
 assert.ok(s.party.characters[s.party.order[0]].conditions.some(v=>v.id==='hungry'));
 const r=restExpedition(s,maps);assert.ok(r.changed);assert.ok(!r.state.party.characters[s.party.order[0]].conditions.some(v=>v.id==='hungry'));
 assert.deepEqual(parseCampaign(serializeCampaign(r.state,maps),maps),r.state);
});
test('face-on secret search reveals a wall and allows passage, retaining fog of war',()=>{
 const s=at(fresh(),'map_diagnostic_galleries',3,7,1),w=s.maps.map_diagnostic_galleries;
 assert.equal(isOpaque(dungeon,w,4,7),true);
 const found=interactExpedition(s,maps);assert.ok(found.changed);assert.match(found.message,/Secret/);
 assert.equal(found.state.maps.map_diagnostic_galleries.secrets.gallery_hidden_arch,true);
 assert.equal(isOpaque(dungeon,found.state.maps.map_diagnostic_galleries,4,7),false);
 assert.ok(!found.state.maps.map_diagnostic_galleries.visited.includes('4,7'));
 const walk=moveExpedition(found.state,maps,'forward');assert.equal(walk.state.maps.map_diagnostic_galleries.x,4);
 assert.equal(expeditionMapSymbols(walk.state,dungeon).some(v=>v.symbol==='S'),true);
 assert.deepEqual(parseCampaign(serializeCampaign(walk.state,maps),maps),walk.state);
});
test('stepping on a hidden trap damages once, subsequent crossings are safe, and RNG persists',()=>{
 let s=at(fresh(),'map_diagnostic_galleries',2,8,0);const initial=s.rng.state;
 const step=moveExpedition(s,maps,'forward');assert.ok(step.changed);assert.match(step.message,/TRAP/);
 assert.equal(step.state.expedition.triggeredTraps.length,1);assert.notEqual(step.state.rng.state,initial);
 const back=moveExpedition(step.state,maps,'backward'),again=moveExpedition(back.state,maps,'forward');
 assert.ok(!again.message.includes('TRAP'));assert.equal(again.state.expedition.triggeredTraps.length,1);
 assert.equal(again.state.rollCount,1);assert.deepEqual(parseCampaign(serializeCampaign(again.state,maps),maps),again.state);
});
test('searching and disarming a trap consumes seeded RNG, then will not trigger on entry',()=>{
 let s=at(fresh(),'map_diagnostic_galleries',2,8,0);const initial=s.rollCount;
 for(let n=0;n<50&&!s.expedition.triggeredTraps.length;n++){
  const result=interactExpedition(s,maps);assert.ok(result);s=result.state;
 }
 assert.equal(s.expedition.triggeredTraps.length,1);assert.ok(s.rollCount>initial);
 assert.ok(!moveExpedition(s,maps,'forward').message.includes('TRAP'));
});
test('Firstlight Well grants its one full restoration; dungeon fountains remain daily, without reviving dead heroes',()=>{
 let s=fresh();const id=s.party.order[0];s.party.characters[id].hp=1;
 at(s,'map_town',7,7,0);const first=interactExpedition(s,maps);assert.ok(first?.changed);assert.equal(first.state.expedition.fountainDays['map_town:town_well_spring'],1);
 assert.ok(first.state.party.characters[id].hp>1);assert.equal(interactExpedition(first.state,maps).changed,false);
 s=first.state;s.elapsedMinutes=1440;settleExpeditionTime(s);s.party.characters[id].hp=1;
 const next=interactExpedition(s,maps);assert.equal(next.changed,false);assert.match(next.message,/one blessing/);
 assert.deepEqual(parseCampaign(serializeCampaign(s,maps),maps),s);
});
test('bashing a locked door uses two heroes, spends five minutes and food per attempt and cannot bypass quest seals',()=>{
 let s=at(fresh(),'map_diagnostic_galleries',3,2,1),opened=false;
 for(let n=0;n<30;n++){const r=bashExpedition(s,maps);assert.ok(r.changed);assert.equal(r.state.elapsedMinutes,s.elapsedMinutes+5);assert.equal(r.state.party.resources.food,s.party.resources.food-1);s=r.state;
 if(s.maps.map_diagnostic_galleries.doors.door_north){opened=true;break;}}
 assert.equal(opened,true);assert.equal(bashExpedition(s,maps).changed,false);
 assert.deepEqual(parseCampaign(serializeCampaign(s,maps),maps),s);
 const fake=structuredClone(maps);fake.map_diagnostic_galleries.doors.find(x=>x.id==='door_north').questLocked=true;
 const sealed=at(fresh(),'map_diagnostic_galleries',3,2,1);assert.equal(bashExpedition(sealed,fake).changed,false);
});
test('older v8 inventory saves migrate without losing carried items or door state',()=>{
 const s=fresh(),old=structuredClone(s),inv=structuredClone(s.inventory);
 old.version=8;delete old.expedition;for(const w of Object.values(old.maps))delete w.secrets;
 old.maps.map_town.doors.town_north_gate=true;
 const upgraded=parseCampaign(JSON.stringify(old),maps);assert.equal(upgraded.version,18);
 assert.deepEqual(upgraded.inventory,inv);assert.equal(upgraded.maps.map_town.doors.town_north_gate,true);
 assert.equal(upgraded.maps.map_diagnostic_galleries.secrets.gallery_hidden_arch,false);
});
test('forged environment references and impossible clock values reject without mutating serialized input',()=>{
 for(const damage of [s=>s.expedition.triggeredTraps.push('unknown:trap'),s=>s.expedition.fountainDays['unknown:fountain']=1,s=>s.expedition.settledAtMinute=9999,s=>s.expedition.lastMealAtMinute=-2,s=>s.maps.map_diagnostic_galleries.secrets.gallery_hidden_arch='yes',s=>s.maps.map_diagnostic_galleries.secrets.unknown=true]){
  const s=fresh();damage(s);assert.throws(()=>validateCampaign(s,maps));
 }
});
test('glass-eye exploration does not mark unknown squares visited, while ordinary movement does',()=>{
 let s=fresh(),w=s.maps.map_town;const initial=w.visited.length;
 assert.equal(w.visited.length,initial);
 s=moveExpedition(s,maps,'forward').state;
 assert.equal(s.maps.map_town.visited.length,initial+1);
});
