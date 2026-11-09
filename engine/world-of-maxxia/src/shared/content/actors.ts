/** MM08: authored actors and four-state portrait sets; numeric portrait values remain save compatible. */
import baseline from './actors-default.json' with {type:'json'};
import {CLASSES,ABILITIES} from './classes.ts';
import {ITEMS} from './items.ts';
import {canEquip} from './classes.ts';
import type {Attributes,ClassId} from './party.ts';
export const PORTRAIT_STATES=['normal','hurt','afflicted','dead'] as const;
export type PortraitState=typeof PORTRAIT_STATES[number];
export interface PortraitSet {id:string;name:string;legacyIndex?:number;states:Record<PortraitState,string>;}
export interface ActorSeed {id:string;name:string;classId:ClassId;portraitId:string;portrait:number;age:number;heritage:string;attributes:Attributes;equipment:{melee:string|null;ranged:string|null;body:string|null;offhand:string|null;preferredAttack:'melee'|'ranged'};}
export interface ActorDatabase {format:'maxxia-actors';version:1;portraits:PortraitSet[];actors:ActorSeed[];startingParty:string[];}
export const MAX_ACTORS_BYTES=256*1024;
export class ActorDatabaseError extends Error {code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.code=code;this.path=path;this.name='ActorDatabaseError';}}
const fail=(code:string,path:string,message:string):never=>{throw new ActorDatabaseError(code,path,message);};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const actorId=/^hero_[a-z0-9_]{1,90}$/;
const portraitId=/^portrait_[a-z0-9_]{1,90}$/;
const assetId=/^asset_[a-z0-9_]{1,89}$/;
export function readActorDatabase(input:unknown):ActorDatabase {
 let raw:unknown=input;
 if(typeof input==='string'){if(new TextEncoder().encode(input).length>MAX_ACTORS_BYTES)fail('E_SIZE','$','Actors database exceeds 256 KiB.');try{raw=JSON.parse(input);}catch{fail('E_JSON','$','Invalid actor JSON.');}}
 if(!obj(raw)||raw.format!=='maxxia-actors'||raw.version!==1||!Array.isArray(raw.actors)||!Array.isArray(raw.portraits)||!Array.isArray(raw.startingParty)||raw.actors.length<1||raw.actors.length>128||raw.portraits.length<1||raw.portraits.length>128||raw.startingParty.length<1||raw.startingParty.length>6)fail('E_FORMAT','$','Expected maxxia-actors v1 (1–128 actors and portraits, 1–6 starters).');
 const database=raw as Record<string,unknown> & {actors:Record<string,unknown>[];portraits:Record<string,unknown>[];startingParty:string[]};
 const portraits=new Set<string>(),legacy=new Set<number>();
 for(const [i,p] of database.portraits.entries()){
  const at=`$.portraits[${i}]`;
  if(!obj(p)||typeof p.id!=='string'||!portraitId.test(p.id)||portraits.has(p.id))fail('E_PORTRAIT_ID',at,'Invalid or repeated portrait ID.');
  portraits.add(p.id as string);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>100)fail('E_PORTRAIT_NAME',at+'.name','Invalid portrait name.');
  if(p.legacyIndex!==undefined){if(!Number.isInteger(p.legacyIndex)||(p.legacyIndex as number)<0||(p.legacyIndex as number)>11||legacy.has(p.legacyIndex as number))fail('E_LEGACY_PORTRAIT',at,'Invalid or repeated historical portrait number.');legacy.add(p.legacyIndex as number);}
  if(!obj(p.states))fail('E_PORTRAIT_STATES',at+'.states','Missing four portrait states.');
  for(const state of PORTRAIT_STATES)if(typeof (p.states as Record<string,unknown>)[state]!=='string'||!assetId.test((p.states as Record<string,unknown>)[state] as string))fail('E_PORTRAIT_RESOURCE',at+'.states.'+state,'Expected a catalogue image resource ID.');
 }
 const ids=new Set<string>();
 for(const [i,a] of database.actors.entries()){
  const at=`$.actors[${i}]`;
  if(!obj(a)||typeof a.id!=='string'||!actorId.test(a.id)||ids.has(a.id))fail('E_ACTOR_ID',at+'.id','Invalid or duplicate actor ID.');ids.add(a.id as string);
  if(typeof a.name!=='string'||!a.name.trim()||a.name.length>24||/[\x00-\x1f\x7f<>]/.test(a.name))fail('E_NAME',at+'.name','Name must be 1–24 printable characters.');
  if(typeof a.classId!=='string'||!Object.hasOwn(CLASSES,a.classId))fail('E_CLASS',at+'.classId','Unknown class ID.');
  if(typeof a.portraitId!=='string'||!portraits.has(a.portraitId)||!Number.isInteger(a.portrait)||(a.portrait as number)<0||(a.portrait as number)>11)fail('E_PORTRAIT',at+'.portraitId','Unknown portrait ID or invalid legacy index.');
  if(!Number.isInteger(a.age)||(a.age as number)<1||(a.age as number)>999||typeof a.heritage!=='string'||a.heritage.length>100)fail('E_IDENTITY',at,'Invalid age or heritage.');
  if(!obj(a.attributes)||ABILITIES.some(k=>!Number.isInteger((a.attributes as Record<string,unknown>)[k])||((a.attributes as Record<string,unknown>)[k] as number)<1||((a.attributes as Record<string,unknown>)[k] as number)>18))fail('E_ATTRIBUTES',at+'.attributes','Attributes must be integers 1–18.');
  if(!obj(a.equipment)||!['melee','ranged'].includes(a.equipment.preferredAttack as string))fail('E_EQUIPMENT',at+'.equipment','Invalid equipped attack preference.');
  for(const slot of ['melee','ranged','body','offhand'] as const){const id=(a.equipment as Record<string,unknown>)[slot];if(id!==null&&(typeof id!=='string'||!ITEMS[id as string]||ITEMS[id as string].slot!==slot||!canEquip(a.classId as string,ITEMS[id as string])))fail('E_EQUIPMENT',at+'.equipment.'+slot,'Unknown, misplaced or forbidden starting equipment.');}
 }
 const starts=new Set<string>();for(const [i,id] of database.startingParty.entries())if(typeof id!=='string'||!ids.has(id)||starts.has(id))fail('E_START',`$.startingParty[${i}]`,'Starter must reference an existing unique actor.');else starts.add(id);
 return raw as unknown as ActorDatabase;
}
export const ACTORS:Record<string,ActorSeed>={};
export const PORTRAITS:Record<string,PortraitSet>={};
export const PORTRAIT_ORDER:string[]=[];
export const DEFAULT_PARTY:string[]=[];
export function installActorDatabase(data:unknown):void {
 const valid=readActorDatabase(data);
 for(const id of Object.keys(ACTORS))delete ACTORS[id];for(const id of Object.keys(PORTRAITS))delete PORTRAITS[id];
 Object.assign(ACTORS,Object.fromEntries(valid.actors.map(x=>[x.id,x])));
 Object.assign(PORTRAITS,Object.fromEntries(valid.portraits.map(x=>[x.id,x])));
 PORTRAIT_ORDER.splice(0,PORTRAIT_ORDER.length,...valid.portraits.map(p=>p.id));
 DEFAULT_PARTY.splice(0,DEFAULT_PARTY.length,...valid.startingParty);
}
export function resetActorDatabase():void{installActorDatabase(baseline);}
export function portraitForLegacyNumber(index:number):string {return Object.values(PORTRAITS).find(p=>p.legacyIndex===index)?.id??PORTRAIT_ORDER[0];}
export function portraitIndex(id:string):number{return PORTRAIT_ORDER.indexOf(id);}
installActorDatabase(baseline);
