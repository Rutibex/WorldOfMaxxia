/** MP07 — bounded, typed, pack-qualified mutable adventure state.
 * Definitions stay in the composed catalogue; only values are serialized here.
 * Future script/actions must use these operations rather than mutating definitions.
 */
import type {MapRegistry} from './campaign.ts';

export type ScopeAddress = {scope:'campaign'} | {scope:'local';mapId:string};
export interface StateBucket {
 flags:Record<string,boolean>;
 counters:Record<string,number>;
 collections:Record<string,string[]>;
}
export interface ScopedState {version:1;campaign:StateBucket;local:Record<string,StateBucket>;}
export type ScopedAction =
 | {kind:'flag';address:ScopeAddress;key:string;value:boolean}
 | {kind:'counter';address:ScopeAddress;key:string;delta:number}
 | {kind:'collection-add'|'collection-remove';address:ScopeAddress;key:string;value:string};

const qualified=/^[a-z][a-z0-9_]{0,47}:(flag|counter|collection):[a-z][a-z0-9_]{0,79}$/;
const identifier=/^[a-z][a-z0-9_]{0,79}$/;
const MAX_FIELDS=128, MAX_LOCAL=20, MAX_ENTRIES=128, MAX_COUNTER=100000000;
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const empty=():StateBucket=>({flags:Object.create(null),counters:Object.create(null),collections:Object.create(null)});
export function newScopedState():ScopedState{return {version:1,campaign:empty(),local:Object.create(null)};}
function validateBucket(value:unknown):asserts value is StateBucket {
 if(!record(value)||Object.keys(value).sort().join(',')!=='collections,counters,flags'||!record(value.flags)||!record(value.counters)||!record(value.collections))throw new TypeError('Malformed typed state bucket.');
 const groups:[string,Record<string,unknown>][]=[['flag',value.flags],['counter',value.counters],['collection',value.collections]];
 let total=0;
 for(const [type,values] of groups){
  const entries=Object.entries(values);total+=entries.length;
  if(entries.length>MAX_FIELDS)throw new TypeError('Typed state exceeds field limit.');
  for(const [key,v] of entries){if(!qualified.test(key)||key.split(':')[1]!==type)throw new TypeError(`Invalid typed state key ${key}.`);
   if(type==='flag'&&typeof v!=='boolean')throw new TypeError(`Flag ${key} must be boolean.`);
   if(type==='counter'&&(!Number.isSafeInteger(v)||Math.abs(v as number)>MAX_COUNTER))throw new TypeError(`Counter ${key} exceeds bounds.`);
   if(type==='collection'&&(!Array.isArray(v)||v.length>MAX_ENTRIES||v.some(e=>typeof e!=='string'||!identifier.test(e))||new Set(v).size!==v.length))throw new TypeError(`Invalid collection ${key}.`);
  }
 }
 if(total>MAX_FIELDS)throw new TypeError('Too many scoped state fields.');
}
export function validateScopedState(value:unknown,registry:MapRegistry):ScopedState {
 if(!record(value)||Object.keys(value).sort().join(',')!=='campaign,local,version'||value.version!==1||!record(value.local))throw new TypeError('Invalid namespaced state document.');
 validateBucket(value.campaign);
 if(Object.keys(value.local).length>MAX_LOCAL)throw new TypeError('Too many local state maps.');
 for(const [mapId,content] of Object.entries(value.local)){
  if(!Object.hasOwn(registry,mapId))throw new TypeError(`Unknown local state map ${mapId}.`);
  validateBucket(content);
 }
 return value as unknown as ScopedState;
}
function target(state:ScopedState,address:ScopeAddress,registry:MapRegistry):StateBucket {
 if(address.scope==='campaign')return state.campaign;
 if(address.scope!=='local'||!Object.hasOwn(registry,address.mapId))throw new TypeError('Unknown local state map.');
 return state.local[address.mapId]??(state.local[address.mapId]=empty());
}
/** Pure transaction: invalid actions never partially commit a state change. */
export function applyScopedAction(source:ScopedState,action:ScopedAction,registry:MapRegistry):ScopedState {
 validateScopedState(source,registry);
 const prefix=action.kind==='flag'?'flag':action.kind==='counter'?'counter':'collection';
 if(typeof action.key!=='string'||!qualified.test(action.key)||action.key.split(':')[1]!==prefix)throw new TypeError('State key does not match action type.');
 const next=structuredClone(source),bucket=target(next,action.address,registry);
 if(action.kind==='flag'){
  if(typeof action.value!=='boolean')throw new TypeError('Flag value must be boolean.');
  bucket.flags[action.key]=action.value;
 }else if(action.kind==='counter'){
  if(!Number.isSafeInteger(action.delta))throw new TypeError('Counter delta must be an integer.');
  const sum=(bucket.counters[action.key]??0)+action.delta;
  if(!Number.isSafeInteger(sum)||Math.abs(sum)>MAX_COUNTER)throw new RangeError('Counter overflow.');
  bucket.counters[action.key]=sum;
 }else{
  if(!identifier.test(action.value))throw new TypeError('Invalid collection element.');
  const previous=bucket.collections[action.key]??[];
  bucket.collections[action.key]=action.kind==='collection-add'?[...new Set([...previous,action.value])]:previous.filter(value=>value!==action.value);
 }
 return validateScopedState(next,registry);
}
export function readScopedValue(state:ScopedState,address:ScopeAddress,kind:'flag'|'counter'|'collection',key:string,registry:MapRegistry):boolean|number|readonly string[]{
 validateScopedState(state,registry);
 if(!qualified.test(key)||key.split(':')[1]!==kind)throw new TypeError('Invalid scoped read key.');
 const bucket=address.scope==='campaign'?state.campaign:(Object.hasOwn(registry,address.mapId)?state.local[address.mapId]:undefined);
 if(address.scope==='local'&&!Object.hasOwn(registry,address.mapId))throw new TypeError('Unknown local state map.');
 return kind==='flag'?bucket?.flags[key]??false:kind==='counter'?bucket?.counters[key]??0:[...(bucket?.collections[key]??[])];
}
