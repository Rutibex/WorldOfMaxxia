/** MM16 map document v1 and reversible adapter for Phase 34 # . D maps.
 * The authored document, never a mutable campaign grid, is the single source of map definitions.
 * V1 intentionally retains cell-authoritative topology and the 64x64 safe budget.
 */
import {validateGridMap,type GridMap,type Pose} from '../rules/grid.ts';

const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=/^[a-z][a-z0-9_]{0,63}$/;
const material=/^[a-z][a-z0-9_]{0,63}$/;
const clone=<T>(x:T):T=>structuredClone(x);
const fail=(message:string):never=>{throw new TypeError('MM16 map document: '+message);};
export const MAX_MAP_DOCUMENT_BYTES=512*1024;
export type Surface='floor'|'wall'|'ceiling';
export interface MaterialOverride{x:number;y:number;materialId:string;}
export interface MaterialLayer{default:string;overrides:MaterialOverride[];}
export type MapMaterials=Record<Surface,MaterialLayer>;
export interface ArrivalPoint{id:string;x:number;y:number;facing:0|1|2|3;name:string;}
export interface MapEventPlaceholder{id:string;x:number;y:number;name:string;notes:string;}
export interface MapSettings{environmentId:string;musicId?:string;notes:string;}
export interface MapDocumentV1{
 format:'maxxia-map';version:1;id:string;name:string;width:number;height:number;
 geometry:{rows:string[]};materials:MapMaterials;scenery:GridMap['props'];
 objects:{perception?:GridMap['perception'];terrain?:GridMap['terrain'];spritePlacements?:GridMap['spritePlacements'];enemyAppearances?:GridMap['enemyAppearances'];entities?:GridMap['entities'];doors:GridMap['doors'];secrets:NonNullable<GridMap['secrets']>;traps:NonNullable<GridMap['traps']>;fountains:NonNullable<GridMap['fountains']>;portals:Array<{id:string;x:number;y:number;targetMapId:string;targetX:number;targetY:number;targetFacing:0|1|2|3;targetArrivalId?:string;activation?:'interact'|'step'}>};
 arrivals:ArrivalPoint[];events:MapEventPlaceholder[];settings:MapSettings;
 [other:string]:unknown;
}
const defaultMaterials=():MapMaterials=>({
 floor:{default:'material_floor_default',overrides:[]},
 wall:{default:'material_wall_default',overrides:[]},
 ceiling:{default:'material_ceiling_default',overrides:[]}
});
const legacyFields=new Set(['id','name','rows','spawn','doors','props','secrets','traps','fountains','portals','entities','spritePlacements','enemyAppearances','terrain','perception']);
/** Import never changes the supplied object; preserve unknown legacy metadata in the new document. */
export function importLegacyMap(value:unknown):MapDocumentV1{
 const map=validateGridMap(value) as GridMap&{portals?:MapDocumentV1['objects']['portals']};
 const extras=Object.fromEntries(Object.entries(map).filter(([key])=>!legacyFields.has(key)));
 const document:MapDocumentV1={...clone(extras),format:'maxxia-map',version:1,id:map.id,name:map.name,width:map.rows[0].length,height:map.rows.length,
  geometry:{rows:clone(map.rows)},materials:defaultMaterials(),scenery:clone(map.props),
  objects:{...(map.perception?{perception:clone(map.perception)}:{}),...(map.terrain?{terrain:clone(map.terrain)}:{}),...(map.spritePlacements?{spritePlacements:clone(map.spritePlacements)}:{}),...(map.enemyAppearances?{enemyAppearances:clone(map.enemyAppearances)}:{}),...(map.entities?{entities:clone(map.entities)}:{}),doors:clone(map.doors),secrets:clone(map.secrets??[]),traps:clone(map.traps??[]),fountains:clone(map.fountains??[]),portals:clone(map.portals??[])},
  arrivals:[{id:'arrival_start',name:'Start',...clone(map.spawn)}],events:[],settings:{environmentId:map.environmentId??'environment_default',notes:''}};
 return validateMapDocument(document);
}
/** Convert a document to the unchanged gameplay GridMap interface, not the reverse. */
export function adaptMapDocument(doc:MapDocumentV1):GridMap&{portals:MapDocumentV1['objects']['portals'];arrivals:ArrivalPoint[]}{
 const start=doc.arrivals.find(a=>a.id==='arrival_start')!;
 return {id:doc.id,name:doc.name,rows:clone(doc.geometry.rows),environmentId:doc.settings.environmentId,materials:clone(doc.materials),spawn:{x:start.x,y:start.y,facing:start.facing} as Pose,
  ...(doc.objects.perception?{perception:clone(doc.objects.perception)}:{}),...(doc.objects.terrain?{terrain:clone(doc.objects.terrain)}:{}),...(doc.objects.spritePlacements?{spritePlacements:clone(doc.objects.spritePlacements)}:{}),...(doc.objects.enemyAppearances?{enemyAppearances:clone(doc.objects.enemyAppearances)}:{}),...(doc.objects.entities?{entities:clone(doc.objects.entities)}:{}),doors:clone(doc.objects.doors),props:clone(doc.scenery),secrets:clone(doc.objects.secrets),traps:clone(doc.objects.traps),
  fountains:clone(doc.objects.fountains),portals:clone(doc.objects.portals),arrivals:clone(doc.arrivals)};
}
/** Validate complete authoring budgets before adapting. Preserve unknown compatible metadata. */
export function validateMapDocument(value:unknown):MapDocumentV1{
 if(!record(value)||value.format!=='maxxia-map'||value.version!==1)fail('expected maxxia-map version 1.');
 if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_MAP_DOCUMENT_BYTES)fail('map document exceeds 512 KiB.');
 const doc=value as unknown as MapDocumentV1;
 if(typeof doc.id!=='string'||!/^map_[a-z0-9_]{1,91}$/.test(doc.id)||typeof doc.name!=='string'||!doc.name.trim()||doc.name.length>160)fail('invalid map ID or name.');
 if(!Number.isInteger(doc.width)||doc.width<3||doc.width>64||!Number.isInteger(doc.height)||doc.height<3||doc.height>64)fail('map dimensions must be 3–64 cells.');
 if(!record(doc.geometry)||!Array.isArray(doc.geometry.rows)||doc.geometry.rows.length!==doc.height||doc.geometry.rows.some(row=>typeof row!=='string'||row.length!==doc.width))fail('geometry dimensions do not match rows.');
 const rows=doc.geometry.rows;
 if(!record(doc.materials))fail('materials must contain floor, wall and ceiling layers.');
 let overrides=0;
 for(const surface of ['floor','wall','ceiling'] as const){
  const layer=doc.materials[surface];
  if(!record(layer)||typeof layer.default!=='string'||!material.test(layer.default)||!Array.isArray(layer.overrides))fail(`invalid ${surface} material layer.`);
  const cells=new Set<string>();
  for(const v of layer.overrides){
   if(!record(v)||!Number.isInteger(v.x)||!Number.isInteger(v.y)||v.x<0||v.y<0||v.x>=doc.width||v.y>=doc.height||typeof v.materialId!=='string'||!material.test(v.materialId))fail(`invalid ${surface} override.`);
   const key=`${v.x},${v.y}`;if(cells.has(key))fail(`duplicate ${surface} override at ${key}.`);cells.add(key);
   if(surface==='floor'&&rows[v.y][v.x]==='#')fail('floor material override must target a walkable tile.');
   if(surface==='wall'&&rows[v.y][v.x]==='.')fail('wall material override must target a wall or door.');
   overrides++;
  }
 }
 if(overrides>4096)fail('too many material overrides.');
 if(!Array.isArray(doc.scenery)||!record(doc.objects)||!Array.isArray(doc.objects.doors)||!Array.isArray(doc.objects.secrets)||!Array.isArray(doc.objects.traps)||!Array.isArray(doc.objects.fountains)||!Array.isArray(doc.objects.portals))fail('missing scenery or world objects.');
 if(!Array.isArray(doc.arrivals)||doc.arrivals.length<1||doc.arrivals.length>64||!doc.arrivals.some(a=>a.id==='arrival_start'))fail('include 1–64 arrivals with arrival_start.');
 if(!Array.isArray(doc.events)||doc.events.length>256||!record(doc.settings)||typeof doc.settings.environmentId!=='string'||!/^(?:[a-z][a-z0-9_]{0,63}|[a-z][a-z0-9_]{0,47}:environment:[a-z][a-z0-9_]{0,79})$/.test(doc.settings.environmentId)||typeof doc.settings.notes!=='string'||doc.settings.notes.length>4096||(doc.settings.musicId!==undefined&&(typeof doc.settings.musicId!=='string'||!id.test(doc.settings.musicId))))fail('invalid event list or map settings.');
 const allowed=(x:number,y:number)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<doc.width&&y<doc.height&&rows[y][x]==='.';
 const ids=new Set<string>();
 for(const a of doc.arrivals){
  if(!record(a)||typeof a.id!=='string'||!id.test(a.id)||ids.has(a.id)||typeof a.name!=='string'||a.name.length>100||!allowed(a.x,a.y)||![0,1,2,3].includes(a.facing))fail('invalid/duplicate arrival or blocked arrival cell.');ids.add(a.id);
 }
 for(const e of doc.events){
  if(!record(e)||typeof e.id!=='string'||!id.test(e.id)||ids.has(e.id)||typeof e.name!=='string'||e.name.length>100||typeof e.notes!=='string'||e.notes.length>4096||!allowed(e.x,e.y))fail('invalid/duplicate event placeholder or blocked event cell.');ids.add(e.id);
 }
 const portalIds=new Set<string>();
 if(doc.objects.portals.length>12)fail('too many transfers (maximum 12 per map).');
 for(const portal of doc.objects.portals){
  if(!record(portal)||typeof portal.id!=='string'||!/^[a-z0-9_]{1,48}$/.test(portal.id)||portalIds.has(portal.id)||!allowed(portal.x,portal.y)||
     (portal.activation!==undefined&&portal.activation!=='interact'&&portal.activation!=='step')||
     (portal.targetArrivalId!==undefined&&(typeof portal.targetArrivalId!=='string'||!id.test(portal.targetArrivalId))))fail('invalid/duplicate transfer, activation or blocked transfer square.');
  portalIds.add(portal.id);
 }
 // Reuse the unchanged Phase 34 collision, object, secret, trap and door validator.
 validateGridMap(adaptMapDocument(doc));
 return doc;
}
/** Legacy map JSON is accepted for older projects but is never silently rewritten. */
export function normalizeMapDocument(value:unknown):GridMap&{portals?:MapDocumentV1['objects']['portals']}{
 if(record(value)&&Object.hasOwn(value,'format'))return adaptMapDocument(validateMapDocument(value));
 return validateGridMap(value) as GridMap&{portals?:MapDocumentV1['objects']['portals']};
}
/** Produce an idempotent, readable serialization for authoring and migration tools. */
export function serializeMapDocument(value:unknown):string{return JSON.stringify(validateMapDocument(value),null,2)+'\n';}
