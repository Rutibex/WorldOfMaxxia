import {MANIFEST_SCHEMA,CURRENT_ENGINE_VERSION,PROJECT_FORMAT_VERSION,type ProjectManifest} from './generated.ts';
export {CURRENT_ENGINE_VERSION,PROJECT_FORMAT_VERSION,type ProjectManifest} from './generated.ts';
export const MAX_MANIFEST_BYTES=64*1024;
export const MAX_MANIFEST_DEPTH=32;
export class ManifestError extends Error {
  code:string;path:string;
  constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.name='ManifestError';this.code=code;this.path=path;}
}
const bad=(code:string,path:string,message:string):never=>{throw new ManifestError(code,path,message);};
interface Schema {type?:string;const?:unknown;enum?:unknown[];$ref?:string;required?:string[];properties?:Record<string,Schema>;additionalProperties?:boolean;pattern?:string;minLength?:number;maxLength?:number;minimum?:number;maximum?:number;minItems?:number;maxItems?:number;uniqueItems?:boolean;items?:Schema;$defs?:Record<string,Schema>;}
const schema=MANIFEST_SCHEMA as unknown as Schema;
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function canonical(v:unknown):string {if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(record(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
function validate(v:unknown,n:Schema,path:string):void {
 if(n.$ref){const target=schema.$defs?.[n.$ref.split('/').at(-1)!];if(!target)throw new Error('Broken generated schema reference.');return validate(v,target,path);}
 const matches=n.type==='object'?record(v):n.type==='array'?Array.isArray(v):n.type==='integer'?typeof v==='number'&&Number.isSafeInteger(v):typeof v===n.type;
 if(!matches)bad('E_TYPE',path,`Expected ${n.type}.`);
 if(Object.hasOwn(n,'const')&&v!==n.const)bad('E_CONST',path,`Expected ${JSON.stringify(n.const)}.`);
 if(n.enum&&!n.enum.includes(v))bad('E_ENUM',path,'Value is not supported.');
 if(record(v)){
  for(const k of n.required??[])if(!Object.hasOwn(v,k))bad('E_REQUIRED',`${path}.${k}`,'Required field is missing.');
  for(const [k,child]of Object.entries(n.properties??{}))if(Object.hasOwn(v,k))validate(v[k],child,`${path}.${k}`);
  if(n.additionalProperties===false)for(const k of Object.keys(v))if(!Object.hasOwn(n.properties??{},k))bad('E_PROPERTY',`${path}.${k}`,'Unknown field.');
 }
 if(typeof v==='string'){
  const length=Array.from(v).length;
  if(n.minLength!==undefined&&length<n.minLength||n.maxLength!==undefined&&length>n.maxLength)bad('E_LENGTH',path,'String length is outside the permitted range.');
  if(n.pattern&&!new RegExp(n.pattern).test(v))bad('E_PATTERN',path,'Value does not match the required format.');
 }
 if(typeof v==='number'){
  if(n.minimum!==undefined&&v<n.minimum)bad('E_MINIMUM',path,`Minimum is ${n.minimum}.`);
  if(n.maximum!==undefined&&v>n.maximum)bad('E_MAXIMUM',path,`Maximum is ${n.maximum}.`);
 }
 if(Array.isArray(v)){
  if(n.minItems!==undefined&&v.length<n.minItems||n.maxItems!==undefined&&v.length>n.maxItems)bad('E_ITEMS',path,'Array length is outside the permitted range.');
  if(n.uniqueItems&&new Set(v.map(canonical)).size!==v.length)bad('E_DUPLICATE_ITEMS',path,'Duplicate array records are not permitted.');
  v.forEach((item,i)=>validate(item,n.items!,`${path}[${i}]`));
 }
}
function checkDepth(v:unknown,depth=0):void {if(v!==null&&typeof v==='object'){if(depth>=MAX_MANIFEST_DEPTH)bad('E_DEPTH','$',`Manifest exceeds ${MAX_MANIFEST_DEPTH} nesting levels.`);for(const value of Object.values(v))checkDepth(value,depth+1);}}
function compareVersions(a:string,b:string):number {const aa=a.split('.').map(Number),bb=b.split('.').map(Number);for(let i=0;i<3;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return 0;}
export function validateProjectManifest(value:unknown):ProjectManifest {
 checkDepth(value);
 if(record(value)&&Number.isSafeInteger(value.projectFormatVersion)&&value.projectFormatVersion!==PROJECT_FORMAT_VERSION)bad('E_PROJECT_VERSION','$.projectFormatVersion',`Project format ${value.projectFormatVersion} is unsupported; this build reads format ${PROJECT_FORMAT_VERSION}.`);
 validate(value,schema,'$');const v=value as ProjectManifest;
 if(compareVersions(v.engineVersion,v.minimumEngineVersion)<0)bad('E_ENGINE_RANGE','$.engineVersion','Authored engine version cannot be older than the minimum engine version.');
 if(compareVersions(CURRENT_ENGINE_VERSION,v.minimumEngineVersion)<0)bad('E_ENGINE_VERSION','$.minimumEngineVersion',`Project requires engine ${v.minimumEngineVersion}; this build is ${CURRENT_ENGINE_VERSION}.`);
 // Kind-specific requirements are checked in both language readers; JSON Schema remains additive for v1.
 const source=v.content as Record<string,unknown>;
 const fields=source.kind==='legacy-phase34'?['foundation','town','galleries','vault']:['index'];
 for(const field of fields)if(!Object.hasOwn(source,field))bad('E_REQUIRED',`$.content.${field}`,'Required content path is missing.');
 if(Object.hasOwn(source,'encounterGroups')!==Object.hasOwn(source,'encounterPlacements'))bad('E_ENCOUNTER_PAIR','$.content','Encounter groups and placements must both be provided.');
 const ids=new Set<string>();v.startingParty.forEach((a,i)=>{if(ids.has(a.id))bad('E_REFERENCE_DUPLICATE',`$.startingParty[${i}].id`,'Actor is already in the starting party.');ids.add(a.id);});
 return v;
}
export function readProjectManifest(text:string):ProjectManifest {
 text=text.replace(/^\uFEFF/,'');
 if(new TextEncoder().encode(text).length>MAX_MANIFEST_BYTES)bad('E_SIZE','$',`Manifest exceeds ${MAX_MANIFEST_BYTES} bytes.`);
 let value:unknown;try{value=JSON.parse(text);}catch{bad('E_JSON','$','Manifest is not valid JSON.');}
 return validateProjectManifest(value);
}
export function serializeProjectManifest(value:ProjectManifest):string {
 validateProjectManifest(value);
 let text=JSON.stringify(value,null,2)+'\n';
 if(new TextEncoder().encode(text).length>MAX_MANIFEST_BYTES)text=JSON.stringify(value);
 readProjectManifest(text);return text;
}
export function createStableId(prefix:string):string {
 if(!/^[a-z][a-z0-9_]{0,61}$(?![\s\S])/.test(prefix))bad('E_ID_PREFIX','$','ID prefix must be 1–62 lowercase ASCII letters, digits or underscores, beginning with a letter.');
 return prefix+'_'+crypto.randomUUID().replaceAll('-','');
}
