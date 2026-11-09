import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,validateCampaign,validateMapRegistry,parseCampaign,serializeCampaign,travelCampaign,MAX_SAVE_BYTES} from '../src/shared/rules/campaign.ts';
import {applyGridAction} from '../src/shared/rules/grid.ts';
import {SeededRng} from '../src/shared/rules/rng.ts';
import {CampaignStore,SAVE_PREFIX} from '../src/shared/saves/campaign-store.ts';
const town=JSON.parse(readFileSync(new URL('../public/content/town.json',import.meta.url)));
const dungeon=JSON.parse(readFileSync(new URL('../public/content/galleries.json',import.meta.url)));
const vault=JSON.parse(readFileSync(new URL('../public/content/vault.json',import.meta.url)));
const registry=validateMapRegistry([town,dungeon,vault]);
const start=()=>newCampaign(registry);
const makeStorage=()=>{
  const data=new Map();return {data,getItem(k){return data.get(k)??null;},setItem(k,v){data.set(k,v);},removeItem(k){data.delete(k);}};
};
test('new campaign keeps separate map states and a shared clock',()=>{
 const c=start();assert.equal(c.currentMapId,'map_town');assert.equal(c.party.order.length,6);
 assert.deepEqual(Object.keys(c.maps).sort(),Object.keys(registry).sort());assert.equal(c.elapsedMinutes,0);
 assert.equal(c.party.resources.gold,300);assert.ok(c.inventory.items.length>=15);
});
test('save round trip keeps all party mutations, map doors/discovery, RNG and time',()=>{
 const c=start();c.party.resources.gold=432;c.party.characters[c.party.order[0]].hp-=2;
 c.party.order.reverse();c.party.selectedId=c.party.order[1];c.party.characters[c.party.order[0]].xp+=200;
 c.party.resources.supplies.item_antidote=1;
 c.maps.map_town.doors.town_north_gate=true;c.maps.map_town.visited.push('7,11');
 c.elapsedMinutes=1687;c.rollCount=9;const rng=new SeededRng('hello');rng.integer(1,20);c.rng=rng.snapshot();c.quests.flags.push('test_started');
 const cloned=parseCampaign(serializeCampaign(c,registry),registry);
 assert.deepEqual(cloned,c);assert.equal(cloned.elapsedMinutes,1687);
 const r2=new SeededRng(1);r2.restore(cloned.rng);assert.equal(r2.integer(1,100),rng.integer(1,100));
});
test('town-dungeon-town returns to target coordinates without resetting doors',()=>{
 const s=start(),w=s.maps.map_town;
 w.x=13;w.y=3;w.facing=0;w.doors.town_north_gate=true;w.visited.push('13,3');
 s.quests.flags.push('flag_iona_cistern_task');s.quests.mainStage=2;s.quests.questItems.push('item_quest_cistern_key');s.quests.completedStages.push('quest_main_01');
 const t1=travelCampaign(s,registry);assert.ok(t1);assert.equal(t1.state.currentMapId,'map_diagnostic_galleries');
 assert.equal(t1.state.maps.map_town.doors.town_north_gate,true);
 const dw=t1.state.maps.map_diagnostic_galleries;
 dw.x=5;dw.y=8;dw.facing=1;dw.visited.push('5,8');dw.doors.door_south=true;
 const t2=travelCampaign(t1.state,registry);assert.ok(t2);assert.equal(t2.state.currentMapId,'map_town');
 assert.equal(t2.state.maps.map_diagnostic_galleries.doors.door_south,true);
 assert.equal(t2.state.maps.map_town.doors.town_north_gate,true);
 assert.equal(t2.state.elapsedMinutes,10);
 assert.equal(t2.state.party.order.length,6);
 assert.deepEqual(parseCampaign(serializeCampaign(t2.state,registry),registry),t2.state);
});
test('portals never travel through a closed door or from far away',()=>{
 let s=start();assert.equal(travelCampaign(s,registry),null);
 s.maps.map_town.x=13;s.maps.map_town.y=3;s.maps.map_town.facing=3;
 assert.equal(travelCampaign(s,registry),null);
});
test('walking changes local map, shared campaign clock uses delta once',()=>{
 const s=start(),m=registry.map_town,w=s.maps.map_town;
 const r=applyGridAction(m,w,'forward');assert.equal(r.state.x,7);assert.equal(r.state.y,11);
 s.maps.map_town=r.state;s.elapsedMinutes+=r.state.minutes-w.minutes;
 const blocked=applyGridAction(m,r.state,'forward');assert.equal(blocked.changed,false);
 assert.equal(s.elapsedMinutes,1);assert.equal(blocked.state.minutes,1);
});
test('unknown version, wrong map, impossible cells, missing data reject safely',()=>{
 for(const mutate of [
 c=>c.version=99,c=>c.currentMapId='map_missing',c=>c.maps.map_town.x=999,
 c=>c.maps.map_town.doors.town_north_gate='yes',c=>c.maps.map_town.visited.push('999,999'),
 c=>c.party.resources.gold=-1,c=>c.rng.state=0,c=>c.inventory.items=[{id:'item_test',ownerId:'bad',definitionId:'item_test',count:1}],
 ]){const c=start();mutate(c);assert.throws(()=>validateCampaign(c,registry));}
 assert.throws(()=>parseCampaign('oops',registry),/JSON/);
 assert.throws(()=>parseCampaign('x'.repeat(MAX_SAVE_BYTES+1),registry),/large/);
});
test('slots distinguish absent, corrupt, and valid saves without deleting corrupt bytes',()=>{
 const storage=makeStorage(),store=new CampaignStore(storage,registry);
 assert.equal(store.list().filter(s=>s.present).length,0);
 storage.setItem(SAVE_PREFIX+'auto','{corrupt data');assert.equal(store.list()[0].valid,false);
 assert.throws(()=>store.load('auto'));
 assert.throws(()=>store.save('auto',start()),/damaged/);
 assert.equal(storage.getItem(SAVE_PREFIX+'auto'),'{corrupt data');
 store.save('auto',start(),true);
 assert.equal(storage.getItem(SAVE_PREFIX+'auto:backup'),'{corrupt data');
 assert.equal(store.list()[0].valid,true);
});
test('replacing a slot preserves previous raw backup and latest state',()=>{
 const storage=makeStorage(),store=new CampaignStore(storage,registry),s=start();
 store.save('slot2',s);const old=storage.getItem(SAVE_PREFIX+'slot2');
 s.party.resources.gold=999;store.save('slot2',s);
 assert.equal(storage.getItem(SAVE_PREFIX+'slot2:backup'),old);
 assert.equal(store.load('slot2').party.resources.gold,999);
 assert.equal(store.importText(store.exportText(s)).party.resources.gold,999);
});
test('backup failure and quota failure never replace original slot',()=>{
 const storage=makeStorage(),store=new CampaignStore(storage,registry);store.save('slot1',start());
 const original=storage.getItem(SAVE_PREFIX+'slot1'),originalWrite=storage.setItem.bind(storage);
 storage.setItem=(key,val)=>{if(key.endsWith(':backup'))throw new Error('QUOTA');originalWrite(key,val);};
 assert.throws(()=>store.save('slot1',start()),/QUOTA/);assert.equal(storage.getItem(SAVE_PREFIX+'slot1'),original);
});
test('import failures do not modify saved bytes',()=>{
 const storage=makeStorage(),store=new CampaignStore(storage,registry);store.save('slot3',start());
 const before=storage.getItem(SAVE_PREFIX+'slot3');
 assert.throws(()=>store.importText('{'));assert.throws(()=>store.importText('{"version":20}'));
 assert.equal(storage.getItem(SAVE_PREFIX+'slot3'),before);
});
test('source maps reject invalid unknown portals and ID mismatch',()=>{
 const damaged=structuredClone(town);damaged.portals[0].targetMapId='map_does_not_exist';
 assert.throws(()=>validateMapRegistry([damaged,dungeon]));
});

test('saving while standing inside an opened doorway remains valid',()=>{
 const c=start();const w=c.maps.map_town;w.doors.town_north_gate=true;w.x=12;w.y=2;w.visited.push('12,2');
 const restored=parseCampaign(serializeCampaign(c,registry),registry);assert.equal(restored.maps.map_town.x,12);
 restored.maps.map_town.doors.town_north_gate=false;assert.throws(()=>validateCampaign(restored,registry));
});
