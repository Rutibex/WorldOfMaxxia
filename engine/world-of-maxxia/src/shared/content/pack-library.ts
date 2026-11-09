import {CURRENT_ENGINE_VERSION} from '../project/generated.ts';
/** MP06: local/offline library contracts. No arbitrary paths, code, or network installation. */
import {canonicalJSON,verifyCatalogueBuild,sha256JSON,MAX_RUNTIME_CATALOGUE_BYTES} from './catalogue-build.ts';
import {CatalogueError,composePackCatalogue,captureCatalogueBase,installComposedCatalogue,validateMetadata,type PackInput,type ComposedCatalogue} from './catalogue.ts';
import type {ResourceResolver} from '../project/resources.ts';

export const PACK_LIBRARY_LIMITS={archiveBytes:32*1024*1024,archiveExpandedBytes:32*1024*1024,fileBytes:1024*1024,entries:4096,installedBytes:48*1024*1024,installedBundles:32} as const;
export interface LibraryBundle {id:string;name:string;kind:'archive'|'build';bytes:Uint8Array;}
export interface LibraryPreferences {adventureId:'firstlight'|'brass-proof'|'catalogue-proof';enabled:string[];}
export interface LibraryPack {manifest:PackInput['manifest'];index:PackInput['index'];files:PackInput['files'];source:string;}
export const ADVENTURES=[
 {id:'firstlight',name:'World of Maxxia — Firstlight',project:'WorldOfMaxxia.maxxia',description:'Original village, cistern and vault adventure, with its existing saves.',required:[] as string[]},
 {id:'brass-proof',name:'Brass Workshop — Pack Fixture',project:'WorldOfMaxxia.maxxia',description:'Firstlight maps with the Brass pack enabled. Verifies content-only additions in combat and character creation; not a separate scripted adventure.',required:['brass']},
 {id:'catalogue-proof',name:'Glass Archive — Pack Fixture',project:'CatalogueProof.maxxia',description:'Firstlight maps with two contributed pack catalogues. A compatibility sandbox, not a finished new story.',required:['brass','glass']},
] as const;
function problem(code:string,msg:string):never{throw new CatalogueError(code,'$.library',msg);}
const readable=(name:string)=>/^[a-zA-Z0-9][a-zA-Z0-9_. -]{0,120}$/.test(name);
const bytesEq=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
const decoder=new TextDecoder('utf-8',{fatal:true});
const cp=(v:unknown)=>structuredClone(v);
const get16=(v:DataView,i:number)=>v.getUint16(i,true),get32=(v:DataView,i:number)=>v.getUint32(i,true);
const pathOk=(s:string)=>s.length<=240&&/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/.test(s);
const crcTable=Uint32Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=n&1?(n>>>1)^0xedb88320:n>>>1;return n>>>0;});
function crc32(input:Uint8Array):number{let n=0xffffffff;for(const v of input)n=crcTable[(n^v)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
/** The CLI's canonical .maxxia-pack.zip output uses STORED ZIP records.
 * Deliberately reject unsupported ZIP methods instead of decompressing untrusted input.
 */
export function unpackMaxxiaArchive(bytes:Uint8Array):Map<string,Uint8Array>{
 if(bytes.length<22||bytes.length>PACK_LIBRARY_LIMITS.archiveBytes)problem('E_ARCHIVE_LIMIT','Archive must be 22 bytes–32 MiB.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(get32(view,i)===0x06054b50&&i+22+get16(view,i+20)===bytes.length){end=i;break;}
 if(end<0)problem('E_ARCHIVE_FORMAT','Invalid ZIP end record.');
 const count=get16(view,end+10),directoryLength=get32(view,end+12),directoryStart=get32(view,end+16);
 if(get16(view,end+4)||get16(view,end+6)||get16(view,end+8)!==count||count<1||count>PACK_LIBRARY_LIMITS.entries||directoryStart+directoryLength!==end)problem('E_ARCHIVE_FORMAT','Multi-disk, ZIP64, or inconsistent ZIP directory.');
 const names=new Set<string>(),result=new Map<string,Uint8Array>(),regions:[number,number][]=[];let position=directoryStart,total=0;
 for(let n=0;n<count;n++){
  if(position+46>end||get32(view,position)!==0x02014b50)problem('E_ARCHIVE_FORMAT','Damaged central directory.');
  const flag=get16(view,position+8),method=get16(view,position+10),crc=get32(view,position+16),compressed=get32(view,position+20),expanded=get32(view,position+24),nameLen=get16(view,position+28),extra=get16(view,position+30),comment=get16(view,position+32),attrs=get32(view,position+38),local=get32(view,position+42);
  if(position+46+nameLen+extra+comment>end)problem('E_ARCHIVE_FORMAT','Truncated ZIP entry.');
  let name='';try{name=decoder.decode(bytes.subarray(position+46,position+46+nameLen));}catch{problem('E_ARCHIVE_PATH','ZIP entry names must be UTF-8.');}
  if(!pathOk(name)||names.has(name.toLowerCase()))problem('E_ARCHIVE_PATH',`Unsafe or duplicate entry: ${name}`);names.add(name.toLowerCase());
  if(flag&~0x0800||method!==0||expanded!==compressed||expanded>PACK_LIBRARY_LIMITS.fileBytes||total+expanded>PACK_LIBRARY_LIMITS.archiveExpandedBytes||![0,0x8000].includes((attrs>>>16)&0xf000)||local+30>directoryStart||get32(view,local)!==0x04034b50)problem('E_ARCHIVE_FORMAT',`Unsupported ZIP entry: ${name}. Use the Maxxia CLI's stored archive output.`);
  const localLen=get16(view,local+26),localExtra=get16(view,local+28),start=local+30+localLen+localExtra,stop=start+compressed;
  if(start>directoryStart||stop>directoryStart||get16(view,local+6)!==flag||get16(view,local+8)!==method||get32(view,local+14)!==crc||get32(view,local+18)!==compressed||get32(view,local+22)!==expanded||!bytesEq(bytes.subarray(local+30,local+30+localLen),bytes.subarray(position+46,position+46+nameLen)))problem('E_ARCHIVE_FORMAT',`ZIP headers disagree: ${name}`);
  const data=bytes.slice(start,stop);if(crc32(data)!==crc)problem('E_ARCHIVE_INTEGRITY',`Checksum mismatch: ${name}`);
  regions.push([local,stop]);result.set(name,data);total+=expanded;position+=46+nameLen+extra+comment;
 }
 if(position!==end)problem('E_ARCHIVE_FORMAT','ZIP directory trailing data.');
 regions.sort((a,b)=>a[0]-b[0]);let previous=0;for(const [start,stop] of regions){if(start!==previous)problem('E_ARCHIVE_FORMAT','ZIP overlap, gap or executable prefix.');previous=stop;}if(previous!==directoryStart)problem('E_ARCHIVE_FORMAT','ZIP contains unreferenced bytes.');
 return result;
}
function parseJSON(bytes:Uint8Array,label:string):unknown{try{return JSON.parse(decoder.decode(bytes));}catch{problem('E_JSON',`${label} is not valid UTF-8 JSON.`);}}
export function archivePack(bytes:Uint8Array,source='local archive'):LibraryPack{
 const files=unpackMaxxiaArchive(bytes),manifest=parseJSON(files.get('pack.json')??new Uint8Array(),'pack.json') as PackInput['manifest'];
 if(!manifest||typeof manifest.contentIndex!=='string'||!pathOk(manifest.contentIndex))problem('E_INDEX_PATH','Missing or invalid content index in archive.');
 const index=parseJSON(files.get(manifest.contentIndex)??new Uint8Array(),manifest.contentIndex) as PackInput['index'];
 const docs=new Map<string,unknown>();for(const [name,contents]of files)docs.set(name,parseJSON(contents,name));
 const pack={manifest,index,files:docs};validateMetadata(pack,0);
 const expected=new Set(['pack.json',manifest.contentIndex,...index.definitions.map(d=>d.file)]);
 if(docs.size!==expected.size||[...docs.keys()].some(k=>!expected.has(k)))problem('E_ARCHIVE_FILES','Archive contents do not match the declared content index.');
 return {...pack,source};
}
export async function buildPacks(bytes:Uint8Array,source='compiled build'):Promise<LibraryPack[]>{
 if(bytes.length>MAX_RUNTIME_CATALOGUE_BYTES)problem('E_CATALOGUE_SIZE','Compiled build exceeds 8 MiB.');
 const text=decoder.decode(bytes),version=(JSON.parse(text) as {engineVersion?:unknown}).engineVersion;
 if(version!=='0.50.0'&&version!=='0.51.0'&&version!=='0.52.0'&&version!=='0.53.0'&&version!=='0.54.0'&&version!=='0.55.0'&&version!=='0.56.0'&&version!=='0.57.0'&&version!=='0.58.0'&&version!=='0.59.0'&&version!=='0.60.0'&&version!=='0.61.0'&&version!=='0.62.0'&&version!=='0.63.0')problem('E_ENGINE','Only supported MP04–MP18 compiled catalogues can be imported.');
 const verified=await verifyCatalogueBuild(text,version);
 return verified.packs.map(p=>({...p,source}));
}
export async function bundlePacks(bundle:LibraryBundle):Promise<LibraryPack[]>{
 if(!readable(bundle.name)||!/^local:[a-f0-9]{64}$/.test(bundle.id))problem('E_BUNDLE','Invalid local bundle identifier.');
 return bundle.kind==='archive'?[archivePack(bundle.bytes,bundle.id)]:buildPacks(bundle.bytes,bundle.id);
}
export async function hashBundle(bytes:Uint8Array):Promise<string>{const buffer=await crypto.subtle.digest('SHA-256',bytes.slice().buffer as ArrayBuffer);return Array.from(new Uint8Array(buffer),n=>n.toString(16).padStart(2,'0')).join('');}
export async function admitBundle(name:string,kind:'archive'|'build',bytes:Uint8Array):Promise<LibraryBundle>{
 if(!readable(name))problem('E_BUNDLE','File name must be a simple, readable name.');
 if(bytes.length>PACK_LIBRARY_LIMITS.archiveBytes)problem('E_BUNDLE_SIZE','Imported file exceeds 32 MiB.');
 const id='local:'+await hashBundle(bytes),bundle={id,name,kind,bytes:new Uint8Array(bytes)};
 await bundlePacks(bundle);return bundle;
}
export function availablePacks(groups:readonly LibraryPack[][]):Map<string,LibraryPack>{
 const chosen=new Map<string,LibraryPack>();
 for(const group of groups)for(const p of group){const id=p.manifest.packId,prior=chosen.get(id);if(prior){
  const signature=(item:LibraryPack)=>canonicalJSON({manifest:item.manifest,index:item.index,files:[...item.files].sort(([a],[b])=>a.localeCompare(b))});
  if(signature(prior)!==signature(p))problem('E_PACK_CONFLICT',`Conflicting installations for ${id}; remove the incompatible bundle.`);
 }else chosen.set(id,p);}
 return chosen;
}
function versionFits(version:string,min:string,max:string):boolean{
 const values=(s:string)=>s.split('.').map(Number);const compare=(a:string,b:string)=>{const x=values(a),y=values(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]<y[i]?-1:1;return 0;};
 return compare(version,min)>=0&&compare(version,max)<0;
}
/** Mandatory providers never auto-disappear. Optional providers may be disabled. */
export function selectionReport(available:Map<string,LibraryPack>,enabled:readonly string[]):{ordered:string[];notes:string[]}{
 const chosen=new Set(['core',...enabled]),notes:string[]=[];
 if(enabled.length!==new Set(enabled).size)problem('E_SELECTION_DUPLICATE','Repeated enabled pack ID.');
 if(!available.has('core'))problem('E_CORE_MISSING','The bundled core catalogue is not installed.');
 const ordered:string[]=[],visiting=new Set<string>(),done=new Set<string>();
 function visit(id:string){if(visiting.has(id))problem('E_DEPENDENCY_CYCLE',`Dependency cycle involving ${id}.`);if(done.has(id))return;
  const p=available.get(id);if(!p)problem('E_DEPENDENCY_MISSING',`Enabled pack ${id} is not installed.`);
  visiting.add(id);
  for(const d of [...p.manifest.dependencies].sort((a,b)=>a.packId.localeCompare(b.packId))){const provider=available.get(d.packId),active=chosen.has(d.packId);
   if(!active){if(d.optional){notes.push(`${id}: optional ${d.packId} is disabled.`);continue;}problem('E_DEPENDENCY_DISABLED',`${id} requires ${d.packId}. Enable it first; no installed data has been changed.`);}
   if(!provider)problem('E_DEPENDENCY_MISSING',`${id} requires missing provider ${d.packId}.`);
   if(!versionFits(provider.manifest.version,d.versions.min,d.versions.maxExclusive))problem('E_DEPENDENCY_VERSION',`${id} requires ${d.packId} >=${d.versions.min} and <${d.versions.maxExclusive}; installed ${provider.manifest.version}.`);
   visit(d.packId);
  }
  visiting.delete(id);done.add(id);ordered.push(id);
 }
 for(const id of [...chosen].sort())visit(id);
 return {ordered,notes};
}
export function requireAdventure(selection:string,enabled:readonly string[]):void{
 const adventure=ADVENTURES.find(a=>a.id===selection);if(!adventure)problem('E_ADVENTURE','Unknown playable adventure.');
 for(const id of adventure.required)if(!enabled.includes(id))problem('E_ADVENTURE_REQUIRED',`${adventure.name} needs enabled pack ${id}.`);
}
/** Call only at game boot: staging must never mutate an active combat session. */
export async function installLibrarySelection(available:Map<string,LibraryPack>,enabled:readonly string[],resources:ResourceResolver|null,projectId:string):Promise<{hash:string;summary:ComposedCatalogue['summary'];resources:ResourceResolver|null}>{
 if(enabled.length===0)problem('E_SELECTION_EMPTY','A core-only project should use the unchanged baseline boot.');
 const report=selectionReport(available,enabled),packs=report.ordered.map(id=>available.get(id)!);
 const root=enabled.slice().sort().at(-1)!;
 const engineVersion=packs.some(p=>!versionFits('0.52.0',p.manifest.engine.min,p.manifest.engine.maxExclusive))?CURRENT_ENGINE_VERSION:'0.52.0';
 const staged=composePackCatalogue(packs,root,captureCatalogueBase(),resources,engineVersion);
 const hash=await sha256JSON({engineVersion,projectId,selected:report.ordered.map(id=>({id,manifest:packs.find(p=>p.manifest.packId===id)!.manifest,files:[...available.get(id)!.files].sort(([a],[b])=>a.localeCompare(b))}))});
 installComposedCatalogue(staged);
 return {hash,summary:staged.summary,resources:staged.resources};
}
