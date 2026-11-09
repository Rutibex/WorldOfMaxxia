/** MM15 reusable loot tables and project-authored persistent ground pickups.
 * Definitions never enter saves: only generated item instances and mutated ground state do.
 */
import baselineLoot from './loot-default.json' with {type:'json'};
import baselinePickups from './pickups-default.json' with {type:'json'};
import {ITEMS} from './items.ts';
import {MONSTERS} from './monsters.ts';
import {ENCOUNTER_SEEDS} from './encounters.ts';
import {PLOT_ITEMS} from '../rules/quests.ts';
import {tileAt,type GridMap} from '../rules/grid.ts';
export const MAX_LOOT_BYTES=256*1024,MAX_PICKUPS_BYTES=256*1024;
export interface LootEntry {itemId:string;chance:number;min:number;max:number;memberIndex:number;}
export interface LootTable {id:string;name:string;entries:LootEntry[];}
export interface LootAssignment {encounterId:string;tableId:string;}
export interface LootDatabase {format:'maxxia-loot-tables';version:1;tables:LootTable[];assignments:LootAssignment[];}
export interface PickupItem {itemId:string;count:number;}
export interface PickupDefinition {id:string;mapId:string;x:number;y:number;name:string;gold:number;items:PickupItem[];legacyQuest?:{sceneId:string;plotId:string};questItemId?:string;}
export interface PickupDatabase {format:'maxxia-ground-pickups';version:1;pickups:PickupDefinition[];}
export class LootDataError extends Error {readonly code:string;readonly path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.name='LootDataError';this.code=code;this.path=path;}}
const fail=(code:string,path:string,reason:string):never=>{throw new LootDataError(code,path,reason);};
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const stable=/^[a-z][a-z0-9_]{1,79}$/;
const int=(v:unknown,a:number,b:number):v is number=>Number.isSafeInteger(v)&&(v as number)>=a&&(v as number)<=b;
function decode(raw:unknown,max:number,label:string):unknown {
 if(typeof raw!=='string')return raw;
 if(new TextEncoder().encode(raw).byteLength>max)fail('E_SIZE','$',`${label} exceeds ${max} bytes.`);
 try{return JSON.parse(raw);}catch{return fail('E_JSON','$',`Invalid ${label} JSON.`);}
}
export function readLootDatabase(raw:unknown):LootDatabase {
 const value=decode(raw,MAX_LOOT_BYTES,'Loot database');
 if(!record(value)||value.format!=='maxxia-loot-tables'||value.version!==1||!Array.isArray(value.tables)||value.tables.length>256||!Array.isArray(value.assignments)||value.assignments.length>512)fail('E_FORMAT','$','Expected maxxia-loot-tables version 1.');
 const db=value as unknown as LootDatabase,ids=new Set<string>(),assigned=new Set<string>();
 for(const [i,t]of db.tables.entries()){
  const p=`$.tables[${i}]`;
  if(!record(t)||typeof t.id!=='string'||!stable.test(t.id)||ids.has(t.id))fail('E_ID',p+'.id','Invalid or duplicate loot table ID.');ids.add(t.id);
  if(typeof t.name!=='string'||!t.name.trim()||t.name.length>100||!Array.isArray(t.entries)||t.entries.length>48)fail('E_TABLE',p,'Invalid name or more than 48 loot entries.');
  for(const [j,e]of t.entries.entries()){
   const q=`${p}.entries[${j}]`;
   if(!record(e)||typeof e.itemId!=='string'||!stable.test(e.itemId)||!ITEMS[e.itemId]||!int(e.chance,0,100)||!int(e.min,1,20)||!int(e.max,e.min,20)||!int(e.memberIndex,0,2))fail('E_ENTRY',q,'Invalid item, chance, quantity, or member index.');
   if(ITEMS[e.itemId].unique&&(e.min!==1||e.max!==1))fail('E_UNIQUE',q,'Unique items must have quantity one.');
  }
 }
 for(const [i,a]of db.assignments.entries()){
  const p=`$.assignments[${i}]`;
  if(!record(a)||typeof a.encounterId!=='string'||!stable.test(a.encounterId)||assigned.has(a.encounterId)||!ids.has(a.tableId))fail('E_ASSIGNMENT',p,'Duplicate encounter assignment or missing table.');
  assigned.add(a.encounterId);
 }
 return db;
}
export function readPickupDatabase(raw:unknown):PickupDatabase {
 const value=decode(raw,MAX_PICKUPS_BYTES,'Ground pickups');
 if(!record(value)||value.format!=='maxxia-ground-pickups'||value.version!==1||!Array.isArray(value.pickups)||value.pickups.length>128)fail('E_FORMAT','$','Expected maxxia-ground-pickups version 1.');
 const db=value as unknown as PickupDatabase,ids=new Set<string>(),scenes=new Set<string>();let startingEntries=0;
 for(const [i,p]of db.pickups.entries()){
  const q=`$.pickups[${i}]`;
  if(!record(p)||typeof p.id!=='string'||!stable.test(p.id)||ids.has(p.id)||p.id.length>73||typeof p.mapId!=='string'||!stable.test(p.mapId)||!int(p.x,0,63)||!int(p.y,0,63)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||!int(p.gold,0,1000000)||!Array.isArray(p.items)||p.items.length>24)fail('E_PICKUP',q,'Invalid pickup ID, position, name, gold or item count.');ids.add(p.id);
  for(const [j,item]of p.items.entries()){
   if(!record(item)||typeof item.itemId!=='string'||!ITEMS[item.itemId]||!int(item.count,1,20)||ITEMS[item.itemId].unique&&item.count!==1)fail('E_ITEM',`${q}.items[${j}]`,'Invalid item reference or stack quantity.');
  }
  startingEntries+=p.items.length+(p.legacyQuest!==undefined?1:0)+(p.questItemId!==undefined?1:0);
  if(startingEntries>400)fail('E_BUDGET',q,'Starting ground entries exceed the save-state budget of 400.');
  if(p.questItemId!==undefined){
   if(typeof p.questItemId!=='string'||!/^item_quest_[a-z0-9_]{1,65}$/.test(p.questItemId)||PLOT_ITEMS.includes(p.questItemId as typeof PLOT_ITEMS[number])||p.legacyQuest!==undefined)fail('E_QUEST_ID',q+'.questItemId','Custom quest item ID must be a new item_quest_* ID, never a reserved legacy quest ID.');
  }
  if(p.legacyQuest!==undefined){
   const v=p.legacyQuest;
   if(!record(v)||typeof v.sceneId!=='string'||!stable.test(v.sceneId)||typeof v.plotId!=='string'||!stable.test(v.plotId)||scenes.has(v.sceneId)||p.items.length!==0||p.gold!==0)fail('E_LEGACY_QUEST',q+'.legacyQuest','Legacy quest pickup requires a unique scene and no ordinary loot.');scenes.add(v.sceneId);
  }
 }
 return db;
}
let loot=readLootDatabase(baselineLoot),pickups=readPickupDatabase(baselinePickups);
export function installLootDatabase(raw:unknown):void {const next=readLootDatabase(raw);loot=next;}
export function installPickupDatabase(raw:unknown):void {const next=readPickupDatabase(raw);pickups=next;}
export function resetLootDefinitions():void {loot=readLootDatabase(baselineLoot);pickups=readPickupDatabase(baselinePickups);}
export function lootTableForEncounter(encounterId:string):LootTable|undefined {const a=loot.assignments.find(v=>v.encounterId===encounterId);return loot.tables.find(t=>t.id===a?.tableId);}
export function authoredPickups():readonly PickupDefinition[] {return pickups.pickups;}
export function validateLootReferences(registry:Record<string,GridMap>):void {
 const encounters=new Map(ENCOUNTER_SEEDS.map(e=>[e.id,e]));
 for(const [i,a]of loot.assignments.entries()){
  const enc=encounters.get(a.encounterId);if(!enc)fail('E_ENCOUNTER',`$.assignments[${i}]`,'Loot table references an absent encounter.');
  const t=loot.tables.find(t=>t.id===a.tableId)!;
  for(const [j,e]of t.entries.entries())if(e.memberIndex>=enc!.enemies.length)fail('E_MEMBER',`$.tables.${t.id}.entries[${j}]`,'Entry member index exceeds encounter size.');
 }
 const usedLocations=new Set<string>(),questKeys=new Set<string>();
 for(const [i,p]of pickups.pickups.entries()){
  const map=registry[p.mapId];if(!map||tileAt(map,p.x,p.y)!=='.')fail('E_POSITION',`$.pickups[${i}]`,'Pickup must be on an existing map walkable floor tile.');
  if(p.legacyQuest){const scene=map.props.find(v=>v.id===p.legacyQuest!.sceneId);
   if(!scene||scene.x!==p.x||scene.y!==p.y)fail('E_QUEST_SCENE',`$.pickups[${i}].legacyQuest`,'Legacy quest pickup must reference its existing scene at the same position.');
  }
  if(p.questItemId){if(questKeys.has(p.questItemId))fail('E_QUEST_ID',`$.pickups[${i}].questItemId`,'Quest pickup ID is already used.');questKeys.add(p.questItemId);}
  const key=p.mapId+':'+p.id;if(usedLocations.has(key))fail('E_PICKUP',`$.pickups[${i}]`,'Duplicate pickup.');usedLocations.add(key);
 }
}
