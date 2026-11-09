/** MM05: independent, versioned resource definitions. Paths are relative to the catalogue, not code. */
import {ManifestError} from './manifest.ts';
import {MANIFEST_SCHEMA} from './generated.ts';
export type ResourceKind='image'|'audio'|'font';
export interface ResourceEntry {id:string;kind:ResourceKind;path:string;name?:string;legacyPath?:string;}
export interface ResourceCatalog {format:'maxxia-resource-catalog';version:1;resources:ResourceEntry[];}
export const MAX_RESOURCE_CATALOG_BYTES=512*1024;
const safe=new RegExp(MANIFEST_SCHEMA.$defs.RelativePath.pattern);
const idPattern=/^asset_[a-z0-9_]{1,89}$(?![\s\S])/;
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const knownExtensions:Record<ResourceKind,ReadonlySet<string>>={
 image:new Set(['png','jpg','jpeg','gif','webp','svg']),
 audio:new Set(['wav','ogg','mp3','mid','midi']),
 font:new Set(['woff','woff2','ttf'])
};
function validPath(path:unknown):path is string{
 return typeof path==='string' && path.length<=240 && safe.test(path) && !path.split('/').some(part=>part==='.'||part==='..');
}
export function readResourceCatalog(text:string):ResourceCatalog {
 const data=text.replace(/^\uFEFF/,'');
 if(new TextEncoder().encode(data).length>MAX_RESOURCE_CATALOG_BYTES)throw new ManifestError('E_RESOURCE_SIZE','$','Resource catalogue exceeds 512 KiB.');
 let parsed:unknown;try{parsed=JSON.parse(data);}catch{throw new ManifestError('E_RESOURCE_JSON','$','Resource catalogue is not valid JSON.');}
 if(!record(parsed)||parsed.format!=='maxxia-resource-catalog'||parsed.version!==1||!Array.isArray(parsed.resources)||parsed.resources.length>2048)
  throw new ManifestError('E_RESOURCE_FORMAT','$','Expected resource catalogue version 1 with up to 2048 entries.');
 const ids=new Set<string>(),paths=new Set<string>(),legacy=new Set<string>();
 for(const [i,item] of parsed.resources.entries()) {
  const at=`$.resources[${i}]`;
  if(!record(item)||typeof item.id!=='string'||!idPattern.test(item.id)||ids.has(item.id))throw new ManifestError('E_RESOURCE_ID',at+'.id','Invalid or duplicate resource ID.');
  if(typeof item.kind!=='string'||!Object.hasOwn(knownExtensions,item.kind))throw new ManifestError('E_RESOURCE_KIND',at+'.kind','Unknown resource kind.');
  if(!validPath(item.path))throw new ManifestError('E_RESOURCE_PATH',at+'.path','Resource must have a safe catalogue-relative path.');
  const suffix=item.path.split('.').at(-1)!.toLowerCase();
  if(!knownExtensions[item.kind as ResourceKind].has(suffix))throw new ManifestError('E_RESOURCE_EXTENSION',at+'.path','File extension does not match resource kind.');
  const casePath=item.path.toLowerCase();if(paths.has(casePath))throw new ManifestError('E_RESOURCE_PATH_COLLISION',at+'.path','Case-insensitive resource path collision.');
  if(item.name!==undefined&&(typeof item.name!=='string'||item.name.length>160))throw new ManifestError('E_RESOURCE_NAME',at+'.name','Resource name must contain at most 160 characters.');
  if(item.legacyPath!==undefined){
   if(!validPath(item.legacyPath))throw new ManifestError('E_RESOURCE_LEGACY',at+'.legacyPath','Unsafe legacy resource lookup path.');
   const old=item.legacyPath.toLowerCase();if(legacy.has(old))throw new ManifestError('E_RESOURCE_LEGACY_COLLISION',at+'.legacyPath','Legacy path is assigned more than once.');
   legacy.add(old);
  }
  ids.add(item.id);paths.add(casePath);
 }
 return parsed as unknown as ResourceCatalog;
}
export interface LocatedResource extends ResourceEntry {url:string;}
export interface ResourceResolver {
 catalogUrl:string;
 byId:ReadonlyMap<string,LocatedResource>;
 byLegacyPath:ReadonlyMap<string,LocatedResource>;
}
export function locateResources(catalog:ResourceCatalog,catalogUrl:string):ResourceResolver {
 const byId=new Map<string,LocatedResource>(),byLegacyPath=new Map<string,LocatedResource>();
 for(const entry of catalog.resources){
  const resource={...entry,url:new URL(entry.path,catalogUrl).href};
  byId.set(entry.id,resource);
  if(entry.legacyPath)byLegacyPath.set(entry.legacyPath,resource);
 }
 return {catalogUrl,byId,byLegacyPath};
}
/** ID-based authored references: changing the resource path does not change any ID or lookup. */
export function requireResource(resolver:ResourceResolver,id:string,kind?:ResourceKind):LocatedResource {
 const found=resolver.byId.get(id);
 if(!found)throw new ManifestError('E_RESOURCE_MISSING','$.resources',`Unknown resource ${id}.`);
 if(kind&&found.kind!==kind)throw new ManifestError('E_RESOURCE_KIND','$.resources',`Resource ${id} is not a ${kind}.`);
 return found;
}
/** Transitional MM05 path adapter. Unconverted legacy paths still use the original public/ assets. */
export function legacyResourceUrl(resolver:ResourceResolver|null,legacyPath:string,fallbackBase:string):string {
 return resolver?.byLegacyPath.get(legacyPath)?.url??new URL(legacyPath,fallbackBase).href;
}
