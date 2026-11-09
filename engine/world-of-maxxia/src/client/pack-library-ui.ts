/** MP06 local module library. Nothing is uploaded; selection only changes between sessions. */
import {ADVENTURES,PACK_LIBRARY_LIMITS,admitBundle,availablePacks,buildPacks,bundlePacks,requireAdventure,selectionReport,type LibraryBundle,type LibraryPack,type LibraryPreferences} from '../shared/content/pack-library.ts';
import {sha256JSON} from '../shared/content/catalogue-build.ts';

export interface LibraryLaunch {project:string;adventureId:string;available:Map<string,LibraryPack>;enabled:string[];coreHash:string;}
const dbName='world-of-maxxia:pack-library:mp06';
const fallback:LibraryPreferences={adventureId:'firstlight',enabled:[]};
function node<T extends HTMLElement>(id:string):T{const value=document.getElementById(id);if(!value)throw new Error('Missing library element '+id);return value as T;}
function dbOpen():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{if(!indexedDB)throw new Error('IndexedDB is unavailable.');const request=indexedDB.open(dbName,1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('bundles',{keyPath:'id'});db.createObjectStore('settings');};request.onerror=()=>reject(request.error);request.onsuccess=()=>resolve(request.result);});}
function txDone(tx:IDBTransaction):Promise<void>{return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??new Error('Database transaction aborted.'));tx.onerror=()=>reject(tx.error??new Error('Database transaction failed.'));});}
function get<T>(tx:IDBTransaction,store:string,key?:IDBValidKey):Promise<T>{return new Promise((resolve,reject)=>{const r=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);r.onsuccess=()=>resolve(r.result as T);r.onerror=()=>reject(r.error);});}
class LibraryStorage{
 constructor(private db:IDBDatabase){}
 async read():Promise<{bundles:LibraryBundle[];prefs:LibraryPreferences}>{const tx=this.db.transaction(['bundles','settings'],'readonly'),done=txDone(tx),[bundles,prefs]=await Promise.all([get<LibraryBundle[]>(tx,'bundles'),get<LibraryPreferences|undefined>(tx,'settings','prefs')]);await done;return {bundles,prefs:prefs??fallback};}
 async writePrefs(prefs:LibraryPreferences):Promise<void>{const tx=this.db.transaction('settings','readwrite');tx.objectStore('settings').put(prefs,'prefs');await txDone(tx);}
 async add(bundle:LibraryBundle):Promise<void>{const tx=this.db.transaction('bundles','readwrite');tx.objectStore('bundles').put(bundle);await txDone(tx);}
 async remove(id:string):Promise<void>{const tx=this.db.transaction('bundles','readwrite');tx.objectStore('bundles').delete(id);await txDone(tx);}
}
function addButton(text:string,run:()=>void|Promise<void>):HTMLButtonElement{const button=document.createElement('button');button.type='button';button.className='panel-button library-small';button.textContent=text;button.addEventListener('click',()=>{void Promise.resolve().then(run).catch(error=>{node('library-message').textContent=String(error instanceof Error?error.message:error);});});return button;}
function download(name:string,bytes:Uint8Array,type:string){const url=URL.createObjectURL(new Blob([bytes.slice().buffer],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function safePrefs(value:LibraryPreferences):LibraryPreferences{
 if(!value||!ADVENTURES.some(a=>a.id===value.adventureId)||!Array.isArray(value.enabled)||value.enabled.length>128||value.enabled.some(v=>typeof v!=='string'||!/^[a-z][a-z0-9_]{0,47}$/.test(v)))return fallback;
 return {adventureId:value.adventureId,enabled:[...new Set(value.enabled)]};
}
export async function openLibraryHub():Promise<LibraryLaunch>{
 const screen=node<HTMLElement>('library-screen'),loading=node<HTMLElement>('loading');
 loading.hidden=true;screen.hidden=false;
 const message=node<HTMLElement>('library-message'),packsPanel=node<HTMLElement>('library-packs'),choose=node<HTMLSelectElement>('library-adventure'),install=node<HTMLInputElement>('library-file');
 let store:LibraryStorage|null=null,bundles:LibraryBundle[]=[],prefs=safePrefs(fallback),installed:Map<string,LibraryPack>=new Map(),quarantine=new Map<string,string>();
 const builtinResponse=await fetch(new URL('mp06-proof/catalogue.maxxia-build.json',new URL('./',location.href)).href,{cache:'no-store'});
 if(!builtinResponse.ok)throw new Error('Bundled MP04 provider catalogue is missing.');
 const builtinBytes=new Uint8Array(await builtinResponse.arrayBuffer());if(builtinBytes.length>8*1024*1024)throw new Error('Bundled catalogue exceeds the safe limit.');
 const coreProof=await buildPacks(builtinBytes,'bundled:mp04');
 const core=coreProof.find(pack=>pack.manifest.packId==='core');if(!core)throw new Error('Bundled core pack missing.');
 const coreHash=await sha256JSON({manifest:core.manifest,index:core.index,files:[...core.files].sort(([a],[b])=>a.localeCompare(b))});
 try{store=new LibraryStorage(await dbOpen());const saved=await store.read();bundles=saved.bundles;prefs=safePrefs(saved.prefs);}catch(error){message.textContent=`Local installation storage is unavailable (${String(error instanceof Error?error.message:error)}). Bundled adventures remain playable, but imported packs cannot persist.`;}
 async function rebuild():Promise<void>{
  const groups=[coreProof];quarantine=new Map();
  for(const bundle of bundles)try{const parsed=await bundlePacks(bundle);availablePacks([...groups,parsed]);groups.push(parsed);}catch(error){quarantine.set(bundle.id,String(error instanceof Error?error.message:error));}
  installed=availablePacks(groups);
  if(quarantine.size)message.textContent=`${quarantine.size} damaged or incompatible installed bundle(s) were left untouched but disabled. Remove or reimport them below.`;
 }
 async function persist(){if(store)await store.writePrefs(prefs);}
 const chooseAdventure=(id:string)=>{const selected=ADVENTURES.find(a=>a.id===id);if(!selected)return;prefs={adventureId:selected.id,enabled:[...new Set([...prefs.enabled.filter(x=>x!=='brass'&&x!=='glass'),...selected.required])]};void persist().catch(error=>message.textContent=String(error));render();};
 const explain=(pack:LibraryPack)=>pack.manifest.dependencies.map(d=>`${d.packId} ${d.versions.min}–<${d.versions.maxExclusive}${d.optional?' (optional)':''}`).join(', ')||'none';
 function render():void{
  choose.value=prefs.adventureId;
  packsPanel.replaceChildren();
  const sorted=[...installed.values()].sort((a,b)=>a.manifest.packId.localeCompare(b.manifest.packId));
  for(const pack of sorted){
   const id=pack.manifest.packId,required=(ADVENTURES.find(a=>a.id===prefs.adventureId)!.required as readonly string[]).includes(id);
   const line=document.createElement('div');line.className='library-pack-row';
   const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=id==='core'||prefs.enabled.includes(id);toggle.disabled=id==='core'||required;toggle.setAttribute('aria-label',`Enable ${pack.manifest.title}`);
   toggle.addEventListener('change',()=>{
    const next=new Set(prefs.enabled);
    if(toggle.checked){
     const add=(key:string,visited=new Set<string>())=>{if(visited.has(key))return;visited.add(key);const p=installed.get(key);if(!p)throw new Error(`Required provider ${key} has not been installed.`);if(key!=='core')next.add(key);for(const d of p.manifest.dependencies)if(!d.optional)add(d.packId,visited);};
     try{add(id);}catch(error){message.textContent=String(error instanceof Error?error.message:error);toggle.checked=false;return;}
    }else next.delete(id);
    try{selectionReport(installed,[...next]);prefs={...prefs,enabled:[...next].sort()};message.textContent=`Selection updated. Changes take effect when a new game session starts.`;void persist().catch(error=>message.textContent=String(error));render();}
    catch(error){message.textContent=String(error instanceof Error?error.message:error);toggle.checked=!toggle.checked;}
   });
   const description=document.createElement('div');description.className='library-pack-description';
   const title=document.createElement('strong');title.textContent=`${pack.manifest.title} · ${pack.manifest.version}`;
   const details=document.createElement('small');details.textContent=`${id} · ${pack.manifest.kind} · requires ${explain(pack)} · ${pack.source.startsWith('local:')?'Imported':'Bundled'}`;
   description.append(title,details);line.append(toggle,description);packsPanel.append(line);
  }
  const archives=node<HTMLElement>('library-imported');archives.replaceChildren();
  for(const bundle of bundles){const row=document.createElement('div');row.className='library-bundle-row';const name=document.createElement('span');name.textContent=`${bundle.name} · ${(bundle.bytes.length/1024).toFixed(1)} KiB${quarantine.has(bundle.id)?' · Unusable: '+quarantine.get(bundle.id):''}`;row.append(name);
   row.append(addButton('Export',()=>download(bundle.name,bundle.bytes,bundle.kind==='archive'?'application/zip':'application/json')));
   row.append(addButton('Remove',async()=>{const owned=quarantine.has(bundle.id)?[]:(await bundlePacks(bundle)).map(p=>p.manifest.packId).filter(id=>id!=='core');if(!quarantine.has(bundle.id)&&owned.some(id=>prefs.enabled.includes(id)))throw new Error(`Disable ${owned.filter(id=>prefs.enabled.includes(id)).join(', ')} before removal.`);await store?.remove(bundle.id);bundles=bundles.filter(b=>b.id!==bundle.id);await rebuild();render();message.textContent='Bundle removed; saved adventures were not deleted.';}));archives.append(row);}
  const saveBox=node<HTMLElement>('library-saves');saveBox.replaceChildren();
  try{const records=new Map<string,number>();for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)??'';if(!key.includes('world-of-maxxia:campaign:v1:')||key.endsWith(':backup'))continue;const group=key.startsWith('maxxia-catalogue:')?key.split(':').slice(0,4).join(':'):key.startsWith('maxxia-project:')?key.split(':').slice(0,3).join(':'):'Firstlight original';records.set(group,(records.get(group)??0)+1);}if(records.size){for(const [group,count] of records){const line=document.createElement('small');line.textContent=`${group} · ${count} saved slot(s), preserved across selections`;saveBox.append(line);}}else saveBox.textContent='No existing local campaign slots found.';}catch{saveBox.textContent='Browser save metadata is unavailable.';}
  if(!bundles.length){const hint=document.createElement('small');hint.textContent='No imported files. Built-in MP04 providers are available above.';archives.append(hint);}
 }
 await rebuild();
 const previousMessage=message.textContent;
 if(!previousMessage)message.textContent='Library selections are local to this browser. Existing saves stay on disk when you change enabled packs.';
 const describe=node<HTMLElement>('library-adventure-description');
 for(const adventure of ADVENTURES){const opt=document.createElement('option');opt.value=adventure.id;opt.textContent=adventure.name;choose.append(opt);}
 choose.addEventListener('change',()=>{chooseAdventure(choose.value);describe.textContent=ADVENTURES.find(a=>a.id===prefs.adventureId)!.description;});
 describe.textContent=ADVENTURES.find(a=>a.id===prefs.adventureId)!.description;
 render();
 node<HTMLButtonElement>('library-import').addEventListener('click',()=>install.click());
 install.addEventListener('change',()=>{void (async()=>{const file=install.files?.[0];install.value='';if(!file)return;
  if(!store)throw new Error('IndexedDB is unavailable. Importing cannot be persisted safely.');
  if(file.size>PACK_LIBRARY_LIMITS.archiveBytes)throw new Error('Maximum import size is 32 MiB.');
  const kind=file.name.endsWith('.maxxia-pack.zip')?'archive':file.name.endsWith('.maxxia-build.json')?'build':null;
  if(!kind)throw new Error('Choose a .maxxia-pack.zip or .maxxia-build.json produced by the Maxxia toolkit.');
  if(bundles.length>=PACK_LIBRARY_LIMITS.installedBundles)throw new Error('Library bundle count limit reached.');
  const bytes=new Uint8Array(await file.arrayBuffer()),bundle=await admitBundle(file.name,kind,bytes);
  if(bundles.some(b=>b.id===bundle.id))throw new Error('This exact file is already installed.');
  if(bundles.reduce((n,b)=>n+b.bytes.length,0)+bytes.length>PACK_LIBRARY_LIMITS.installedBytes)throw new Error('Installed bundles would exceed 48 MiB.');
  const trial=availablePacks([coreProof,...await Promise.all([...bundles,bundle].map(bundlePacks))]);
  await store.add(bundle);bundles.push(bundle);installed=trial;render();message.textContent=`Imported ${file.name}. Enable its content above. Adventure maps/routines remain authoring-only until MP11–16.`;
 })().catch(error=>{message.textContent=`Import rejected; library unchanged: ${String(error instanceof Error?error.message:error)}`;});});
 return await new Promise<LibraryLaunch>(resolve=>{
  node<HTMLButtonElement>('library-open').addEventListener('click',()=>{void (async()=>{
   requireAdventure(prefs.adventureId,prefs.enabled);
   selectionReport(installed,prefs.enabled);
   await persist();const selected=ADVENTURES.find(a=>a.id===prefs.adventureId)!;
   screen.hidden=true;loading.hidden=false;
   resolve({project:selected.project,adventureId:selected.id,available:installed,enabled:[...prefs.enabled],coreHash});
  })().catch(error=>{message.textContent=`Cannot start: ${String(error instanceof Error?error.message:error)}`;});});
 });
}
