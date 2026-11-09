import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {join,resolve,dirname} from 'node:path';import {createHash} from 'node:crypto';import {createPackArchive} from '../toolkit/archive.mjs';
const root=resolve(dirname(new URL(import.meta.url).pathname),'..');
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const sha=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:stable(v)).digest('hex');
function pack(dir){const read=name=>JSON.parse(readFileSync(join(dir,name),'utf8')),manifest=read('pack.json'),idx=read(manifest.contentIndex),paths=['pack.json',manifest.contentIndex,...idx.definitions.map(d=>d.file)],files=new Map(paths.map(path=>[path,read(path)]));const zip=createPackArchive(new Map([...files].map(([name,data])=>[name,Buffer.from(stable(data)+'\n')])));return {manifest,idx,files,zipHash:sha(zip)};}
const core=pack(root+'/toolkit/core'),bell=pack(root+'/examples/mp24/brass-bell'),receiving=pack(root+'/examples/mp17/receiving-yard');
const engineVersion='0.69.0',rules={id:'core:rules:classic',version:'1.0.0'};
for(const [name,rootPackId,packs,loadOrder] of [['brass-bell','bell',[core,bell],['core','bell']],['receiving','receiving',[core,bell,receiving],['core','bell','receiving']]]){
 const pins=packs.map(p=>({packId:p.manifest.packId,version:p.manifest.version,sha256:p.zipHash})).sort((a,b)=>a.packId.localeCompare(b.packId));
 const lock={format:'maxxia-catalogue-lock',formatVersion:1,engineVersion,rules,packs:pins};
 const resolution={format:'maxxia-resolution',formatVersion:1,rootPackId,lock,loadOrder,catalogueHash:sha({engineVersion,rules,packs:pins,loadOrder})};
 const files=packs.flatMap(p=>[...p.files].map(([path,data])=>({path:'packs/'+p.manifest.packId+'/'+path,data}))).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const body={format:'maxxia-content-build',formatVersion:1,toolkitVersion:'0.24.0-mp24',engineVersion,rules,rootPackId,playableInCurrentRuntime:true,files,resolution};
 const final={...body,contentHash:sha(body)};const out=root+'/engine/world-of-maxxia/public/mp24-proof/'+name+'.maxxia-build.json';mkdirSync(dirname(out),{recursive:true});writeFileSync(out,stable(final)+'\n');console.log(name,files.length,final.contentHash);
}
