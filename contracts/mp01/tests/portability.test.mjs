import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ContractError,validateCatalogue,validateCharacter,validateLock,validateTransfer,compareVersions} from '../validate.mjs';
const load=async n=>JSON.parse(await readFile(new URL('../fixtures/'+n+'.json',import.meta.url),'utf8'));
const character=await load('character'),transfer=await load('transfer'),lock=await load('catalogue-lock'),set=await load('cases/core-and-two-packs');
const clone=x=>structuredClone(x);
function rejects(check,mutate,code,path,baseline=character){const v=clone(baseline);mutate(v);assert.throws(()=>check(v),e=>e instanceof ContractError&&e.code===code&&e.path===path);}
test('portable envelope round trip preserves charges, conditions and opaque unknown extension state',()=>{const v=clone(character);v.items[0].charges=7;v.state={'brass:quest:unknown_extension':{nested:['preserve',4]}};const frozen=JSON.stringify(v);validateCharacter(v);assert.equal(JSON.stringify(v),frozen);assert.deepEqual(validateCharacter(JSON.parse(frozen)),v);});
test('missing provider is diagnosed without mutating envelope',()=>{const v=clone(character);v.classId='brass:class:bellwarden';const before=JSON.stringify(v);assert.throws(()=>validateCharacter(v),e=>e.code==='E_PIN_MISSING');assert.equal(JSON.stringify(v),before);});
for(const [name,mut,code,path] of [
 ['race kind',v=>v.raceId='core:item:sword','E_REFERENCE_KIND','$.raceId'],
 ['class kind',v=>v.classId='core:item:sword','E_REFERENCE_KIND','$.classId'],
 ['missing pin',v=>v.raceId='brass:race:human','E_PIN_MISSING','$.raceId'],
 ['duplicate pins',v=>v.compatibility.requiredPacks.push(clone(v.compatibility.requiredPacks[0])),'E_PIN_DUPLICATE','$.compatibility.requiredPacks[1].packId'],
 ['campaign-bound item',v=>v.items[0].binding='campaign','E_CAMPAIGN_BOUND','$.items[0].binding'],
 ['duplicate item identity',v=>v.items.push(clone(v.items[0])),'E_INSTANCE_DUPLICATE','$.items[1].instanceId'],
 ['dangling equipment',v=>v.equipment.melee='i_missing','E_EQUIPMENT_REFERENCE','$.equipment.melee'],
 ['double equipped instance',v=>v.equipment.offhand='i_sword','E_EQUIPMENT_DUPLICATE','$.equipment.offhand'],
 ['local condition',v=>v.conditions[0].portable=false,'E_CONDITION_LOCAL','$.conditions[0].portable'],
 ['timed condition null',v=>v.conditions[0].remaining=null,'E_CONDITION_DURATION','$.conditions[0].remaining'],
 ['persistent finite condition',v=>v.conditions[0].unit='persistent','E_CONDITION_DURATION','$.conditions[0].remaining'],
 ['duplicate ability',v=>v.abilities.push(v.abilities[0]),'E_ABILITY_DUPLICATE','$.abilities'],
 ['negative charges',v=>v.items[0].charges=-1,'E_SCHEMA','$.items[0].charges'],
 ['future character format',v=>v.formatVersion=2,'E_SCHEMA','$.formatVersion'],
 ['unknown top-level field',v=>v.campaignFlags=[],'E_SCHEMA','$.campaignFlags'],
 ['bad hash',v=>v.compatibility.requiredPacks[0].sha256='bad','E_SCHEMA','$.compatibility.requiredPacks[0].sha256'],
 ['fractional revision',v=>v.revision=1.5,'E_SCHEMA','$.revision'],
 ['wrong resource kind',v=>v.resources['core:item:sword']=3,'E_REFERENCE_KIND','$.resources.core:item:sword']
])test(name,()=>rejects(validateCharacter,mut,code,path));
test('persistent portable condition is accepted',()=>{const v=clone(character);v.conditions[0].unit='persistent';v.conditions[0].remaining=null;validateCharacter(v);});
test('lock requires unique provider pins',()=>rejects(validateLock,v=>v.packs.push(clone(v.packs[0])),'E_PIN_DUPLICATE','$.packs[1].packId',lock));
test('lock requires core pin',()=>rejects(validateLock,v=>v.packs[0].packId='brass','E_PIN_CORE','$.packs',lock));
test('move preserves identity',()=>validateTransfer(transfer));
test('copy requires new identity',()=>rejects(validateTransfer,v=>v.operation='copy','E_TRANSFER_IDENTITY','$.destinationCharacterId',transfer));
test('explicit copy identity is accepted',()=>{const v=clone(transfer);v.operation='copy';v.destinationCharacterId='c_copy';validateTransfer(v);});
test('move cannot change identity',()=>rejects(validateTransfer,v=>v.destinationCharacterId='c_other','E_TRANSFER_IDENTITY','$.destinationCharacterId',transfer));
test('source and destination differ',()=>rejects(validateTransfer,v=>v.destinationCampaignId=v.sourceCampaignId,'E_TRANSFER_DESTINATION','$.destinationCampaignId',transfer));
test('invalid receipt stage rejected',()=>rejects(validateTransfer,v=>v.stage='whatever','E_SCHEMA','$.stage',transfer));
test('numeric version ordering avoids lexicographic 1.10 vs 1.9 error',()=>{assert.equal(compareVersions('1.10.0','1.9.0'),1);assert.equal(compareVersions('1.0.0','1.0.0'),0);assert.throws(()=>compareVersions('01.0.0','1.0.0'));});
test('validation leaves catalogue descriptors unchanged',()=>{const v=clone(set),before=JSON.stringify(v);validateCatalogue(v);assert.equal(JSON.stringify(v),before);});
test('malformed descriptor has schema diagnostic instead of TypeError',()=>rejects(validateCatalogue,v=>v.packs[0]=null,'E_SCHEMA','$.packs[0]',set));
test('unknown selection fields are rejected',()=>rejects(validateCatalogue,v=>v.loadOrder=1,'E_SCHEMA','$.loadOrder',set));
test('optional incompatible provider still fails',()=>rejects(validateCatalogue,v=>v.packs[2].manifest.dependencies[1].versions.min='1.1.0','E_DEPENDENCY_VERSION','$.packs[2].manifest.dependencies[1].versions',set));
test('definition file cannot shadow index',()=>rejects(validateCatalogue,v=>v.packs[1].index.definitions[0].file='content/index.json','E_PATH_DUPLICATE','$.packs[1].index.definitions[0].file',set));
test('prototype-like names cannot be namespaces',()=>rejects(validateCatalogue,v=>v.packs[0].manifest.packId='__proto__','E_SCHEMA','$.packs[0].manifest.packId',set));
test('wrong schema version rejected',()=>rejects(validateCatalogue,v=>v.packs[1].manifest.formatVersion=2,'E_SCHEMA','$.packs[1].manifest.formatVersion',set));
test('guarded optional reference missing in installed provider still fails',()=>rejects(validateCatalogue,v=>v.packs[2].index.definitions[2].references[0].id='brass:item:missing','E_REFERENCE_MISSING','$.packs[2].index.definitions[2].references[0].id',set));
test('lower dependency version bound is inclusive',()=>validateCatalogue(set));
test('upper dependency version bound is exclusive',()=>rejects(validateCatalogue,v=>v.packs[1].manifest.dependencies[0].versions.maxExclusive='1.0.0','E_VERSION_RANGE','$.packs[1].manifest.dependencies[0].versions',set));
test('dependency upper endpoint rejects provider exactly at maxExclusive',()=>rejects(validateCatalogue,v=>v.packs[0].manifest.version='2.0.0','E_DEPENDENCY_VERSION','$.packs[1].manifest.dependencies[0].versions',set));
test('required provider references cannot masquerade as optional branches',()=>rejects(validateCatalogue,v=>v.packs[1].index.definitions[1].references[0]={id:'core:ability:strike',whenPackEnabled:'core',onAbsent:'skip'},'E_OPTIONAL_GUARD','$.packs[1].index.definitions[1].references[0]',set));
test('local references cannot use provider guard',()=>rejects(validateCatalogue,v=>v.packs[1].index.definitions[1].references=[{id:'brass:item:buckler',whenPackEnabled:'brass',onAbsent:'skip'}],'E_OPTIONAL_GUARD','$.packs[1].index.definitions[1].references[0]',set));
test('content index cannot shadow manifest',()=>rejects(validateCatalogue,v=>v.packs[1].manifest.contentIndex='pack.json','E_INDEX_PATH','$.packs[1].manifest.contentIndex',set));
test('content index must be a JSON path',()=>rejects(validateCatalogue,v=>v.packs[1].manifest.contentIndex='content/index.png','E_SCHEMA','$.packs[1].manifest.contentIndex',set));
test('core is required by every noncore pack',()=>rejects(validateCatalogue,v=>v.packs[1].manifest.dependencies=[],'E_CORE_DEPENDENCY','$.packs[1].manifest.dependencies',set));
