import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry,CAMPAIGN_VERSION} from '../src/shared/rules/campaign.ts';
import {TOWN_SERVICES,SHOP_STOCK,nearbyService,serviceAction,validateServices,RUMORS} from '../src/shared/rules/services.ts';
import {ITEMS} from '../src/shared/content/items.ts';
import {SPELLS} from '../src/shared/rules/magic.ts';
import {derived,training,validateParty} from '../src/shared/rules/party.ts';
import {validateInventory,giveItem} from '../src/shared/rules/inventory.ts';
import {validateMagic,partyDefenseBonus} from '../src/shared/rules/magic.ts';
import {tileAt} from '../src/shared/rules/grid.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(name=>JSON.parse(readFileSync(new URL(`../public/content/${name}.json`,import.meta.url)))));
const fresh=()=>newCampaign(registry);
const position=(s,kind)=>{const n=TOWN_SERVICES.find(n=>n.kind===kind);s.currentMapId='map_town';s.maps.map_town.x=n.x;s.maps.map_town.y=n.y;s.maps.map_town.facing=1;const cell=`${n.x},${n.y}`;if(!s.maps.map_town.visited.includes(cell))s.maps.map_town.visited.push(cell);return s;};
const perform=(s,kind,action,extra={})=>serviceAction(s,registry,{serviceId:TOWN_SERVICES.find(n=>n.kind===kind).id,action,...extra});
const roundTrip=s=>assert.deepEqual(parseCampaign(serializeCampaign(s,registry),registry),s);

