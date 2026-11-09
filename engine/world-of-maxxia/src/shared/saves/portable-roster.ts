import {RACES,DEFAULT_RACE_ID} from '../content/races.ts';
import {packCondition,listedEffects,effectDefinition} from '../content/effect-definitions.ts';
import {itemPortability} from './item-portability.ts';
/** MP08 portable roster: validated, revisioned character/item records independent of the format-18 simulation.
 * The campaign's character and item IDs remain local compatibility keys. UUIDs are lasting
 * identities, and carry exact definition-provider provenance; transfer is deliberately MP09.
 */
import {validateCampaign,type CampaignState,type MapRegistry} from '../rules/campaign.ts';
import {ITEMS} from '../content/items.ts';
import {CLASSES} from '../content/classes.ts';
import {SPELLS} from '../content/spells.ts';
import type {Character} from '../rules/party.ts';
import type {ItemInstance} from '../rules/inventory.ts';
import type {InstanceIdentity} from './campaign-instances.ts';

export const PORTABLE_ROSTER_FORMAT='maxxia-portable-roster' as const;
export const PORTABLE_CHARACTER_FORMAT='maxxia-portable-character' as const;
export const ROSTER_PREFIX='world-of-maxxia:roster:mp08:';
const UID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEGACY_ITEMS=new Set<string>(["item_bellkeeper_blade", "item_cistern_carapace", "item_custodian_seal", "item_echo_staff", "item_glass_thorn", "item_quayward_charm", "item_regulator_lens", "item_tessa_silver_brooch"]);
const asObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const jsonBytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(v)).length;
function uid():string{
 if(typeof crypto==='undefined'||!crypto.getRandomValues)throw new TypeError('A cryptographic random source is required to allocate portable IDs.');
 const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const s=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
 return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;
}
export interface DefinitionSource{definitionId:string;packId:string;version:string;catalogueHash:string|null;}
export interface PortableItem{portableId:string;revision:number;source:DefinitionSource;instance:ItemInstance;}
export interface PortableCharacter{
 format:typeof PORTABLE_CHARACTER_FORMAT;version:1;portableId:string;revision:number;originInstanceId:string;
 source:DefinitionSource;character:Character;
 spellbook:{known:string[];readied:string|null;itemCurses:string[]};
 items:PortableItem[];
}
export interface RosterSnapshot{
 format:typeof PORTABLE_ROSTER_FORMAT;version:1;originInstanceId:string;
 characterIds:string[];selectedId:string;records:PortableCharacter[];
}
export interface ProviderInspection {available:boolean;missingProviders:string[];}
function sourceFor(id:string,kind:'item'|'class'|'spell',lock:InstanceIdentity):DefinitionSource{
 let packId:string;
 if(id.includes(':')){
  const bits=id.split(':');if(bits.length!==3||bits[1]!==kind||!/^[a-z][a-z0-9_]*$/.test(bits[0]))throw new TypeError(`Invalid ${kind} definition ID ${id}.`);
  packId=bits[0];
 }else packId=kind==='item'&&LEGACY_ITEMS.has(id)?'firstlight':'core';
 if(packId==='firstlight')return {definitionId:id,packId,version:'legacy-adapter-v1',catalogueHash:lock.catalogueHash};
 const provider=lock.providers.find(p=>p.id===packId);
 if(!provider)throw new TypeError(`Missing provider ${packId} required by ${kind} ${id}. Keep the original record; enable the provider before using it.`);
 return {definitionId:id,packId,version:provider.version,catalogueHash:lock.catalogueHash};
}
function assertSource(raw:unknown,definitionId:string,kind:'item'|'class',lock:InstanceIdentity,allowMissing=false):string|null {
 if(!asObject(raw)||raw.definitionId!==definitionId||typeof raw.packId!=='string'||typeof raw.version!=='string'||!(raw.catalogueHash===null||typeof raw.catalogueHash==='string'))throw new TypeError(`Invalid ${kind} source provenance: ${definitionId}.`);
 if(raw.packId==='firstlight'){
  if(kind!=='item'||!LEGACY_ITEMS.has(definitionId)||raw.version!=='legacy-adapter-v1'||!['project_world_of_maxxia','project_mp04_catalogue_proof'].includes(lock.projectId)){if(allowMissing)return 'firstlight@legacy-adapter-v1';throw new TypeError(`Incompatible Firstlight item ${definitionId}.`);}
  return null;
 }
 const wanted=lock.providers.find(p=>p.id===raw.packId);
 if(!wanted||wanted.version!==raw.version){if(allowMissing)return `${raw.packId}@${raw.version}`;throw new TypeError(`Missing provider ${raw.packId}@${raw.version} for ${definitionId}; character data retained. Restore the original pack before importing.`);}
 if(raw.catalogueHash!==lock.catalogueHash){if(allowMissing)return `${raw.packId}@${raw.version} (original catalogue required)`;throw new TypeError(`Catalogue hash changed for ${definitionId}; data retained pending explicit pack migration.`);}
 if(!definitionId.includes(':')&&raw.packId!=='core'||definitionId.includes(':')&&definitionId.split(':')[0]!==raw.packId)throw new TypeError(`Source ownership does not match ${definitionId}.`);
 return null;
}
function spellbookFrom(state:CampaignState,id:string){return {known:[...state.magic.known[id]],readied:state.magic.readied[id],itemCurses:[...state.magic.itemCurses[id]]};}
function recordContentEqual(a:PortableCharacter,b:PortableCharacter):boolean{
 return same(a.source,b.source)&&same(a.character,b.character)&&same(a.spellbook,b.spellbook)&&same(a.items,b.items);
}
/** Build a fresh snapshot without changing party gameplay IDs. Changes advance only the relevant revision. */
export function captureRoster(state:CampaignState,lock:InstanceIdentity,instanceId:string,previous?:RosterSnapshot):RosterSnapshot{
 if(!UID.test(instanceId))throw new TypeError('Invalid roster owner instance ID.');
 const previousRecords=new Map(previous?.records.map(r=>[r.character.id,r])??[]);
 const records:Object[]=[],all=Object.keys(state.party.characters).sort();
 for(const id of all){
  const c=structuredClone(state.party.characters[id]),prior=previousRecords.get(id);
  const items:PortableItem[]=state.inventory.items.filter(i=>i.ownerId===id).map(i=>{
   const old=prior?.items.find(p=>p.instance.id===i.id),next={portableId:old?.portableId??uid(),revision:old?.revision??1,source:sourceFor(i.definitionId,'item',lock),instance:structuredClone(i)};
   if(old&&!same({...next,revision:old.revision},{...old}))next.revision=old.revision+1;
   return next;
  }).sort((a,b)=>a.instance.id.localeCompare(b.instance.id));
  const next:PortableCharacter={format:PORTABLE_CHARACTER_FORMAT,version:1,portableId:prior?.portableId??uid(),revision:prior?.revision??1,originInstanceId:instanceId,
   source:sourceFor(c.classId,'class',lock),character:c,spellbook:spellbookFrom(state,id),items};
  // Item revisions are part of the character's revision, including a new stack.
  if(prior&&!recordContentEqual(next,prior))next.revision=prior.revision+1;
  records.push(next);
 }
 const roster: RosterSnapshot={format:PORTABLE_ROSTER_FORMAT,version:1,originInstanceId:instanceId,characterIds:[...state.party.order],selectedId:state.party.selectedId,records:records as PortableCharacter[]};
 validateRoster(roster,state,lock,instanceId);return roster;
}
/** Enforce one-to-one correspondence between the authoritative campaign and its portable snapshot. */
export function validateRoster(raw:unknown,state:CampaignState,lock:InstanceIdentity,instanceId:string):RosterSnapshot {
 if(!asObject(raw)||raw.format!==PORTABLE_ROSTER_FORMAT||raw.version!==1||raw.originInstanceId!==instanceId||!Array.isArray(raw.records)||raw.records.length!==Object.keys(state.party.characters).length||raw.records.length>24||!Array.isArray(raw.characterIds)||!same(raw.characterIds,state.party.order)||raw.selectedId!==state.party.selectedId)throw new TypeError('Portable roster and campaign membership differ.');
 const ids=new Set<string>(),itemIds=new Set<string>(),itemLocalIds=new Set<string>(),localHeroIds=new Set<string>();
 for(const r of raw.records){
  if(!asObject(r)||r.format!==PORTABLE_CHARACTER_FORMAT||r.version!==1||typeof r.portableId!=='string'||!UID.test(r.portableId)||ids.has(r.portableId)||!Number.isSafeInteger(r.revision)||(r.revision as number)<1||(r.revision as number)>100000000||r.originInstanceId!==instanceId||!asObject(r.character)||typeof r.character.id!=='string'||localHeroIds.has(r.character.id)||!state.party.characters[r.character.id]||!same(r.character,state.party.characters[r.character.id])||!asObject(r.spellbook)||!same(r.spellbook,spellbookFrom(state,r.character.id))||!Array.isArray(r.items))throw new TypeError('Invalid or stale portable character record.');
  ids.add(r.portableId);localHeroIds.add((r.character as {id:string}).id);assertSource(r.source,r.character.classId as string,'class',lock);
  const owned=state.inventory.items.filter(i=>i.ownerId===(r.character as {id:string}).id);
  if(r.items.length!==owned.length)throw new TypeError(`Inventory mismatch for ${r.character.id}.`);
  const seenLocal=new Set<string>();
  for(const it of r.items){
   if(!asObject(it)||typeof it.portableId!=='string'||!UID.test(it.portableId)||itemIds.has(it.portableId)||!Number.isSafeInteger(it.revision)||(it.revision as number)<1||(it.revision as number)>100000000||!asObject(it.instance)||typeof it.instance.id!=='string'||seenLocal.has(it.instance.id)||itemLocalIds.has(it.instance.id))throw new TypeError('Invalid or duplicated portable item identity.');
   itemIds.add(it.portableId);seenLocal.add(it.instance.id);itemLocalIds.add(it.instance.id);
   if(!owned.some(i=>same(i,it.instance)))throw new TypeError(`Portable item ${it.instance.id} differs from the campaign item.`);
   assertSource(it.source,it.instance.definitionId as string,'item',lock);
  }
 }
 if(itemLocalIds.size!==state.inventory.items.length)throw new TypeError('Inventory has unrepresented items.');
 if(jsonBytes(raw)>MAX_ROSTER_BYTES)throw new TypeError('Portable roster exceeds 256 KiB.');
 return structuredClone(raw) as unknown as RosterSnapshot;
}
export const MAX_ROSTER_BYTES=256*1024;
/** Include future level-grants as well as already learned powers in definition snapshots. */
function portableRelatedAbilities(hero:import('../rules/party.ts').Character){
 const cls=CLASSES[hero.classId],race=RACES[hero.raceId??DEFAULT_RACE_ID];
 const grants=new Set([...(cls?.abilityGrants??[]),...(cls?.creationChoices?.find(c=>c.id===hero.creationChoiceId)?.abilityGrants??[]),...(race?.abilityGrants??[])].map(g=>g.id));
 return listedEffects().filter(e=>e.activation && (e.activation.classes.includes(hero.classId)||grants.has(e.id)||hero.abilityState?.learned.includes(e.id)||Object.hasOwn(hero.abilityState?.cooldowns??{},e.id)));
}
/** Portable character files retain the same permanent IDs across an export/import inspection. */
export function exportPortableCharacter(record:PortableCharacter,includeDefinitions=false,providers:readonly {id:string;version:string}[]=[]):string{
 if(!asObject(record)||record.format!==PORTABLE_CHARACTER_FORMAT||!UID.test(record.portableId))throw new TypeError('Not a portable character.');
 // Plot objects remain in the campaign save, but never in a portable export.
 const exportableItems=record.items.filter(i=>itemPortability(i.instance.definitionId)==='exportable');
 const excluded=new Set(record.items.filter(i=>itemPortability(i.instance.definitionId)!=='exportable').map(i=>i.instance.id));
 if(record.items.some(i=>excluded.has(i.instance.id)&&!!i.instance.equipped))throw new TypeError('Unequip campaign-bound equipment before exporting.');
 const outward={...record,items:exportableItems};
 const related=portableRelatedAbilities(record.character);
 const raceId=record.character.raceId??DEFAULT_RACE_ID;const race=RACES[raceId];if(!race)throw new TypeError("Missing portable race provider: "+raceId);const definitions=Object.fromEntries([[record.character.classId,CLASSES[record.character.classId]],[raceId,race],...related.map(e=>[e.id,e]),...exportableItems.map(i=>[i.instance.definitionId,ITEMS[i.instance.definitionId]]),...record.spellbook.known.map(id=>[id,SPELLS[id]]),...record.character.conditions.filter(c=>c.id.includes(':')).map(c=>[c.id,packCondition(c.id)])]);const conditionProviders=Object.fromEntries(record.character.conditions.filter(c=>c.id.includes(':')).map(c=>{const ns=c.id.split(':')[0],version=providers.find(p=>p.id===ns)?.version;if(includeDefinitions&&!version)throw new TypeError('Missing condition provider provenance: '+ns);return [ns,version];}));const abilityProviders=Object.fromEntries(related.map(e=>{const ns=e.id.split(':')[0],version=providers.find(p=>p.id===ns)?.version;if(includeDefinitions&&!version)throw new TypeError('Missing ability provider provenance: '+ns);return [ns,version];}));const raceProviderVersion=providers.find(p=>p.id===raceId.split(':')[0])?.version;if(includeDefinitions&&!raceProviderVersion)throw new TypeError('Missing race provider version: '+raceId);const raceProviders={[raceId.split(':')[0]]:raceProviderVersion};const data=JSON.stringify(includeDefinitions?{...outward,definitionSnapshots:definitions,conditionProviders,abilityProviders,raceProviders}:outward,null,2)+'\n';if(new TextEncoder().encode(data).length>65536)throw new TypeError('Portable character export is oversized.');return data;
}
export function inspectPortableCharacter(text:string,lock:InstanceIdentity):{record:PortableCharacter;providers:ProviderInspection}{
 if(new TextEncoder().encode(text).length>65536)throw new TypeError('Portable character file exceeds 64 KiB.');
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw new TypeError('Portable character file is invalid JSON.');}
 if(!asObject(raw)||raw.format!==PORTABLE_CHARACTER_FORMAT||raw.version!==1||!UID.test(raw.portableId as string)||!Number.isSafeInteger(raw.revision)||(raw.revision as number)<1||!asObject(raw.character)||typeof raw.character.id!=='string'||!asObject(raw.spellbook)||!Array.isArray(raw.items)||raw.items.length>216||!UID.test(raw.originInstanceId as string))throw new TypeError('Invalid portable character file.');
 const missing=new Set<string>();
 const check=(p:unknown,id:string,kind:'item'|'class')=>{const absent=assertSource(p,id,kind,lock,true);if(absent)missing.add(absent);};
 check(raw.source,raw.character.classId as string,'class');
 if(asObject(raw.raceProviders))for(const [ns,v]of Object.entries(raw.raceProviders)){if(typeof v!=='string'||!lock.providers.some(p=>p.id===ns&&p.version===v))missing.add(`${ns}@${String(v)}`);}
 if(asObject(raw.abilityProviders))for(const [ns,v]of Object.entries(raw.abilityProviders)){if(typeof v!=='string'||!lock.providers.some(p=>p.id===ns&&p.version===v))missing.add(`${ns}@${String(v)}`);}
 const ids=new Set<string>(),locals=new Set<string>();for(const item of raw.items){if(!asObject(item)||!UID.test(item.portableId as string)||ids.has(item.portableId as string)||!Number.isSafeInteger(item.revision)||(item.revision as number)<1||!asObject(item.instance)||typeof item.instance.definitionId!=='string'||typeof item.instance.id!=='string'||locals.has(item.instance.id))throw new TypeError('Invalid portable item record.');ids.add(item.portableId as string);locals.add(item.instance.id as string);check(item.source,item.instance.definitionId,'item');}
 // If a provider is absent we may inspect/store the opaque record but not evaluate it with live rules.
 if(!missing.size){
  if(!Object.hasOwn(CLASSES,raw.character.classId as string))throw new TypeError('Portable character class definition is not installed.');
  if(!Object.hasOwn(RACES,(raw.character.raceId as string|undefined)??DEFAULT_RACE_ID))throw new TypeError('Portable character race definition is not installed.');
  for(const i of raw.items)if(!Object.hasOwn(ITEMS,(i as PortableItem).instance.definitionId))throw new TypeError(`Portable item definition ${(i as PortableItem).instance.definitionId} is not installed.`);
  for(const spell of ((raw.spellbook as {known?:unknown}).known instanceof Array?(raw.spellbook as {known:string[]}).known:[]))if(!SPELLS[spell as string])throw new TypeError(`Portable spell definition ${String(spell)} unavailable.`);
 }
 return {record:structuredClone(raw) as unknown as PortableCharacter,providers:{available:missing.size===0,missingProviders:[...missing].sort()}};
}
/** Independent staging area; never inserts an imported hero into a running campaign (MP09). */
export class PortableRosterVault{
 private readonly storage:{getItem(k:string):string|null;setItem(k:string,v:string):void;removeItem(k:string):void};
 constructor(storage:{getItem(k:string):string|null;setItem(k:string,v:string):void;removeItem(k:string):void}){this.storage=storage;}
 importText(text:string,lock:InstanceIdentity):ProviderInspection{
  const {record,providers}=inspectPortableCharacter(text,lock),key=ROSTER_PREFIX+'staged:'+record.portableId,old=this.storage.getItem(key);
  if(old!==null&&old!==JSON.stringify(record))throw new TypeError('Portable ID already staged with different content; no record overwritten.');
  if(old===null)this.storage.setItem(key,JSON.stringify(record));return providers;
 }
 exportText(id:string):string{if(!UID.test(id))throw new TypeError('Invalid portable ID.');const raw=this.storage.getItem(ROSTER_PREFIX+'staged:'+id);if(!raw)throw new TypeError('Unknown staged character.');return raw+'\n';}
}

