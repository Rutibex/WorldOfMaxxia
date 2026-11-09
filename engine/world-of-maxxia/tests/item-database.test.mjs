import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ITEMS,ITEM_IDS,readItemDatabase,installItemDatabase} from '../src/shared/content/items.ts';
import {loadProjectBoot,loadProjectItems} from '../src/client/project-boot.ts';
import {newCampaign,validateMapRegistry,serializeCampaign,parseCampaign} from '../src/shared/rules/campaign.ts';
import {giveItem,itemAction,itemName} from '../src/shared/rules/inventory.ts';
import {nearbyGround,lootGround} from '../src/shared/rules/ground.ts';
const text=readFileSync(new URL('../public/projects/WorldOfMaxxia/database/items.json',import.meta.url),'utf8');
const baseline=readItemDatabase(text);
const maps=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL(`../public/content/${n}.json`,import.meta.url)))));
function withDatabase(make,fn){try{const db=structuredClone(baseline);make(db);installItemDatabase(db);return fn(db);}finally{installItemDatabase(baseline);}}
test('48 original item IDs, prices, effects and equipment retain MM05 definitions',()=>{
 assert.equal(baseline.items.length,48);assert.equal(Object.keys(ITEMS).length,48);assert.equal(ITEM_IDS.length,48);
 for(const item of baseline.items){assert.deepEqual(ITEMS[item.id],item);assert.equal(item.iconResourceId,`asset_art_items_${item.id}_png`);}
});
test('reject malformed, unsafe, duplicate and inconsistent item definitions atomically',()=>{
 const variants=[
  db=>db.items.push({...db.items[0]}),
  db=>db.items[0].id='../../escape',
  db=>db.items[0].category='unsupported',
  db=>db.items[0].slot='body',
  db=>db.items[0].price=-1,
  db=>db.items[0].iconResourceId='../not-an-asset',
  db=>db.items[0].dice='999d99999',
  db=>delete db.items[0].effect,
 ];
 const original=ITEMS.item_dagger.name;
 for(const mutate of variants){const db=structuredClone(baseline);mutate(db);assert.throws(()=>installItemDatabase(db));assert.equal(ITEMS.item_dagger.name,original);}
});
test('change an item name in project JSON without recompiling any engine module',()=>withDatabase(db=>{db.items.find(x=>x.id==='item_dagger').name='Carved Dagger';},()=>{
 const s=newCampaign(maps),item=s.inventory.items.find(x=>x.definitionId==='item_dagger');
 assert(item);assert.equal(itemName(item),'Carved Dagger');assert.equal(ITEMS.item_dagger.price,45);
}));
test('new consumable may be granted, used, dropped, looted and roundtrip through saves',()=>withDatabase(db=>{
 db.items.push({...db.items.find(x=>x.id==='item_healing_draught'),id:'item_mm06_newtonic',name:'Project-Brewed Tonic',price:77,iconResourceId:'asset_art_items_item_healing_draught_png'});
},()=>{
 let s=newCampaign(maps);const c=s.party.characters.hero_tarin;c.hp-=10;
 const item=giveItem(s.inventory,'hero_tarin','item_mm06_newtonic');assert(item);
 assert.equal(itemName(item),'Project-Brewed Tonic');
 let result=itemAction(s,{action:'use',itemId:item.id});assert.equal(result.changed,true);s=result.state;
 assert(s.party.characters.hero_tarin.hp>c.hp);
 const other=giveItem(s.inventory,'hero_tarin','item_mm06_newtonic');assert(other);
 result=itemAction(s,{action:'drop',itemId:other.id});assert(result.changed);s=result.state;
 const pile=nearbyGround(s,maps).find(x=>x.entries.some(y=>y.item?.definitionId==='item_mm06_newtonic'));
 assert(pile);const claimed=lootGround(s,maps,{containerId:pile.id,takeAll:true,ownerId:'hero_tarin'});
 assert(claimed.changed);s=claimed.state;
 const saved=serializeCampaign(s,maps);const loaded=parseCampaign(saved,maps);
 assert.deepEqual(loaded,s);assert(loaded.inventory.items.some(i=>i.definitionId==='item_mm06_newtonic'));
}));
test('duplicate an armor definition under another ID and equip it as myrmidon',()=>withDatabase(db=>{
 db.items.push({...db.items.find(x=>x.id==='item_leather_coat'),id:'item_mm06_novel_armor',name:'Azure Traveling Coat',armor:4});
},()=>{
 let s=newCampaign(maps),item=giveItem(s.inventory,'hero_tarin','item_mm06_novel_armor');
 assert(item);const result=itemAction(s,{action:'equip',itemId:item.id});assert.equal(result.changed,true);
 s=result.state;assert.equal(s.party.characters.hero_tarin.equipment.body,'item_mm06_novel_armor');
 assert.deepEqual(parseCampaign(serializeCampaign(s,maps),maps),s);
}));
test('boot loads author-defined catalogue path before scene initialization',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/WorldOfMaxxia.maxxia',import.meta.url),'utf8'));
 assert.equal(manifest.content.items,'core/classic/database/items.json');
 const db=structuredClone(baseline);db.items.find(x=>x.id==='item_dagger').name='Edited by Project';
 const fetcher=async url=>new Response(url.endsWith('WorldOfMaxxia.maxxia')?JSON.stringify(manifest):url.endsWith('database/items.json')?JSON.stringify(db):readFileSync(new URL('../public/'+new URL(url).pathname.replace(/^\/(game\/)?/,'') ,import.meta.url)));
 try{
  const boot=await loadProjectBoot('https://example.test/game/',fetcher);
  assert(boot.itemsUrl?.endsWith('/database/items.json'));
  await loadProjectItems(boot,fetcher);assert.equal(ITEMS.item_dagger.name,'Edited by Project');
 }finally{installItemDatabase(baseline);}
});
