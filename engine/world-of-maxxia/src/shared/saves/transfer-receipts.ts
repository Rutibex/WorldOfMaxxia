/** MP09: crash-recoverable, local cross-instance transfers. A receipt commits the
 * destination first and the source second. While a receipt is pending, neither
 * instance may be opened: recovery either completes the exact staged bytes or
 * refuses modification. Older save slots cannot reanimate transferred heroes.
 * These protections apply to this local save library; exported files are copyable.
 */
import {parseCampaign,serializeCampaign,type CampaignState,type MapRegistry,MAX_SAVE_BYTES} from '../rules/campaign.ts';
import {validateScopedState} from '../rules/scoped-state.ts';
import {SLOT_IDS,type StorageLike} from './campaign-store.ts';
import {INSTANCE_PREFIX,validateInstanceSnapshot,type InstanceSnapshot,type InstanceIdentity} from './campaign-instances.ts';
import {captureRoster,validateRoster,type PortableCharacter,type RosterSnapshot} from './portable-roster.ts';
import {ITEMS} from '../content/items.ts';
import {itemPortability} from './item-portability.ts';
import {ITEM_LIMIT_PER_CATEGORY,ITEM_LIMIT_TOTAL} from '../rules/inventory.ts';

export const TRANSFER_LEDGER_KEY='world-of-maxxia:transfer:mp09:ledger';
const PREFIX='world-of-maxxia:transfer:mp09:';
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_RECEIPTS=96;
const asObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const bytes=(s:string)=>new TextEncoder().encode(s).length;
function uuid():string {
 if(typeof crypto==='undefined'||!crypto.getRandomValues)throw new TypeError('Cryptographic random is required for transfers.');
 const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export type TransferMode='move'|'copy';
export interface TransferReceipt {
 format:'maxxia-transfer-receipt';version:1;id:string;mode:TransferMode;status:'pending'|'complete';
 sourceInstanceId:string;destinationInstanceId:string;sourcePortableId:string;destinationPortableId:string;
 sourceRevision:number;destinationRevision:number;createdAt:string;completedAt:string|null;
 sourceSlot:'auto';destinationSlot:'auto';benchedCharacterId:string|null;
}
interface Ledger{format:'maxxia-transfer-ledger';version:1;receipts:TransferReceipt[];}
export interface TransferRequest {sourceInstanceId:string;destinationInstanceId:string;portableId:string;mode:TransferMode;id?:string;benchId?:string;}
const empty=():Ledger=>({format:'maxxia-transfer-ledger',version:1,receipts:[]});
const slot=(id:string)=>INSTANCE_PREFIX+id+':auto';
const key=(id:string,kind:'sourceBefore'|'destBefore'|'sourceAfter'|'destAfter')=>PREFIX+id+':'+kind;
function assertReceipt(v:unknown):TransferReceipt{
 if(!asObj(v)||v.format!=='maxxia-transfer-receipt'||v.version!==1||!UID.test(v.id as string)||!['move','copy'].includes(v.mode as string)||!['pending','complete'].includes(v.status as string)||!UID.test(v.sourceInstanceId as string)||!UID.test(v.destinationInstanceId as string)||v.sourceInstanceId===v.destinationInstanceId||!UID.test(v.sourcePortableId as string)||!UID.test(v.destinationPortableId as string)||(v.mode==='move'?v.sourcePortableId!==v.destinationPortableId:v.sourcePortableId===v.destinationPortableId)||!Number.isSafeInteger(v.sourceRevision)||(v.sourceRevision as number)<1||!Number.isSafeInteger(v.destinationRevision)||(v.destinationRevision as number)<1||typeof v.createdAt!=='string'||v.sourceSlot!=='auto'||v.destinationSlot!=='auto'||!(v.benchedCharacterId===null||typeof v.benchedCharacterId==='string')||!(v.completedAt===null||typeof v.completedAt==='string'))throw new TypeError('Damaged transfer receipt; local data retained.');
 return v as unknown as TransferReceipt;
}
export function readTransferLedger(storage:StorageLike):Ledger{
 const raw=storage.getItem(TRANSFER_LEDGER_KEY);if(raw===null)return empty();
 if(bytes(raw)>64000)throw new TypeError('Transfer receipt ledger exceeds its size limit.');
 let data:unknown;try{data=JSON.parse(raw);}catch{throw new TypeError('Transfer ledger is not JSON; existing records preserved.');}
 if(!asObj(data)||data.format!=='maxxia-transfer-ledger'||data.version!==1||!Array.isArray(data.receipts)||data.receipts.length>MAX_RECEIPTS)throw new TypeError('Invalid transfer ledger.');
 const receipts=data.receipts.map(assertReceipt);if(new Set(receipts.map(r=>r.id)).size!==receipts.length)throw new TypeError('Duplicate transfer receipts.');
 return {format:'maxxia-transfer-ledger',version:1,receipts};
}
function saveLedger(storage:StorageLike,ledger:Ledger):void{storage.setItem(TRANSFER_LEDGER_KEY,JSON.stringify(ledger));}
/** Prevent historical manual-slot rewinds from creating a second live owner. */
export function assertTransferOwnership(snapshot:InstanceSnapshot,storage:StorageLike):void {
 const ledger=readTransferLedger(storage);
 if(ledger.receipts.some(r=>r.status==='pending'&&(r.sourceInstanceId===snapshot.id||r.destinationInstanceId===snapshot.id)))throw new TypeError('Transfer pending recovery. Reopen the campaign library to complete it.');
 const latest=new Map<string,{owner:string;minimumRevision:number;receipt:TransferReceipt}>();
 for(const r of ledger.receipts){if(r.status!=='complete')continue;
  if(r.mode==='move')latest.set(r.sourcePortableId,{owner:r.destinationInstanceId,minimumRevision:r.destinationRevision,receipt:r});
  else latest.set(r.destinationPortableId,{owner:r.destinationInstanceId,minimumRevision:r.destinationRevision,receipt:r});
 }
 for(const [portableId,entry] of latest){
  const record=snapshot.roster?.records.find(c=>c.portableId===portableId);
  if(entry.owner===snapshot.id){
   if(!record||record.revision<entry.minimumRevision)throw new TypeError(`Transfer receipt ${entry.receipt.id} requires a newer character snapshot. Historical slot preserved, but cannot reactivate transferred ownership.`);
  }else if(record)throw new TypeError(`Character ${portableId} belongs to another campaign under receipt ${entry.receipt.id}. Historical slot preserved.`);
 }
}
function loadAuto(storage:StorageLike,registry:MapRegistry,identity:InstanceIdentity,id:string):{snapshot:InstanceSnapshot;raw:string}{
 const raw=storage.getItem(slot(id));if(raw===null)throw new TypeError(`Campaign ${id} has no auto checkpoint.`);
 if(bytes(raw)>MAX_SAVE_BYTES+300000)throw new TypeError('Transfer source or destination save is oversized.');
 let data:unknown;try{data=JSON.parse(raw);}catch{throw new TypeError('Transfer source or destination save is damaged.');}
 const snapshot=validateInstanceSnapshot(data,registry,identity);if(snapshot.id!==id)throw new TypeError('Mismatched instance storage key.');
 if(snapshot.version!==2||!snapshot.roster)throw new TypeError('Transfer requires an MP08 v2 autosave; explicitly save the instance before transferring.');
 return {snapshot,raw};
}
function clean(s:CampaignState,registry:MapRegistry):CampaignState{return JSON.parse(serializeCampaign(s,registry)) as CampaignState;}
function mapRecord(incoming:PortableCharacter,dest:CampaignState,mode:TransferMode):{localId:string;character:PortableCharacter}{
 const value=structuredClone(incoming);const suffix=uuid().replaceAll('-','').slice(0,20);const localId='hero_arrival_'+suffix;
 if(Object.hasOwn(dest.party.characters,localId))throw new TypeError('Character local ID collision; retry the transfer.');
 value.character.id=localId;value.originInstanceId=''; // destination owner assigned by caller
 if(mode==='copy'){
  value.portableId=uuid();value.revision=1;
  value.items.forEach(i=>{i.portableId=uuid();i.revision=1;});
 }else{
  value.revision++;
  value.items.forEach(i=>{i.revision++;});
 }
 for(const item of value.items){item.instance.id=`stack_${dest.inventory.nextId++}`;item.instance.ownerId=localId;}
 return {localId,character:value};
}
function plan(source:InstanceSnapshot,destination:InstanceSnapshot,record:PortableCharacter,mode:TransferMode,benchId:string|undefined,registry:MapRegistry):{sourceAfter:string;destAfter:string;arrived:PortableCharacter;benched:string|null}{
 if(source.campaign.combat.active||destination.campaign.combat.active)throw new TypeError('Both campaigns must be outside combat to transfer.');
 if(source.campaign.combat.defeated||destination.campaign.combat.defeated)throw new TypeError('Cannot transfer into or out of a defeated expedition.');
 if(!source.campaign.party.order.includes(record.character.id))throw new TypeError('Only active party characters may depart.');
 if(mode==='move'&&source.campaign.party.order.length<2)throw new TypeError('The last active character cannot leave the source campaign.');
 if(destination.campaign.party.characters&&Object.keys(destination.campaign.party.characters).length>=24)throw new TypeError('Destination has reached its 24-character roster cap.');
 if(destination.roster!.records.some(r=>r.portableId===record.portableId))throw new TypeError('Destination already has this permanent character identity.');
 const target=structuredClone(destination.campaign),outbound=structuredClone(source.campaign);
 let benched:string|null=null;
 if(target.party.order.length===6){
  if(!benchId||!target.party.order.includes(benchId))throw new TypeError('Destination has six active heroes. Explicitly choose one to bench; that character and their items are preserved.');
  benched=benchId;
 }else if(benchId)throw new TypeError('Benching is only needed for a full active party.');
 for(const item of record.items){
  const definition=ITEMS[item.instance.definitionId];if(!definition)throw new TypeError(`Missing item definition ${item.instance.definitionId}.`);
  if(itemPortability(item.instance.definitionId)==='campaign-bound')throw new TypeError(`Campaign-bound item ${item.instance.definitionId} must remain with its original adventure. Store it in the source campaign before transferring.`);
  if(item.source.packId==='firstlight'&&source.identity.adventureId!==destination.identity.adventureId)throw new TypeError(`Firstlight-only item ${item.instance.definitionId} cannot leave its adventure. Store it in the source campaign first.`);
  const owned=record.items.filter(i=>ITEMS[i.instance.definitionId]?.category===definition.category);
  if(owned.length>ITEM_LIMIT_PER_CATEGORY)throw new TypeError('Transferred inventory category exceeds capacity.');
 }
 if(target.inventory.items.length+record.items.length>ITEM_LIMIT_TOTAL||target.inventory.nextId+record.items.length>100000000)throw new TypeError('Destination inventory exceeds engine limits.');
 const mapped=mapRecord(record,target,mode),incoming=mapped.character;incoming.originInstanceId=destination.id;
 if(target.party.order.length===6){target.party.order[target.party.order.indexOf(benched!)]=mapped.localId;}
 else target.party.order.push(mapped.localId);
 target.party.characters[mapped.localId]=structuredClone(incoming.character);if(incoming.character.conditions.some(c=>c.id.includes(':')&&c.unit==='minutes')&&target.magic.effectClock===undefined)target.magic.effectClock=target.elapsedMinutes;
 target.party.selectedId=mapped.localId;
 target.magic.known[mapped.localId]=[...incoming.spellbook.known];
 target.magic.readied[mapped.localId]=incoming.spellbook.readied;
 target.magic.itemCurses[mapped.localId]=[...incoming.spellbook.itemCurses];
 target.inventory.items.push(...incoming.items.map(i=>structuredClone(i.instance)));
 if(mode==='move'){
  const id=record.character.id;
  outbound.party.order=outbound.party.order.filter(v=>v!==id);
  delete outbound.party.characters[id];if(outbound.party.selectedId===id)outbound.party.selectedId=outbound.party.order[0];
  delete outbound.magic.known[id];delete outbound.magic.readied[id];delete outbound.magic.itemCurses[id];
  delete outbound.inventory.backpackSort[id];outbound.inventory.items=outbound.inventory.items.filter(i=>i.ownerId!==id);
 }
 // Revalidate full gameplay and both portable snapshots against the same provider lock.
 const afterTarget=clean(target,registry),afterSource=mode==='copy'?source.campaign:clean(outbound,registry);
 const incomingRoster=captureRoster(afterTarget,destination.identity,destination.id,destination.roster);
 const arrived=incomingRoster.records.find(v=>v.character.id===mapped.localId)!;
 arrived.portableId=incoming.portableId;arrived.revision=incoming.revision;
 for(const it of arrived.items){const kept=incoming.items.find(v=>v.instance.id===it.instance.id)!;it.portableId=kept.portableId;it.revision=kept.revision;it.source=kept.source;}
 const oldItems=new Set(destination.roster!.records.flatMap(r=>r.items.map(i=>i.portableId)));
 if(oldItems.has(arrived.portableId)||arrived.items.some(i=>oldItems.has(i.portableId)))throw new TypeError('Duplicate portable item identity in destination.');
 validateRoster(incomingRoster,afterTarget,destination.identity,destination.id);
 const outboundRoster=mode==='move'?captureRoster(afterSource,source.identity,source.id,source.roster):source.roster!;
 validateRoster(outboundRoster,afterSource,source.identity,source.id);
 const t:InstanceSnapshot={...destination,version:2,savedAt:new Date().toISOString(),campaign:afterTarget,roster:incomingRoster};
 const s:InstanceSnapshot=mode==='copy'?source:{...source,version:2,savedAt:new Date().toISOString(),campaign:afterSource,roster:outboundRoster};
 validateInstanceSnapshot(t,registry,destination.identity);validateInstanceSnapshot(s,registry,source.identity);
 return {sourceAfter:JSON.stringify(s),destAfter:JSON.stringify(t),arrived,benched};
}
/** Stage snapshots and preimages before publishing the pending receipt. */
export class TransferCoordinator {
 private readonly storage:StorageLike;
 private readonly registry:MapRegistry;
 private readonly identity:InstanceIdentity;
 constructor(storage:StorageLike,registry:MapRegistry,identity:InstanceIdentity){this.storage=storage;this.registry=registry;this.identity=identity;}
 receipts():TransferReceipt[]{return structuredClone(readTransferLedger(this.storage).receipts);}
 /** Repeated calls with a durable receipt ID are idempotent; never replay rewards. */
 transfer(request:TransferRequest):TransferReceipt{
  const transactionId=request.id??uuid();if(!UID.test(transactionId))throw new TypeError('Invalid transfer transaction ID.');
  this.recover();
  const ledger=readTransferLedger(this.storage),existing=ledger.receipts.find(r=>r.id===transactionId);
  if(existing){if(existing.sourceInstanceId!==request.sourceInstanceId||existing.destinationInstanceId!==request.destinationInstanceId||existing.sourcePortableId!==request.portableId||existing.mode!==request.mode||(existing.benchedCharacterId??undefined)!==(request.benchId??undefined))throw new TypeError('Transaction ID already used for another request.');this.recover();return readTransferLedger(this.storage).receipts.find(r=>r.id===transactionId)!;}
  if(!['move','copy'].includes(request.mode)||!UID.test(request.sourceInstanceId)||!UID.test(request.destinationInstanceId)||request.sourceInstanceId===request.destinationInstanceId||!UID.test(request.portableId))throw new TypeError('Invalid transfer request.');
  if(ledger.receipts.length>=MAX_RECEIPTS)throw new TypeError('Transfer history limit reached; archive receipts before another transfer.');
  const a=loadAuto(this.storage,this.registry,this.identity,request.sourceInstanceId);
  const b=loadAuto(this.storage,this.registry,this.identity,request.destinationInstanceId);
  assertTransferOwnership(a.snapshot,this.storage);assertTransferOwnership(b.snapshot,this.storage);
  const record=a.snapshot.roster!.records.find(r=>r.portableId===request.portableId);
  if(!record)throw new TypeError('Source character has already left this campaign or its auto slot is stale.');
  const result=plan(a.snapshot,b.snapshot,record,request.mode,request.benchId,this.registry);
  const r:TransferReceipt={format:'maxxia-transfer-receipt',version:1,id:transactionId,mode:request.mode,status:'pending',sourceInstanceId:request.sourceInstanceId,destinationInstanceId:request.destinationInstanceId,sourcePortableId:record.portableId,destinationPortableId:result.arrived.portableId,sourceRevision:record.revision,destinationRevision:result.arrived.revision,createdAt:new Date().toISOString(),completedAt:null,sourceSlot:'auto',destinationSlot:'auto',benchedCharacterId:result.benched};
  const drafts={sourceBefore:a.raw,destBefore:b.raw,sourceAfter:result.sourceAfter,destAfter:result.destAfter};
  for(const [kind,text] of Object.entries(drafts) as [keyof typeof drafts,string][]){
   if(bytes(text)>MAX_SAVE_BYTES+300000)throw new TypeError('Transfer snapshot exceeds maximum size.');
   if(this.storage.getItem(key(transactionId,kind))!==null)throw new TypeError('Transfer staging key already occupied.');
  }
  // Staged data is intentionally inert until the pending ledger entry is durable.
  try{for(const [kind,text] of Object.entries(drafts) as [keyof typeof drafts,string][])this.storage.setItem(key(transactionId,kind),text);
   saveLedger(this.storage,{...ledger,receipts:[...ledger.receipts,r]});
  }catch(error){/* Orphan staged data is inert; retry uses a different ID. */throw error;}
  this.recover();return readTransferLedger(this.storage).receipts.find(v=>v.id===transactionId)!;
 }
 /** Complete a staged transfer after interrupted writes. Never overwrite unrelated edits. */
 recover():void {
  const ledger=readTransferLedger(this.storage);
  for(const r of ledger.receipts){if(r.status!=='pending')continue;
   const staged=Object.fromEntries((['sourceBefore','destBefore','sourceAfter','destAfter'] as const).map(kind=>[kind,this.storage.getItem(key(r.id,kind))])) as Record<'sourceBefore'|'destBefore'|'sourceAfter'|'destAfter',string|null>;
   if(Object.values(staged).some(v=>v===null))throw new TypeError(`Transfer ${r.id} has an incomplete checkpoint. Existing saves retained; manual recovery needed.`);
   const sBefore=validateInstanceSnapshot(JSON.parse(staged.sourceBefore!),this.registry,this.identity);
   const dBefore=validateInstanceSnapshot(JSON.parse(staged.destBefore!),this.registry,this.identity);
   const sAfter=validateInstanceSnapshot(JSON.parse(staged.sourceAfter!),this.registry,this.identity);
   const dAfter=validateInstanceSnapshot(JSON.parse(staged.destAfter!),this.registry,this.identity);
   if(sBefore.id!==r.sourceInstanceId||dBefore.id!==r.destinationInstanceId||sAfter.id!==r.sourceInstanceId||dAfter.id!==r.destinationInstanceId)throw new TypeError('Transfer staged instance IDs mismatch; saves retained.');
   const departing=sBefore.roster!.records.find(v=>v.portableId===r.sourcePortableId);
   const arriving=dAfter.roster!.records.find(v=>v.portableId===r.destinationPortableId);
   if(!departing||departing.revision!==r.sourceRevision||!arriving||arriving.revision!==r.destinationRevision||dBefore.roster!.records.some(v=>v.portableId===r.destinationPortableId)||(r.mode==='move'&&sAfter.roster!.records.some(v=>v.portableId===r.sourcePortableId))||(r.mode==='copy'&&!same(sBefore,sAfter)))throw new TypeError('Transfer staged character/receipt mismatch; saves retained.');
   for(const [id,before,after] of [[r.destinationInstanceId,staged.destBefore!,staged.destAfter!],[r.sourceInstanceId,staged.sourceBefore!,staged.sourceAfter!]] as const){
    const current=this.storage.getItem(slot(id));
    if(current===after)continue;
    if(current!==before)throw new TypeError(`Transfer ${r.id} encountered a modified save. Preserve both checkpoints; no overwrite performed.`);
    this.storage.setItem(slot(id)+':backup',before);
    this.storage.setItem(slot(id),after);
   }
   r.status='complete';r.completedAt=new Date().toISOString();saveLedger(this.storage,ledger);
   for(const kind of ['sourceBefore','destBefore','sourceAfter','destAfter'] as const)this.storage.removeItem(key(r.id,kind));
  }
 }
}
