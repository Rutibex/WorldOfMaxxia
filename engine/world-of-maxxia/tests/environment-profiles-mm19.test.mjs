import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_ENVIRONMENTS,readEnvironments,validateEnvironmentMaps,materialAt} from '../src/shared/project/environments.ts';
import {locateResources,readResourceCatalog} from '../src/shared/project/resources.ts';
import {validateMapRegistry} from '../src/shared/rules/campaign.ts';
import {adaptMapDocument,validateMapDocument} from '../src/shared/project/map-document.ts';
const path=new URL('../public/projects/TransferProof/',import.meta.url);
const read=relative=>JSON.parse(readFileSync(new URL(relative,path),'utf8'));
const resources=locateResources(readResourceCatalog(JSON.stringify(read('assets/catalog.json'))),new URL('assets/catalog.json',path).href);
const profiles=read('database/environments.json');
const maps=read('maps/index.json').maps.map(({path})=>read('maps/'+path));
const copy=x=>structuredClone(x);

test('MM19 two new maps share one environment profile with raster resources, stable resource identifiers and no map ID dispatch',()=>{
 const database=readEnvironments(JSON.stringify(profiles),resources);
 const [a,b]=maps;validateEnvironmentMaps(maps,database);
 assert.equal(a.settings.environmentId,'environment_ruins');assert.equal(b.settings.environmentId,'environment_ruins');
 assert.equal(database.profiles.find(p=>p.id==='environment_ruins').materials.length,4);
 assert.equal(resources.byId.get('asset_mm19_wall').kind,'image');
 const adapted=validateMapRegistry(maps);
 assert.equal(adapted.map_landing.environmentId,'environment_ruins');
 assert.equal(adapted.map_tower.materials.wall.overrides[0].materialId,'material_wall_brass');
 assert.equal(materialAt(b,'wall',0,2),'material_wall_brass');
 assert.equal(materialAt(b,'wall',0,3),'material_wall_default');
 const changed=copy(database);changed.profiles.find(p=>p.id==='environment_ruins').materials.find(m=>m.id==='material_wall_default').resourceId='asset_mm19_brass';
 validateEnvironmentMaps(maps,readEnvironments(JSON.stringify(changed),resources));
 assert.equal(a.materials.wall.default,b.materials.wall.default,'both maps follow the shared material ID when the profile asset changes');
});

test('MM19 bad profile IDs, missing image resources, non-image kinds, duplicate materials and out-of-range fog are rejected',()=>{
 const fail=fn=>{const db=copy(profiles);fn(db);assert.throws(()=>readEnvironments(JSON.stringify(db),resources));};
 fail(db=>{db.profiles[1].id=db.profiles[0].id;});
 fail(db=>{db.profiles[1].materials[0].id=db.profiles[1].materials[1].id;});
 fail(db=>{db.profiles[1].fogStrength=3;});
 fail(db=>{db.profiles[1].skyResourceId='asset_missing';});
 fail(db=>{db.profiles[1].materials[0].resourceId='asset_missing';});
 fail(db=>{db.profiles[1].materials=db.profiles[1].materials.filter(m=>m.surface!=='wall');});
 fail(db=>{db.profiles[1].skyColor='#XYZ';});
});

test('MM19 missing project profile, missing/wrong-surface material, and bad tile overrides are blocked',()=>{
 const db=readEnvironments(JSON.stringify(profiles),resources);
 const fail=fn=>{const docs=copy(maps);fn(docs);assert.throws(()=>validateEnvironmentMaps(docs,db));};
 fail(docs=>{docs[0].settings.environmentId='environment_missing';});
 fail(docs=>{docs[0].materials.wall.default='material_floor_default';});
 fail(docs=>{docs[0].materials.floor.overrides=[{x:2,y:2,materialId:'material_wall_brass'}];});
 const bad=copy(maps[0]);bad.materials.wall.overrides=[{x:3,y:3,materialId:'material_wall_brass'}];
 assert.throws(()=>validateMapDocument(bad),'wall override cannot occupy floor');
});

test('MM19 old maps remain valid without a project environment database and retain legacy procedural rendering metadata',()=>{
 const old=read('maps/map_landing.json');old.settings.environmentId='environment_default';
 old.materials.wall.default='material_wall_default';old.materials.floor.default='material_floor_default';old.materials.ceiling.default='material_ceiling_default';
 validateEnvironmentMaps([old],DEFAULT_ENVIRONMENTS);
 assert.equal(adaptMapDocument(validateMapDocument(old)).environmentId,'environment_default');
});

test('MM19 map geometry is not modified by profile/mat reads and map ID is irrelevant',()=>{
 const doc=copy(maps[1]);const before=JSON.stringify(doc.geometry);
 assert.equal(materialAt(doc,'wall',0,2),'material_wall_brass');
 doc.id='map_another_name';validateMapDocument(doc);
 validateEnvironmentMaps([doc],readEnvironments(JSON.stringify(profiles),resources));
 assert.equal(JSON.stringify(doc.geometry),before);
});