/** MP17 explicit file-copy admission. Exact exported definition snapshots must match;
 * provider versions are checked before rebinding catalogue provenance on the new copy. */
export function copyPortableIntoReserve(source:CampaignState,text:string,lock:InstanceIdentity,registry:MapRegistry):CampaignState{
 if(text.length>65536)throw new TypeError('Portable file exceeds64 KiB');const envelope=JSON.parse(text);
 if(!asObject(envelope)||!asObject(envelope.definitionSnapshots)||!asObject(envelope.character)||!Array.isArray(envelope.items)||!asObject(envelope.spellbook)||!Array.isArray(envelope.spellbook.known))throw new TypeError('Export this character again with definition snapshots before copying across catalogues');
 const raw=envelope as unknown as PortableCharacter & {definitionSnapshots:Record<string,unknown>;conditionProviders?:Record<string,string>;abilityProviders?:Record<string,string>;raceProviders?:Record<string,string>};
 const stable=(v:unknown):string=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
 const check=(id:string,definition:unknown)=>{if(!definition||stable(raw.definitionSnapshots[id])!==stable(definition))throw new TypeError('Definition changed or missing: '+id);};
 check(raw.character.classId,CLASSES[raw.character.classId]);const sourceRaceId=raw.character.raceId??DEFAULT_RACE_ID;if(sourceRaceId!==DEFAULT_RACE_ID||raw.raceProviders){check(sourceRaceId,RACES[sourceRaceId]);const ns=sourceRaceId.split(':')[0];if(!raw.raceProviders?.[ns]||!lock.providers.some(p=>p.id===ns&&p.version===raw.raceProviders![ns]))throw new TypeError('Missing race provider version');}for(const i of raw.items){if(!asObject(i)||!asObject(i.instance))throw new TypeError('Invalid portable inventory');check(i.instance.definitionId,ITEMS[i.instance.definitionId]);if(itemPortability(i.instance.definitionId)==='campaign-bound')throw new TypeError('Campaign-bound items cannot leave their adventure');if(ITEMS[i.instance.definitionId].unique&&(source.inventory.items.some(v=>v.definitionId===i.instance.definitionId)||source.ground.containers.some(c=>c.entries.some(e=>e.item?.definitionId===i.instance.definitionId))))throw new TypeError('Unique item already exists in destination');}
 for(const id of raw.spellbook.known)check(id,SPELLS[id]);for(const c of raw.character.conditions??[])if(c.id.includes(':')){check(c.id,packCondition(c.id));const ns=c.id.split(':')[0];if(!raw.conditionProviders?.[ns]||!lock.providers.some(p=>p.id===ns&&p.version===raw.conditionProviders![ns]))throw new TypeError('Missing condition provider version');}
 const related=portableRelatedAbilities(raw.character);
 for(const ability of related){check(ability.id,ability);const ns=ability.id.split(':')[0];if(!raw.abilityProviders?.[ns]||!lock.providers.some(p=>p.id===ns&&p.version===raw.abilityProviders![ns]))throw new TypeError('Missing ability provider version');}
 for(const id of raw.character.abilityState?.learned??[])if(!effectDefinition(id))throw new TypeError('Learned ability provider unavailable: '+id);
 const copy=structuredClone(raw);const rebind=(p:unknown)=>{if(!asObject(p)||!lock.providers.some(v=>v.id===p.packId&&v.version===p.version))throw new TypeError('Exact definition provider must be enabled');p.catalogueHash=lock.catalogueHash;};rebind(copy.source);for(const i of copy.items)rebind(i.source);
 const {record,providers}=inspectPortableCharacter(JSON.stringify(copy),lock);if(!providers.available)throw new TypeError('Required providers are unavailable');
 if(source.combat.active||source.combat.defeated||Object.keys(source.party.characters).length>=24)throw new TypeError('Destination is unavailable or its roster is full');
 const id='hero_copy_'+record.portableId.replaceAll('-','');if(source.party.characters[id])throw new TypeError('This file has already been copied into the destination');
 const next=structuredClone(source),hero=structuredClone(record.character);if(hero.conditions.some(c=>c.id.includes(':')&&c.unit==='minutes')&&next.magic.effectClock===undefined)next.magic.effectClock=next.elapsedMinutes;hero.id=id;next.party.characters[id]=hero;next.magic.known[id]=[...record.spellbook.known];next.magic.readied[id]=record.spellbook.readied;next.magic.itemCurses[id]=[...record.spellbook.itemCurses];
 for(const item of record.items)next.inventory.items.push({...structuredClone(item.instance),id:'stack_'+next.inventory.nextId++,ownerId:id});
 // New permanent identities are assigned by the ordinary roster snapshot at save.
 return validateCampaign(next,registry);
}
