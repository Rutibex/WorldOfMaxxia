/** MM12 named, project-owned descriptions and repeat policies for six supported states.
 * IDs and mechanical effects remain fixed to preserve campaign save semantics. */
import defaults from './conditions-default.json' with {type:'json'};
import type {Condition} from '../rules/party.ts';
export type ConditionDefinition={id:string;name:string;description:string;reapply:'replace'|'extend'};
export type ConditionDatabase={format:'maxxia-conditions';version:1;conditions:ConditionDefinition[]};
export const CONDITION_IDS=['poisoned','asleep','frightened','cursed','drunk','hungry'] as const;
export const MAX_CONDITIONS_BYTES=16384;
let byId=new Map<string,ConditionDefinition>();
export function readConditionDatabase(value:unknown):ConditionDatabase{
 let obj:unknown=value;
 if(typeof value==='string'){
  if(new TextEncoder().encode(value).length>MAX_CONDITIONS_BYTES)throw new RangeError('Condition database exceeds 16 KiB.');
  obj=JSON.parse(value);
 }
 if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new TypeError('Expected condition database.');
 const db=obj as ConditionDatabase;
 if(db.format!=='maxxia-conditions'||db.version!==1||!Array.isArray(db.conditions)||db.conditions.length!==CONDITION_IDS.length)throw new TypeError('Expected six supported condition definitions, version 1.');
 const ids=new Set<string>();
 for(const condition of db.conditions){
  if(!condition||!CONDITION_IDS.includes(condition.id as typeof CONDITION_IDS[number])||ids.has(condition.id)||typeof condition.name!=='string'||!condition.name.trim()||condition.name.length>80||typeof condition.description!=='string'||condition.description.length>500||!['replace','extend'].includes(condition.reapply))throw new TypeError('Invalid or duplicate condition definition.');
  ids.add(condition.id);
 }
 return db;
}
export function installConditionDatabase(value:unknown):void{
 const validated=readConditionDatabase(value);
 byId=new Map(validated.conditions.map(c=>[c.id,{...c}]));
}
export function resetConditionDatabase():void{installConditionDatabase(defaults);}
export function conditionDefinition(id:string):ConditionDefinition|undefined{return byId.get(id);}
/** Compatible with saved Condition instances: no new serialization fields. */
export function applyConditionPolicy(existing:readonly Condition[], next:Condition):Condition[]{
 const previous=existing.find(e=>e.id===next.id),definition=conditionDefinition(next.id);
 if(!previous||definition?.reapply!=='extend'||previous.unit!==next.unit||next.remaining===null||previous.remaining===null)return [...existing.filter(e=>e.id!==next.id),next];
 return [...existing.filter(e=>e.id!==next.id),{...next,remaining:Math.min(999,previous.remaining+next.remaining)}];
}
resetConditionDatabase();
