/** MP02 disk authoring tools. No live game state, installed-pack mutation or code evaluation. */
import {readFile,lstat,realpath,open,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {composePackCatalogue} from '../engine/world-of-maxxia/src/shared/content/catalogue.ts';
import {locateResources,readResourceCatalog} from '../engine/world-of-maxxia/src/shared/project/resources.ts';
import Ajv2020 from 'ajv/dist/2020.js';
import {validateDocument,validateCatalogue,compareVersions,ContractError} from '../contracts/mp01/validate.mjs';
import {problem,ToolError} from './diagnostics.mjs';
export const TOOLKIT_VERSION='0.27.0-mp27';
export const DEFAULT_CORE=fileURLToPath(new URL('./core/',import.meta.url));
export const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}':JSON.stringify(value);
const pretty=value=>JSON.stringify(value,null,2)+'\n';
const ajv=new Ajv2020({strict:true,allErrors:true});
for(const kind of ['map','routine','class','race','item','monster','resource','npc','dialogue','quest','encounter','condition','ability','recipe','environment'])ajv.addSchema(JSON.parse(await readFile(new URL('./schemas/'+kind+'.schema.json',import.meta.url),'utf8')),kind);
ajv.addSchema(JSON.parse(await readFile(new URL('./schemas/routine-v2.schema.json',import.meta.url),'utf8')));
ajv.addSchema(JSON.parse(await readFile(new URL('./schemas/map-v2.schema.json',import.meta.url),'utf8')));
const proofItems=JSON.parse(await readFile(new URL('../engine/world-of-maxxia/src/shared/content/items-default.json',import.meta.url),'utf8')).items;
const proofResources=locateResources(readResourceCatalog(await readFile(new URL('../engine/world-of-maxxia/public/assets/catalog.json',import.meta.url),'utf8')),'https://maxxia.invalid/assets/catalog.json');
const schemaPath=e=>e.instancePath.split('/').slice(1).map(k=>/^\d+$/.test(k)?'['+k+']':'.'+k).join('')+(e.keyword==='additionalProperties'?'.'+e.params.additionalProperty:e.keyword==='required'?'.'+e.params.missingProperty:'');
export const inside=(root,path)=>{if(process.platform==='win32'){root=root.toLowerCase();path=path.toLowerCase();}return path===root||path.startsWith(root+sep);};
const contractMessage=e=>e.message.slice(e.message.indexOf(': ')+2);
export async function noSymlinks(path){
 const parts=[];let p=resolve(path);while(dirname(p)!==p){parts.unshift(p);p=dirname(p);}
 for(const part of parts){let s;try{s=await lstat(part);}catch(e){if(e.code==='ENOENT')continue;throw e;}if(s.isSymbolicLink())problem('E_SYMLINK',part,'$');}
}
export async function directory(path){const p=resolve(path);await noSymlinks(p);let s;try{s=await lstat(p);}catch{problem('E_IO',p,'$','Pack directory is missing or inaccessible.');}if(!s.isDirectory())problem('E_DIRECTORY',p,'$');return realpath(p);}
export async function readBounded(handle,limit,file,code='E_SIZE'){
 const chunks=[];let total=0;
 while(true){const chunk=Buffer.allocUnsafe(Math.min(65536,limit-total+1));const {bytesRead}=await handle.read(chunk,0,chunk.length,null);if(!bytesRead)break;total+=bytesRead;if(total>limit)problem(code,file,'$','Input exceeds its admitted byte limit.');chunks.push(chunk.subarray(0,bytesRead));}
 return Buffer.concat(chunks,total);
}
export async function readJSON(root,path,budget){
 if(!/^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/.test(path))problem('E_IO',path,'$','Invalid pack-relative input path.');
 const absolute=resolve(root,path);if(!inside(root,absolute))problem('E_IO',absolute,'$','Input escaped pack root.');
 await noSymlinks(absolute);let handle;
 try{
  handle=await open(absolute,constants.O_RDONLY|(constants.O_NOFOLLOW??0));const s=await handle.stat();
  if(!s.isFile())problem('E_IO',absolute,'$','Expected a regular file.');if(s.size>1024*1024)problem('E_SIZE',absolute,'$');
  const raw=await readBounded(handle,1024*1024,absolute);if(raw.length>1024*1024)problem('E_SIZE',absolute,'$');if(budget){budget.bytes+=raw.length;if(budget.bytes>(budget.limit??32*1024*1024))problem('E_SIZE',absolute,'$','Selected source content exceeds the configured byte limit.');}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw).replace(/^\uFEFF/,''));}catch{problem('E_JSON',absolute,'$','Expected valid UTF-8 JSON.');}
 }catch(e){if(e instanceof ToolError)throw e;problem('E_IO',absolute,'$',e.code==='ENOENT'?'Required file does not exist.':'Could not read input file: '+e.message);}finally{await handle?.close();}
}
export function contract(kind,data,file){try{validateDocument(kind,data);}catch(e){if(e instanceof ContractError){const m=/^\$\.definitions\[(\d+)\]/.exec(e.path);problem(e.code,file,e.path,contractMessage(e),m?data.definitions?.[Number(m[1])]?.id:null);}throw e;}}
function payload(kind,data,file,descriptor){
 const check=kind==='map'&&data.formatVersion===2?ajv.getSchema('https://maxxia.invalid/toolkit/mp13/map.schema.json'):kind==='routine'&&data.formatVersion===2?ajv.getSchema('https://maxxia.invalid/toolkit/mp12/routine.schema.json'):ajv.getSchema(kind);
 if(!check)problem('E_UNSUPPORTED_KIND',file,'$',`MP02 compiles map and routine payloads; ${kind} is not yet supported.`,descriptor.id);
 if(!check(data)){let e=check.errors[0];if(kind==='npc'){for(const candidate of check.errors){const m=/^\/record\/services\/(\d+)/.exec(candidate.instancePath);if(m){const branch=['shop','healing','training','tribute','barter'].indexOf(data.record.services[Number(m[1])]?.kind);if(branch>=0&&candidate.schemaPath.includes('/oneOf/'+branch+'/')){e=candidate;break;}}}}for(const candidate of check.errors){const m=/^\/actions\/(\d+)/.exec(candidate.instancePath);if(m){const operation=data.actions?.[Number(m[1])]?.operation;const branch=operation==='message'?0:operation==='set_flag'?1:null;if(branch!==null&&candidate.schemaPath.includes('/oneOf/'+branch+'/')){e=candidate;break;}}}problem('E_PAYLOAD_SCHEMA',file,'$'+schemaPath(e),e.message,descriptor.id);}
 if(data.id!==descriptor.id)problem('E_PAYLOAD_ID',file,'$.id',undefined,descriptor.id);
}
export const sourceFile=(p,path)=>p.sourceType==='archive'?p.root+'!/'+path:join(p.root,path);
export async function loadSelection(packPath,options={}){return (await import('./resolver.mjs')).resolveSelection(packPath,options);}
export async function validateLoadedSelection(loaded,engineVersion,rootPackId){
 const context={engineVersion,rules:{id:'core:rules:classic',version:'1.0.0'},packs:loaded.map(p=>({manifest:p.manifest,index:p.index}))};
 try{validateCatalogue(context);}catch(e){
  if(!(e instanceof ContractError))throw e;
  const m=/^\$\.packs\[(\d+)\]\.(manifest|index)(.*)$/.exec(e.path);
  if(m){const p=loaded[Number(m[1])],file=sourceFile(p,m[2]==='manifest'?'pack.json':p.manifest.contentIndex);const d=/^\.definitions\[(\d+)\]/.exec(m[3]);problem(e.code,file,'$'+m[3],contractMessage(e),d?p.index.definitions[Number(d[1])]?.id:null);}
  problem(e.code,sourceFile(loaded[0],'pack.json'),e.path,contractMessage(e));
 }
 for(const p of loaded){
  p.payloads=new Map();
  for(const d of p.index.definitions){const file=sourceFile(p,d.file);if(!p.files.has(d.file))problem('E_IO',file,'$','Required payload is missing.',d.id);const data=p.files.get(d.file);payload(d.kind,data,file,d);p.payloads.set(d.id,data);}
 }

 for(const p of loaded)for(const d of p.index.definitions){
  const data=p.payloads.get(d.id),file=sourceFile(p,d.file),refs=[];
  if(d.kind==='map'&&data.formatVersion===2){const m=data.record;if(m.environmentId?.includes(':'))refs.push(m.environmentId);for(const e of m.enemyAppearances??[])if(e.kindId.includes(':'))refs.push(e.kindId);for(const e of m.entities??[]){if(e.npcId)refs.push(e.npcId);if(e.onUse)refs.push(e.onUse.routineId);for(const id of [e.lock?.keyItemId,...(e.rewards??[]).map(r=>r.itemId)])if(id?.includes(':'))refs.push(id);}for(const portal of m.portals??[]){const target=loaded.flatMap(pack=>pack.index.definitions.map(d=>({d,payload:pack.payloads.get(d.id)}))).find(v=>v.d.kind==='map'&&v.payload.formatVersion===2&&v.payload.record.id===portal.targetMapId);if(target)refs.push(target.d.id);}}else if(d.kind==='map'){
   const width=data.rows[0].length;if(data.rows.some(row=>row.length!==width))problem('E_MAP_SHAPE',file,'$.rows',undefined,d.id);
   for(const [field,records] of [['arrivals',data.arrivals],['objects',data.objects]]){
    const ids=new Set();for(const [i,v] of records.entries()){
     if(ids.has(v.id))problem('E_LOCAL_DUPLICATE',file,`$.${field}[${i}].id`,undefined,d.id);ids.add(v.id);
     if(data.rows[v.y]?.[v.x]!=='.')problem('E_MAP_POSITION',file,`$.${field}[${i}]`,'Place this entity on an open in-bounds tile.',d.id);
     if(field==='objects'){if(v.onInteract.split(':')[1]!=='routine')problem('E_ROUTINE_KIND',file,`$.objects[${i}].onInteract`,undefined,d.id);refs.push(v.onInteract);}
    }
   }
   if(p.manifest.entry?.mapId===d.id&&!data.arrivals.some(a=>a.id===p.manifest.entry.arrivalId))problem('E_ENTRY_ARRIVAL',sourceFile(p,'pack.json'),'$.entry.arrivalId',undefined,d.id);
  }
  if(d.kind==='item'&&data.record.effectId)refs.push(data.record.effectId);
  if(d.kind==='race')for(const g of data.record.abilityGrants??[])refs.push(g.id);
  if(d.kind==='environment')refs.push(...[data.record.skyResourceId,...data.record.materials.map(m=>m.resourceId),...Object.values(data.record.scene?.textures??{}),...(data.record.sprites??[]).flatMap(s=>s.sources.map(v=>v.resourceId))].filter(Boolean));
  if(d.kind==='class'){for(const id of Object.values(data.record.starterEquipment??{}))if(typeof id==='string'&&id.includes(':'))refs.push(id);for(const g of data.record.abilityGrants??[])refs.push(g.id);for(const ch of data.record.creationChoices??[]){for(const g of ch.abilityGrants??[])refs.push(g.id);for(const id of Object.values(ch.starterEquipment??{}))if(typeof id==='string'&&id.includes(':'))refs.push(id);}}
  if(d.kind==='ability'&&data.record.activation)for(const id of data.record.activation.classes)if(id.includes(':'))refs.push(id);
  if(d.kind==='routine'&&data.formatVersion===2){const scan=v=>{if(Array.isArray(v))return v.forEach(scan);if(!v||typeof v!=='object')return;if(v.op==='call')refs.push(v.routine);if(v.op==='effect')refs.push(v.effectId);if(v.query==='has-condition'&&v.conditionId?.includes(':'))refs.push(v.conditionId);if(typeof v.questId==='string')refs.push(v.questId);if((v.op==='give-item'||v.op==='cost'||v.query==='has-item')&&typeof v.item==='string'&&v.item.includes(':'))refs.push(v.item);Object.values(v).forEach(scan);};scan(data.actions);}
  if(['npc','dialogue','quest','encounter','condition','ability'].includes(d.kind)){const scan=v=>{if(Array.isArray(v))return v.forEach(scan);if(!v||typeof v!=='object')return;for(const field of ['effectId','conditionId','dialogueId','routineId','itemId','questId',...(d.kind==='encounter'?['mapId','kindId']:d.kind==='ability'?['kindId']:[])])if(typeof v[field]==='string'&&v[field].includes(':')&&v[field]!==d.id)refs.push(v[field]);if(v.query==='has-item'&&v.item?.includes(':'))refs.push(v.item);Object.values(v).forEach(scan);};scan(data.record);}
  if(!['environment','map','routine','race','class','npc','dialogue','quest','encounter','condition','ability'].includes(d.kind)&&!(d.kind==='item'&&data.record.effectId))continue;
  const expected=[...new Set(refs)].sort(),declared=[...new Set(d.references.map(r=>r.id))].sort();
  if(stable(expected)!==stable(declared))problem('E_REFERENCE_INDEX',sourceFile(p,p.manifest.contentIndex),'$.definitions['+p.index.definitions.indexOf(d)+'].references',`Payload refers to ${JSON.stringify(expected)} but descriptor declares ${JSON.stringify(declared)}.`,d.id);
 }
 let composed;try{composed=composePackCatalogue(loaded,rootPackId,{classes:[],items:structuredClone(proofItems),monsters:[]},proofResources,engineVersion);}catch(e){const id=e.objectId,owner=id&&loaded.find(p=>p.index.definitions.some(d=>d.id===id)),d=owner?.index.definitions.find(d=>d.id===id);problem(e.code??'E_PAYLOAD_SCHEMA',owner&&d?sourceFile(owner,d.file):sourceFile(loaded[0],'pack.json'),e.path??'$',e.message,id??null);}
 return {engineVersion,rootPackId,rules:context.rules,packs:loaded,catalogueSummary:composed.summary};
}
export function hasPlayableEntry(selection){const root=selection.packs.find(p=>p.manifest.packId===selection.rootPackId);const entry=root?.manifest.entry;return !!entry&&root.payloads.get(entry.mapId)?.formatVersion===2&&root.payloads.get(entry.mapId)?.format==='maxxia-authored-map';}
export function inspectSelection(selection){
 return {rootPackId:selection.rootPackId,engineVersion:selection.engineVersion,rules:selection.rules,playableInCurrentRuntime:hasPlayableEntry(selection),...(selection.catalogueSummary?{catalogue:selection.catalogueSummary}:{}),...(selection.resolution?{resolution:selection.resolution}:{}),packs:selection.packs.map(p=>({packId:p.manifest.packId,title:p.manifest.title,version:p.manifest.version,entry:p.manifest.entry,definitions:p.index.definitions.map(d=>({id:d.id,kind:d.kind,visibility:d.visibility,file:d.file,references:d.references,...(d.kind==='map'&&p.payloads.get(d.id).formatVersion===2?{record:p.payloads.get(d.id).record}:d.kind==='map'?{dimensions:{width:p.payloads.get(d.id).rows[0].length,height:p.payloads.get(d.id).rows.length},arrivals:p.payloads.get(d.id).arrivals,objects:p.payloads.get(d.id).objects}:d.kind==='routine'?{actions:p.payloads.get(d.id).actions}:{record:p.payloads.get(d.id).record??p.payloads.get(d.id)})}))})).sort((a,b)=>a.packId<b.packId?-1:a.packId>b.packId?1:0)};
}
export async function scaffold(path,{id,title}={}){
 const target=resolve(path);await noSymlinks(target);let exists=false;try{await lstat(target);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}if(exists)problem('E_DEST_EXISTS',target,'$');
 const mapId=id+':map:entry',routineId=id+':routine:read_plaque';
 const manifest={format:'maxxia-pack',formatVersion:1,packId:id,title:title??'A New Maxxia Adventure',version:'1.0.0',kind:'adventure',engine:{min:'0.49.0',maxExclusive:'1.0.0'},rules:{id:'core:rules:classic',version:'1.0.0'},dependencies:[{packId:'core',versions:{min:'1.0.0',maxExclusive:'2.0.0'},optional:false}],contentIndex:'content/index.json',entry:{mapId,arrivalId:'entry'},credits:['Michael Robinson']};
 contract('pack',manifest,join(target,'pack.json'));if(id==='core')problem('E_USAGE',target,'$.packId','Scaffold creates adventure packs; core is reserved.');
 const defs=[{id:mapId,kind:'map',visibility:'local',file:'content/entry.json',placement:'authored',tags:[],references:[{id:routineId}]},{id:routineId,kind:'routine',visibility:'local',file:'content/read-plaque.json',placement:'none',tags:[],references:[]}];
 const index={format:'maxxia-content-index',formatVersion:1,definitions:defs};
 const map={format:'maxxia-authored-map',formatVersion:1,id:mapId,name:'The Entry Chamber',rows:['#########','#.......#','#.......#','#.......#','#.......#','#.......#','#########'],arrivals:[{id:'entry',x:4,y:4,facing:0}],objects:[{id:'plaque',name:'Inscribed brass plaque',x:4,y:2,onInteract:routineId}]};
 const routine={format:'maxxia-authored-routine',formatVersion:1,id:routineId,actions:[{operation:'message',text:'Beyond this threshold, a new adventure begins.'},{operation:'set_flag',flag:'plaque_read',value:true}]};
 await mkdir(dirname(target),{recursive:true});try{await mkdir(target);}catch(e){if(e.code==='EEXIST')problem('E_DEST_EXISTS',target,'$');throw e;}
 try{await mkdir(join(target,'content'));for(const [file,data] of [['pack.json',manifest],['content/index.json',index],['content/entry.json',map],['content/read-plaque.json',routine]])await writeFile(join(target,file),pretty(data),{flag:'wx'});}catch(e){await rm(target,{recursive:true,force:true});throw e;}
 return {directory:target,packId:id,files:4};
}
export async function buildSelection(selection,output){
 const out=resolve(output);if(!out.endsWith('.maxxia-build.json'))problem('E_OUTPUT',out,'$','Build output must end in .maxxia-build.json.');
 for(const p of selection.packs)if(inside(p.root,out))problem('E_OUTPUT',out,'$','Build output must be outside every source pack.');
 await noSymlinks(out);
 try{const s=await lstat(out);if(!s.isFile())problem('E_OUTPUT',out,'$');const existing=JSON.parse(await readFile(out,'utf8'));if(existing.format!=='maxxia-content-build')problem('E_OUTPUT',out,'$','Refusing to replace a file that is not a Maxxia content build.');}catch(e){if(e.code!=='ENOENT'){if(e instanceof ToolError)throw e;problem('E_OUTPUT',out,'$','Refusing to replace an unreadable or unrelated output file.');}}
 const files=[];for(const p of selection.packs)for(const [path,data] of p.files)files.push({path:`packs/${p.manifest.packId}/${path}`,data});files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const body={format:'maxxia-content-build',formatVersion:1,toolkitVersion:TOOLKIT_VERSION,engineVersion:selection.engineVersion,rules:selection.rules,rootPackId:selection.rootPackId,playableInCurrentRuntime:hasPlayableEntry(selection),...(selection.resolution?{resolution:selection.resolution}:{}),files};
 const contentHash=createHash('sha256').update(stable(body)).digest('hex'),bytes=stable({...body,contentHash})+'\n';
 await mkdir(dirname(out),{recursive:true});const temp=out+'.'+randomUUID()+'.tmp';
 try{await writeFile(temp,bytes,{flag:'wx'});await rename(temp,out);}finally{await rm(temp,{force:true});}
 return {output:out,contentHash,files:files.length,bytes:Buffer.byteLength(bytes),playableInCurrentRuntime:hasPlayableEntry(selection)};
}
