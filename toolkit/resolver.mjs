/** Deterministic bounded dependency search, exact ZIP provenance and staged authoring sessions. */
import {lstat,realpath,open,writeFile,mkdir,rename,rm,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {compareVersions,validateLock} from '../contracts/mp01/validate.mjs';
import {contract,directory,noSymlinks,readJSON,readBounded,stable,DEFAULT_CORE,validateLoadedSelection,sourceFile,inside} from './content.mjs';
import {problem,ToolError} from './diagnostics.mjs';
import {readPackArchive,createPackArchive,ARCHIVE_LIMITS} from './archive.mjs';
export const RESOLVER_LIMITS=Object.freeze({candidates:256,selected:128,poolBytes:64*1024*1024,searchNodes:10000});
const hash=b=>createHash('sha256').update(b).digest('hex');
const compareText=(a,b)=>a<b?-1:a>b?1:0;
const supportedRules=Object.freeze({id:'core:rules:classic',version:'1.0.0'});
const fits=(v,r)=>compareVersions(v,r.min)>=0&&compareVersions(v,r.maxExclusive)<0;
function checkHeader(p){
 const m=p.manifest,file=sourceFile(p,'pack.json');
 if((m.kind==='core')!==(m.packId==='core'))problem('E_CORE',file,'$.kind','core is reserved for the core kind.');
 if(m.contentIndex.toLowerCase()==='pack.json')problem('E_INDEX_PATH',file,'$.contentIndex','Index cannot shadow manifest.');
 if(compareVersions(m.engine.min,m.engine.maxExclusive)>=0)problem('E_VERSION_RANGE',file,'$.engine','Engine interval must be nonempty.');
 if(m.packId!=='core'&&!m.dependencies.some(d=>d.packId==='core'&&!d.optional))problem('E_CORE_DEPENDENCY',file,'$.dependencies','Noncore packs require a direct required core dependency.');
 const seen=new Set();for(const [i,d] of m.dependencies.entries()){
  const at=`$.dependencies[${i}]`;
  if(seen.has(d.packId))problem('E_DEPENDENCY_DUPLICATE',file,at+'.packId','Duplicate provider.');seen.add(d.packId);
  if(d.packId===m.packId)problem('E_DEPENDENCY_SELF',file,at+'.packId','Self dependency is forbidden.');
  if(compareVersions(d.versions.min,d.versions.maxExclusive)>=0)problem('E_VERSION_RANGE',file,at+'.versions','Dependency interval must be nonempty.');
 }
}
async function snapshot(input,budget){
 const absolute=resolve(input);await noSymlinks(absolute);let stat;
 try{stat=await lstat(absolute);}catch{problem('E_IO',absolute,'$','Source is missing or inaccessible.');}
 let p,archive,files;
 if(stat.isDirectory()){
  const root=await directory(absolute),manifest=await readJSON(root,'pack.json',budget);contract('pack',manifest,join(root,'pack.json'));
  const index=await readJSON(root,manifest.contentIndex,budget);contract('content-index',index,join(root,manifest.contentIndex));
  p={root,sourceType:'directory',manifest,index};checkHeader(p);files=new Map([['pack.json',manifest],[manifest.contentIndex,index]]);
  const paths=new Set(['pack.json',manifest.contentIndex.toLowerCase()]),ids=new Set();
  for(const [i,d] of index.definitions.entries()){
   if(ids.has(d.id))problem('E_ID_DUPLICATE',sourceFile(p,manifest.contentIndex),`$.definitions[${i}].id`,'Duplicate definition ID.',d.id);ids.add(d.id);
   if(paths.has(d.file.toLowerCase()))problem('E_PATH_DUPLICATE',join(root,manifest.contentIndex),`$.definitions[${i}].file`,'Definition path collides with another file.',d.id);paths.add(d.file.toLowerCase());
   try{files.set(d.file,await readJSON(root,d.file,budget));}catch(e){if(e instanceof ToolError)e.objectId=d.id;throw e;}
  }
  archive=createPackArchive(new Map([...files].map(([name,value])=>[name,Buffer.from(stable(value)+'\n')])));
 }else if(stat.isFile()){
  if(stat.size>ARCHIVE_LIMITS.compressedBytes)problem('E_ARCHIVE_LIMIT',absolute,'$','Archive exceeds 32 MiB input limit.');
  let handle;try{handle=await open(absolute,constants.O_RDONLY|(constants.O_NOFOLLOW??0));const actual=await handle.stat();if(!actual.isFile())problem('E_IO',absolute,'$','Expected a regular archive file.');archive=await readBounded(handle,ARCHIVE_LIMITS.compressedBytes,absolute,'E_ARCHIVE_LIMIT');}finally{await handle?.close();}
  const unpacked=readPackArchive(archive,absolute);budget.bytes+=unpacked.expandedBytes;if(budget.bytes>budget.limit)problem('E_SIZE',absolute,'$','Candidate pool exceeds 64 MiB expanded content.');
  const parse=path=>{
   const raw=unpacked.files.get(path),file=absolute+'!/'+path;if(!raw)problem('E_IO',file,'$','Required archive file is absent.');
   try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw).replace(/^\uFEFF/,''));}catch{problem('E_JSON',file,'$','Expected valid UTF-8 JSON.');}
  };
  const manifest=parse('pack.json');contract('pack',manifest,absolute+'!/pack.json');const index=parse(manifest.contentIndex);contract('content-index',index,absolute+'!/'+manifest.contentIndex);
  p={root:await realpath(absolute),sourceType:'archive',manifest,index};checkHeader(p);files=new Map([['pack.json',manifest],[manifest.contentIndex,index]]);
  const paths=new Set(['pack.json',manifest.contentIndex.toLowerCase()]),ids=new Set();
  for(const [i,d] of index.definitions.entries()){
   if(ids.has(d.id))problem('E_ID_DUPLICATE',sourceFile(p,manifest.contentIndex),`$.definitions[${i}].id`,'Duplicate definition ID.',d.id);ids.add(d.id);
   if(paths.has(d.file.toLowerCase()))problem('E_PATH_DUPLICATE',sourceFile(p,manifest.contentIndex),`$.definitions[${i}].file`,'Definition path collides with another file.',d.id);paths.add(d.file.toLowerCase());
   try{files.set(d.file,parse(d.file));}catch(e){if(e instanceof ToolError)e.objectId=d.id;throw e;}
  }
 }else problem('E_IO',absolute,'$','Expected a source directory or regular ZIP archive.');
 if(budget.bytes>RESOLVER_LIMITS.poolBytes)problem('E_SIZE',absolute,'$','Candidate pool exceeds 64 MiB expanded content.');
 return {...p,files,archive,archiveSha256:hash(archive)};
}
function compatible(p,engineVersion){return fits(engineVersion,p.manifest.engine)&&stable(p.manifest.rules)===stable(supportedRules);}
function loadOrder(selected){
 const visiting=new Set(),visited=new Set(),order=[];
 function visit(id){
  if(visiting.has(id))problem('E_DEPENDENCY_CYCLE',sourceFile(selected.get(id),'pack.json'),'$.dependencies','Selected dependency graph contains a cycle.');
  if(visited.has(id))return;visiting.add(id);
  for(const dep of selected.get(id).manifest.dependencies.filter(d=>selected.has(d.packId)).map(d=>d.packId).sort(compareText))visit(dep);
  visiting.delete(id);visited.add(id);order.push(id);
 }
 for(const id of [...selected.keys()].sort(compareText))visit(id);return order;
}
export async function resolveSelection(rootPath,{dependencies=[],candidates=[],enable=[],engineVersion='0.50.0',lock=null}={}){
 try{compareVersions(engineVersion,engineVersion);}catch{problem('E_USAGE',null,'$.engineVersion','Use a canonical numeric engine version.');}
 if(!Array.isArray(dependencies)||!Array.isArray(candidates)||!Array.isArray(enable))problem('E_USAGE',null,'$','Expected dependency/candidate/enable arrays.');
 dependencies=[...dependencies];candidates=[...candidates];enable=[...enable];if(lock&&typeof lock!=='string')lock=structuredClone(lock);
 if(1+dependencies.length+candidates.length>RESOLVER_LIMITS.candidates)problem('E_SIZE',null,'$','Candidate count exceeds 256.');
 for(const id of enable)if(!/^[a-z][a-z0-9_]{0,47}$/.test(id))problem('E_USAGE',null,'$.enable','Enabled provider IDs must be canonical namespaces.');
 // All reads happen before selection/commit. Caller order never sets version preference.
 const budget={bytes:0,limit:RESOLVER_LIMITS.poolBytes},seenSources=new Set(),inputs=[rootPath,...dependencies,...candidates],snapshots=[];
 for(const input of inputs){const p=await snapshot(input,budget);if(seenSources.has(p.root))problem('E_FILE_ALIAS',p.root,'$','The same physical source was supplied more than once.');seenSources.add(p.root);snapshots.push(p);}
 if(!snapshots.some(p=>p.manifest.packId==='core'))snapshots.push(await snapshot(DEFAULT_CORE,budget));
 const pool=new Map(),byIdentity=new Map();
 for(const p of snapshots){
  const key=p.manifest.packId+'@'+p.manifest.version,existing=byIdentity.get(key);
  if(existing&&existing.archiveSha256!==p.archiveSha256)problem('E_CANDIDATE_FORK',sourceFile(p,'pack.json'),'$.version',`Different archive bytes claim ${key}. Publish a new version.`);
  if(existing)continue;byIdentity.set(key,p);if(!pool.has(p.manifest.packId))pool.set(p.manifest.packId,[]);pool.get(p.manifest.packId).push(p);
 }
 for(const versions of pool.values())versions.sort((a,b)=>-compareVersions(a.manifest.version,b.manifest.version));
 const fixed=new Map();for(const p of snapshots.slice(0,1+dependencies.length)){
  const prev=fixed.get(p.manifest.packId);if(prev&&prev.archiveSha256!==p.archiveSha256)problem('E_RESOLUTION_CONFLICT',sourceFile(p,'pack.json'),'$.version','Explicit dependencies require conflicting exact versions.');fixed.set(p.manifest.packId,p);
  if(!fits(engineVersion,p.manifest.engine))problem('E_ENGINE',sourceFile(p,'pack.json'),'$.engine','Explicit pack does not support this engine version.');
  if(stable(p.manifest.rules)!==stable(supportedRules))problem('E_RULES',sourceFile(p,'pack.json'),'$.rules','Explicit pack does not support the selected exact rules profile.');
 }
 let expectedLock=null;
 if(lock){
  if(typeof lock==='string'){const path=resolve(lock);await noSymlinks(path);let handle;try{handle=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));const info=await handle.stat();if(!info.isFile()||info.size>1024*1024)problem('E_LOCK',path,'$','Expected a regular lock file up to 1 MiB.');const bytes=await readBounded(handle,1024*1024,path,'E_LOCK');if(bytes.length>1024*1024)problem('E_LOCK',path,'$','Lock exceeds 1 MiB.');expectedLock=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(e){if(e instanceof ToolError)throw e;problem('E_LOCK',path,'$','Lock is missing, malformed or unreadable.');}finally{await handle?.close();}}else expectedLock=structuredClone(lock);
  try{validateLock(expectedLock);}catch(e){problem(e.code??'E_LOCK',typeof lock==='string'?resolve(lock):null,e.path??'$',e.message);}
  expectedLock.packs.sort((a,b)=>compareText(a.packId,b.packId));
  if(expectedLock.engineVersion!==engineVersion||stable(expectedLock.rules)!==stable(supportedRules))problem('E_LOCK',typeof lock==='string'?resolve(lock):null,'$','Lock engine/rules differ from requested context.');
 }
 const pins=expectedLock?new Map(expectedLock.packs.map(p=>[p.packId,p])):null;
 const root=snapshots[0],requested=new Set([...fixed.keys(),...enable,...(pins?.keys()??[]),'core']);let nodes=0,lastError=null;
 const conflict=(code,file,path,message)=>new ToolError(code,file,path,message);
 function search(chosen){
  if(++nodes>RESOLVER_LIMITS.searchNodes)problem('E_RESOLUTION_LIMIT',null,'$','Dependency search exceeded 10000 nodes. Narrow version ranges or candidate pool.');
  const needed=new Set(requested),constraints=new Map();
  for(const p of chosen.values())for(const [i,d] of p.manifest.dependencies.entries()){
   if(!d.optional)needed.add(d.packId);if(!constraints.has(d.packId))constraints.set(d.packId,[]);constraints.get(d.packId).push({range:d.versions,file:sourceFile(p,'pack.json'),path:`$.dependencies[${i}]`});
  }
  if(needed.size>RESOLVER_LIMITS.selected)problem('E_SIZE',null,'$','Selected dependency closure exceeds 128 packs.');
  for(const [id,p] of chosen){
   if((constraints.get(id)??[]).some(c=>!fits(p.manifest.version,c.range))){const c=(constraints.get(id)??[]).find(c=>!fits(p.manifest.version,c.range));lastError=conflict('E_RESOLUTION_CONFLICT',c.file,c.path+'.versions',`No selected ${id} version satisfies all active constraints.`);return null;}
  }
  const next=[...needed].filter(id=>!chosen.has(id)).sort(compareText)[0];
  if(!next){try{loadOrder(chosen);}catch(e){lastError=e;return null;}return chosen;}
  const constraintsFor=constraints.get(next)??[],source=constraintsFor[0],available=fixed.has(next)?[fixed.get(next)]:(pool.get(next)??[]);
  const valid=available.filter(p=>compatible(p,engineVersion)&&constraintsFor.every(c=>fits(p.manifest.version,c.range))&&(!pins||pins.has(next)&&pins.get(next).version===p.manifest.version&&pins.get(next).sha256===p.archiveSha256));
  if(!valid.length){lastError=conflict(pins?'E_LOCK':available.length?'E_RESOLUTION_CONFLICT':'E_DEPENDENCY_MISSING',source?.file??sourceFile(root,'pack.json'),source?source.path+(available.length?'.versions':'.packId'):'$.dependencies',pins?`No exact version/archive pin for ${next} matches the lock.`:`No compatible candidate exists for ${next}.`);return null;}
  for(const p of valid){const branch=new Map(chosen);branch.set(next,p);const result=search(branch);if(result)return result;}return null;
 }
 const selected=search(new Map());if(!selected)throw lastError??conflict('E_RESOLUTION_CONFLICT',sourceFile(root,'pack.json'),'$','No consistent dependency selection exists.');
 const order=loadOrder(selected),pinsSorted=[...selected.values()].map(p=>({packId:p.manifest.packId,version:p.manifest.version,sha256:p.archiveSha256})).sort((a,b)=>compareText(a.packId,b.packId));
 const catalogueLock={format:'maxxia-catalogue-lock',formatVersion:1,rules:{...supportedRules},engineVersion,packs:pinsSorted};validateLock(catalogueLock);
 if(expectedLock&&stable(expectedLock)!==stable(catalogueLock))problem('E_LOCK',typeof lock==='string'?resolve(lock):null,'$.packs','Lock selection must match exactly, without extra or missing providers.');
 const loaded=[selected.get(root.manifest.packId),...[...selected.values()].filter(p=>p.manifest.packId!==root.manifest.packId).sort((a,b)=>compareText(a.manifest.packId,b.manifest.packId))].map(p=>({...p,files:structuredClone(p.files)}));
 const stage=await validateLoadedSelection(loaded,engineVersion,root.manifest.packId);
 const catalogueHash=hash(Buffer.from(stable({engineVersion,rules:supportedRules,packs:pinsSorted,loadOrder:order})));
 stage.resolution={format:'maxxia-resolution',formatVersion:1,rootPackId:root.manifest.packId,loadOrder:order,catalogueHash,lock:catalogueLock};
 stage.archives=new Map([...selected].map(([id,p])=>[id,Buffer.from(p.archive)]));return stage;
}
export class PackSession {
 #current=null;
 #request=0;
 get current(){return this.#current===null?null:structuredClone(this.#current);}
 async load(path,options={}){const ticket=++this.#request;const staged=await resolveSelection(path,options);if(ticket!==this.#request)problem('E_STAGE_SUPERSEDED',null,'$','A newer session-load request superseded this staged result.');const next={resolution:staged.resolution,documents:staged.packs.flatMap(p=>[...p.files].map(([path,data])=>({packId:p.manifest.packId,path,data})))};this.#current=structuredClone(next);return this.current;}
}
export async function writeResolvedArtifact(selection,output,kind){
 const out=resolve(output),extension=kind==='archive'?'.maxxia-pack.zip':'.maxxia-lock.json';if(!out.endsWith(extension))problem('E_OUTPUT',out,'$',`Expected ${extension} output.`);
 for(const p of selection.packs)if(inside(p.root,out))problem('E_OUTPUT',out,'$','Output cannot replace a selected source.');await noSymlinks(out);
 try{const s=await lstat(out);if(!s.isFile())problem('E_OUTPUT',out,'$','Output is not a regular file.');if(kind==='lock'){const previous=JSON.parse(await readFile(out,'utf8'));if(previous.format!=='maxxia-catalogue-lock')problem('E_OUTPUT',out,'$','Refusing to replace unrelated output.');}else{if(s.size>ARCHIVE_LIMITS.compressedBytes)problem('E_OUTPUT',out,'$','Existing output exceeds archive limit.');const previous=readPackArchive(await readFile(out),out);let manifest;try{manifest=JSON.parse(previous.files.get('pack.json')?.toString('utf8'));}catch{}if(manifest?.format!=='maxxia-pack')problem('E_OUTPUT',out,'$','Refusing to replace an unrelated ZIP.');}}catch(e){if(e.code!=='ENOENT'){if(e instanceof ToolError)throw e;problem('E_OUTPUT',out,'$','Refusing to replace unrelated or unreadable output.');}}
 const bytes=kind==='archive'?selection.archives.get(selection.rootPackId):Buffer.from(stable(selection.resolution.lock)+'\n');
 await mkdir(dirname(out),{recursive:true});const temp=out+'.'+randomUUID()+'.tmp';try{await writeFile(temp,bytes,{flag:'wx'});await rename(temp,out);}finally{await rm(temp,{force:true});}
 return {output:out,bytes:bytes.length,sha256:hash(bytes),...(kind==='lock'?{catalogueHash:selection.resolution.catalogueHash}:{packId:selection.rootPackId})};
}
