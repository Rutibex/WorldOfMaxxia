/** MP05: explicit Firstlight compatibility layer, not a generic pack override API.
 * The core profile retains existing IDs for format-18 saves. Campaign-owned
 * records are restored only for a project explicitly listed by its adapter.
 */
import {readItemDatabase,installItemDatabase,ITEMS,type ItemDefinition,type ItemDatabase} from './items.ts';
import {readMonsterDatabase,installMonsterDatabase,MONSTERS,type MonsterDefinition,type MonsterDatabase} from './monsters.ts';
import {readClassDatabase,CLASSES} from './classes.ts';
import {readSpellDatabase} from './spells.ts';
import {readProgression} from './progression.ts';
import {readConditionDatabase} from './conditions.ts';
export class LegacyAdapterError extends Error {
 code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.name='LegacyAdapterError';this.code=code;this.path=path;}
}
const fail=(code:string,path:string,message:string):never=>{throw new LegacyAdapterError(code,path,message);};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export interface FirstlightAdapter {
 format:'maxxia-legacy-adapter';formatVersion:1;adapterId:'firstlight';projectIds:string[];
 coreRules:{id:'core:rules:classic';version:'1.0.0'};items:string;monsters:string;coreProvenance:string;
 expectedItemIds:string[];expectedMonsterIds:string[];
}
const safePath=(v:unknown):v is string=>typeof v==='string'&&v.length<241&&/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.json$/.test(v);
const uniqueIds=(value:unknown):value is string[]=>Array.isArray(value)&&value.length>0&&value.length<256&&value.every(v=>typeof v==='string'&&/^[a-z][a-z0-9_]{1,79}$/.test(v))&&new Set(value).size===value.length;
export function readFirstlightAdapter(input:unknown,projectId:string):FirstlightAdapter {
 let data:unknown=input;if(typeof input==='string'){try{data=JSON.parse(input);}catch{fail('E_LEGACY_JSON','$','Invalid adapter JSON.');}}
 if(!obj(data))throw new LegacyAdapterError('E_LEGACY_FORMAT','$','Adapter must be a JSON object.');
 if(data.format!=='maxxia-legacy-adapter'||data.formatVersion!==1||data.adapterId!=='firstlight'||Object.keys(data).sort().join('|')!==['adapterId','coreProvenance','coreRules','expectedItemIds','expectedMonsterIds','format','formatVersion','items','monsters','projectIds'].sort().join('|'))fail('E_LEGACY_FORMAT','$','Unsupported adapter shape.');
 if(!Array.isArray(data.projectIds)||data.projectIds.length<1||data.projectIds.length>8||data.projectIds.some(x=>typeof x!=='string'||!/^project_[a-z0-9_]{2,80}$/.test(x))||new Set(data.projectIds).size!==data.projectIds.length||!data.projectIds.includes(projectId))fail('E_LEGACY_PROJECT','$.projectIds','Adapter does not authorize the selected project.');
 if(!obj(data.coreRules)||data.coreRules.id!=='core:rules:classic'||data.coreRules.version!=='1.0.0'||Object.keys(data.coreRules).length!==2)fail('E_LEGACY_RULES','$.coreRules','Unsupported rules profile.');
 if(!safePath(data.items)||!safePath(data.monsters)||!safePath(data.coreProvenance))fail('E_LEGACY_PATH','$','Unsafe database paths.');
 if(!uniqueIds(data.expectedItemIds)||!uniqueIds(data.expectedMonsterIds))fail('E_LEGACY_IDS','$','Missing or duplicate expected record IDs.');
 return data as unknown as FirstlightAdapter;
}
export interface CoreProvenance {
 format:'maxxia-core-provenance';formatVersion:1;rulesId:string;rulesVersion:string;legacyProjectId:string;
 coreDatabases:Record<string,string>;legacyOverlay:Record<string,string>;originalDatabases:Record<string,string>;immutableLegacyIds:boolean;
}
export function readCoreProvenance(raw:unknown):CoreProvenance {
 let data:unknown=raw;if(typeof raw==='string'){try{data=JSON.parse(raw);}catch{fail('E_CORE_PROVENANCE','$','Malformed provenance JSON.');}}
 if(!obj(data))throw new LegacyAdapterError('E_CORE_PROVENANCE','$','Provenance must be a JSON object.');
 if(data.format!=='maxxia-core-provenance'||data.formatVersion!==1||data.rulesId!=='core:rules:classic'||data.rulesVersion!=='1.0.0'||data.legacyProjectId!=='project_world_of_maxxia'||data.immutableLegacyIds!==true)fail('E_CORE_PROVENANCE','$','Incompatible core ownership contract.');
 const hash=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
 for(const key of ['coreDatabases','legacyOverlay','originalDatabases'])if(!obj(data[key]))fail('E_CORE_PROVENANCE','$.'+key,'Missing hash ledger.');
 for(const name of ['classes','items','monsters','spells','conditions','progression'])if(!hash((data.coreDatabases as Record<string,unknown>)[name])||!hash((data.originalDatabases as Record<string,unknown>)[name]))fail('E_CORE_PROVENANCE','$.coreDatabases.'+name,'Missing expected SHA-256.');
 for(const name of ['items','monsters'])if(!hash((data.legacyOverlay as Record<string,unknown>)[name]))fail('E_CORE_PROVENANCE','$.legacyOverlay.'+name,'Missing adapter SHA-256.');
 return data as unknown as CoreProvenance;
}
export async function assertDocumentHash(text:string,expected:string,path:string):Promise<void>{
 const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
 if(actual!==expected)fail('E_CORE_HASH',path,'Content differs from the shipped core/adaptation provenance.');
}
/** Parse and cross-check everything before touching installed rules registries.
 * No source pack may override a legacy or shared ID at this boundary. */
