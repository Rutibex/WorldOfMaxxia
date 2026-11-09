import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readLootDatabase,readPickupDatabase,installLootDatabase,installPickupDatabase,resetLootDefinitions,validateLootReferences,lootTableForEncounter,authoredPickups} from '../src/shared/content/loot.ts';
import {newCampaign,validateMapRegistry,parseCampaign,serializeCampaign} from '../src/shared/rules/campaign.ts';
import {rewardLoot,LOOT_TABLE,giveItem} from '../src/shared/rules/inventory.ts';
import {lootGround,dropItem,nearbyGround} from '../src/shared/rules/ground.ts';
import {loadProjectLoot} from '../src/client/project-boot.ts';
const base=new URL('../public/projects/WorldOfMaxxia/database/',import.meta.url);
const loot=readLootDatabase(readFileSync(new URL('loot-tables.json',base),'utf8'));
const ground=readPickupDatabase(readFileSync(new URL('ground-pickups.json',base),'utf8'));
const registry=validateMapRegistry(['town','galleries','vault'].map(x=>JSON.parse(readFileSync(new URL('../public/content/'+x+'.json',import.meta.url),'utf8'))));
const position=(s,map,x,y)=>{s.currentMapId=map;Object.assign(s.maps[map],{x,y});const k=x+','+y;if(!s.maps[map].visited.includes(k))s.maps[map].visited.push(k);return s;};
const saved=s=>parseCampaign(serializeCampaign(s,registry),registry);
test('MM15 original ten loot assignments and four quest pickups preserve identity',()=>{
 assert.equal(loot.tables.length,10);assert.equal(loot.assignments.length,10);assert.equal(ground.pickups.length,4);
 for(const assignment of loot.assignments){const table=loot.tables.find(t=>t.id===assignment.tableId);assert.deepEqual(table.entries.map(e=>e.itemId),LOOT_TABLE[assignment.encounterId]);}
 assert.equal(ground.pickups.find(p=>p.legacyQuest.plotId==='item_quest_tessa_ledger').id,'pickup_scene_upper_ledger');
 validateLootReferences(registry);
});
test('MM15 independent loot table can attach to a new encounter and roll bound quantities',()=>{
 const db=structuredClone(loot);db.tables.push({id:'loot_test_new',name:'Test treasure',entries:[{itemId:'item_antidote',chance:100,min:3,max:3,memberIndex:0}]});
 db.assignments.push({encounterId:'enc_gallery_east',tableId:'loot_test_new'}); // duplicate assignment rejected
 assert.throws(()=>readLootDatabase(db),/Duplicate encounter/);
 db.assignments=db.assignments.filter(a=>a.encounterId!=='enc_gallery_east');db.assignments.push({encounterId:'enc_gallery_east',tableId:'loot_test_new'});
 try{installLootDatabase(db);let s=newCampaign(registry),enc=s.combat.encounters.enc_gallery_east;enc.enemies[0].hp=0;enc.cleared=true;enc.rewarded=true;
  const before=s.party.resources.gold;rewardLoot(s,enc.id);
  const c=s.ground.containers.find(c=>c.enemyId===enc.enemies[0].id);
  assert.equal(c.entries[0].item.definitionId,'item_antidote');assert.equal(c.entries[0].item.count,3);
  assert.equal(s.party.resources.gold,before);assert.equal(rewardLoot(s,enc.id),'');
  s=position(s,c.mapId,c.x,c.y);const got=lootGround(saved(s),registry,{containerId:c.id,takeAll:true});assert(got.changed);
  assert(got.state.inventory.items.some(i=>i.id===c.entries[0].id&&i.count===3));saved(got.state);
 }finally{resetLootDefinitions();}
});
test('MM15 seeded chance outcomes remain stable independent of battle RNG',()=>{
 const db=structuredClone(loot);const table=db.tables.find(t=>t.id==='loot_enc_gallery_entry');table.entries=[{itemId:'item_healing_draught',chance:48,min:1,max:4,memberIndex:0}];
 try{installLootDatabase(db);const a=newCampaign(registry),b=newCampaign(registry);
 a.combat.encounters.enc_gallery_entry.enemies[0].hp=0;b.combat.encounters.enc_gallery_entry.enemies[0].hp=0;
 b.rng={algorithm:'xorshift32-v1',state:1234};b.rollCount=999;
 rewardLoot(a,'enc_gallery_entry');rewardLoot(b,'enc_gallery_entry');
 assert.deepEqual(a.ground.containers.find(x=>x.enemyId==='enemy_imp_1').entries,b.ground.containers.find(x=>x.enemyId==='enemy_imp_1').entries);
 assert.equal(a.rollCount,0);assert.equal(b.rollCount,999);
 }finally{resetLootDefinitions();}
});
test('MM15 authored loose items and gold use normal ground looting with persistent partial loot',()=>{
 const db=structuredClone(ground);db.pickups.push({id:'pickup_test_supply',mapId:'map_town',x:7,y:12,name:'Loose supplies',gold:17,items:[{itemId:'item_antidote',count:2},{itemId:'item_healing_draught',count:1}]});
 try{installPickupDatabase(db);let s=newCampaign(registry);const c=s.ground.containers.find(c=>c.id==='ground_pickup_pickup_test_supply');
 assert.equal(c.entries.length,2);assert.equal(c.gold,17);assert.equal(nearbyGround(s,registry).some(p=>p.id===c.id),true);
 s=lootGround(s,registry,{containerId:c.id,entryId:c.entries[0].id}).state;
 assert.equal(s.ground.containers.find(p=>p.id===c.id).entries.length,1);s=saved(s);
 assert.equal(s.ground.containers.find(p=>p.id===c.id).gold,17);
 const previous=s.party.resources.gold;s=lootGround(s,registry,{containerId:c.id,takeAll:true}).state;
 assert.equal(s.party.resources.gold,previous+17);assert(!s.ground.containers.some(p=>p.id===c.id));saved(s);
 }finally{resetLootDefinitions();}
});
test('MM15 ground item identity is preserved across dropped items and authored piles',()=>{
 const db=structuredClone(ground);db.pickups.push({id:'pickup_test_potion',mapId:'map_town',x:7,y:12,name:'Vial',gold:0,items:[{itemId:'item_antidote',count:1}]});
 try{installPickupDatabase(db);let s=newCampaign(registry),c=s.ground.containers.find(c=>c.id==='ground_pickup_pickup_test_potion'),id=c.entries[0].id;
 const other=giveItem(s.inventory,'hero_vexa','item_dagger');s=dropItem(s,other.id).state;
 assert.equal(s.ground.containers.find(c=>c.id==='ground_pickup_pickup_test_potion').entries[0].id,id);
 assert.equal(s.ground.containers.some(c=>c.id.startsWith('ground_pile_')),true);
 s=saved(s);s=lootGround(s,registry,{containerId:c.id,takeAll:true}).state;
 assert.equal(s.inventory.items.find(i=>i.id===id).definitionId,'item_antidote');saved(s);
 }finally{resetLootDefinitions();}
});
test('MM15 rejects missing item, out of bounds quantity, quest scene forgery, and wall pickups',()=>{
 const b=structuredClone(loot);b.tables[0].entries[0].itemId='not_an_item';assert.throws(()=>readLootDatabase(b),/E_ENTRY/);
 const q=structuredClone(ground);q.pickups.push({id:'pickup_bad',mapId:'map_town',x:0,y:0,name:'Wall gold',gold:5,items:[]});
 assert.doesNotThrow(()=>readPickupDatabase(q));
 try{installPickupDatabase(q);assert.throws(()=>validateLootReferences(registry),/E_POSITION/);}finally{resetLootDefinitions();}
 const x=structuredClone(ground);x.pickups[0].legacyQuest.sceneId='scene_not_real';
 try{installPickupDatabase(x);assert.throws(()=>validateLootReferences(registry),/E_QUEST_SCENE/);}finally{resetLootDefinitions();}
 const y=structuredClone(ground);y.pickups[0].items.push({itemId:'item_antidote',count:50});assert.throws(()=>readPickupDatabase(y),/E_ITEM/);
});
test('MM15 loader resets to defaults for legacy projects and loads authored definitions through fetch',async()=>{
 const files={'https://example.test/loot.json':JSON.stringify(loot),'https://example.test/pickups.json':JSON.stringify(ground)};
 const fetcher=async url=>new Response(files[url],{status:files[url]?200:404});
 await loadProjectLoot({lootTablesUrl:'https://example.test/loot.json',groundPickupsUrl:'https://example.test/pickups.json'},fetcher);
 assert.equal(lootTableForEncounter('enc_bell_heart').entries.length,2);assert.equal(authoredPickups().length,4);
 const modified=structuredClone(loot);modified.assignments=[];installLootDatabase(modified);assert.equal(lootTableForEncounter('enc_bell_heart'),undefined);
 await loadProjectLoot({lootTablesUrl:null,groundPickupsUrl:null},fetcher);
 assert.equal(lootTableForEncounter('enc_bell_heart').entries.length,2);
});

