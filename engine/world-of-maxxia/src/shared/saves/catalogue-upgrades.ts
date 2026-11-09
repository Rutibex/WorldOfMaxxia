/** MP10 — deliberate, non-destructive catalogue adoption. The *entire* instance library
 * and receipt ledger migrate as one ownership domain. An unavailable provider leaves the
 * old data opaque and untouched; no script or save is evaluated against unknown rules.
 * Distinct catalogue storage prefixes make the original a recoverable checkpoint.
 */
import {validateInstanceIdentity,validateInstanceSnapshot,INSTANCE_PREFIX,type InstanceIdentity,type InstanceSnapshot} from './campaign-instances.ts';
import {SLOT_IDS,SAVE_PREFIX,type StorageLike} from './campaign-store.ts';
import {readTransferLedger,TRANSFER_LEDGER_KEY} from './transfer-receipts.ts';
import {captureRoster} from './portable-roster.ts';
import {parseCampaign,serializeCampaign,MAX_SAVE_BYTES,type MapRegistry} from '../rules/campaign.ts';
import {validateScopedState} from '../rules/scoped-state.ts';
import {CLASSES} from '../content/classes.ts';
import {ITEMS} from '../content/items.ts';
import {SPELLS} from '../content/spells.ts';

export const UPGRADE_JOURNAL_KEY='world-of-maxxia:upgrade:mp10:journal';
const STAGE='world-of-maxxia:upgrade:mp10:stage:';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA=/^[a-f0-9]{64}$/;
const bytes=(s:string)=>new TextEncoder().encode(s).length;
const obj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const indexKey=INSTANCE_PREFIX+'index';
const snapKey=(id:string,slot:string)=>INSTANCE_PREFIX+id+':'+slot;
const date=()=>new Date().toISOString();
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),v=>v.toString(16).padStart(2,'0')).join('');
const parse=(s:string,label:string)=>{try{return JSON.parse(s) as unknown;}catch{throw new TypeError(`${label} is damaged; its original bytes were retained.`);}};
const failure=(msg:string):never=>{throw new TypeError(msg);};
const maxFiles=75;
const migratableKey=(key:string)=>key===indexKey||key===TRANSFER_LEDGER_KEY||SLOT_IDS.some(slot=>key===SAVE_PREFIX+slot)||new RegExp('^world-of-maxxia:instance:mp07:[0-9a-f-]{36}:(?:auto|slot1|slot2|slot3)$').test(key);

/** Aliases must be user-supplied and identity-specific. A provider alias never silently
 * translates a definition ID; source definitions with renamed prefixes need a future
 * explicit reference mapping and are deliberately blocked here. */
