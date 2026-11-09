import {parseAmountExpression,ExpressionError} from '../rules/expressions.ts';
/** MM10: validated, project-authored spell catalog and per-class learning lists. */
import bundled from './spells-default.json' with {type:'json'};
export type SpellTarget='enemy'|'enemies'|'ally'|'dead_ally'|'party'|'world'|'object';
export type SpellContext='combat'|'exploration'|'both';
export type SpellEffect='damage'|'heal'|'light'|'attack_debuff'|'bind'|'reveal'|'unseal'|'ward'|'fold'|'cure'|'steadfast'|'chorus'|'turn_undead'|'break_curse'|'revive'|'hints'|'leech'|'sleep'|'secret'|'bones'|'briar'|'echo'|'hearth'|'composed';
export type PrimitiveTarget='selected'|'caster'|'party'|'enemies';
export type PrimitiveOperation='damage'|'heal'|'resource'|'condition'|'cure'|'revive'|'ward'|'hex'|'reveal'|'unseal'|'fold';
export interface SpellPrimitive {operation:PrimitiveOperation;target:PrimitiveTarget;amount?:string;resource?:'hp'|'sp';damageType?:'physical'|'fire'|'cold'|'lightning'|'poison'|'arcane'|'holy'|'necrotic';conditionId?:string;wardKind?:'stone_skin'|'mirror_ward'|'blessing'|'sheltering_hand'|'steadfast'|'briar_mantle'|'light'|'glass_eye'|'borrowed_face';hexKind?:'ill_omen'|'binding_thread'|'sleep_thorns'|'crooked_bones'|'bottle_echo'|'hollow_fear';unit?:'ticks'|'turns'|'minutes'|'persistent';remaining?:number|null;}
export interface SpellDefinition {effects?:SpellPrimitive[];id:string;name:string;classId:string;level:number;sp:number;target:SpellTarget;context:SpellContext;effect:SpellEffect;description:string;behaviorKey:string;damageType?:string;duration?:number;dice?:string;save?:'DEX'|'WIS'|'CON';saveHalf?:boolean;bonus?:'INT'|'WIS'|'CHA';}
export interface SpellClassAccess{spellIds:string[];starterSpellIds:string[];}
export interface SpellDatabase{conditionsFile?:string;format:'maxxia-spells';version:1;spells:SpellDefinition[];classAccess:Record<string,SpellClassAccess>;}
export const MAX_SPELLS_BYTES=256*1024;
const TARGETS=['enemy','enemies','ally','dead_ally','party','world','object'];
const CONTEXTS=['combat','exploration','both'];
const EFFECTS=['damage','heal','light','attack_debuff','bind','reveal','unseal','ward','fold','cure','steadfast','chorus','turn_undead','break_curse','revive','hints','leech','sleep','secret','bones','briar','echo','hearth','composed'];
const ABILITIES=['INT','WIS','CHA'];const SAVES=['DEX','WIS','CON'];
const baselineKeys=new Set((bundled.spells as SpellDefinition[]).map(s=>s.behaviorKey));
export class SpellDatabaseError extends Error {code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.code=code;this.path=path;this.name='SpellDatabaseError';}}
const bad=(code:string,path:string,message:string):never=>{throw new SpellDatabaseError(code,path,message);};
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const idPattern=/^(?:spell_[a-z0-9_]{1,90}|[a-z][a-z0-9_]{1,90})$/;
export function readSpellDatabase(input:unknown):SpellDatabase{
 let raw:unknown=input;
 if(typeof input==='string'){
  if(new TextEncoder().encode(input).byteLength>MAX_SPELLS_BYTES)bad('E_SIZE','$','Spell database exceeds 256 KiB.');
  try{raw=JSON.parse(input);}catch{bad('E_JSON','$','Malformed JSON.');}
 }
 if(!record(raw)||raw.format!=='maxxia-spells'||raw.version!==1||!Array.isArray(raw.spells)||raw.spells.length<1||raw.spells.length>256||!record(raw.classAccess))bad('E_FORMAT','$','Expected maxxia-spells v1 with 1–256 spells and classAccess.');
 const obj=raw as unknown as SpellDatabase;
 if(obj.conditionsFile!==undefined&&(typeof obj.conditionsFile!=='string'||!/^[a-z][a-z0-9_-]*\.json$/.test(obj.conditionsFile)))bad('E_CONDITIONS','$.conditionsFile','Condition filename must be a safe JSON basename.');
 const ids=new Set<string>();
 for(const [i,spell]of obj.spells.entries()){
  const p=`$.spells[${i}]`;
  if(!record(spell))bad('E_TYPE',p,'Expected spell record.');
  if(typeof spell.id!=='string'||!idPattern.test(spell.id)||ids.has(spell.id))bad('E_ID',p+'.id','Invalid or duplicate spell ID.');ids.add(spell.id);
  if(typeof spell.name!=='string'||!spell.name.trim()||spell.name.length>100||typeof spell.description!=='string'||spell.description.length>2000||typeof spell.classId!=='string'||!idPattern.test(spell.classId))bad('E_TEXT',p,'Invalid spell text or primary class.');
  if(!Number.isSafeInteger(spell.level)||spell.level<1||spell.level>20||!Number.isSafeInteger(spell.sp)||spell.sp<0||spell.sp>999)bad('E_NUMBER',p,'Level must be 1–20 and SP 0–999.');
  if(!TARGETS.includes(spell.target)||!CONTEXTS.includes(spell.context)||!EFFECTS.includes(spell.effect))bad('E_ENUM',p,'Unsupported target, context or effect.');
  if(spell.effect==='composed'){
   if(spell.behaviorKey!=='composed')bad('E_BEHAVIOR',p+'.behaviorKey','Composed spells require the composed behavior key.');
   if(!Array.isArray(spell.effects)||spell.effects.length<1||spell.effects.length>8)bad('E_EFFECTS',p+'.effects','Composed spells require 1–8 primitives.');
   let rollBudget=0;
   for(const [j,primitive] of spell.effects!.entries()){
    const path=`${p}.effects[${j}]`;
    if(!record(primitive)||!['damage','heal','resource','condition','cure','revive','ward','hex','reveal','unseal','fold'].includes(primitive.operation)||!['selected','caster','party','enemies'].includes(primitive.target))bad('E_EFFECT',path,'Unknown primitive operation or target.');
    const op=primitive as unknown as SpellPrimitive;
    const offensive=['damage','hex'].includes(op.operation);
    const world=['reveal','unseal','fold'].includes(op.operation);
    if(world){if(op.target!=='caster'||!['world','object'].includes(spell.target)||spell.context!=='exploration')bad('E_TARGET',path,'World operations require a caster target and exploration spell.');}
    else if(op.operation==='revive'){if(op.target!=='selected'||spell.target!=='dead_ally'||spell.context!=='exploration')bad('E_TARGET',path,'Revive requires a selected fallen ally outside combat.');}
    else if(offensive){if(op.target==='enemies'?spell.target!=='enemies':op.target!=='selected'||spell.target!=='enemy')bad('E_TARGET',path,'Offensive operations require selected enemy or enemy group.');}
    else if(op.operation==='ward'){if(!['caster','party'].includes(op.target)||!['party','ally'].includes(spell.target))bad('E_TARGET',path,'Wards must target caster or party on ally/party spells.');}
    else if(op.target==='enemies'||op.target==='selected'&&spell.target!=='ally'||op.target==='selected'&&!['heal','resource','condition','cure'].includes(op.operation))bad('E_TARGET',path,'This operation requires living allied targets.');
    const noAmount=['condition','cure','revive','ward','hex','reveal','unseal','fold'].includes(op.operation);
    if(!noAmount){
     if(typeof op.amount!=='string'||op.amount.length>120)bad('E_AMOUNT',path+'.amount','Bounded amount expression required.');
     try{rollBudget+=parseAmountExpression(op.amount!).diceRolls;}catch(error){if(error instanceof ExpressionError)bad('E_EXPRESSION',path+'.amount',error.message);throw error;}
    }else if(op.amount!==undefined)bad('E_AMOUNT',path,'This operation cannot have an amount expression.');
    if(op.operation==='resource' ? !['hp','sp'].includes(op.resource!) : op.resource!==undefined)bad('E_RESOURCE',path,'Only resource effects may select HP or SP.');
    if(op.operation==='damage' ? op.damageType!==undefined&&!['physical','fire','cold','lightning','poison','arcane','holy','necrotic'].includes(op.damageType) : op.damageType!==undefined)bad('E_DAMAGE',path,'Only damage effects may choose a damage family.');
    if(['condition','cure'].includes(op.operation) ? !(['poisoned','asleep','frightened','cursed','drunk','hungry'].includes(op.conditionId!)||/^[a-z][a-z0-9_]{0,31}:condition:[a-z][a-z0-9_]{0,31}$/.test(op.conditionId!)) : op.conditionId!==undefined)bad('E_CONDITION',path,'Condition selection required for condition/cure only.');
    if(op.operation==='ward' ? !['stone_skin','mirror_ward','blessing','sheltering_hand','steadfast','briar_mantle','light','glass_eye','borrowed_face'].includes(op.wardKind!) : op.wardKind!==undefined)bad('E_WARD',path,'Unsupported ward kind.');
    if(op.operation==='hex' ? !['ill_omen','binding_thread','sleep_thorns','crooked_bones','bottle_echo','hollow_fear'].includes(op.hexKind!) : op.hexKind!==undefined)bad('E_HEX',path,'Unsupported hex kind.');
    if(['condition','ward','hex','reveal'].includes(op.operation)){
     if(!['ticks','turns','minutes','persistent'].includes(op.unit!)||op.operation!=='condition'&&op.unit!==(op.operation==='hex'?'turns':'minutes'))bad('E_DURATION',path,'Invalid duration unit.');
     const limit=op.operation==='hex' ? (['ill_omen','crooked_bones'].includes(op.hexKind!)?3:['bottle_echo','hollow_fear'].includes(op.hexKind!)?2:1) : op.operation==='ward' ? (['light'].includes(op.wardKind!)?60:['briar_mantle'].includes(op.wardKind!)?5:['steadfast'].includes(op.wardKind!)?3:30) : op.operation==='reveal'?30:999;
     if(op.unit==='persistent'?(op.remaining!==null||op.operation!=='condition'):!Number.isSafeInteger(op.remaining)||op.remaining!<1||op.remaining!>limit)bad('E_DURATION',path,'Duration exceeds supported bounds.');
    }else if(op.unit!==undefined||op.remaining!==undefined)bad('E_DURATION',path,'Unexpected duration.');
   }
   if(rollBudget>48)bad('E_EXPRESSION',p+'.effects','Combined primitives exceed 48 dice rolls.');
  }else{
   if(typeof spell.behaviorKey!=='string'||!baselineKeys.has(spell.behaviorKey))bad('E_BEHAVIOR',p+'.behaviorKey','Select a supported existing behavior key.');
   const baseline=(bundled.spells as SpellDefinition[]).find(s=>s.behaviorKey===spell.behaviorKey)!;
   if(spell.effect!==baseline.effect||spell.target!==baseline.target||spell.context!==baseline.context)bad('E_BEHAVIOR',p,'The selected handler requires its original effect, target and context.');
   if(spell.effects!==undefined)bad('E_EFFECT',p+'.effects','Only composed spells may carry primitives.');
  }
  if(spell.dice!==undefined&&(typeof spell.dice!=='string'||!/^(?:[1-9]|[1-2][0-9])d(?:4|6|8|10|12|20)$/.test(spell.dice)))bad('E_DICE',p+'.dice','Use bounded dice, such as 2d6.');
  if(spell.save!==undefined&&!SAVES.includes(spell.save)||spell.bonus!==undefined&&!ABILITIES.includes(spell.bonus)||spell.saveHalf!==undefined&&typeof spell.saveHalf!=='boolean'||spell.damageType!==undefined&&(typeof spell.damageType!=='string'||!/^[a-z_]{1,30}$/.test(spell.damageType))||spell.duration!==undefined&&(!Number.isSafeInteger(spell.duration)||spell.duration<0||spell.duration>10000))bad('E_OPTION',p,'Invalid optional spell property.');
 }
 if(Object.keys(obj.classAccess).length>128)bad('E_SIZE','$.classAccess','At most 128 caster class entries.');
 for(const [classId,access]of Object.entries(obj.classAccess)){
  const p=`$.classAccess.${classId}`;
  if(!idPattern.test(classId)||!record(access)||!Array.isArray(access.spellIds)||!Array.isArray(access.starterSpellIds)||access.spellIds.length>256||access.starterSpellIds.length>12)bad('E_ACCESS',p,'Invalid class spell-access lists.');
  for(const [key,values]of [['spellIds',access.spellIds],['starterSpellIds',access.starterSpellIds]] as const){if(new Set(values).size!==values.length||values.some(id=>typeof id!=='string'||!ids.has(id)))bad('E_REFERENCE',p+'.'+key,'Duplicate or undefined spell.');}
  if(access.starterSpellIds.some(id=>!access.spellIds.includes(id)))bad('E_REFERENCE',p+'.starterSpellIds','Starting spells must be permitted to this class.');
 }
 return obj;
}
export function legacySpellName(key:string):string{return (bundled.spells as SpellDefinition[]).find(s=>s.behaviorKey===key)?.name??key;}
export const SPELLS:Record<string,SpellDefinition>={};
export const STARTER_SPELLS:Record<string,readonly string[]>={};
const ACCESS:Record<string,readonly string[]>={};
export function installSpellDatabase(input:unknown):void{
 const db=readSpellDatabase(input);
 for(const id of Object.keys(SPELLS))delete SPELLS[id];
 for(const id of Object.keys(STARTER_SPELLS))delete STARTER_SPELLS[id];
 for(const id of Object.keys(ACCESS))delete ACCESS[id];
 for(const s of db.spells)SPELLS[s.id]=s;
 for(const [id,access]of Object.entries(db.classAccess)){ACCESS[id]=[...access.spellIds];STARTER_SPELLS[id]=[...access.starterSpellIds];}
}
export function resetSpellDatabase():void{installSpellDatabase(bundled);}
export function spellAllowed(classId:string,id:string):boolean{return !!SPELLS[id]&&!!ACCESS[classId]?.includes(id);}
export function spellsForClass(classId:string):readonly string[]{return ACCESS[classId]??[];}
export function hasSpellAccess(classId:string):boolean{return spellsForClass(classId).length>0;}
export function starterSpellsForClass(classId:string):readonly string[]{return STARTER_SPELLS[classId]??[];}
resetSpellDatabase();
