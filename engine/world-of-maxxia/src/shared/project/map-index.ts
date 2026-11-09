/** MM16: map index accepts v1 authored map documents and legacy grid JSON through a validated adapter. */
import {ManifestError} from './manifest.ts';
import {MANIFEST_SCHEMA} from './generated.ts';
import {validateMapRegistry,type MapRegistry} from '../rules/campaign.ts';
export interface MapIndexEntry {id:string;path:string;}
export interface MapIndex {format:'maxxia-map-index';version:1;maps:MapIndexEntry[];}
export interface LocatedMap extends MapIndexEntry {url:string;cacheKey:string;}
export const MAX_MAP_INDEX_BYTES=64*1024;
const relative=new RegExp(MANIFEST_SCHEMA.$defs.RelativePath.pattern);
const idPattern=/^map_[a-z0-9_]{1,91}$(?![\s\S])/;
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function readMapIndex(text:string):MapIndex {
 const contents=text.replace(/^\uFEFF/,'');
 if(new TextEncoder().encode(contents).length>MAX_MAP_INDEX_BYTES)throw new ManifestError('E_INDEX_SIZE','$','Map index exceeds 64 KiB.');
 let value:unknown;try{value=JSON.parse(contents);}catch{throw new ManifestError('E_INDEX_JSON','$','Map index is not valid JSON.');}
 if(!record(value)||value.format!=='maxxia-map-index'||value.version!==1||!Array.isArray(value.maps)||value.maps.length<1||value.maps.length>20)throw new ManifestError('E_MAP_INDEX','$','Expected map index v1 with 1–20 maps.');
 const ids=new Set<string>(),paths=new Set<string>();
 for(const [i,entry]of value.maps.entries()){
  const at=`$.maps[${i}]`;
  if(!record(entry)||typeof entry.id!=='string'||!idPattern.test(entry.id))throw new ManifestError('E_MAP_ID',at+'.id','Map ID must begin with map_ and contain lowercase letters, digits or underscores.');
  if(ids.has(entry.id))throw new ManifestError('E_MAP_DUPLICATE',at+'.id',`Duplicate map ID: ${entry.id}.`);
  if(typeof entry.path!=='string'||!relative.test(entry.path)||!entry.path.endsWith('.json'))throw new ManifestError('E_MAP_PATH',at+'.path','Use a project-relative .json file without traversal.');
  if(paths.has(entry.path.toLowerCase()))throw new ManifestError('E_MAP_PATH_DUPLICATE',at+'.path','Two maps use the same file path (case-insensitive).');
  ids.add(entry.id);paths.add(entry.path.toLowerCase());
 }
 return value as unknown as MapIndex;
}
export function locateMaps(index:MapIndex,indexUrl:string):LocatedMap[] {
 // The schema forbids .., protocols, encoded separators, and leading slashes in relative paths.
 return index.maps.map(({id,path})=>({id,path,url:new URL(path,indexUrl).href,cacheKey:'mapdoc:'+id}));
}
/** Do not trust a map's internal ID merely because its index entry has a valid ID. */
export function validateIndexedMaps(entries:readonly MapIndexEntry[],values:unknown[]):MapRegistry {
 if(entries.length!==values.length)throw new ManifestError('E_MAP_COUNT','$.maps','Map loading did not return the expected number of documents.');
 for(let i=0;i<entries.length;i++){
  const map=values[i];
  if(!record(map)||map.id!==entries[i].id)throw new ManifestError('E_MAP_ID_MISMATCH',`$.maps[${i}]`,`Map file ${entries[i].path} must declare id ${entries[i].id}.`);
 }
 try{return validateMapRegistry(values);}catch(error){throw new ManifestError('E_MAP_VALIDATION','$.maps',error instanceof Error?error.message:String(error));}
}