export interface PackRenameAlias{from:string;to:string;}
export interface UpgradePreview{
 status:'ready'|'blocked';token:string;from:InstanceIdentity;to:InstanceIdentity;
 instances:number;slots:number;transferReceipts:number;oldBytes:number;
 changes:string[];blockers:string[];opaqueRecords:number;
}
interface Entry {key:string;before:string|null;after:string;digest:string;}
interface UpgradeJournal{
 format:'maxxia-catalogue-upgrade';version:1;transactionId:string;
 status:'pending'|'complete'|'rolled-back';createdAt:string;completedAt:string|null;
 from:InstanceIdentity;to:InstanceIdentity;token:string;
 entries:{key:string;digest:string;length:number}[];
}
function assertIndex(raw:string):string[]{
 if(bytes(raw)>32768)failure('Source instance index is oversized.');
 const x=parse(raw,'Source index');
 if(!obj(x)||x.format!=='maxxia-instance-index'||x.version!==1||!Array.isArray(x.entries)||x.entries.length>16)failure('Invalid source instance index.');
 const ids:string[]=[];
 for(const e of (x as {entries:unknown[]}).entries){if(!obj(e)||typeof e.id!=='string'||!UUID.test(e.id)||ids.includes(e.id))failure('Invalid or repeated source instance ID.');ids.push((e as {id:string}).id);}
 return ids;
}
function aliasesMap(aliases:readonly PackRenameAlias[]):Map<string,string>{
 const map=new Map<string,string>();const used=new Set<string>();
 for(const entry of aliases){if(!/^[a-z][a-z0-9_]{0,47}$/.test(entry.from)||!/^[a-z][a-z0-9_]{0,47}$/.test(entry.to)||entry.from===entry.to||map.has(entry.from)||used.has(entry.to))failure('Invalid, repeated, or ambiguous provider alias.');map.set(entry.from,entry.to);used.add(entry.to);}
 return map;
}
function readOriginal(source:StorageLike):{files:Map<string,string>;ids:string[];receipts:number}{
 const index=source.getItem(indexKey);if(!index)throw new TypeError('No original campaign-instance index exists in the selected source.');
 const ids=assertIndex(index),files=new Map<string,string>([[indexKey,index]]);
 for(const id of ids){
  if(!source.getItem(snapKey(id,'auto')))failure(`Source campaign ${id} has no authoritative autosave.`);
  for(const slot of SLOT_IDS){const key=snapKey(id,slot),raw=source.getItem(key);if(raw!==null){if(bytes(raw)>MAX_SAVE_BYTES+300000)failure(`Save ${id}/${slot} is oversized.`);files.set(key,raw);}}
 }
 for(const slot of SLOT_IDS){const key=SAVE_PREFIX+slot,raw=source.getItem(key);if(raw!==null){if(bytes(raw)>MAX_SAVE_BYTES+2048)failure('Original format-18 legacy slot oversized.');files.set(key,raw);}}
 const ledger=source.getItem(TRANSFER_LEDGER_KEY);const receipts=readTransferLedger(source).receipts;
 if(receipts.some(r=>r.status==='pending'))failure('Pending transfers must recover in the original catalogue before migration.');
 if(ledger!==null)files.set(TRANSFER_LEDGER_KEY,ledger);
 if(files.size>maxFiles)failure('Migration file count exceeds the safe limit.');
 return {files,ids,receipts:receipts.length};
}
function rawRosterRequirements(raw:unknown):string[]{
 if(!obj(raw)||!obj(raw.roster)||!Array.isArray(raw.roster.records))return [];
 const set=new Set<string>();for(const record of raw.roster.records){if(!obj(record))continue;
  if(obj(record.source)&&typeof record.source.packId==='string')set.add(record.source.packId);
  if(Array.isArray(record.items))for(const item of record.items)if(obj(item)&&obj(item.source)&&typeof item.source.packId==='string')set.add(item.source.packId);
 }
 return [...set];
}
function rawOwnedDefinitions(raw:unknown,alias:string):boolean{
 // Inspect all game/roster/scoped objects for old namespaced references, not
 // just equipped items. A rename must not strand an old monster, quest or flag.
 if(!obj(raw))return false;
 const prefix=alias+':';
 const visit=(value:unknown,depth:number):boolean=>{
  if(depth>32)return true; // fail closed on unexpectedly deep content
  if(typeof value==='string')return value.startsWith(prefix);
  if(Array.isArray(value))return value.some(v=>visit(v,depth+1));
  if(obj(value))return Object.entries(value).some(([key,v])=>key.startsWith(prefix)||visit(v,depth+1));
  return false;
 };
 return visit(raw.campaign,0)||visit(raw.scoped,0)||visit(raw.roster,0);
}
function reconcile(from:InstanceIdentity,to:InstanceIdentity,aliases:Map<string,string>):{changes:string[];blockers:string[]}{
 const changes:string[]=[],blockers:string[]=[];
 if(from.projectId!==to.projectId||from.adventureId!==to.adventureId)blockers.push('Cannot migrate between different projects or adventures; use a compatible original adventure.');
 if(!same(from.rules,to.rules))blockers.push('Rules profile changes require a separate rules migration.');
 if(same(from,to))blockers.push('The source already has the selected catalogue identity.');
 const target=new Map(to.providers.map(p=>[p.id,p.version]));
 for(const p of from.providers){const mapped=aliases.get(p.id)??p.id,v=target.get(mapped);
  if(!v)blockers.push(`Missing provider ${p.id}@${p.version}; existing character and save bytes remain opaque until restored.`);
  else if(mapped!==p.id)changes.push(`Declared provider alias: ${p.id} → ${mapped} (definitions must retain valid IDs)`);
  if(v&&v!==p.version)changes.push(`Provider ${p.id}: ${p.version} → ${v}`);
 }
 const old=new Set(from.providers.map(p=>aliases.get(p.id)??p.id));
 for(const p of to.providers)if(!old.has(p.id))changes.push(`New provider enabled: ${p.id}@${p.version}`);
 if(from.catalogueHash!==to.catalogueHash)changes.push(`Catalogue hash: ${from.catalogueHash?.slice(0,12)??'none'} → ${to.catalogueHash?.slice(0,12)??'none'}`);
 return {changes,blockers};
}
/** Preview can inspect unsupported old payloads without trying to execute their game rules. */
export async function previewCatalogueUpgrade(source:StorageLike,target:StorageLike,from:InstanceIdentity,to:InstanceIdentity,aliases:readonly PackRenameAlias[]=[]):Promise<UpgradePreview>{
 const old=validateInstanceIdentity(from),next=validateInstanceIdentity(to),rename=aliasesMap(aliases);
 const original=readOriginal(source),{files,ids,receipts}=original,{changes,blockers}=reconcile(old,next,rename);
 const existing=target.getItem(indexKey);
 if(existing!==null||target.getItem(TRANSFER_LEDGER_KEY)!==null)blockers.push('Destination already contains a campaign library or transfer history; it cannot be overwritten.');
 if(target.getItem(UPGRADE_JOURNAL_KEY)!==null)blockers.push('A migration journal already exists. Recover or roll it back before proceeding.');
 const needs=[...new Set([...old.providers.map(p=>p.id),...ids.flatMap(id=>rawRosterRequirements(parse(files.get(snapKey(id,'auto'))!,id)))] )];
 const targetIds=new Set(next.providers.map(p=>p.id));
 for(const p of needs)if(p!=='firstlight'&&!targetIds.has(rename.get(p)??p)){
  if(!blockers.some(b=>b.includes(`Missing provider ${p}@`)))blockers.push(`Missing referenced provider ${p}; the complete roster is preserved as opaque source data.`);
 }
 let opaqueRecords=0;
 for(const id of ids){const raw=parse(files.get(snapKey(id,'auto'))!,id);
  if(!obj(raw)||raw.format!=='maxxia-campaign-instance'||![1,2].includes(raw.version as number)||!obj(raw.identity)||raw.id!==id){blockers.push(`Instance ${id} has an invalid/unsupported envelope; original retained.`);continue;}
  try{if(!same(validateInstanceIdentity(raw.identity),old))throw new TypeError('lock mismatch');}catch{blockers.push(`Instance ${id} has a different original pack lock.`);}
  if(obj(raw.roster)&&Array.isArray(raw.roster.records))opaqueRecords+=raw.roster.records.length;
  for(const [oldId]of rename)if(rawOwnedDefinitions(raw,oldId))blockers.push(`Instance ${id} references ${oldId} definition IDs. An explicit definition-reference migration is required; provider alias alone cannot rewrite them.`);
 }
 // An immutable preview digest binds source bytes, identities and exact alias declarations.
 const token=await hash(JSON.stringify({files:[...files].sort(([a],[b])=>a.localeCompare(b)),old,next,aliases}));
 return {status:blockers.length?'blocked':'ready',token,from:old,to:next,instances:ids.length,slots:[...files.keys()].filter(k=>k.startsWith(INSTANCE_PREFIX)&&k!==indexKey).length,transferReceipts:receipts,oldBytes:[...files.values()].reduce((n,s)=>n+bytes(s),0),changes,blockers,opaqueRecords};
}

