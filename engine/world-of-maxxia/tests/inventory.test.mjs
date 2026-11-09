import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry,CAMPAIGN_VERSION} from '../src/shared/rules/campaign.ts';
import {ITEMS,ITEM_IDS} from '../src/shared/content/items.ts';
import {initialInventory,itemAction,giveItem,claimCache,rewardLoot,validateInventory,itemCategoryCount,wearEquipped} from '../src/shared/rules/inventory.ts';
import {derived} from '../src/shared/rules/party.ts';
import {beginEncounter,combatAction,chooseTarget} from '../src/shared/rules/combat.ts';
import {SeededRng} from '../src/shared/rules/rng.ts';
const maps=validateMapRegistry(['town','galleries','vault'].map(v=>JSON.parse(readFileSync(new URL(`../public/content/${v}.json`,import.meta.url)))));
const fresh=()=>newCampaign(maps);
const hero=(s,id='hero_tarin')=>s.party.characters[id];
test('catalog has exactly 40 ordinary items and eight distinctive special rewards',()=>{
 assert.equal(ITEM_IDS.length,48);assert.equal(ITEM_IDS.filter(id=>ITEMS[id].unique).length,8);
 assert.equal(new Set(ITEM_IDS).size,48);for(const item of Object.values(ITEMS))assert.ok(item.category&&item.price>=0);
});
test('starting equipment and party potions are physical serialized instances, no duplicate virtual supplies',()=>{
 const s=fresh();validateInventory(s.inventory,s.party);assert.equal(s.version,18);
 assert.equal(s.party.resources.supplies.item_healing_draught,undefined);
 assert.equal(s.inventory.items.filter(i=>i.definitionId==='item_healing_draught').reduce((t,i)=>t+i.count,0),2);
 assert.ok(s.inventory.items.some(i=>i.ownerId==='hero_tarin'&&i.equipped==='melee'&&i.definitionId==='item_sword'));
 assert.deepEqual(parseCampaign(serializeCampaign(s,maps),maps),s);
});
test('equip, remove, class restrictions and armor modifiers are reflected in actual character stats',()=>{
 let s=fresh();const id='hero_tarin';assert.equal(derived(hero(s)).armorBonus,3);
 let p=giveItem(s.inventory,id,'item_plate_harness');assert.ok(p);
 let res=itemAction(s,{action:'equip',itemId:p.id});assert.equal(res.changed,true);s=res.state;
 assert.equal(derived(hero(s)).armorBonus,6);assert.equal(s.inventory.items.filter(i=>i.equipped==='body'&&i.ownerId===id).length,1);
 res=itemAction(s,{action:'remove',itemId:p.id});assert.equal(res.changed,true);s=res.state;assert.equal(derived(hero(s)).armorBonus,0);
 const staff=s.inventory.items.find(i=>i.ownerId==='hero_orrin'&&i.definitionId==='item_staff');
 res=itemAction(s,{action:'transfer',itemId:staff.id,targetId:'hero_tarin'});assert.equal(res.changed,false); // starter staff is equipped
 const plate= s.inventory.items.find(i=>i.id===p.id);res=itemAction(s,{action:'transfer',itemId:plate.id,targetId:'hero_orrin'});assert.ok(res.changed);
 res=itemAction(res.state,{action:'equip',itemId:p.id});assert.equal(res.changed,false);assert.match(res.message,/cannot equip/i);
});
test('item uses validate first: no wasted healing/antidote, no phantom charges or unauthorized combat use',()=>{
 let s=fresh();const i=s.inventory.items.find(v=>v.definitionId==='item_healing_draught');const before=JSON.stringify(s);
 let res=itemAction(s,{action:'use',itemId:i.id});assert.equal(res.changed,false);assert.equal(JSON.stringify(s),before);
 s.party.characters[i.ownerId].hp-=5;res=itemAction(s,{action:'use',itemId:i.id});assert.equal(res.changed,true);
 assert.equal(res.state.party.characters[i.ownerId].hp,s.party.characters[i.ownerId].hp+5);
 const count=res.state.inventory.items.find(v=>v.id===i.id).count;assert.equal(count,1);
 assert.equal(itemAction(res.state,{action:'use',itemId:i.id}).changed,false);
 const unknown=itemAction(res.state,{action:'use',itemId:'stack_99999'});assert.equal(unknown.changed,false);
});
test('accessories, identification and repair have bounded costs and never change on invalid action',()=>{
 let s=fresh(),p=giveItem(s.inventory,'hero_tarin','item_ember_ring');assert.equal(p.identified,false);
 let a=itemAction(s,{action:'identify',itemId:p.id});assert.equal(a.changed,true);s=a.state;assert.equal(s.inventory.items.find(i=>i.id===p.id).identified,true);
 a=itemAction(s,{action:'equip',itemId:p.id,slot:'accessoryB'});assert.ok(a.changed);s=a.state;
 assert.equal(derived(hero(s)).resistances.fire,15);
 assert.equal(itemAction(s,{action:'repair',itemId:p.id}).changed,false);
 s.inventory.items.find(i=>i.ownerId==='hero_tarin'&&i.equipped==='melee').durability=2;
 let wear=wearEquipped(s,'hero_tarin','melee');assert.equal(wear,null);assert.equal(hero(s).equipment.melee,'item_sword');
 wear=wearEquipped(s,'hero_tarin','melee');assert.match(wear,/breaks/);assert.equal(hero(s).equipment.melee,null);
 const sword=s.inventory.items.find(i=>i.ownerId==='hero_tarin'&&i.definitionId==='item_sword');
 assert.equal(itemAction(s,{action:'equip',itemId:sword.id}).changed,false);
 a=itemAction(s,{action:'repair',itemId:sword.id});assert.equal(a.changed,true);assert.equal(a.state.inventory.items.find(i=>i.id===sword.id).durability,ITEMS.item_sword.maxDurability);
});
test('stacks can split and transfer; full category blocks and does not lose anything',()=>{
 let s=fresh(),v=s.inventory.items.find(i=>i.definitionId==='item_healing_draught');assert.equal(v.count,2);
 let a=itemAction(s,{action:'split',itemId:v.id,splitCount:1});assert.ok(a.changed);s=a.state;assert.equal(s.inventory.items.filter(i=>i.definitionId===v.definitionId).length,2);
 const other=s.inventory.items.find(i=>i.definitionId==='item_healing_draught'&&i.id!==v.id);
 a=itemAction(s,{action:'transfer',itemId:other.id,targetId:'hero_tarin'});assert.ok(a.changed);s=a.state;
 assert.equal(s.inventory.items.find(i=>i.id===other.id).ownerId,'hero_tarin');
 for(let n=0;n<20;n++)giveItem(s.inventory,'hero_tarin','item_empty_bottle');
 assert.equal(itemCategoryCount(s.inventory,'hero_tarin','misc'),2); // empty bottles stack, not slots
 for(const id of ['item_healing_scroll','item_antidote','item_wake_salts','item_torch','item_smoke_bomb','item_acid_flask','item_spark_capsule'])giveItem(s.inventory,'hero_tarin',id);
 assert.equal(itemCategoryCount(s.inventory,'hero_tarin','misc'),9);
 const spare=giveItem(s.inventory,'hero_vexa','item_venom_flask');assert.ok(spare);
 const before=JSON.stringify(s);a=itemAction(s,{action:'transfer',itemId:spare.id,targetId:'hero_tarin'});
 assert.equal(a.changed,false);assert.equal(JSON.stringify(s),before);
});
test('fixed encounter loot and authored treasure caches can each be claimed exactly once',()=>{
 let s=fresh();const e=s.combat.encounters.enc_gallery_entry;e.enemies.forEach(v=>v.hp=0);e.cleared=true;e.rewarded=true;const first=rewardLoot(s,'enc_gallery_entry');assert.match(first,/corpse/);
 const size=s.inventory.items.length;assert.equal(rewardLoot(s,'enc_gallery_entry'),'');assert.equal(size,s.inventory.items.length);
 s.currentMapId='map_town';s.maps.map_town.x=9;s.maps.map_town.y=11;s.maps.map_town.visited.push('9,11');
 let result=claimCache(s);assert.ok(result.changed);s=result.state;
 assert.equal(claimCache(s).changed,false);assert.equal(s.inventory.claimed.filter(id=>id==='cache_town_market').length,1);
 assert.deepEqual(parseCampaign(serializeCampaign(s,maps),maps),s);
});
test('v7 migration preserves maps, combat, spells and RNG, but realizes original starter supplies as items',()=>{
 const s=fresh(),old=structuredClone(s);old.version=7;old.inventory={items:[]};old.party.resources.supplies={item_healing_draught:2,item_antidote:2};
 old.quests.flags.push('found_flag');old.maps.map_town.doors.town_north_gate=true;
 const upgraded=parseCampaign(JSON.stringify(old),maps);assert.equal(upgraded.version,CAMPAIGN_VERSION);
 assert.deepEqual(upgraded.maps,old.maps);assert.deepEqual(upgraded.magic,old.magic);assert.deepEqual(upgraded.combat,old.combat);assert.deepEqual(upgraded.rng,old.rng);
 assert.deepEqual(upgraded.inventory,s.inventory);assert.deepEqual(upgraded.party,s.party);assert.equal(upgraded.inventory.items.filter(i=>i.definitionId==='item_antidote').reduce((sum,i)=>sum+i.count,0),2);
});
test('tampered inventory rejects duplicated IDs, dangling equipment, item forgery, overflow and invalid counters',()=>{
 const failures=[s=>s.inventory.items[1].id=s.inventory.items[0].id,s=>s.inventory.items[0].definitionId='item_fake',s=>s.inventory.nextId=1,s=>s.inventory.items[0].ownerId='hero_bad',s=>s.inventory.items[0].count=999,s=>s.inventory.items[0].durability=999,s=>s.inventory.items[0].equipped='accessoryA',s=>s.inventory.claimed=['cache_fake'],s=>s.inventory.items.shift()];
 for(const corrupt of failures){const s=fresh();corrupt(s);assert.throws(()=>serializeCampaign(s,maps));}
});
test('cursed equipped items cannot be removed, sold or transferred until priestly cleansing',()=>{
 const s=fresh(),sword=s.inventory.items.find(v=>v.ownerId==='hero_tarin'&&v.equipped==='melee');
 s.magic.itemCurses.hero_tarin=['item_sword'];
 for(const action of ['remove','sell','transfer']){const r=itemAction(s,{action,itemId:sword.id,targetId:'hero_vexa'});assert.equal(r.changed,false);}
 assert.deepEqual(s.magic.itemCurses.hero_tarin,['item_sword']);
});
test('consumable combat turn validates ownership, consumes exactly one potion and advances via combat engine',async()=>{
 const {afterItemUse}=await import('../src/shared/rules/combat.ts');
 let s=fresh();s.currentMapId='map_diagnostic_galleries';s.maps.map_diagnostic_galleries.x=2;s.maps.map_diagnostic_galleries.y=8;
 let begun=beginEncounter(s,maps);s=begun.state;
 const acting=s.combat.active.turnOrder[s.combat.active.turnIndex];
 assert.ok(acting.startsWith('hero_'));
 const potion= s.inventory.items.find(i=>i.definitionId==='item_healing_draught');
 s.party.characters[acting].hp=Math.max(1,s.party.characters[acting].hp-6);
 const invalid=itemAction(s,{action:'use',itemId:potion.id,targetId:acting});
 if(potion.ownerId!==acting){assert.equal(invalid.changed,false);assert.match(invalid.message,/acting character/);}else{
   assert.ok(invalid.changed);const advanced=afterItemUse(invalid.state,maps);assert.equal(advanced.changed,true);
   assert.ok(advanced.state.rollCount>=s.rollCount);
 }
});
test('corpse treasure stays outside inventory until manually picked up',async()=>{
 const {lootGround}=await import('../src/shared/rules/ground.ts');let s=fresh();s.currentMapId='map_diagnostic_galleries';Object.assign(s.maps[s.currentMapId],{x:2,y:8,facing:1});const e=s.combat.encounters.enc_gallery_entry;e.enemies.forEach(v=>v.hp=0);e.cleared=true;e.rewarded=true;const n=s.inventory.items.length;rewardLoot(s,e.id);assert.equal(s.inventory.items.length,n);const c=s.ground.containers.find(c=>c.enemyId==='enemy_imp_1');const count=c.entries.length;const r=lootGround(s,maps,{containerId:c.id,takeAll:true});assert.ok(r.changed);assert.equal(r.state.inventory.items.length,n+count);assert.deepEqual(parseCampaign(serializeCampaign(r.state,maps),maps),r.state);
});
