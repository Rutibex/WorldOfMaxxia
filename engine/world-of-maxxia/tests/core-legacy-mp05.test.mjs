import test,{afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadProjectBoot,loadProjectItems,loadProjectClasses,loadProjectProgression,loadProjectSpells,loadProjectMonsters,loadProjectLegacyAdapter,loadProjectEncounters,loadProjectLoot,loadProjectActors,createProjectCampaign,projectCampaignStorage} from '../src/client/project-boot.ts';
import {readFirstlightAdapter,readCoreProvenance,stageFirstlightOverlay,LegacyAdapterError} from '../src/shared/content/legacy-adapter.ts';
import {ITEMS,installItemDatabase,readItemDatabase} from '../src/shared/content/items.ts';
import {MONSTERS,installMonsterDatabase,readMonsterDatabase} from '../src/shared/content/monsters.ts';
import {CLASSES,installClassDatabase} from '../src/shared/content/classes.ts';
import {readMapIndex,locateMaps,validateIndexedMaps} from '../src/shared/project/map-index.ts';
import {CampaignStore} from '../src/shared/saves/campaign-store.ts';
import {giveItem} from '../src/shared/rules/inventory.ts';
const root=new URL('../public/',import.meta.url);
const raw=p=>readFileSync(new URL(p,root),'utf8');
const data=p=>JSON.parse(raw(p));
const original=p=>data('projects/WorldOfMaxxia/database/'+p+'.json');
const core=p=>data('core/classic/database/'+p+'.json');
const legacy=p=>data('projects/WorldOfMaxxia/legacy/database/'+p+'.json');
const base={items:structuredClone(original('items')),monsters:structuredClone(original('monsters')),classes:structuredClone(original('classes'))};
afterEach(()=>{installItemDatabase(base.items);installMonsterDatabase(base.monsters);installClassDatabase(base.classes);});
const fetcher=async url=>{const pathname=new URL(url).pathname.replace(/^\//,'');try{return new Response(raw(pathname));}catch{return new Response('',{status:404});}};
const setup=async project=>{const href=`https://example.test/?project=${project}`,boot=await loadProjectBoot(href,fetcher);await loadProjectItems(boot,fetcher);await loadProjectProgression(boot,fetcher);await loadProjectClasses(boot,fetcher);await loadProjectSpells(boot,fetcher);await loadProjectMonsters(boot,fetcher);return {href,boot};};
test('shared core and Firstlight records reconstruct every old item/monster with original order/IDs',()=>{
 for(const [name,field] of [['items','items'],['monsters','monsters']]){
  const assembled=[...core(name)[field],...legacy(name)[field]];
  assert.deepEqual(assembled,original(name)[field]);
  assert.equal(assembled.length,name==='items'?48:9);
  assert.equal(new Set(assembled.map(x=>x.id)).size,assembled.length);
 }
 for(const name of ['classes','spells','conditions','progression'])assert.deepEqual(core(name),original(name));
});
test('core alone establishes six classes, forty items and two monsters without campaign content',async()=>{
 const {boot}=await setup('WorldOfMaxxia.maxxia');
 assert.equal(Object.keys(CLASSES).length,6);assert.equal(Object.keys(ITEMS).length,40);assert.equal(Object.keys(MONSTERS).length,2);
 assert.equal(ITEMS.item_custodian_seal,undefined);assert.equal(MONSTERS.bell_heart,undefined);
 assert.equal(boot.itemsUrl,'https://example.test/core/classic/database/items.json');
 assert.equal(boot.spellsUrl,'https://example.test/core/classic/database/spells.json');
});
test('Firstlight adapter restores namespaced runtime content to historical stable identities',async()=>{
 const {boot,href}=await setup('WorldOfMaxxia.maxxia');await loadProjectLegacyAdapter(boot,href,fetcher);
 assert.equal(Object.keys(ITEMS).length,48);assert.equal(Object.keys(MONSTERS).length,9);
 assert.deepEqual(Object.values(ITEMS),original('items').items);assert.deepEqual(Object.values(MONSTERS),original('monsters').monsters);
 assert(ITEMS.item_bellkeeper_blade);assert(MONSTERS.bell_heart);assert.equal(Object.keys(CLASSES).length,6);
});
test('authored catalogue proof also boots through shared core and the same legacy overlay',async()=>{
 const {boot,href}=await setup('CatalogueProof.maxxia');await loadProjectLegacyAdapter(boot,href,fetcher);
 assert.deepEqual(Object.values(ITEMS),original('items').items);
 assert.deepEqual(Object.values(MONSTERS),original('monsters').monsters);
});
test('legacy loader never executes for a different project or makes surprise requests',async()=>{
 const boot={manifest:{projectId:'project_other'}};
 await loadProjectLegacyAdapter(boot,'https://example.test/',async()=>{throw Error('Unexpected adapter request');});
});
test('corrupt campaign file is refused before replacing the installed core tables',async()=>{
 const {boot,href}=await setup('WorldOfMaxxia.maxxia');const before={items:structuredClone(ITEMS),monsters:structuredClone(MONSTERS)};
 const bad=async url=>new Response(url.endsWith('/legacy/database/items.json')?raw('projects/WorldOfMaxxia/legacy/database/items.json').replace('Bellkeeper Blade','Changed Blade'):(await fetcher(url)).body);
 await assert.rejects(loadProjectLegacyAdapter(boot,href,bad),e=>e.code==='E_CORE_HASH');
 assert.deepEqual(ITEMS,before.items);assert.deepEqual(MONSTERS,before.monsters);
});
test('missing core or changed rules profile never silently falls back to old bundled data',async()=>{
 const {boot,href}=await setup('WorldOfMaxxia.maxxia');const before=structuredClone(ITEMS);
 await assert.rejects(loadProjectLegacyAdapter(boot,href,async url=>url.endsWith('core/classic/database/classes.json')?new Response('',{status:404}):fetcher(url)),e=>e.code==='E_PROJECT_HTTP');
 assert.deepEqual(ITEMS,before);
 const incompatible=readFirstlightAdapter(raw('projects/WorldOfMaxxia/legacy/adapter.json'),'project_world_of_maxxia');
 assert.throws(()=>readFirstlightAdapter({...incompatible,coreRules:{id:'core:rules:other',version:'1.0.0'}},'project_world_of_maxxia'),e=>e.code==='E_LEGACY_RULES');
});
test('overlay staging rejects duplicate core IDs, renamed save IDs and missing guaranteed loot',()=>{
 const adapter=readFirstlightAdapter(raw('projects/WorldOfMaxxia/legacy/adapter.json'),'project_world_of_maxxia');
 installItemDatabase(core('items'));installMonsterDatabase(core('monsters'));
 const badItems=legacy('items');badItems.items[0].id='item_dagger';
 assert.throws(()=>stageFirstlightOverlay(adapter,badItems,legacy('monsters')),e=>e.code==='E_LEGACY_IDS');
 const tampered=legacy('monsters');tampered.monsters[0].guaranteedLootItemId='item_does_not_exist';
 assert.throws(()=>stageFirstlightOverlay(adapter,legacy('items'),tampered),e=>e.code==='E_LEGACY_LOOT');
 const custom={...adapter,expectedItemIds:[...adapter.expectedItemIds.slice(1),'item_dagger']};
 assert.throws(()=>stageFirstlightOverlay(custom,{...legacy('items'),items:[{...legacy('items').items[0],id:'item_dagger'},...legacy('items').items.slice(1)]},legacy('monsters')),e=>e.code==='E_LEGACY_COLLISION');
});
test('format-18 original campaign save with campaign-specific gear and encounter survives split',async()=>{
 const {boot,href}=await setup('WorldOfMaxxia.maxxia');await loadProjectLegacyAdapter(boot,href,fetcher);await loadProjectEncounters(boot,fetcher);await loadProjectLoot(boot,fetcher);await loadProjectActors(boot,fetcher);
 const indexUrl='projects/WorldOfMaxxia/maps/index.json';const idx=readMapIndex(raw(indexUrl)),loc=locateMaps(idx,'https://example.test/'+indexUrl),registry=validateIndexedMaps(loc,loc.map(e=>data(new URL(e.url).pathname.slice(1))));
 const state=createProjectCampaign(registry,boot);assert(state.party.characters.hero_tarin);
 const legacyGear=giveItem(state.inventory,'hero_tarin','item_bellkeeper_blade');assert.equal(legacyGear.definitionId,'item_bellkeeper_blade');
 const storageMap=new Map(),storage={getItem:k=>storageMap.get(k)??null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
 const gameStore=new CampaignStore(projectCampaignStorage(storage,boot.manifest.projectId),registry);
 gameStore.save('auto',state);const key='world-of-maxxia:campaign:v1:auto',old=storageMap.get(key);
 const restored=gameStore.load('auto');assert.equal(restored.version,18);assert.equal(restored.party.order.length,6);
 assert.equal(restored.combat.encounters.enc_bell_heart?.enemies?.[0]?.kindId,'bell_heart');
 assert.equal(storageMap.get(key),old,'reading a save does not rewrite the original slot');
});
