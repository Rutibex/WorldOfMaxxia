import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadProjectBoot,selectProjectUrl,createProjectCampaign,projectCampaignStorage} from '../src/client/project-boot.ts';
import {readMapIndex,locateMaps,validateIndexedMaps} from '../src/shared/project/map-index.ts';
import {validateMapRegistry,newCampaign,travelCampaign} from '../src/shared/rules/campaign.ts';
import {CampaignStore} from '../src/shared/saves/campaign-store.ts';
import {recoverParty} from '../src/shared/rules/combat.ts';
const publicDir=new URL('../public/',import.meta.url);
const file=(name)=>readFileSync(new URL(name,publicDir),'utf8');
const baseline=JSON.parse(file('WorldOfMaxxia.maxxia'));
const maps=validateMapRegistry(['town','galleries','vault'].map(name=>JSON.parse(file('content/'+name+'.json'))));
function mockFiles(overrides={}) {
 return async url=>{
  const relative=new URL(url).pathname.replace(/^\/(?:game\/)?/,'');
  return relative in overrides?new Response(overrides[relative]):new Response(file(relative));
 };
}
test('default boot resolves packaged manifest and project-owned map index under nested hosting',async()=>{
 const boot=await loadProjectBoot('https://example.test/game/',mockFiles());
 assert.equal(boot.manifest.projectId,'project_world_of_maxxia');
 assert.equal(boot.mapDocuments.length,3);
 assert.equal(boot.mapDocuments[0].url,'https://example.test/game/projects/WorldOfMaxxia/maps/map_town.json');
 assert.deepEqual(createProjectCampaign(maps,boot),newCampaign(maps));
});
test('selected root manifest and legacy Phase 34 manifests both load without map registration',async()=>{
 const selected=await loadProjectBoot('https://example.test/game/?project=WorldOfMaxxia.maxxia',mockFiles());
 assert.equal(selected.mapDocuments.length,3);assert.equal(selected.legacyContent,false);
});
test('legacy content adapter remains readable for older MM02 manifests',async()=>{
 const legacy={...baseline,content:{kind:'legacy-phase34',foundation:'content/foundation.json',town:'content/town.json',galleries:'content/galleries.json',vault:'content/vault.json'}};
 const boot=await loadProjectBoot('https://example.test/game/?project=Legacy.maxxia',mockFiles({'Legacy.maxxia':JSON.stringify(legacy)}));
 assert.equal(boot.legacyContent,true);assert.equal(boot.mapDocuments.length,3);assert.equal(boot.mapDocuments[1].url,'https://example.test/game/content/town.json');
 assert.deepEqual(createProjectCampaign(maps,boot),newCampaign(maps));
});
test('unsafe selections, missing manifests and missing indexes report actionable errors',async()=>{
 for(const query of ['project=','project=../x.maxxia','project=https://evil.test/a.maxxia','project=/a.maxxia','project=%252e%252e/x.maxxia','project=a.maxxia&project=b.maxxia','project=a.json'])assert.throws(()=>selectProjectUrl('https://example.test/?'+query),e=>e.code==='E_PROJECT_SELECTION');
 await assert.rejects(()=>loadProjectBoot('https://example.test/?project=missing.maxxia',async()=>new Response('',{status:404})),e=>e.code==='E_PROJECT_HTTP');
 await assert.rejects(()=>loadProjectBoot('https://example.test/?project=bad.maxxia',async()=>new Response('{}')),e=>e.code==='E_REQUIRED');
 await assert.rejects(()=>loadProjectBoot('https://example.test/?project=ok.maxxia',async url=>url.endsWith('.maxxia')?new Response(JSON.stringify(baseline)):new Response('',{status:404})),e=>e.code==='E_PROJECT_HTTP');
});
test('oversized response and invalid UTF-8 are rejected without unbounded reads',async()=>{
 await assert.rejects(()=>loadProjectBoot('https://example.test/?project=large.maxxia',async()=>new Response('x'.repeat(66000))),e=>e.code==='E_SIZE');
 await assert.rejects(()=>loadProjectBoot('https://example.test/?project=bad.maxxia',async()=>new Response(new Uint8Array([0xff,0xfe]))),e=>e.code==='E_JSON');
});
test('configured position/facing/starting roster and invalid reference checks remain intact',async()=>{
 const m=structuredClone(baseline);m.start.y=11;m.start.facing=2;m.startingParty.reverse();
 const boot=await loadProjectBoot('https://example.test/?project=custom.maxxia',mockFiles({'custom.maxxia':JSON.stringify(m)}));
 const state=createProjectCampaign(maps,boot);assert.equal(state.maps.map_town.y,11);assert.equal(state.maps.map_town.facing,2);assert.equal(state.party.order[0],'hero_mora');
 boot.manifest.start.map.id='map_missing';assert.throws(()=>createProjectCampaign(maps,boot),e=>e.code==='E_REFERENCE');
 boot.manifest.start.map.id='map_town';boot.manifest.start.x=0;assert.throws(()=>createProjectCampaign(maps,boot),e=>e.code==='E_START_BLOCKED');
 boot.manifest.start.x=7;boot.manifest.startingParty[0].id='hero_unknown';assert.throws(()=>createProjectCampaign(maps,boot),e=>e.code==='E_REFERENCE');
});
test('separate project identities isolate save slots while legacy World retains stored slots',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const old=new CampaignStore(storage,maps),other=new CampaignStore(projectCampaignStorage(storage,'project_another'),maps);
 old.save('auto',newCampaign(maps));assert.equal(other.list()[0].present,false);
 const different=newCampaign(maps);different.party.resources.gold=777;other.save('auto',different);
 assert.equal(old.load('auto').party.resources.gold,300);assert.equal(other.load('auto').party.resources.gold,777);
 assert.equal(projectCampaignStorage(storage,'project_world_of_maxxia'),storage);
});
test('selected starting roster is properly reduced to chosen actors',async()=>{
 const m=structuredClone(baseline);m.startingParty=[{type:'actor',id:'hero_mora'}];
 const boot=await loadProjectBoot('https://example.test/?project=single.maxxia',mockFiles({'single.maxxia':JSON.stringify(m)}));
 const state=createProjectCampaign(maps,boot);assert.deepEqual(Object.keys(state.party.characters),['hero_mora']);assert(state.inventory.items.every(i=>i.ownerId==='hero_mora'));
});
test('four-map proof: all four documents load, travel both directions, registry state validates',async()=>{
 const boot=await loadProjectBoot('https://example.test/game/?project=projects/ExpansionProof/ExpansionProof.maxxia',mockFiles());
 assert.equal(boot.mapDocuments.length,4);
 const registry=validateIndexedMaps(boot.mapDocuments,boot.mapDocuments.map(e=>JSON.parse(file(new URL(e.url).pathname.replace('/game/','')))));
 const state=createProjectCampaign(registry,boot),portal=registry.map_town.portals.find(p=>p.targetMapId==='map_overlook');
 assert(portal);state.maps.map_town.x=portal.x;state.maps.map_town.y=portal.y;state.maps.map_town.visited.push(`${portal.x},${portal.y}`);
 const entered=travelCampaign(state,registry);assert(entered);assert.equal(entered.state.currentMapId,'map_overlook');
 assert.equal(entered.state.maps.map_overlook.x,4);
 const returned=travelCampaign(entered.state,registry);assert(returned);assert.equal(returned.state.currentMapId,'map_town');
});
test('one-map proof: starts, validates, saves and reloads without original map IDs',async()=>{
 const boot=await loadProjectBoot('https://example.test/game/?project=projects/SingleMapProof/SingleMapProof.maxxia',mockFiles());
 assert.equal(boot.mapDocuments.length,1);
 const registry=validateIndexedMaps(boot.mapDocuments,boot.mapDocuments.map(e=>JSON.parse(file(new URL(e.url).pathname.replace('/game/','')))));
 const state=createProjectCampaign(registry,boot);assert.equal(state.currentMapId,'map_single_room');assert.deepEqual(Object.keys(state.combat.encounters),[]);
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const store=new CampaignStore(projectCampaignStorage(storage,boot.manifest.projectId),registry);store.save('auto',state);assert.deepEqual(store.load('auto'),state);
});
test('index rejects duplicate map ID, duplicate file paths, traversal, and mismatched document IDs',()=>{
 const raw={format:'maxxia-map-index',version:1,maps:[{id:'map_a',path:'a.json'}]};
 assert.equal(readMapIndex(JSON.stringify(raw)).maps.length,1);
 assert.throws(()=>readMapIndex(JSON.stringify({...raw,maps:[raw.maps[0],{id:'map_a',path:'b.json'}]})),e=>e.code==='E_MAP_DUPLICATE');
 assert.throws(()=>readMapIndex(JSON.stringify({...raw,maps:[raw.maps[0],{id:'map_b',path:'A.json'}]})),e=>e.code==='E_MAP_PATH_DUPLICATE');
 assert.throws(()=>readMapIndex(JSON.stringify({...raw,maps:[{id:'map_a',path:'../outside.json'}]})),e=>e.code==='E_MAP_PATH');
 assert.throws(()=>readMapIndex(JSON.stringify({...raw,maps:[{id:'map_a',path:'%2e%2e/outside.json'}]})),e=>e.code==='E_MAP_PATH');
 assert.throws(()=>validateIndexedMaps(raw.maps,[{id:'map_other'}]),e=>e.code==='E_MAP_ID_MISMATCH');
 assert.equal(locateMaps(raw,'https://example.test/maps/index.json')[0].url,'https://example.test/maps/a.json');
});
