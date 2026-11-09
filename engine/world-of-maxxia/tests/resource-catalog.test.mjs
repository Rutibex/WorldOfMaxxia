import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,copyFileSync,writeFileSync,renameSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readResourceCatalog,locateResources,requireResource,legacyResourceUrl} from '../src/shared/project/resources.ts';
import {loadProjectBoot,projectAssetUrl,projectResourceUrl} from '../src/client/project-boot.ts';
const publicRoot=new URL('../public/',import.meta.url);
const file=(p)=>readFileSync(new URL(p,publicRoot),'utf8');
const raw=file('assets/catalog.json');
const source=readResourceCatalog(raw);
function one(records){return JSON.stringify({format:'maxxia-resource-catalog',version:1,resources:records});}
const sample={id:'asset_example',kind:'image',path:'art/ui/stone.png',legacyPath:'assets/art/ui/stone.png',name:'Stone'};
test('production art, audio and fonts retain stable IDs with a validated catalogue',()=>{
 assert.equal(source.resources.length,365);
 assert(source.resources.some(r=>r.kind==='audio'&&r.path.endsWith('.mid')));
 assert(source.resources.some(r=>r.kind==='font'&&r.path.endsWith('.woff')));
 const resolve=locateResources(source,'https://assets.example/game/assets/catalog.json');
 assert.equal(requireResource(resolve,'asset_art_ui_stone_png','image').url,'https://assets.example/game/assets/art/ui/stone.png');
 assert.equal(legacyResourceUrl(resolve,'assets/art/ui/stone.png','https://assets.example/game/'),requireResource(resolve,'asset_art_ui_stone_png').url);
 assert.equal(legacyResourceUrl(resolve,'assets/legacy-unknown.png','https://assets.example/game/'),'https://assets.example/game/assets/legacy-unknown.png');
 assert.throws(()=>requireResource(resolve,'asset_missing'),e=>e.code==='E_RESOURCE_MISSING');
 assert.throws(()=>requireResource(resolve,'asset_art_ui_stone_png','audio'),e=>e.code==='E_RESOURCE_KIND');
});
test('catalogue rejects unsafe paths, wrong kinds, duplicate IDs, case-only collisions and aliases',()=>{
 const errors=[
  [[{...sample,path:'../outside.png'}],'E_RESOURCE_PATH'],
  [[{...sample,path:'C:/outside.png'}],'E_RESOURCE_PATH'],
  [[{...sample,path:'%2e%2e/outside.png'}],'E_RESOURCE_PATH'],
  [[{...sample,kind:'audio'}],'E_RESOURCE_EXTENSION'],
  [[sample,{...sample,path:'another.png'}],'E_RESOURCE_ID'],
  [[sample,{...sample,id:'asset_other',path:'ART/UI/STONE.PNG'}],'E_RESOURCE_PATH_COLLISION'],
  [[sample,{...sample,id:'asset_other',path:'another.png'}],'E_RESOURCE_LEGACY_COLLISION']
 ];
 for(const [items,code] of errors)assert.throws(()=>readResourceCatalog(one(items)),e=>e.code===code);
 assert.throws(()=>readResourceCatalog(one([{...sample,id:'bad'}])),e=>e.code==='E_RESOURCE_ID');
 assert.throws(()=>readResourceCatalog(one([{...sample,path:'a.svg',kind:'font'}])),e=>e.code==='E_RESOURCE_EXTENSION');
 assert.throws(()=>readResourceCatalog(JSON.stringify({format:'bad',version:1,resources:[]})),e=>e.code==='E_RESOURCE_FORMAT');
 assert.throws(()=>readResourceCatalog('not json'),e=>e.code==='E_RESOURCE_JSON');
 assert.throws(()=>readResourceCatalog('x'.repeat(525000)),e=>e.code==='E_RESOURCE_SIZE');
 assert.equal(readResourceCatalog(one([])).resources.length,0);
});
test('catalogue relinking preserves resource identity and compatibility alias without code changes',()=>{
 const root=mkdtempSync(join(tmpdir(),'maxxia-mm05-'));
 try{
  mkdirSync(join(root,'art','ui'),{recursive:true});mkdirSync(join(root,'art','alternate'),{recursive:true});
  copyFileSync(new URL('assets/art/ui/stone.png',publicRoot),join(root,'art','ui','stone.png'));
  const before=locateResources(readResourceCatalog(one([sample])),'file://'+root+'/catalog.json');
  renameSync(join(root,'art','ui','stone.png'),join(root,'art','alternate','stone.png'));
  const after=locateResources(readResourceCatalog(one([{...sample,path:'art/alternate/stone.png'}])),'file://'+root+'/catalog.json');
  assert.equal(requireResource(before,sample.id).id,requireResource(after,sample.id).id);
  assert.notEqual(requireResource(before,sample.id).url,requireResource(after,sample.id).url);
  assert.equal(legacyResourceUrl(after,sample.legacyPath,'file://'+root+'/'),requireResource(after,sample.id).url);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('all shipped manifests boot through catalogues; historic manifest without catalogue still loads',async()=>{
 const get=async url=>{
  const path=new URL(url).pathname.replace(/^\/(?:game\/)?/,'');
  return new Response(file(path));
 };
 const host='https://example.test/game/';
 const standard=await loadProjectBoot(host,get);
 assert(standard.resourceResolver);assert.equal(standard.resourceResolver.byId.size,source.resources.length);
 assert.equal(projectAssetUrl(standard,'assets/art/ui/stone.png',host),'https://example.test/game/assets/art/ui/stone.png');
 assert.equal(projectResourceUrl(standard,'asset_art_ui_stone_png','assets/art/ui/stone.png',host),'https://example.test/game/assets/art/ui/stone.png');
 for(const project of ['ExpansionProof','SingleMapProof']){
  const boot=await loadProjectBoot(host+'?project=projects/'+project+'/'+project+'.maxxia',get);
  assert.equal(boot.resourceResolver?.byId.size,0);
  assert.throws(()=>projectResourceUrl(boot,'asset_art_ui_stone_png','assets/art/ui/stone.png',host),e=>e.code==='E_RESOURCE_MISSING');
  assert.equal(projectResourceUrl(boot,'asset_art_ui_stone_png','assets/art/ui/stone.png',host,true),'https://example.test/game/assets/art/ui/stone.png');
  assert.equal(projectAssetUrl(boot,'assets/art/ui/stone.png',host),'https://example.test/game/assets/art/ui/stone.png');
 }
 const original=JSON.parse(file('WorldOfMaxxia.maxxia'));delete original.content.resources;
 const old=await loadProjectBoot(host+'?project=Old.maxxia',async url=>url.endsWith('Old.maxxia')?new Response(JSON.stringify(original)):get(url));
 assert.equal(old.resourceResolver,null);
});
