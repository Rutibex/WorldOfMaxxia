/** MP07: independent campaign instances; retains the existing format-18 gameplay payload.
 * Nothing reads, overwrites or upgrades legacy world-of-maxxia:campaign:v1 slots here.
 */
import {parseCampaign,serializeCampaign,type CampaignState,type MapRegistry,MAX_SAVE_BYTES} from '../rules/campaign.ts';
import {newScopedState,validateScopedState,type ScopedState} from '../rules/scoped-state.ts';
import {SLOT_IDS,type SlotId,type SlotSummary,type StorageLike} from './campaign-store.ts';
import {copyPortableIntoReserve,captureRoster,validateRoster,exportPortableCharacter,ROSTER_PREFIX,type RosterSnapshot} from './portable-roster.ts';
import {TransferCoordinator,assertTransferOwnership,type TransferRequest,type TransferReceipt} from './transfer-receipts.ts';

export const INSTANCE_PREFIX='world-of-maxxia:instance:mp07:';
const INDEX_KEY=INSTANCE_PREFIX+'index';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PACK=/^[a-z][a-z0-9_]{0,47}$/;
const SHA=/^[a-f0-9]{64}$/;
const time=/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;
const maxInstances=16;
function newInstanceId():string{
 if(typeof crypto==='undefined'||typeof crypto.getRandomValues!=='function')throw new TypeError('Browser cryptographic random source is unavailable; cannot allocate an instance ID.');
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const asObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const jsize=(s:string)=>new TextEncoder().encode(s).length;
export interface InstanceIdentity {
 projectId:string;
 adventureId:string;
 rules:{id:'core:rules:classic';version:'1.0.0'};
 catalogueHash:string|null;
 providers:{id:string;version:string}[];
}
export interface InstanceHeader {id:string;name:string;createdAt:string;updatedAt:string;}
interface InstanceIndex {format:'maxxia-instance-index';version:1;entries:InstanceHeader[];}
export interface InstanceSnapshot {
 format:'maxxia-campaign-instance';version:1|2;id:string;name:string;createdAt:string;savedAt:string;
 identity:InstanceIdentity;scoped:ScopedState;campaign:CampaignState;roster?:RosterSnapshot;
}
export interface InstanceSummary extends InstanceHeader{valid:boolean;description:string;}
const slotKey=(id:string,slot:SlotId)=>INSTANCE_PREFIX+id+':'+slot;
const checkId=(id:string)=>{if(!ID.test(id))throw new TypeError('Invalid instance ID.');};
const validateHeader=(entry:unknown):InstanceHeader=>{
 if(!asObject(entry)||typeof entry.id!=='string'||!ID.test(entry.id)||typeof entry.name!=='string'||entry.name.length<1||entry.name.length>64||!entry.name.trim()||typeof entry.createdAt!=='string'||!time.test(entry.createdAt)||typeof entry.updatedAt!=='string'||!time.test(entry.updatedAt))throw new TypeError('Invalid campaign instance index entry.');
 return entry as unknown as InstanceHeader;
};
export function validateInstanceIdentity(value:unknown):InstanceIdentity {
 if(!asObject(value)||typeof value.projectId!=='string'||!PACK.test(value.projectId)||typeof value.adventureId!=='string'||!PACK.test(value.adventureId)||!asObject(value.rules)||value.rules.id!=='core:rules:classic'||value.rules.version!=='1.0.0'||(value.catalogueHash!==null&&(typeof value.catalogueHash!=='string'||!SHA.test(value.catalogueHash)))||!Array.isArray(value.providers)||value.providers.length<1||value.providers.length>128)throw new TypeError('Invalid resolved pack identity.');
 const providers=value.providers;
 if(providers.some(p=>!asObject(p)||typeof p.id!=='string'||!PACK.test(p.id)||typeof p.version!=='string'||!/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(p.version))||providers[0]?.id!=='core'||new Set(providers.map(p=>p.id)).size!==providers.length)throw new TypeError('Invalid or duplicated providers.');
 return {projectId:value.projectId as string,adventureId:value.adventureId as string,rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:value.catalogueHash as string|null,providers:providers.map(p=>({id:p.id as string,version:p.version as string}))};
}
export function validateInstanceSnapshot(input:unknown,registry:MapRegistry,identity:InstanceIdentity):InstanceSnapshot {
 if(!asObject(input)||(input.version===1?Object.keys(input).sort().join(',')!=='campaign,createdAt,format,id,identity,name,savedAt,scoped,version':Object.keys(input).sort().join(',')!=='campaign,createdAt,format,id,identity,name,roster,savedAt,scoped,version')||input.format!=='maxxia-campaign-instance'||![1,2].includes(input.version as number)||typeof input.id!=='string'||!ID.test(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.length>64||typeof input.createdAt!=='string'||!time.test(input.createdAt)||typeof input.savedAt!=='string'||!time.test(input.savedAt))throw new TypeError('Invalid campaign instance snapshot.');
 const lock=validateInstanceIdentity(input.identity),expected=validateInstanceIdentity(identity);
 if(JSON.stringify(lock)!==JSON.stringify(expected))throw new TypeError('This instance requires its exact original adventure and pack versions/hash. Change the enabled pack selection or migrate explicitly in MP10.');
 const campaign=parseCampaign(JSON.stringify(input.campaign),registry),scoped=validateScopedState(input.scoped,registry);
 const roster=input.version===2?validateRoster(input.roster,campaign,lock,input.id as string):undefined;
 return {...input,roster,id:input.id,name:input.name,createdAt:input.createdAt,savedAt:input.savedAt,identity:lock,campaign,scoped} as InstanceSnapshot;
}
export class CampaignInstanceStore {
 private activeId:string|null=null;
 private scope:ScopedState=newScopedState();
 private roster:RosterSnapshot|null=null;
 readonly identity:InstanceIdentity;
 private readonly storage:StorageLike;
 private readonly registry:MapRegistry;
 private readonly transfers:TransferCoordinator;
 constructor(storage:StorageLike,registry:MapRegistry,identity:InstanceIdentity){
  // A half-committed catalogue migration must not expose partially installed saves.
  const upgrade=storage.getItem('world-of-maxxia:upgrade:mp10:journal');
  if(upgrade!==null){let record:unknown;try{record=JSON.parse(upgrade);}catch{throw new TypeError('Damaged save-upgrade journal. Original records preserved; use recovery.');}
   if(!record||typeof record!=='object'||!('status' in record)||record.status==='pending')throw new TypeError('Save upgrade is pending recovery; do not load or overwrite campaign slots.');}
  this.storage=storage;this.registry=registry;this.identity=validateInstanceIdentity(identity);this.readIndex();this.transfers=new TransferCoordinator(storage,registry,this.identity);}
 private readIndex():InstanceIndex {
  const raw=this.storage.getItem(INDEX_KEY);
  if(raw===null)return {format:'maxxia-instance-index',version:1,entries:[]};
  if(jsize(raw)>32768)throw new TypeError('Campaign instance index is oversized; existing data was retained.');
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new TypeError('Campaign instance index is damaged; existing data was retained.');}
  if(!asObject(value)||value.format!=='maxxia-instance-index'||value.version!==1||!Array.isArray(value.entries)||value.entries.length>maxInstances)throw new TypeError('Invalid campaign instance index; existing data was retained.');
  const entries=value.entries.map(validateHeader);
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new TypeError('Duplicate instance IDs in index.');
  return {format:'maxxia-instance-index',version:1,entries};
 }
 private writeIndex(index:InstanceIndex):void{this.storage.setItem(INDEX_KEY,JSON.stringify(index));}
 get currentId():string|null{return this.activeId;}
 getTransferReceipts():TransferReceipt[]{return this.transfers.receipts();}
 /** A successful transfer invalidates the active in-memory session. Reopen its checkpoint. */
 transferCharacter(request:TransferRequest):TransferReceipt {
  const ids=new Set(this.readIndex().entries.map(e=>e.id));
  if(!ids.has(request.sourceInstanceId)||!ids.has(request.destinationInstanceId))throw new TypeError('Both transfer campaigns must be installed in the current library.');
  const receipt=this.transfers.transfer(request);
  // Convenience index timestamps are not part of the transaction authority.
  // Their failure must not undo a fully committed transfer receipt.
  try{const index=this.readIndex(),now=new Date().toISOString();
   for(const e of index.entries)if(e.id===request.sourceInstanceId||e.id===request.destinationInstanceId)e.updatedAt=now;
   this.writeIndex(index);
  }catch{/* Receipt/checkpoint remain authoritative if the index timestamp cannot be updated. */}
  this.activeId=null;this.roster=null;this.scope=newScopedState();
  return receipt;
 }
 recoverTransfers():void{this.transfers.recover();}
 getInstanceAuto(id:string):InstanceSnapshot{return structuredClone(this.read(id,'auto'));}
 /** Swap a preserved reserve into a full active party. No character is removed or copied. */
 swapReserve(id:string,reserveId:string,activeId:string):void {
  const current=this.read(id,'auto');
  const party=current.campaign.party;
  if(current.campaign.combat.active)throw new TypeError('Cannot change the active party during combat.');
  if(!Object.hasOwn(party.characters,reserveId)||party.order.includes(reserveId)||!party.order.includes(activeId))throw new TypeError('Choose a reserve and a different active character.');
  const campaign=structuredClone(current.campaign);
  campaign.party.order[campaign.party.order.indexOf(activeId)]=reserveId;
  if(campaign.party.selectedId===activeId)campaign.party.selectedId=reserveId;
  const prior=this.roster;
  this.roster=current.roster??captureRoster(current.campaign,this.identity,id);
  try{this.saveInternal(id,'auto',campaign,current.scoped);}
  finally{if(this.activeId!==id)this.roster=prior;}
  const index=this.readIndex(),header=index.entries.find(e=>e.id===id);
  if(header){header.updatedAt=new Date().toISOString();this.writeIndex(index);}
 }
 getScopedState():ScopedState{return structuredClone(this.scope);}
 /** A portable roster is a snapshot, not a live transfer transaction. */
 getRosterSnapshot():RosterSnapshot|null{return this.roster?structuredClone(this.roster):null;}
 importCharacterCopy(text:string):CampaignState{
  if(!this.activeId)throw new TypeError('Open a destination instance first');const id=this.activeId,snapshot=this.read(id,'auto'),campaign=copyPortableIntoReserve(snapshot.campaign,text,this.identity,this.registry);
  const roster=captureRoster(campaign,this.identity,id,snapshot.roster),next:InstanceSnapshot={...snapshot,campaign,roster,savedAt:new Date().toISOString()};validateInstanceSnapshot(next,this.registry,this.identity);assertTransferOwnership(next,this.storage);
  const key=slotKey(id,'auto'),old=this.storage.getItem(key);if(old!==null)this.storage.setItem(key+':backup',old);this.storage.setItem(key,JSON.stringify(next));this.roster=roster;this.cacheRoster(roster);return campaign;
 }
 exportCharacter(portableId:string,includeDefinitions=false):string{
  const record=this.roster?.records.find(r=>r.portableId===portableId);
  if(!record)throw new TypeError('Choose an active instance and a known portable character.');
  return exportPortableCharacter(record,includeDefinitions,this.identity.providers);
 }
 private cacheRoster(roster:RosterSnapshot):void{
  // Snapshot is authoritative. Character records are independent, recoverable indexes.
  // A failed cache write must not make an already committed campaign save unusable.
  for(const character of roster.records){
   const key=ROSTER_PREFIX+roster.originInstanceId+':'+character.portableId;
   const older=this.storage.getItem(key);
   if(older){
    try{const old=JSON.parse(older) as {revision:number};if(Number.isSafeInteger(old.revision)&&old.revision>=character.revision)continue;}catch{continue;}
   }
   try{this.storage.setItem(key,JSON.stringify(character));}catch{/* Recoverable from embedded snapshot on next load/save. */}
  }
 }
 setScopedState(value:ScopedState):void{this.scope=structuredClone(validateScopedState(value,this.registry));}
 private read(id:string,slot:SlotId):InstanceSnapshot {
  checkId(id);if(!SLOT_IDS.includes(slot))throw new TypeError('Invalid save slot.');
  this.transfers.recover();
  const raw=this.storage.getItem(slotKey(id,slot));if(raw===null)throw new TypeError('Instance save slot is empty.');
  if(jsize(raw)>MAX_SAVE_BYTES+300000)throw new TypeError('Instance save exceeds maximum size.');
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new TypeError('Instance save is not JSON.');}
  const instance=validateInstanceSnapshot(value,this.registry,this.identity);
  assertTransferOwnership(instance,this.storage);
  if(instance.id!==id)throw new TypeError('Instance identity does not match its storage key.');
  return instance;
 }
 private saveInternal(id:string,slot:SlotId,campaign:CampaignState,scoped:ScopedState,replaceInvalid=false):void {
  const header=this.readIndex().entries.find(e=>e.id===id);if(!header)throw new TypeError('Unknown instance; no save written.');
  const clean=JSON.parse(serializeCampaign(campaign,this.registry)) as CampaignState;
  // Ordinary saves cannot change membership; dedicated receipt/import operations do. Otherwise
  // a stale tab or imported old slot could silently remint a transferred hero UUID.
  const authoritative=this.read(id,'auto');
  if(JSON.stringify(Object.keys(clean.party.characters).sort())!==JSON.stringify(Object.keys(authoritative.campaign.party.characters).sort()))throw new TypeError('Character membership differs from this campaign checkpoint. Reopen its current save; transfers must use receipts.');
  const state=structuredClone(validateScopedState(scoped,this.registry));
  const roster=captureRoster(clean,this.identity,id,this.roster??undefined);
  const snapshot:InstanceSnapshot={format:'maxxia-campaign-instance',version:2,id,name:header.name,createdAt:header.createdAt,savedAt:new Date().toISOString(),identity:this.identity,scoped:state,campaign:clean,roster};
  assertTransferOwnership(snapshot,this.storage);
  const encoded=JSON.stringify(snapshot);if(jsize(encoded)>MAX_SAVE_BYTES+300000)throw new TypeError('Instance save is too large.');
  const key=slotKey(id,slot),old=this.storage.getItem(key);
  if(old!==null){
   try{this.read(id,slot);}catch{if(!replaceInvalid)throw new TypeError('Slot is damaged or incompatible; original retained.');}
   this.storage.setItem(key+':backup',old);
  }
  this.storage.setItem(key,encoded);this.roster=roster;this.cacheRoster(roster);
 }
 listInstances():InstanceSummary[]{return this.readIndex().entries.map(entry=>{
  try{const valid=SLOT_IDS.filter(id=>{try{this.read(entry.id,id);return true;}catch{return false;}});
   return {...entry,valid:valid.length>0,description:valid.length?`${valid.length} valid save slot(s) · ${entry.updatedAt.slice(0,16).replace('T',' ')}`:'Unreadable or incompatible; files preserved'};
  }catch{return {...entry,valid:false,description:'Unreadable or incompatible; files preserved'};}
 });}
 create(name:string,campaign:CampaignState,scoped:ScopedState=newScopedState(),id:string=newInstanceId()):string {
  checkId(id);if(!name.trim()||name.length>64)throw new TypeError('Campaign name must be 1–64 characters.');
  const index=this.readIndex();if(index.entries.length>=maxInstances)throw new RangeError('Maximum of 16 campaign instances reached.');
  if(index.entries.some(e=>e.id===id))throw new TypeError('Instance ID already exists.');
  const now=new Date().toISOString(),header={id,name:name.trim(),createdAt:now,updatedAt:now};
  // Validate all data before writing. The slot write precedes the index commit;
  // failed index writes roll back only the newly-created key.
  const clean=JSON.parse(serializeCampaign(campaign,this.registry)) as CampaignState;
  const cleanScoped=structuredClone(validateScopedState(scoped,this.registry));
  const roster=captureRoster(clean,this.identity,id);
  const snapshot:InstanceSnapshot={format:'maxxia-campaign-instance',version:2,id,name:header.name,createdAt:now,savedAt:now,identity:this.identity,scoped:cleanScoped,campaign:clean,roster};
  const text=JSON.stringify(snapshot);if(jsize(text)>MAX_SAVE_BYTES+300000)throw new TypeError('Instance is too large.');
  const key=slotKey(id,'auto');if(this.storage.getItem(key)!==null)throw new TypeError('Instance storage key already occupied.');
  this.storage.setItem(key,text);
  try{this.writeIndex({...index,entries:[...index.entries,header]});}
  catch(error){this.storage.removeItem(key);throw error;}
  this.activeId=id;this.scope=cleanScoped;this.roster=roster;this.cacheRoster(roster);return id;
 }
 activate(id:string):void {
  const entry=this.readIndex().entries.find(e=>e.id===id);if(!entry)throw new TypeError('Unknown campaign instance.');
  const valid=SLOT_IDS.find(slot=>{try{this.read(id,slot);return true;}catch{return false;}});
  if(!valid)throw new TypeError('This instance has no readable slots for the current catalogue.');
  // Do not commit selection until compatibility is verified.
  const selected=this.read(id,valid);this.activeId=id;this.scope=structuredClone(selected.scoped);this.roster=selected.roster??captureRoster(selected.campaign,this.identity,id);this.cacheRoster(this.roster);
 }
 list():SlotSummary[]{if(!this.activeId)return SLOT_IDS.map(id=>({id,present:false,valid:false,description:'No campaign instance selected'}));
  return SLOT_IDS.map(id=>{const raw=this.storage.getItem(slotKey(this.activeId!,id));if(raw===null)return {id,present:false,valid:false,description:'Empty'};
   try{const snapshot=this.read(this.activeId!,id);return {id,present:true,valid:true,savedAt:snapshot.savedAt,description:`${this.registry[snapshot.campaign.currentMapId].name} · ${snapshot.campaign.elapsedMinutes} min · ${snapshot.savedAt.slice(0,16).replace('T',' ')}`};}
   catch{return {id,present:true,valid:false,description:'Unreadable/incompatible · original retained'};}
  });
 }
 load(slot:SlotId):CampaignState {
  if(!this.activeId)throw new TypeError('Select a campaign instance first.');
  const snapshot=this.read(this.activeId,slot);
  this.scope=structuredClone(snapshot.scoped);this.roster=snapshot.roster??captureRoster(snapshot.campaign,this.identity,this.activeId);this.cacheRoster(this.roster);
  return structuredClone(snapshot.campaign);
 }
 save(slot:SlotId,campaign:CampaignState,replaceInvalid=false):void {
  if(!this.activeId)throw new TypeError('Select a campaign instance first.');
  this.saveInternal(this.activeId,slot,campaign,this.scope,replaceInvalid);
  // Update convenience timestamp after successful state write. A failed index write
  // leaves the committed save intact, recoverable by its existing index entry.
  const index=this.readIndex(),entry=index.entries.find(e=>e.id===this.activeId)!;
  entry.updatedAt=new Date().toISOString();this.writeIndex(index);
 }
 importText(text:string):{campaign:CampaignState;scoped:ScopedState} {
  if(jsize(text)>MAX_SAVE_BYTES+300000)throw new TypeError('Imported file exceeds size limit.');
  let data:unknown;try{data=JSON.parse(text);}catch{throw new TypeError('Imported save is not JSON.');}
  if(asObject(data)&&data.format==='maxxia-campaign-instance'){
   const valid=validateInstanceSnapshot(data,this.registry,this.identity);
   return {campaign:structuredClone(valid.campaign),scoped:structuredClone(valid.scoped)};
  }
  if(asObject(data)&&asObject(data.campaign)&&typeof data.savedAt==='string')data=data.campaign;
  return {campaign:parseCampaign(JSON.stringify(data),this.registry),scoped:newScopedState()};
 }
 exportText(campaign:CampaignState):string {
  if(!this.activeId)throw new TypeError('Select a campaign instance first.');
  const header=this.readIndex().entries.find(e=>e.id===this.activeId)!;
  const valid=JSON.parse(serializeCampaign(campaign,this.registry)) as CampaignState;
  const roster=captureRoster(valid,this.identity,header.id,this.roster??undefined);
  const content:InstanceSnapshot={format:'maxxia-campaign-instance',version:2,id:header.id,name:header.name,createdAt:header.createdAt,savedAt:new Date().toISOString(),identity:this.identity,scoped:this.getScopedState(),campaign:valid,roster};
  return JSON.stringify(content,null,2)+'\n';
 }
}
