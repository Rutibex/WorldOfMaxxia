/** Deterministic MP06 built-in provider proof; no network or AJV dependency. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createPackArchive} from '../toolkit/archive.mjs';
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
const root=resolve(import.meta.dirname,'..');
const sources=[['core','toolkit/core'],['brass','examples/mp04/brass'],['glass','examples/mp04/glass']];
const files=[],pins=[];
for(const [id,dir] of sources){
 const manifest=JSON.parse(await readFile(join(root,dir,'pack.json'))),index=JSON.parse(await readFile(join(root,dir,manifest.contentIndex)));
 const paths=['pack.json',manifest.contentIndex,...index.definitions.map(d=>d.file)],archive=new Map();
 for(const path of paths){const data=await readFile(join(root,dir,path));archive.set(path,data);files.push({path:`packs/${id}/${path}`,data:JSON.parse(data.toString('utf8'))});}
 pins.push({packId:id,version:manifest.version,sha256:createHash('sha256').update(createPackArchive(archive)).digest('hex')});
}
files.sort((a,b)=>a.path.localeCompare(b.path));pins.sort((a,b)=>a.packId.localeCompare(b.packId));
const rules={id:'core:rules:classic',version:'1.0.0'},engineVersion='0.52.0',loadOrder=['core','brass','glass'];
const lock={format:'maxxia-catalogue-lock',formatVersion:1,engineVersion,rules,packs:pins};
const catalogueHash=createHash('sha256').update(stable({engineVersion,rules,packs:pins,loadOrder})).digest('hex');
const resolution={format:'maxxia-resolution',formatVersion:1,rootPackId:'glass',loadOrder,catalogueHash,lock};
const body={format:'maxxia-content-build',formatVersion:1,toolkitVersion:'0.5.0-mp06',engineVersion,rules,rootPackId:'glass',playableInCurrentRuntime:false,files,resolution};
const contentHash=createHash('sha256').update(stable(body)).digest('hex');
const out=join(root,'engine/world-of-maxxia/public/mp06-proof/catalogue.maxxia-build.json');await mkdir(dirname(out),{recursive:true});await writeFile(out,stable({...body,contentHash})+'\n');
console.log(JSON.stringify({out,packs:pins,catalogueHash,contentHash}));
