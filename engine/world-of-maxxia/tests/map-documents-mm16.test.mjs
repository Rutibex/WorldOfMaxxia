import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importLegacyMap,adaptMapDocument,validateMapDocument,normalizeMapDocument,serializeMapDocument} from '../src/shared/project/map-document.ts';
import {validateMapRegistry,newCampaign,validateCampaign,travelCampaign} from '../src/shared/rules/campaign.ts';
import {validateGridMap,applyGridAction,initialGridState} from '../src/shared/rules/grid.ts';
import {validateIndexedMaps} from '../src/shared/project/map-index.ts';
import {CampaignStore} from '../src/shared/saves/campaign-store.ts';
const file=path=>JSON.parse(readFileSync(new URL('../public/'+path,import.meta.url),'utf8'));
const original=['town','galleries','vault'].map(name=>file('content/'+name+'.json'));
const migrated=['map_town','map_diagnostic_galleries','map_resonator_vault'].map(name=>file(`projects/WorldOfMaxxia/maps/${name}.json`));
const attrs=['id','name','rows','spawn','doors','props','secrets','traps','fountains','portals'];

test('MM16 original town, cistern and vault preserve every legacy gameplay field and IDs',()=>{
 for(let i=0;i<3;i++){
  const old=original[i],doc=validateMapDocument(migrated[i]),grid=adaptMapDocument(doc);
  assert.equal(doc.width,old.rows[0].length);assert.equal(doc.height,old.rows.length);
  for(const field of attrs)if(Object.hasOwn(old,field))assert.deepEqual(grid[field],old[field],`changed ${old.id}.${field}`);
  assert.deepEqual(normalizeMapDocument(doc),grid);
  assert.deepEqual(validateGridMap(grid),grid);
  assert.equal(doc.events.length,0);assert.equal(doc.arrivals[0].id,'arrival_start');
 }
});

test('MM16 migration round-trips without mutating legacy source; unknown compatible fields survive',()=>{
 const old={...structuredClone(original[0]),authorNotes:{plugin:'later',nested:{data:42}}},before=structuredClone(old);
 const doc=importLegacyMap(old);assert.deepEqual(old,before);assert.deepEqual(doc.authorNotes,old.authorNotes);
 const loaded=validateMapDocument(JSON.parse(serializeMapDocument(doc)));
 assert.deepEqual(loaded,doc);
 const legacy=adaptMapDocument(loaded);
 for(const field of attrs)if(Object.hasOwn(old,field))assert.deepEqual(legacy[field],old[field]);
});

test('MM16 materials, named arrivals and future events work without rewriting collision or saves',()=>{
 const doc=importLegacyMap(original[0]);doc.materials.floor.overrides.push({x:7,y:7,materialId:'material_marble'});
 doc.materials.wall.overrides.push({x:7,y:1,materialId:'material_basalt'});
 doc.settings={environmentId:'environment_town',musicId:'music_market',notes:'Opening region'};
 doc.arrivals.push({id:'arrival_alt',name:'Alternate Entrance',x:7,y:3,facing:2});
 doc.events.push({id:'event_future_one',name:'Future event',x:7,y:5,notes:'MM24 placeholder'});
 const loaded=validateMapDocument(JSON.parse(serializeMapDocument(doc)));
 const grid=adaptMapDocument(loaded);
 for(const field of attrs)if(Object.hasOwn(original[0],field))assert.deepEqual(grid[field],original[0][field]);
 assert.equal(loaded.events[0].id,'event_future_one');assert.equal(loaded.arrivals[1].name,'Alternate Entrance');
 const state=initialGridState(grid);assert.equal(state.x,original[0].spawn.x);
 assert.equal(applyGridAction(grid,state,'turn_right').state.facing,1);
});

test('MM16 rejects dimension mismatches, unsafe terrain, bad materials, blocked arrivals and duplicate event IDs',()=>{
 const base=importLegacyMap(original[0]);
 const bad=(edit)=>{const v=structuredClone(base);edit(v);assert.throws(()=>validateMapDocument(v));};
 bad(v=>{v.width++;});
 bad(v=>{v.geometry.rows[0]='.'.repeat(v.width);});
 bad(v=>{v.materials.wall.default='../escape';});
 bad(v=>{v.materials.floor.overrides=[{x:0,y:0,materialId:'material_bad'}];});
 bad(v=>{v.materials.ceiling.overrides=[{x:3,y:3,materialId:'material_a'},{x:3,y:3,materialId:'material_b'}];});
 bad(v=>{v.arrivals[0].x=0;});
 bad(v=>{v.arrivals.push({...v.arrivals[0]});});
 bad(v=>{v.events.push({id:'event_a',x:0,y:0,name:'Bad',notes:''});});
 bad(v=>{v.events.push({id:'event_a',x:7,y:7,name:'Good',notes:''},{id:'event_a',x:7,y:7,name:'Again',notes:''});});
 bad(v=>{v.objects.doors[0].id='bad_duplicate';v.objects.doors[1].id='bad_duplicate';});
 bad(v=>{v.format='unknown-map';});
 bad(v=>{v.version=2;});
});

test('MM16 indexed new documents validate cross-map portals; invalid targets are rejected',()=>{
 const index=file('projects/WorldOfMaxxia/maps/index.json');
 const registry=validateIndexedMaps(index.maps,migrated);
 assert.equal(Object.keys(registry).length,3);
 const alt=structuredClone(migrated);alt[0].objects.portals[0].targetMapId='map_missing';
 assert.throws(()=>validateIndexedMaps(index.maps,alt),e=>e.code==='E_MAP_VALIDATION');
});

test('MM16 converted maps maintain sealed doors, secrets, traps and portal travel',()=>{
 const registry=validateMapRegistry(migrated),old=validateMapRegistry(original);
 for(const mapId of Object.keys(old)){
  for(const field of attrs)if(Object.hasOwn(old[mapId],field))assert.deepEqual(registry[mapId][field],old[mapId][field]);
  assert.deepEqual(initialGridState(registry[mapId]),initialGridState(old[mapId]));
 }
 const state=newCampaign(registry);validateCampaign(state,registry);state.quests.questItems.push('item_quest_cistern_key');
 const p=registry.map_town.portals[0];state.maps.map_town.x=p.x;state.maps.map_town.y=p.y;state.maps.map_town.visited.push(`${p.x},${p.y}`);
 const moved=travelCampaign(state,registry);assert(moved);assert.equal(moved.state.currentMapId,p.targetMapId);
});

test('MM16 existing v18 saves remain identical across map migration',()=>{
 const old=validateMapRegistry(original),current=validateMapRegistry(migrated);
 const state=newCampaign(old),values=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const initial=new CampaignStore(storage,old);initial.save('auto',state);
 const loaded=new CampaignStore(storage,current).load('auto');
 assert.deepEqual(loaded,state);assert.equal(loaded.version,18);
});

test('MM16 example project maps use v1 and one-map/four-map registries remain valid',()=>{
 for(const project of ['SingleMapProof','ExpansionProof']){
  const index=file(`projects/${project}/maps/index.json`);
  const docs=index.maps.map(entry=>file(`projects/${project}/maps/${entry.path}`));
  assert(docs.every(d=>d.format==='maxxia-map'));
  assert.equal(Object.keys(validateIndexedMaps(index.maps,docs)).length,index.maps.length);
 }
});
