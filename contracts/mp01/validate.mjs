/** MP01 contract preflight only. No catalogue installation or save mutation. */
import {readFile} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
const names=['common','pack','content-index','character','catalogue-lock','transfer','catalogue'];
const ajv=new Ajv2020({strict:true,allErrors:true});
for(const n of names)ajv.addSchema(JSON.parse(await readFile(new URL('./schemas/'+n+'.schema.json',import.meta.url),'utf8')));
export class ContractError extends Error {
 constructor(code,path,message){super(`${code} at ${path}: ${message}`);this.name='ContractError';this.code=code;this.path=path;}
}
const fail=(code,path,message)=>{throw new ContractError(code,path,message);};
export function validateDocument(kind,value,path='$'){
 const check=ajv.getSchema(`https://maxxia.invalid/contracts/mp01/${kind}.schema.json`);
 if(!check)throw new TypeError('Unknown contract kind '+kind);
 if(!check(value)){
  const e=check.errors[0];const suffix=e.instancePath.split('/').slice(1).map(x=>/^\d+$/.test(x)?`[${x}]`:'.'+x.replaceAll('~1','/').replaceAll('~0','~')).join('');
  const property=e.keyword==='additionalProperties'?e.params.additionalProperty:e.keyword==='required'?e.params.missingProperty:null;
  fail('E_SCHEMA',path+suffix+(property?'.'+property:''),e.message);
 }
 return value;
}
export function compareVersions(a,b){
 const valid=/^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/;
 if(!valid.test(a)||!valid.test(b))throw new TypeError('Expected canonical numeric major.minor.patch versions');
 const av=a.split('.').map(Number),bv=b.split('.').map(Number);
 for(let i=0;i<3;i++)if(av[i]!==bv[i])return av[i]<bv[i]?-1:1;
 return 0;
}
const within=(v,r)=>compareVersions(v,r.min)>=0&&compareVersions(v,r.maxExclusive)<0;
function range(r,path){if(compareVersions(r.min,r.maxExclusive)>=0)fail('E_VERSION_RANGE',path,'min must precede maxExclusive.');}
function rulesMatch(a,b){return a.id===b.id&&a.version===b.version;}
export function validateCatalogue(input){
 validateDocument('catalogue',input);
 const packs=new Map(),defs=new Map();
 for(const [i,p] of input.packs.entries()){
  const at=`$.packs[${i}]`;validateDocument('pack',p.manifest,at+'.manifest');validateDocument('content-index',p.index,at+'.index');
  const m=p.manifest;
  if(packs.has(m.packId))fail('E_PACK_DUPLICATE',at+'.manifest.packId','Pack IDs must be unique in a selection.');
  packs.set(m.packId,{...p,at});
  if(m.contentIndex.toLowerCase()==='pack.json')fail('E_INDEX_PATH',at+'.manifest.contentIndex','The content index cannot shadow the manifest.');
  if((m.kind==='core')!==(m.packId==='core'))fail('E_CORE',at+'.manifest.kind','The reserved core namespace must have core kind, and no other namespace may claim it.');
  range(m.engine,at+'.manifest.engine');
  if(!within(input.engineVersion,m.engine))fail('E_ENGINE',at+'.manifest.engine',`Engine ${input.engineVersion} is outside the supported interval.`);
  if(!rulesMatch(m.rules,input.rules))fail('E_RULES',at+'.manifest.rules','Pack must use the selected exact rules profile and version.');
 }
 for(const p of packs.values()){
  if(p.manifest.packId!=='core'&&!p.manifest.dependencies.some(d=>d.packId==='core'&&!d.optional))fail('E_CORE_DEPENDENCY',p.at+'.manifest.dependencies','Every noncore pack must declare core as a required direct dependency.');
  const dependencies=new Set();
  for(const [i,d] of p.manifest.dependencies.entries()){
   const at=p.at+`.manifest.dependencies[${i}]`;
   if(dependencies.has(d.packId))fail('E_DEPENDENCY_DUPLICATE',at+'.packId','Declare a provider once.');dependencies.add(d.packId);
   if(d.packId===p.manifest.packId)fail('E_DEPENDENCY_SELF',at+'.packId','A pack cannot depend on itself.');
   range(d.versions,at+'.versions');const provider=packs.get(d.packId);
   if(!provider&&!d.optional)fail('E_DEPENDENCY_MISSING',at+'.packId',`Required provider ${d.packId} is absent.`);
   if(provider&&!within(provider.manifest.version,d.versions))fail('E_DEPENDENCY_VERSION',at+'.versions',`Installed ${d.packId} ${provider.manifest.version} is incompatible; optional means absent is permitted, not incompatible is permitted.`);
  }
 }
 if(!packs.has('core'))fail('E_CORE','$.packs','The selected catalogue must include core.');
 if(input.rules.id!=='core:rules:classic')fail('E_RULES','$.rules','v1 supports core:rules:classic only.');
 // Validate an explicitly selected set. This is not version discovery/selection or a lock resolver.
 const visiting=new Set(),visited=new Set();
 function visit(id){if(visiting.has(id))fail('E_DEPENDENCY_CYCLE',packs.get(id).at+'.manifest.dependencies','Selected dependency graph contains a cycle.');if(visited.has(id))return;visiting.add(id);for(const d of packs.get(id).manifest.dependencies)if(packs.has(d.packId))visit(d.packId);visiting.delete(id);visited.add(id);}
 for(const id of packs.keys())visit(id);
 for(const p of packs.values()){
  const files=new Set(['pack.json',p.manifest.contentIndex.toLowerCase()]);
  for(const [i,d] of p.index.definitions.entries()){
   const at=p.at+`.index.definitions[${i}]`,[ns,kind]=d.id.split(':');
   if(defs.has(d.id))fail('E_ID_DUPLICATE',at+'.id','Full definition ID must be unique.');
   if(ns!==p.manifest.packId)fail('E_NAMESPACE',at+'.id','Pack may define only its own namespace.');
   if(kind!==d.kind)fail('E_ID_KIND',at+'.id','ID kind must match the descriptor kind.');
   if(files.has(d.file.toLowerCase()))fail('E_PATH_DUPLICATE',at+'.file','Definition files must be unique, including on case-insensitive filesystems.');files.add(d.file.toLowerCase());
   if(new Set(d.tags).size!==d.tags.length)fail('E_TAG_DUPLICATE',at+'.tags','Tags must be unique.');
   if(d.placement==='eligible'&&(d.visibility!=='exported'||!['item','monster','loot','encounter'].includes(d.kind)))fail('E_PLACEMENT',at+'.placement','Generic placement is limited to exported item/monster/loot/encounter definitions.');
   defs.set(d.id,{...d,at,owner:p.manifest.packId});
  }
  const e=p.manifest.entry;
  if((p.manifest.kind==='adventure')!==(e!==null))fail('E_ENTRY',p.at+'.manifest.entry','Only adventure packs must declare an entry.');
  if(e){const target=defs.get(e.mapId);if(!target||target.owner!==p.manifest.packId||target.kind!=='map')fail('E_ENTRY',p.at+'.manifest.entry.mapId','Entry must name a map owned by this adventure.');}
 }
 for(const p of packs.values())for(const [i,d] of p.index.definitions.entries())for(const [j,reference] of d.references.entries()){
  const at=p.at+`.index.definitions[${i}].references[${j}]`,providerId=reference.id.split(':')[0];
  if(providerId!==p.manifest.packId){
   const dependency=p.manifest.dependencies.find(x=>x.packId===providerId);
   if(!dependency)fail('E_REFERENCE_DEPENDENCY',at+'.id','Cross-pack references require a direct declared dependency.');
   if(dependency.optional&&(reference.whenPackEnabled!==providerId||reference.onAbsent!=='skip')||!dependency.optional&&reference.whenPackEnabled!==undefined)fail('E_OPTIONAL_GUARD',at,'Optional provider references must be explicitly guarded by that provider and skipped when absent; required references are unguarded.');
   if(dependency.optional&&!packs.has(providerId))continue;
  }else if(reference.whenPackEnabled!==undefined)fail('E_OPTIONAL_GUARD',at,'Local references cannot be optional-provider branches.');
  const target=defs.get(reference.id);
  if(!target)fail('E_REFERENCE_MISSING',at+'.id','Referenced definition does not exist.');
  if(target.owner!==p.manifest.packId&&target.visibility!=='exported')fail('E_REFERENCE_PRIVATE',at+'.id','Cross-pack references may target only exported definitions.');
 }
 return {packIds:[...packs.keys()].sort(),definitionIds:[...defs.keys()].sort(),exportedIds:[...defs.values()].filter(d=>d.visibility==='exported').map(d=>d.id).sort()};
}
function pins(values,path){
 const seen=new Set();for(const [i,p] of values.entries()){if(seen.has(p.packId))fail('E_PIN_DUPLICATE',path+`[${i}].packId`,'Pin each pack once.');seen.add(p.packId);}
 if(!seen.has('core'))fail('E_PIN_CORE',path,'Pin the core rules provider.');return seen;
}
function kind(id,expected,path){if(id.split(':')[1]!==expected)fail('E_REFERENCE_KIND',path,`Expected ${expected} ID.`);}
export function validateCharacter(value){
 validateDocument('character',value);const providers=pins(value.compatibility.requiredPacks,'$.compatibility.requiredPacks');
 if(value.compatibility.rules.id!=='core:rules:classic')fail('E_RULES','$.compatibility.rules','Unsupported rules profile.');
 function ref(id,expected,path){kind(id,expected,path);if(!providers.has(id.split(':')[0]))fail('E_PIN_MISSING',path,'Every referenced provider must have an exact dependency pin.');}
 ref(value.raceId,'race','$.raceId');ref(value.classId,'class','$.classId');
 if(new Set(value.abilities).size!==value.abilities.length)fail('E_ABILITY_DUPLICATE','$.abilities','Ability IDs must be unique.');
 value.abilities.forEach((id,i)=>ref(id,'ability',`$.abilities[${i}]`));
 const items=new Set();for(const [i,v] of value.items.entries()){
  const at=`$.items[${i}]`;if(items.has(v.instanceId))fail('E_INSTANCE_DUPLICATE',at+'.instanceId','Item instances must be unique.');items.add(v.instanceId);ref(v.definitionId,'item',at+'.definitionId');
  if(v.binding!=='portable')fail('E_CAMPAIGN_BOUND',at+'.binding','This portable envelope cannot carry campaign-bound items.');
 }
 const equipped=new Set();for(const [slot,id] of Object.entries(value.equipment)){
  if(!items.has(id))fail('E_EQUIPMENT_REFERENCE','$.equipment.'+slot,'Equipment must name an owned item instance.');
  if(equipped.has(id))fail('E_EQUIPMENT_DUPLICATE','$.equipment.'+slot,'An item instance may occupy only one slot.');equipped.add(id);
 }
 value.conditions.forEach((v,i)=>{const at=`$.conditions[${i}]`;ref(v.definitionId,'condition',at+'.definitionId');if(!v.portable)fail('E_CONDITION_LOCAL',at+'.portable','Campaign-only conditions remain in campaign state.');if((v.unit==='persistent')!==(v.remaining===null))fail('E_CONDITION_DURATION',at+'.remaining','Persistent durations are null; timed durations are finite integers.');});
 for(const id of Object.keys(value.resources))ref(id,'ability','$.resources.'+id);
 return value;
}
export function validateLock(value){validateDocument('catalogue-lock',value);pins(value.packs,'$.packs');if(value.rules.id!=='core:rules:classic')fail('E_RULES','$.rules','Unsupported rules profile.');return value;}
export function validateTransfer(value){
 validateDocument('transfer',value);
 if(value.sourceCampaignId===value.destinationCampaignId)fail('E_TRANSFER_DESTINATION','$.destinationCampaignId','Transfer requires different campaign instances.');
 if((value.operation==='move')!==(value.sourceCharacterId===value.destinationCharacterId))fail('E_TRANSFER_IDENTITY','$.destinationCharacterId','Moves preserve identity; explicit copies require a new identity.');
 return value;
}