test('MM15 new quest-marked pickup writes its own journal ID once, without legacy scene code',()=>{
 const db=structuredClone(ground);db.pickups.push({id:'pickup_new_relic',mapId:'map_town',x:7,y:12,name:'Recovered relic',gold:0,items:[],questItemId:'item_quest_new_relic'});
 try{installPickupDatabase(db);let s=newCampaign(registry);const c=s.ground.containers.find(c=>c.id==='ground_pickup_pickup_new_relic');
  assert.equal(c.entries[0].plotId,'item_quest_new_relic');
  const collected=lootGround(s,registry,{containerId:c.id,takeAll:true});assert.equal(collected.changed,true);
  s=saved(collected.state);assert(s.quests.questItems.includes('item_quest_new_relic'));
  assert(!s.ground.containers.some(v=>v.id===c.id));
  assert.equal(lootGround(s,registry,{containerId:c.id,takeAll:true}).changed,false);
  const corrupt=structuredClone(s);corrupt.quests.questItems.push('bad-key');assert.throws(()=>saved(corrupt));
  const bad=structuredClone(db);bad.pickups.at(-1).questItemId='item_quest_regulator';assert.throws(()=>readPickupDatabase(bad),/E_QUEST_ID/);
 }finally{resetLootDefinitions();}
});