export function stageFirstlightOverlay(adapter:FirstlightAdapter,itemInput:unknown,monsterInput:unknown):{items:ItemDatabase;monsters:MonsterDatabase} {
 const addedItems=readItemDatabase(itemInput).items,addedMonsters=readMonsterDatabase(monsterInput).monsters;
 const exact=(actual:string[],expected:string[],path:string)=>{
  if(actual.slice().sort().join('|')!==expected.slice().sort().join('|'))fail('E_LEGACY_IDS',path,'Adapter item/monster set differs from its frozen identity list.');
 };
 exact(addedItems.map(x=>x.id),adapter.expectedItemIds,'$.expectedItemIds');exact(addedMonsters.map(x=>x.id),adapter.expectedMonsterIds,'$.expectedMonsterIds');
 const items=Object.values(ITEMS),monsters=Object.values(MONSTERS);
 const seenItems=new Set(items.map(x=>x.id)),seenMonsters=new Set(monsters.map(x=>x.id));
 for(const it of addedItems)if(seenItems.has(it.id))fail('E_LEGACY_COLLISION','$.items.'+it.id,'Adapter cannot replace a core item.');
 for(const m of addedMonsters)if(seenMonsters.has(m.id))fail('E_LEGACY_COLLISION','$.monsters.'+m.id,'Adapter cannot replace a core monster.');
 const fullItems=readItemDatabase({format:'maxxia-items',version:1,items:[...items,...addedItems]});
 const fullMonsters=readMonsterDatabase({format:'maxxia-monsters',version:1,monsters:[...monsters,...addedMonsters]});
 const allItems=new Set(fullItems.items.map(v=>v.id));
 for(const m of fullMonsters.monsters)if(m.guaranteedLootItemId&&!allItems.has(m.guaranteedLootItemId))fail('E_LEGACY_LOOT','$.monsters.'+m.id,'Unknown guaranteed loot item.');
 return {items:fullItems,monsters:fullMonsters};
}
export function installFirstlightOverlay(staged:{items:ItemDatabase;monsters:MonsterDatabase}):void {
 // Both databases are already fully parsed/validated by staging; synchronous commit.
 installItemDatabase(staged.items);installMonsterDatabase(staged.monsters);
}
/** Smoke proof that the extracted core includes all six unchanged playable classes. */
export function assertClassicCoreReady():void{
 for(const id of ['myrmidon','artificer','mutant','wizard','priest','witch'])if(!CLASSES[id])fail('E_CORE_CLASS','$.classes',`Shared class ${id} was not installed.`);
 if(!ITEMS.item_dagger||!ITEMS.item_healing_draught||!MONSTERS.dust_imp)fail('E_CORE_BASE','$','The shared rules profile has not been installed.');
}