/** No mutation of the source. Builds the new complete snapshots first, validates all
 * of them, then publishes an interruption-recoverable journal in the destination. */
export class CatalogueUpgradeCoordinator{
 private readonly source:StorageLike;private readonly target:StorageLike;private readonly registry:MapRegistry;
 readonly from:InstanceIdentity;readonly to:InstanceIdentity;private readonly aliases:readonly PackRenameAlias[];
 constructor(source:StorageLike,target:StorageLike,registry:MapRegistry,from:InstanceIdentity,to:InstanceIdentity,aliases:readonly PackRenameAlias[]=[]){
  validateInstanceIdentity(from);validateInstanceIdentity(to);aliasesMap(aliases);
  this.source=source;this.target=target;this.registry=registry;this.from=from;this.to=to;this.aliases=aliases;
 }
 preview():Promise<UpgradePreview>{return previewCatalogueUpgrade(this.source,this.target,this.from,this.to,this.aliases);}
 private readJournal():UpgradeJournal|null{
  const raw=this.target.getItem(UPGRADE_JOURNAL_KEY);if(raw===null)return null;
  if(bytes(raw)>30000)failure('Migration journal is too large; retain original files.');
  const value=parse(raw,'Migration journal');
  if(!obj(value)||value.format!=='maxxia-catalogue-upgrade'||value.version!==1||!UUID.test(value.transactionId as string)||!['pending','complete','rolled-back'].includes(value.status as string)||!Array.isArray(value.entries)||value.entries.length>maxFiles||!SHA.test(value.token as string)||!same(value.from,this.from)||!same(value.to,this.to))failure('Incompatible or damaged migration journal. No save files were altered.');
  for(const e of (value as {entries:unknown[]}).entries)if(!obj(e)||typeof e.key!=='string'||!migratableKey(e.key)||!SHA.test(e.digest as string)||!Number.isSafeInteger(e.length)||(e.length as number)>MAX_SAVE_BYTES+300000)failure('Migration journal entry malformed.');
  if(new Set(((value as {entries:{key:string}[]}).entries).map(e=>e.key)).size!==(value as {entries:unknown[]}).entries.length)failure('Duplicate migration journal entries.');
  return value as unknown as UpgradeJournal;
 }
 private async transformed():Promise<{entries:Entry[];preview:UpgradePreview}>{
  const preview=await this.preview();if(preview.status!=='ready')failure(`Migration blocked: ${preview.blockers.join(' ')}`);
  const original=readOriginal(this.source),entries:Entry[]=[];
  for(const [key,raw]of original.files){
   let after=raw;
   if(key.startsWith(INSTANCE_PREFIX)&&key!==indexKey){
    const source=validateInstanceSnapshot(parse(raw,key),this.registry,this.from);
    // Preserve legacy gameplay semantics and all character/item UUIDs while rebinding
    // their provider provenance; no item/world/quest state is dropped.
    const campaign=JSON.parse(serializeCampaign(source.campaign,this.registry));
    const scoped=validateScopedState(source.scoped,this.registry);
    for(const record of source.roster?.records??[]){
     if(!CLASSES[record.character.classId])failure(`Unavailable class ${record.character.classId}; source snapshot retained.`);
     for(const item of record.items)if(!ITEMS[item.instance.definitionId])failure(`Unavailable item ${item.instance.definitionId}; source snapshot retained.`);
     for(const spell of record.spellbook.known)if(!SPELLS[spell])failure(`Unavailable spell ${spell}; source snapshot retained.`);
    }
    const roster=captureRoster(campaign,this.to,source.id,source.roster);
    const rewritten:InstanceSnapshot={...source,version:2,identity:validateInstanceIdentity(this.to),campaign,scoped,roster,savedAt:date()};
    validateInstanceSnapshot(rewritten,this.registry,this.to);
    after=JSON.stringify(rewritten);
   }else if(key.startsWith(SAVE_PREFIX)){
    // Legacy v18 saves have no pack lock. Keep exact bytes; the legacy reader
    // validates upon restore and does not auto-upgrade them into another campaign.
    const parsed=parse(raw,key);if(!obj(parsed)||typeof parsed.savedAt!=='string'||!obj(parsed.campaign))failure('A legacy slot needs manual restore; original preserved.');
    parseCampaign(JSON.stringify((parsed as {campaign:unknown}).campaign),this.registry);
   }
   entries.push({key,before:raw,after,digest:await hash(after)});
  }
  // Historical manual slots that predate receipts remain preserved but may still
  // be blocked by ownership checks after migration. Never rewrite the receipt ledger.
  const current=await this.preview();if(current.token!==preview.token||current.status!=='ready')failure('Source pack or save contents changed during preview. Retry migration.');
  return {entries,preview};
 }
 async adopt(confirmedToken:string):Promise<UpgradeJournal>{
  if(!SHA.test(confirmedToken))failure('Explicit confirmation requires a valid preview token.');
  const plan=await this.transformed();if(plan.preview.token!==confirmedToken)failure('Save state changed after confirmation; obtain a new preview.');
  if(this.readJournal())failure('An upgrade journal already exists. Recover or roll back first.');
  for(const e of plan.entries)if(this.target.getItem(e.key)!==null)failure(`Destination ${e.key} is already occupied; no data overwritten.`);
  const id=crypto.randomUUID(),journal:UpgradeJournal={format:'maxxia-catalogue-upgrade',version:1,transactionId:id,status:'pending',createdAt:date(),completedAt:null,from:validateInstanceIdentity(this.from),to:validateInstanceIdentity(this.to),token:confirmedToken,entries:plan.entries.map(e=>({key:e.key,digest:e.digest,length:bytes(e.after)}))};
  try{
   for(let i=0;i<plan.entries.length;i++){
    // Staged post-images and byte-for-byte preimages are retained as recovery backups.
    this.target.setItem(STAGE+id+':after:'+i,plan.entries[i].after);
    this.target.setItem(STAGE+id+':original:'+i,plan.entries[i].before!);
   }
   this.target.setItem(UPGRADE_JOURNAL_KEY,JSON.stringify(journal));
  }catch(error){
   if(this.target.getItem(UPGRADE_JOURNAL_KEY)===null)for(let i=0;i<plan.entries.length;i++){
    try{this.target.removeItem(STAGE+id+':after:'+i);this.target.removeItem(STAGE+id+':original:'+i);}catch{/* orphan staging is inert */}
   }
   throw error;
  }
  return this.recover() as Promise<UpgradeJournal>;
 }
 async recover():Promise<UpgradeJournal|null>{
  const journal=this.readJournal();if(!journal||journal.status!=='pending')return journal;
  // Preflight every destination file before writing even one. A divergent new save
  // must not be silently replaced by an old post-image.
  const staged:string[]=[];
  for(let i=0;i<journal.entries.length;i++){
   const e=journal.entries[i],after=this.target.getItem(STAGE+journal.transactionId+':after:'+i),original=this.target.getItem(STAGE+journal.transactionId+':original:'+i);
   if(after===null||original===null||bytes(after)!==e.length||await hash(after)!==e.digest)failure(`Migration staging ${i} is damaged. Original data retained; manual recovery required.`);
   const current=this.target.getItem(e.key);
   if(current!==null&&current!==after)failure(`Destination ${e.key} was modified during migration. No conflicting data was overwritten.`);
   staged.push(after!);
  }
  for(let i=0;i<journal.entries.length;i++)if(this.target.getItem(journal.entries[i].key)===null)this.target.setItem(journal.entries[i].key,staged[i]);
  journal.status='complete';journal.completedAt=date();this.target.setItem(UPGRADE_JOURNAL_KEY,JSON.stringify(journal));
  return journal;
 }
 /** Roll back only if the migrated destination has not been edited since adoption.
  * This cannot undo moves/rewards made after adoption; such changes block rollback.
  */
 async rollback():Promise<UpgradeJournal>{
  const j=this.readJournal();if(!j||j.status!=='complete')throw new TypeError('No completed migration is available to roll back.');
  for(const e of j.entries){const actual=this.target.getItem(e.key);if(actual===null||await hash(actual)!==e.digest)failure('Destination changed since migration; rollback refused to protect new progress.');}
  for(const e of j.entries)this.target.removeItem(e.key);
  j.status='rolled-back';j.completedAt=date();this.target.setItem(UPGRADE_JOURNAL_KEY,JSON.stringify(j));
  return j;
 }
}