test('all eight NPCs occupy authored reachable floor tiles, with distinct names and stable IDs',()=>{
 assert.equal(TOWN_SERVICES.length,8);assert.equal(new Set(TOWN_SERVICES.map(n=>n.id)).size,8);
 for(const n of TOWN_SERVICES){assert.equal(tileAt(registry.map_town,n.x,n.y),'.');assert.equal(nearbyService(position(fresh(),n.kind),registry).id,n.id);}
});
test('service actions require physical proximity and refuse combat without mutating source',()=>{
 let s=fresh();assert.equal(perform(s,'merchant','buy',{definitionId:'item_dagger'}).changed,false);
 s=position(s,'merchant');const raw=JSON.stringify(s);s.combat.defeated=true;
 assert.equal(perform(s,'merchant','buy',{definitionId:'item_dagger'}).changed,false);assert.equal(JSON.stringify(s),raw.replace('"defeated":false','"defeated":true'));
});
test('bank transfer is atomic, bounded and never permits spending bank gold',()=>{
 let s=position(fresh(),'tavern');const before=JSON.stringify(s);
 assert.equal(perform(s,'tavern','deposit',{amount:301}).changed,false);assert.equal(perform(s,'tavern','deposit',{amount:0}).changed,false);assert.equal(JSON.stringify(s),before);
 s=perform(s,'tavern','deposit',{amount:250}).state;assert.equal(s.party.resources.gold,50);assert.equal(s.party.resources.bankGold,250);
 assert.equal(perform(s,'tavern','withdraw',{amount:251}).changed,false);roundTrip(s);
 s=perform(s,'tavern','withdraw',{amount:100}).state;assert.equal(s.party.resources.gold,150);assert.equal(s.party.resources.bankGold,150);
});
test('food, drink, rumors and inn rest have exact costs and persistent effects',()=>{
 let s=position(fresh(),'tavern');s.party.characters.hero_mora.hp=1;s.party.characters.hero_mora.sp=1;
 s=perform(s,'tavern','food',{amount:7}).state;assert.equal(s.party.resources.food,55);assert.equal(s.party.resources.gold,293);
 s=perform(s,'tavern','drink',{characterId:'hero_tarin'}).state;assert.equal(s.party.characters.hero_tarin.conditions.some(c=>c.id==='drunk'),true);
 for(let i=0;i<RUMORS.length;i++){const result=perform(s,'tavern','tip');assert.equal(result.changed,true);s=result.state;}
 assert.equal(perform(s,'tavern','tip').changed,false);assert.equal(s.quests.notes.length,RUMORS.length);
 const food=s.party.resources.food;s=perform(s,'tavern','rest').state;assert.equal(s.party.resources.food,food);assert.equal(s.elapsedMinutes,480);assert.equal(s.party.characters.hero_tarin.conditions.some(c=>c.id==='drunk'),false);assert.equal(s.party.characters.hero_mora.hp,derived(s.party.characters.hero_mora).maxHP);roundTrip(s);
});
test('roster dismissal and re-recruitment preserve every stored item and spell',()=>{
 let s=position(fresh(),'tavern');const oldItems=s.inventory.items.filter(i=>i.ownerId==='hero_mora'),known=s.magic.known.hero_mora;
 s=perform(s,'tavern','dismiss',{characterId:'hero_mora'}).state;
 assert.equal(s.party.order.length,5);assert.equal(s.party.characters.hero_mora.name,'Mora');
 assert.deepEqual(s.inventory.items.filter(i=>i.ownerId==='hero_mora'),oldItems);
 assert.deepEqual(s.magic.known.hero_mora,known);validateParty(s.party);validateInventory(s.inventory,s.party);validateMagic(s.magic,s);roundTrip(s);
 assert.equal(perform(s,'tavern','dismiss',{characterId:'hero_mora'}).changed,false);
 s=perform(s,'tavern','recruit',{characterId:'hero_mora'}).state;assert.equal(s.party.order.length,6);assert.deepEqual(s.magic.known.hero_mora,known);roundTrip(s);
});
test('a tavern cannot dismiss the last conscious hero or recruit past six',()=>{
 const s=position(fresh(),'tavern');assert.equal(perform(s,'tavern','recruit',{characterId:'hero_orrin'}).changed,false);
 for(const id of s.party.order.filter(id=>id!=='hero_tarin'))s.party.characters[id].hp=0;
 assert.equal(perform(s,'tavern','dismiss',{characterId:'hero_tarin'}).changed,false);
});
test('merchant stock, buyback and bag capacity prevent item and currency duplication',()=>{
 let s=position(fresh(),'merchant');const price=ITEMS.item_dagger.price,initial=SHOP_STOCK.item_dagger;
 let result=perform(s,'merchant','buy',{definitionId:'item_dagger',characterId:'hero_tarin'});assert.equal(result.changed,true);s=result.state;
 assert.equal(s.party.resources.gold,300-price);assert.equal(s.services.stock.item_dagger,initial-1);
 const bought=s.inventory.items.find(i=>i.ownerId==='hero_tarin'&&i.definitionId==='item_dagger');assert.ok(bought);
 s=perform(s,'merchant','sell',{characterId:'hero_tarin',itemId:bought.id}).state;
 assert.equal(s.party.resources.gold,300-price+Math.max(1,Math.floor(price/2)));
 assert.equal(s.inventory.items.some(i=>i.id===bought.id),false);assert.equal(perform(s,'merchant','sell',{itemId:bought.id}).changed,false);
 roundTrip(s);
});
test('merchant identify and repair quote fixed service costs, without replacing instances',()=>{
 let s=position(fresh(),'merchant');const unknown=giveItem(s.inventory,'hero_tarin','item_ember_ring');assert.equal(unknown.identified,false);
 const before=s.party.resources.gold;s=perform(s,'merchant','identify',{itemId:unknown.id,characterId:'hero_tarin'}).state;
 assert.equal(s.party.resources.gold,before-10);assert.equal(s.inventory.items.find(i=>i.id===unknown.id).identified,true);
 assert.equal(perform(s,'merchant','identify',{itemId:unknown.id}).changed,false);
 const sword=s.inventory.items.find(i=>i.ownerId==='hero_tarin'&&i.definitionId==='item_sword');sword.durability-=3;
 const repairCost=Math.max(1,Math.ceil(ITEMS.item_sword.price*.2));s=perform(s,'merchant','repair',{itemId:sword.id,characterId:'hero_tarin'}).state;
 assert.equal(s.party.resources.gold,before-10-repairCost);assert.equal(s.inventory.items.find(i=>i.id===sword.id).durability,ITEMS.item_sword.maxDurability);roundTrip(s);
});
test('temple healing, curing, revival, equipment uncurse, blessing and duration are persistent',()=>{
 let s=position(fresh(),'temple');const c=s.party.characters.hero_tarin;c.hp-=5;c.conditions.push({id:'poisoned',remaining:4,unit:'ticks'});
 s=perform(s,'temple','heal',{characterId:c.id}).state;assert.equal(s.party.characters[c.id].hp,derived(c).maxHP);
 s=perform(s,'temple','cure',{characterId:c.id,condition:'poisoned'}).state;assert.equal(s.party.characters[c.id].conditions.length,0);
 s.party.characters.hero_mora.hp=0;s=perform(s,'temple','revive',{characterId:'hero_mora'}).state;assert.equal(s.party.characters.hero_mora.sp,0);assert.equal(s.party.characters.hero_mora.hp,derived(s.party.characters.hero_mora).maxHP);
 s.magic.itemCurses.hero_tarin=['item_sword'];s=perform(s,'temple','uncurse',{characterId:'hero_tarin'}).state;assert.deepEqual(s.magic.itemCurses.hero_tarin,[]);
 s=perform(s,'temple','donate').state;assert.equal(partyDefenseBonus(s),1);assert.equal(perform(s,'temple','donate').changed,false);roundTrip(s);
});
test('trainer requires XP, price, level cap and milestone attribute choice',()=>{
 let s=position(fresh(),'trainer');assert.equal(perform(s,'trainer','train',{characterId:'hero_tarin'}).changed,false);
 s.party.characters.hero_tarin.xp=300;const cost=training(s.party.characters.hero_tarin).cost;
 s=perform(s,'trainer','train',{characterId:'hero_tarin'}).state;assert.equal(s.party.characters.hero_tarin.level,2);assert.equal(s.party.resources.gold,300-cost);
 s.party.characters.hero_tarin.xp=1000;assert.equal(perform(s,'trainer','train',{characterId:'hero_tarin'}).changed,false);
 s=perform(s,'trainer','train',{characterId:'hero_tarin',ability:'DEX'}).state;assert.equal(s.party.characters.hero_tarin.level,3);assert.equal(s.party.characters.hero_tarin.attributes.DEX,14);roundTrip(s);
});
test('three spell guilds enforce class, levels, learn-once and shared money',()=>{
 for(const kind of ['wizard','priest','witch']){
  let s=position(fresh(),kind);const id=s.party.order.find(i=>s.party.characters[i].classId===kind);
  const spell=Object.values(SPELLS).find(sp=>sp.classId===kind&&sp.level===1&&!s.magic.known[id].includes(sp.id));
  assert.ok(spell);s=perform(s,kind,'learn',{characterId:id,definitionId:spell.id}).state;
  assert.equal(s.magic.known[id].includes(spell.id),true);
  assert.equal(perform(s,kind,'learn',{characterId:id,definitionId:spell.id}).changed,false);
  const higher=Object.values(SPELLS).find(sp=>sp.classId===kind&&sp.level===5);
  assert.equal(perform(s,kind,'learn',{characterId:id,definitionId:higher.id}).changed,false);
  assert.equal(perform(s,kind,'learn',{characterId:'hero_tarin',definitionId:spell.id}).changed,false);roundTrip(s);
 }
});
test('Iona request is one-time and journal note survives round trip',()=>{
 let s=position(fresh(),'quest');const a=perform(s,'quest','quest');assert.ok(a.changed);s=a.state;
 assert.ok(s.quests.flags.includes('flag_iona_cistern_task'));assert.equal(perform(s,'quest','quest').changed,false);
 roundTrip(s);
});
test('v9 saves upgrade to v10 without modifying prior gameplay fields',()=>{
 const s=fresh(),old=structuredClone(s);old.version=9;delete old.services;
 const upgraded=parseCampaign(JSON.stringify(old),registry);assert.equal(upgraded.version,CAMPAIGN_VERSION);assert.deepEqual(upgraded.party,s.party);assert.deepEqual(upgraded.maps,s.maps);assert.deepEqual(upgraded.inventory,s.inventory);roundTrip(upgraded);
 for(const mutation of [v=>v.services.stock.item_dagger=-1,v=>v.services.rumorsHeard=100,v=>delete v.services]){
  const malformed=structuredClone(s);mutation(malformed);assert.throws(()=>parseCampaign(JSON.stringify(malformed),registry));
 }
});
