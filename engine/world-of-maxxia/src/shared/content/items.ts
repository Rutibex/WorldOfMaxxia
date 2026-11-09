/** MM06: project-owned item definitions. Runtime tables are configured by project boot. */
import defaultItems from './items-default.json' with {type:'json'};
export const ITEM_CATEGORIES=['weapons','armor','accessories','misc'] as const;
export type ItemCategory=typeof ITEM_CATEGORIES[number];
export type ItemSlot='melee'|'ranged'|'body'|'offhand'|'accessory';
export type ItemEffect='none'|'heal'|'antidote'|'wake'|'courage'|'light'|'escape'|'acid'|'spark'|'venom'|'recall'|'identify'|'ward'|'reveal'|'composed';
import {validateExplorationProfile,type ExplorationProfile} from './exploration-contract.ts';
export type ItemPortability='exportable'|'campaign-bound';
export interface EquipRequirements {minLevel?:number;classIds?:string[];raceIds?:string[];}
export interface ItemPassive {attack?:number;defense?:number;}
export interface ItemDefinition {exploration?:ExplorationProfile;attunement?:boolean;equipRequirements?:EquipRequirements;passive?:ItemPassive;curseOnEquip?:boolean;curseOnUse?:boolean;effectId?:string;portability?:ItemPortability;id:string;name:string;category:ItemCategory;price:number;maxDurability:number;maxCharges:number;effect:ItemEffect;power:number;unique:boolean;slot:ItemSlot|null;weight:'light'|'medium'|'heavy'|null;armor:number;dice:string|null;accuracy:number;resistance:string|null;resistBonus:number;description:string;iconResourceId?:string;equipmentTags?:string[];}
export interface ItemDatabase {format:'maxxia-items';version:1;items:ItemDefinition[];}
export class ItemDatabaseError extends Error {code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.code=code;this.path=path;this.name='ItemDatabaseError';}}
const fail=(code:string,path:string,message:string):never=>{throw new ItemDatabaseError(code,path,message);};
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const categories=new Set<string>(ITEM_CATEGORIES);
const slots=new Set<string>(['melee','ranged','body','offhand','accessory']);
const effects=new Set<string>(['none','heal','antidote','wake','courage','light','escape','acid','spark','venom','recall','identify','ward','reveal','composed']);
const weights=new Set<string>(['light','medium','heavy']);
const fields=['id','name','category','price','maxDurability','maxCharges','effect','power','unique','slot','weight','armor','dice','accuracy','resistance','resistBonus','description','iconResourceId'];
export const MAX_ITEMS_BYTES=256*1024;
export function readItemDatabase(input:unknown):ItemDatabase {
 const root=typeof input==='string'?(()=>{if(new TextEncoder().encode(input).byteLength>MAX_ITEMS_BYTES)fail('E_SIZE','$','Items database exceeds 256 KiB.');try{return JSON.parse(input) as unknown;}catch{return fail('E_JSON','$','Invalid JSON.');}})():input;
 if(!isRecord(root)||root.format!=='maxxia-items'||root.version!==1||!Array.isArray(root.items)||root.items.length>1024)fail('E_FORMAT','$','Expected maxxia-items v1 with at most 1024 records.');
 const used=new Set<string>(),items:ItemDefinition[]=[];
 for(const [i,raw] of ((root as {items:unknown[]}).items).entries()){
  const v=raw as Record<string,unknown>;
  const p=`$.items[${i}]`;
  if(!isRecord(v))fail('E_TYPE',p,'Expected object.');
  for(const k of fields.filter(k=>k!=='iconResourceId'))if(!Object.hasOwn(v,k))fail('E_REQUIRED',p+'.'+k,'Required item field missing.');
  if(typeof v.id!=='string'||!(/^(?:item_[a-z0-9_]{1,70}|[a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79})$/.test(v.id))||used.has(v.id))fail('E_ID',p+'.id','Item ID must be unique and stable.');
  used.add(v.id as string);
  if(typeof v.name!=='string'||!v.name.trim()||v.name.length>120||typeof v.description!=='string'||v.description.length>2000)fail('E_TEXT',p,'Name/description length invalid.');
  if(!categories.has(String(v.category)))fail('E_CATEGORY',p+'.category','Unknown category.');
  if(v.effect==='composed'?(typeof v.effectId!=='string'||!/^[a-z][a-z0-9_]{0,31}:ability:[a-z][a-z0-9_]{0,31}$/.test(v.effectId)):v.effectId!==undefined)fail('E_EFFECT',p,'Composed item requires exactly one effect reference');
  if(!effects.has(String(v.effect)))fail('E_EFFECT',p+'.effect','Unknown effect.');
  if(v.slot!==null&&!slots.has(String(v.slot)))fail('E_SLOT',p+'.slot','Unknown slot.');
  if(v.weight!==null&&!weights.has(String(v.weight)))fail('E_WEIGHT',p+'.weight','Unknown weight.');
  if(v.dice!==null&&(typeof v.dice!=='string'||!/^[1-9][0-9]?d(?:[1-9][0-9]?|100)$/.test(v.dice)))fail('E_DICE',p+'.dice','Use NdN dice notation.');
  if(v.resistance!==null&&(typeof v.resistance!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(v.resistance)))fail('E_RESISTANCE',p+'.resistance','Invalid resistance.');
  const ints:Record<string,[number,number]>={price:[0,100000000],maxDurability:[0,10000],maxCharges:[0,10000],power:[0,100000],armor:[0,10000],accuracy:[-1000,1000],resistBonus:[-100,100]};
  for(const [key,[min,max]] of Object.entries(ints))if(!Number.isSafeInteger(v[key])||(v[key] as number)<min||(v[key] as number)>max)fail('E_NUMBER',p+'.'+key,`Expected integer ${min}..${max}.`);
  if(typeof v.unique!=='boolean')fail('E_TYPE',p+'.unique','Expected boolean.');
  if(v.exploration!==undefined&&!validateExplorationProfile(v.exploration))fail('E_EXPLORATION',p+'.exploration','Expected bounded capability profile.');
  if(v.attunement!==undefined&&typeof v.attunement!=='boolean')fail('E_ATTUNEMENT',p+'.attunement','Attunement must be a boolean.');
  for(const flag of ['curseOnEquip','curseOnUse'])if(v[flag]!==undefined&&typeof v[flag]!=='boolean')fail('E_CURSE',p+'.'+flag,'Curse flag must be boolean.');
  if(v.passive!==undefined){if(!isRecord(v.passive)||Object.keys(v.passive).some(k=>!['attack','defense'].includes(k))||Object.values(v.passive).some(n=>!Number.isSafeInteger(n)||Math.abs(n as number)>5))fail('E_PASSIVE',p+'.passive','Expected bounded attack/defense modifiers.');if(v.slot===null)fail('E_PASSIVE',p+'.passive','Passives require equipment.');}
  if(v.equipRequirements!==undefined){const r=v.equipRequirements;if(!isRecord(r)||Object.keys(r).some(k=>!['minLevel','classIds','raceIds'].includes(k)))fail('E_EQUIP_REQUIREMENT',p+'.equipRequirements','Invalid requirement keys.');const req=r as Record<string,unknown>;if(req.minLevel!==undefined&&(!Number.isSafeInteger(req.minLevel)||(req.minLevel as number)<1||(req.minLevel as number)>20))fail('E_EQUIP_REQUIREMENT',p+'.equipRequirements.minLevel','Level must be 1..20.');for(const [k,kind] of [['classIds','class'],['raceIds','race']] as const)if(req[k]!==undefined&&(!Array.isArray(req[k])||req[k].length<1||req[k].length>12||new Set(req[k]).size!==req[k].length||req[k].some(v=>typeof v!=='string'||!(new RegExp('^[a-z][a-z0-9_]{0,47}:'+kind+':[a-z][a-z0-9_]{0,79}$')).test(v))))fail('E_EQUIP_REQUIREMENT',p+'.equipRequirements.'+k,'Invalid qualified IDs.');}
  if(v.portability!==undefined && !['exportable','campaign-bound'].includes(String(v.portability)))fail('E_PORTABILITY',p+'.portability','Item portability must be exportable or campaign-bound.');
  if(v.equipmentTags!==undefined && (!Array.isArray(v.equipmentTags)||v.equipmentTags.length>20||new Set(v.equipmentTags).size!==v.equipmentTags.length||v.equipmentTags.some(t=>typeof t!=='string'||!(/^[a-z][a-z0-9_:]{0,47}$/).test(t))))fail('E_EQUIPMENT_TAGS',p+'.equipmentTags','Expected up to 20 unique equipment tags.');
  if(v.iconResourceId!==undefined&&(typeof v.iconResourceId!=='string'||!(/^(?:asset_[a-z0-9_]{1,89}|[a-z][a-z0-9_]{0,47}:resource:[a-z][a-z0-9_]{0,79})$/.test(v.iconResourceId))))fail('E_ICON',p+'.iconResourceId','Invalid resource ID.');
  if(v.category==='weapons'&&!['melee','ranged'].includes(String(v.slot))||v.category==='armor'&&!['body','offhand'].includes(String(v.slot))||v.category==='accessories'&&v.slot!=='accessory'||v.category==='misc'&&v.slot!==null)fail('E_SLOT',p+'.slot','Slot is incompatible with category.');
  items.push(v as unknown as ItemDefinition);
 }
 return {format:'maxxia-items',version:1,items};
}
/** Stable live table references keep inventory, party, combat and the UI on one source of truth. */
export const ITEMS:Record<string,ItemDefinition>={};
export let ITEM_IDS:string[]=[];
/** Original shipped item artwork remains available to older project manifests. */
export const BASE_ITEM_IDS=new Set((defaultItems as ItemDatabase).items.map(it=>it.id));
export function installItemDatabase(value:unknown):void{
 const parsed=readItemDatabase(value),next=Object.fromEntries(parsed.items.map(it=>[it.id,it])) as Record<string,ItemDefinition>;
 // All validation is finished before touching the active table.
 for(const id of Object.keys(ITEMS))delete ITEMS[id];Object.assign(ITEMS,next);ITEM_IDS=Object.keys(ITEMS);
}
installItemDatabase(defaultItems);
