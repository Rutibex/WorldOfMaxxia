import {validateSpriteDefinitions,validateSpriteBindings,spriteResourceIds,type SpriteDefinition} from './sprite-contracts.ts';
/** MM19 reusable, project-local environment profiles. IDs, not paths, are authored in maps. */
import {validateSceneLayout,type SceneLayout} from './scene-profiles.ts';
import type {GridMap} from '../rules/grid.ts';
import {ManifestError} from './manifest.ts';
import {requireResource,type ResourceResolver} from './resources.ts';
import type {MapDocumentV1,Surface} from './map-document.ts';
const id=/^(?:[a-z][a-z0-9_]{0,63}|[a-z][a-z0-9_]{0,47}:environment:[a-z][a-z0-9_]{0,79})$/;
const resourceId=/^(?:[a-z][a-z0-9_]{0,89}|[a-z][a-z0-9_]{0,47}:resource:[a-z][a-z0-9_]{0,79})$/;
const hex=/^#[0-9a-fA-F]{6}$/;
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const bad=(where:string,message:string):never=>{throw new ManifestError('E_ENVIRONMENT',where,message);};
export const MAX_ENVIRONMENT_BYTES=128*1024;
export interface MaterialDefinition{id:string;name:string;surface:Surface;resourceId:string|null;}
export interface EnvironmentProfile{sprites?:SpriteDefinition[];scene?:SceneLayout;id:string;name:string;skyResourceId:string|null;skyColor:string;fogColor:string;fogStrength:number;materials:MaterialDefinition[];}
export interface EnvironmentDatabase{format:'maxxia-environments';version:1;profiles:EnvironmentProfile[];}
export const DEFAULT_ENVIRONMENT:EnvironmentProfile={id:'environment_default',name:'Default masonry',skyResourceId:null,skyColor:'#192b35',fogColor:'#041018',fogStrength:0.095,materials:[
 {id:'material_floor_default',name:'Stone floor',surface:'floor',resourceId:null},
 {id:'material_wall_default',name:'Stone wall',surface:'wall',resourceId:null},
 {id:'material_ceiling_default',name:'Ceiling',surface:'ceiling',resourceId:null}
]};
export const DEFAULT_ENVIRONMENTS:EnvironmentDatabase={format:'maxxia-environments',version:1,profiles:[DEFAULT_ENVIRONMENT]};
export function readEnvironments(text:string,resolver:ResourceResolver|null=null):EnvironmentDatabase{
 if(new TextEncoder().encode(text).length>MAX_ENVIRONMENT_BYTES)bad('$','Environment database exceeds 128 KiB.');
 let value:unknown;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{bad('$','Invalid environment JSON.');}
 if(!record(value)||value.format!=='maxxia-environments'||value.version!==1||!Array.isArray(value.profiles)||value.profiles.length<1||value.profiles.length>64)bad('$','Expected environment database v1 with 1–64 profiles.');
 const ids=new Set<string>();
 for(const [i,profile] of (value as unknown as EnvironmentDatabase).profiles.entries()){
  const where=`$.profiles[${i}]`;
  if(!record(profile)||typeof profile.id!=='string'||!id.test(profile.id)||ids.has(profile.id)||typeof profile.name!=='string'||!profile.name.trim()||profile.name.length>120||typeof profile.skyColor!=='string'||!hex.test(profile.skyColor)||typeof profile.fogColor!=='string'||!hex.test(profile.fogColor)||typeof profile.fogStrength!=='number'||!Number.isFinite(profile.fogStrength)||profile.fogStrength<0||profile.fogStrength>0.5||!Array.isArray(profile.materials)||profile.materials.length<3||profile.materials.length>128)bad(where,'Invalid environment profile or duplicate ID.');
  if(profile.skyResourceId!==null&&(typeof profile.skyResourceId!=='string'||!resourceId.test(profile.skyResourceId)))bad(where+'.skyResourceId','Sky resource must be an image ID or null.');
  if(profile.skyResourceId){if(!resolver)throw new ManifestError('E_ENVIRONMENT',where,'Sky resource requires a resource catalogue.');requireResource(resolver,profile.skyResourceId,'image');}
  const materials=new Set<string>(),count={floor:0,wall:0,ceiling:0};
  for(const [j,m] of profile.materials.entries()){
   if(!record(m)||typeof m.id!=='string'||!id.test(m.id)||materials.has(m.id)||typeof m.name!=='string'||!m.name.trim()||m.name.length>100||!['floor','wall','ceiling'].includes(m.surface as string)||!(m.resourceId===null||(typeof m.resourceId==='string'&&resourceId.test(m.resourceId))))bad(`${where}.materials[${j}]`,'Invalid or duplicate material.');
   materials.add(m.id);count[m.surface as Surface]++;
   if(m.resourceId){if(!resolver)throw new ManifestError('E_ENVIRONMENT',where,'Material image requires a resource catalogue.');requireResource(resolver,m.resourceId,'image');}
  }
  if(Object.values(count).some(n=>n<1))bad(where,'Every profile requires floor, wall and ceiling materials.');
  if(profile.scene!==undefined)validateSceneLayout(profile.scene,where+'.scene',bad,r=>{if(!resourceId.test(r))bad(where+'.scene.textures','Invalid resource ID.');if(!resolver)bad(where+'.scene.textures','Scene texture requires a resource catalogue.');requireResource(resolver!,r,'image');});
  if(profile.sprites!==undefined)validateSpriteDefinitions(profile.sprites,where+'.sprites',r=>{if(!resolver)bad(where+'.sprites','Sprite image requires a resource catalogue.');requireResource(resolver!,r,'image');});
  ids.add(profile.id);
 }
 return value as unknown as EnvironmentDatabase;
}
export function validateEnvironmentMaps(documents:readonly MapDocumentV1[],database:EnvironmentDatabase):void{
 const profiles=new Map(database.profiles.map(p=>[p.id,p]));
 for(const doc of documents){
  const profile=profiles.get(doc.settings.environmentId);
  if(!profile)throw new ManifestError('E_ENVIRONMENT',`map ${doc.id}`,'Unknown environment '+doc.settings.environmentId);
  validateSpriteBindings({id:doc.id,spritePlacements:doc.objects.spritePlacements,enemyAppearances:doc.objects.enemyAppearances} as GridMap,profile.sprites??[]);
  for(const surface of ['floor','wall','ceiling'] as const){
   const allowed=new Set(profile.materials.filter(m=>m.surface===surface).map(m=>m.id));
   if(!allowed.has(doc.materials[surface].default))bad(`map ${doc.id}`,'Unknown '+surface+' default material '+doc.materials[surface].default);
   for(const override of doc.materials[surface].overrides)if(!allowed.has(override.materialId))bad(`map ${doc.id}`,'Unknown '+surface+' material '+override.materialId);
  }
 }
}
export function materialAt(doc:Pick<MapDocumentV1,'materials'>,surface:Surface,x:number,y:number):string{
 const layer=doc.materials[surface];return layer.overrides.find(m=>m.x===x&&m.y===y)?.materialId??layer.default;
}

/** All profile-owned images enter the same preload queue and resolver. */
export function environmentResourceIds(profile:EnvironmentProfile):string[]{return [...new Set([profile.skyResourceId,...profile.materials.map(m=>m.resourceId),...Object.values(profile.scene?.textures??{}),...spriteResourceIds(profile.sprites)].filter((v):v is string=>v!==null))];}
export function resolveEnvironment(map:Pick<GridMap,'environmentId'>,profiles:ReadonlyMap<string,EnvironmentProfile>):EnvironmentProfile{
 const id=map.environmentId??'environment_default',p=profiles.get(id);
 if(!p)bad('map.environmentId','Unknown environment '+id);return p!;
}
export function mergeEnvironments(base:EnvironmentDatabase,added:readonly EnvironmentProfile[]):EnvironmentDatabase{
 const profiles=structuredClone(base.profiles),seen=new Set(profiles.map(p=>p.id));
 for(const p of added){if(seen.has(p.id))bad('$.profiles','Duplicate environment '+p.id);seen.add(p.id);profiles.push(structuredClone(p));}
 return {format:'maxxia-environments',version:1,profiles};
}
