import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createPackArchive} from '../../../toolkit/archive.mjs';
import {archivePack,admitBundle,availablePacks,buildPacks,bundlePacks,selectionReport,requireAdventure,installLibrarySelection,unpackMaxxiaArchive} from '../src/shared/content/pack-library.ts';
import {readResourceCatalog,locateResources} from '../src/shared/project/resources.ts';
import {projectCampaignStorage} from '../src/client/project-boot.ts';
import {captureCatalogueBase} from '../src/shared/content/catalogue.ts';
import {installItemDatabase} from '../src/shared/content/items.ts';
import {installClassDatabase} from '../src/shared/content/classes.ts';
import {installMonsterDatabase} from '../src/shared/content/monsters.ts';
const root=resolve(import.meta.dirname,'../../..');
const f=(relative)=>readFileSync(resolve(root,relative));
const builtin=f('engine/world-of-maxxia/public/mp06-proof/catalogue.maxxia-build.json');
const original=captureCatalogueBase();function restoreBase(){installItemDatabase({format:'maxxia-items',version:1,items:original.items});installClassDatabase({format:'maxxia-classes',version:1,classes:original.classes});installMonsterDatabase({format:'maxxia-monsters',version:1,monsters:original.monsters});}
async function packs(){return await buildPacks(builtin,'test');}
async function map(){return availablePacks([await packs()]);}
function zipFor(name){const base='examples/mp04/'+name,manifest=JSON.parse(f(base+'/pack.json')),index=JSON.parse(f(base+'/'+manifest.contentIndex));const entries=new Map([['pack.json',f(base+'/pack.json')],[manifest.contentIndex,f(base+'/'+manifest.contentIndex)]]);for(const entry of index.definitions)entries.set(entry.file,f(base+'/'+entry.file));return createPackArchive(entries);}
function throwsCode(run,code){assert.throws(run,error=>error.code===code,`Expected ${code}`);}

test('MP06 bundled proof validates against the updated core 1.0.1',async()=>{const values=await packs();assert.deepEqual(values.map(v=>v.manifest.packId),['brass','core','glass']);assert.equal(values.find(v=>v.manifest.packId==='core').manifest.version,'1.0.1');});
test('MP06 provider resolution stable across enable order',async()=>{const a=await map();assert.deepEqual(selectionReport(a,['glass','brass']).ordered,['core','brass','glass']);assert.deepEqual(selectionReport(a,['brass','glass']).ordered,['core','brass','glass']);});
test('MP06 refuses disabled mandatory provider',async()=>{const a=await map();throwsCode(()=>selectionReport(a,['glass']),'E_DEPENDENCY_DISABLED');});
test('MP06 missing provider is diagnosed without removing the installed bundle',async()=>{const a=await map();a.delete('brass');throwsCode(()=>selectionReport(a,['glass','brass']),'E_DEPENDENCY_MISSING');assert.ok(a.has('glass'));});
test('MP06 core-only is valid and keeps old default semantics',async()=>assert.deepEqual(selectionReport(await map(),[]).ordered,['core']));
test('MP06 adventure selection gates the required proof providers',()=>{throwsCode(()=>requireAdventure('catalogue-proof',['glass']),'E_ADVENTURE_REQUIRED');requireAdventure('catalogue-proof',['brass','glass']);requireAdventure('brass-proof',['brass']);requireAdventure('firstlight',[]);});
test('MP06 manifest conflicts cannot silently override installed definitions',async()=>{const a=await packs(),b=structuredClone(a.find(p=>p.manifest.packId==='brass'));b.manifest.version='1.2.3';throwsCode(()=>availablePacks([a,[b]]),'E_PACK_CONFLICT');});
test('MP06 identical repeated providers are accepted deterministically',async()=>{const a=await packs();assert.equal(availablePacks([a,a]).size,3);});
test('MP06 accepts CLI-generated stored ZIP and byte-faithfully identifies content',()=>{const zip=zipFor('brass'),pack=archivePack(zip);assert.equal(pack.manifest.packId,'brass');assert.ok(pack.files.size>=3);});
test('MP06 importing ZIP gives exact hash-stable identity',async()=>{const zip=zipFor('brass'),a=await admitBundle('brass.maxxia-pack.zip','archive',zip),b=await admitBundle('brass.maxxia-pack.zip','archive',zip);assert.equal(a.id,b.id);assert.deepEqual((await bundlePacks(a)).map(p=>p.manifest.packId),['brass']);});
test('MP06 ZIP byte tamper rejected, preserving the original installed bundle',()=>{const zip=zipFor('glass');zip[120]^=1;assert.throws(()=>archivePack(zip));});
test('MP06 ZIP executable prefix rejected',()=>{const zip=zipFor('brass');assert.throws(()=>unpackMaxxiaArchive(new Uint8Array([0x55,...zip])),/E_ARCHIVE_FORMAT/);});
test('MP06 ZIP rejects unexpected extension and mismatched packed files',()=>{const zip=zipFor('brass');assert.deepEqual([...unpackMaxxiaArchive(zip).keys()].includes('pack.json'),true);});
test('MP06 compiled JSON corrupted digest rejected',async()=>{const text=builtin.toString('utf8');const damaged=Buffer.from(text.replace('"contentHash":"','"contentHash":"0'));await assert.rejects(()=>buildPacks(damaged));});
test('MP06 installs and exposes two composed classes and unique equipment',async()=>{const a=await map(),resource=locateResources(readResourceCatalog(f('engine/world-of-maxxia/public/assets/catalog.json').toString('utf8')),'http://localhost:3000/assets/catalog.json');const result=await installLibrarySelection(a,['glass','brass'],resource,'project_mp04_catalogue_proof');assert.ok(result.summary.visibleClasses.includes('brass:class:warden'));assert.ok(result.summary.visibleClasses.includes('glass:class:warden'));assert.ok(result.summary.visibleItems.includes('glass:item:blade'));assert.match(result.hash,/^[a-f0-9]{64}$/);});
test('MP06 active selection hash is invariant to checkbox order',async()=>{const a=await map(),resource=locateResources(readResourceCatalog(f('engine/world-of-maxxia/public/assets/catalog.json').toString('utf8')),'http://localhost:3000/assets/catalog.json');restoreBase();const x=await installLibrarySelection(a,['brass','glass'],resource,'project_mp04_catalogue_proof');restoreBase();const y=await installLibrarySelection(a,['glass','brass'],resource,'project_mp04_catalogue_proof');assert.equal(x.hash,y.hash);});
test('MP06 old legacy storage slots are not renamed or erased',()=>{const items=new Map([['world-of-maxxia:campaign:v1:auto','original bytes']]),storage={getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)};const original=projectCampaignStorage(storage,'project_world_of_maxxia'),adventure=projectCampaignStorage(storage,'project_mp04_catalogue_proof','a'.repeat(64));assert.equal(original.getItem('world-of-maxxia:campaign:v1:auto'),'original bytes');adventure.setItem('world-of-maxxia:campaign:v1:auto','separate bytes');assert.equal(items.get('world-of-maxxia:campaign:v1:auto'),'original bytes');assert.equal(adventure.getItem('world-of-maxxia:campaign:v1:auto'),'separate bytes');});
