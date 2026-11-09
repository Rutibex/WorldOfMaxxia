import {validateEncounterDocument,encounterSeedId,type EncounterDocument} from './encounter-director.ts';
/** MM14 reusable encounter groups and independently persistent map placements. */
import defaultGroups from './encounter-groups-default.json' with {type:'json'};
import defaultPlacements from './encounter-placements-default.json' with {type:'json'};
import {MONSTERS} from './monsters.ts';
import {tileAt,type GridMap} from '../rules/grid.ts';
export const MAX_ENCOUNTER_GROUP_BYTES=256*1024;
export const MAX_ENCOUNTER_PLACEMENT_BYTES=256*1024;
export interface GroupMember {kindId:string;dx:number;dy:number;}
export interface EncounterGroup {id:string;name:string;boss:boolean;musicTag:string|null;members:GroupMember[];}
export interface EncounterPlacement {id:string;mapId:string;groupId:string;x:number;y:number;triggerRange:number;respawn:'never'|'on-reentry';enemyIds:string[];}
export interface EncounterGroupDatabase {format:'maxxia-encounter-groups';version:1;groups:EncounterGroup[];}
export interface EncounterPlacementDatabase {format:'maxxia-encounter-placements';version:1;placements:EncounterPlacement[];}
export interface EncounterSeed {authored?:boolean;id:string;mapId:string;enemies:Array<{id:string;kindId:string;x:number;y:number}>;}
export class EncounterDataError extends Error {code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.code=code;this.path=path;this.name='EncounterDataError';}}
const bad=(code:string,path:string,message:string):never=>{throw new EncounterDataError(code,path,message);};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=/^[a-z][a-z0-9_]{1,79}$/;
const integer=(v:unknown,min:number,max:number):v is number=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max;
function parse(raw:unknown,max:number,label:string):unknown{
 if(typeof raw!=='string')return raw;
 if(new TextEncoder().encode(raw).byteLength>max)bad('E_SIZE','$',`${label} exceeds ${max/1024} KiB.`);
 try{return JSON.parse(raw);}catch{return bad('E_JSON','$',`${label} is malformed JSON.`);}
}
export function readEncounterGroups(raw:unknown):EncounterGroupDatabase {
 const v=parse(raw,MAX_ENCOUNTER_GROUP_BYTES,'Groups database');
 if(!obj(v)||v.format!=='maxxia-encounter-groups'||v.version!==1||!Array.isArray(v.groups)||v.groups.length>256)bad('E_FORMAT','$','Expected maxxia-encounter-groups v1 with up to 256 groups.');
 const keys=new Set<string>();const db=v as unknown as EncounterGroupDatabase;
 for(const [i,g] of db.groups.entries()){
  const p=`$.groups[${i}]`;if(!obj(g)||typeof g.id!=='string'||!id.test(g.id)||keys.has(g.id))bad('E_ID',p+'.id','Invalid or duplicate group ID.');keys.add(g.id);
  if(typeof g.name!=='string'||!g.name.trim()||g.name.length>100||typeof g.boss!=='boolean'||(g.musicTag!==null&&(typeof g.musicTag!=='string'||!/^[a-z][a-z0-9_]{0,47}$/.test(g.musicTag))))bad('E_GROUP',p,'Invalid group name, boss flag, or music tag.');
  if(!Array.isArray(g.members)||g.members.length<1||g.members.length>3)bad('E_MEMBERS',p+'.members','Each group needs 1–3 combatants (current combat targeting budget).');
  for(const [j,m]of g.members.entries())if(!obj(m)||typeof m.kindId!=='string'||!(id.test(m.kindId)||/^[a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79}$/.test(m.kindId))||!integer(m.dx,-63,63)||!integer(m.dy,-63,63))bad('E_MEMBER',`${p}.members[${j}]`,'Invalid monster reference or coordinate offset.');
 }
 return db;
}
export function readEncounterPlacements(raw:unknown):EncounterPlacementDatabase {
 const v=parse(raw,MAX_ENCOUNTER_PLACEMENT_BYTES,'Placements database');
 if(!obj(v)||v.format!=='maxxia-encounter-placements'||v.version!==1||!Array.isArray(v.placements)||v.placements.length>512)bad('E_FORMAT','$','Expected maxxia-encounter-placements v1 with at most 512 placements.');
 const ids=new Set<string>(),enemyIds=new Set<string>();const db=v as unknown as EncounterPlacementDatabase;
 for(const [i,p]of db.placements.entries()){
  const path=`$.placements[${i}]`;
  if(!obj(p)||typeof p.id!=='string'||!id.test(p.id)||ids.has(p.id))bad('E_ID',path+'.id','Invalid or duplicate placement ID.');ids.add(p.id);
  if(typeof p.mapId!=='string'||!id.test(p.mapId)||typeof p.groupId!=='string'||!id.test(p.groupId)||!integer(p.x,0,63)||!integer(p.y,0,63)||!integer(p.triggerRange,1,4)||!['never','on-reentry'].includes(p.respawn))bad('E_PLACEMENT',path,'Invalid map/group reference, position, range or respawn setting.');
  if(!Array.isArray(p.enemyIds)||p.enemyIds.length<1||p.enemyIds.length>3)bad('E_ENEMIES',path+'.enemyIds','Placement must allocate 1–3 persistent enemy IDs.');
  for(const [j,idValue] of p.enemyIds.entries())if(typeof idValue!=='string'||!id.test(idValue)||enemyIds.has(idValue))bad('E_ENEMY_ID',`${path}.enemyIds[${j}]`,'Enemy instance IDs must be unique across the entire project.');else enemyIds.add(idValue);
 }
 return db;
}
export const ENCOUNTER_GROUPS:Record<string,EncounterGroup>=Object.create(null);
export const ENCOUNTER_PLACEMENTS:Record<string,EncounterPlacement>=Object.create(null);
export const ENCOUNTER_SEEDS:EncounterSeed[]=[]; // stable array identity for older rule/tests.
export function installEncounters(groupRaw:unknown,placementRaw:unknown):void{
 const gs=readEncounterGroups(groupRaw),ps=readEncounterPlacements(placementRaw);
 const groupMap=new Map(gs.groups.map(g=>[g.id,g]));const compiled:EncounterSeed[]=[];
 for(const [i,p]of ps.placements.entries()){
  const group=groupMap.get(p.groupId);if(!group)bad('E_GROUP_REFERENCE',`$.placements[${i}].groupId`,`Missing group ${p.groupId}.`);
  if(p.enemyIds.length!==group!.members.length)bad('E_COUNT',`$.placements[${i}].enemyIds`,'Enemy ID count must match the group membership.');
  compiled.push({id:p.id,mapId:p.mapId,enemies:group!.members.map((m,j)=>({id:p.enemyIds[j],kindId:m.kindId,x:p.x+m.dx,y:p.y+m.dy}))});
 }
 // All validation completes before mutating the installed catalogues.
 for(const k of Object.keys(ENCOUNTER_GROUPS))delete ENCOUNTER_GROUPS[k];
 for(const k of Object.keys(ENCOUNTER_PLACEMENTS))delete ENCOUNTER_PLACEMENTS[k];
 gs.groups.forEach(g=>ENCOUNTER_GROUPS[g.id]=g);ps.placements.forEach(p=>ENCOUNTER_PLACEMENTS[p.id]=p);
 ENCOUNTER_SEEDS.splice(0,ENCOUNTER_SEEDS.length,...compiled);
}
export function resetEncounters():void{installEncounters(defaultGroups,defaultPlacements);}
export function validateEncounterReferences(registry?:Record<string,GridMap>):void{
 for(const seed of ENCOUNTER_SEEDS){
  if(registry&&!Object.hasOwn(registry,seed.mapId))bad('E_MAP_REFERENCE',seed.id,`Unknown map ${seed.mapId}.`);
  for(const v of seed.enemies){
   if(!Object.hasOwn(MONSTERS,v.kindId))bad('E_MONSTER_REFERENCE',seed.id,`Unknown monster ${v.kindId}.`);
   if(registry&&tileAt(registry[seed.mapId],v.x,v.y)!=='.')bad('E_LOCATION',seed.id,`Enemy ${v.id} is outside walkable floor at (${v.x},${v.y}).`);
  }
 }
}
export function respawnOnEntry(state:{combat:{encounters:Record<string,{enemies:Array<{id:string;kindId:string;hp:number}>;cleared:boolean;rewarded:boolean}>};ground?:{containers:Array<{enemyId?:string;entries:unknown[];gold:number}>}},mapId:string):void{
 for(const seed of ENCOUNTER_SEEDS){const p=ENCOUNTER_PLACEMENTS[seed.id],entry=state.combat.encounters[seed.id];
  if(!entry||seed.mapId!==mapId||p?.respawn!=='on-reentry'||!entry.cleared)continue;
  const oldCorpses=state.ground?.containers.filter(c=>entry.enemies.some(e=>e.id===c.enemyId))??[];
  // Never erase unclaimed corpse contents; defer the respawn until loot is collected.
  if(oldCorpses.some(c=>c.entries.length>0||c.gold>0))continue;
  if(state.ground)state.ground.containers=state.ground.containers.filter(c=>!oldCorpses.includes(c));
  entry.enemies.forEach((e,i)=>e.hp=MONSTERS[seed.enemies[i].kindId].hp);
  entry.cleared=false;entry.rewarded=false;
 }
}
resetEncounters();

/** Replace only MP16 placements, retaining legacy seeds and stable registry identity. */
export function installAuthoredEncounterSeeds(doc:EncounterDocument):void{
 validateEncounterDocument(doc);for(const e of doc.encounters)if(ENCOUNTER_SEEDS.some(s=>!s.authored&&s.id===encounterSeedId(e.id)))bad('E_ID','$.encounters','Authored encounter ID collides with a legacy placement');
 ENCOUNTER_SEEDS.splice(0,ENCOUNTER_SEEDS.length,...ENCOUNTER_SEEDS.filter(e=>!e.authored),...doc.encounters.map(e=>({authored:true,id:encounterSeedId(e.id),mapId:e.nativeMapId,enemies:e.members.map((m,i)=>({id:encounterSeedId(e.id)+'_'+i,kindId:m.kindId,x:e.x+m.dx,y:e.y+m.dy}))})));
}
