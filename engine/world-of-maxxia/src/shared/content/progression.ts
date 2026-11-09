/** MM09: project-owned progression and prepared attack parameters; immutable defaults for older projects. */
import baseline from './progression-default.json' with {type:'json'};
import {CLASS_TRAITS,STYLES,CLASSES,type ClassTrait,type PreparedStyle} from './classes.ts';
export type PreparedOperation='weapon'|'device'|'natural';
export interface PreparedDefinition {id:PreparedStyle;name:string;operation:PreparedOperation;requiredTrait:ClassTrait|null;attackBonus:number;attackBonusAtVeteran:number;damageBonus:number;damageBonusAtMilestone:number;damageBonusAtMilestoneReplacesBase:boolean;ignoreDefense:number;damageType:'physical'|'lightning';dice:string;diceAtMilestone:string|null;diceAtVeteran:string|null;defenseBonus:number;defenseAtVeteran:number;}
export interface ProgressionDatabase {format:'maxxia-progression';version:1;maxLevel:number;xpThresholds:number[];trainingGoldPerLevel:number;attributeMilestoneLevels:number[];proficiency:{base:number;veteranLevel:number;veteranBonus:number};preparedMilestoneLevel:number;preparedVeteranLevel:number;traitBonuses:{device_training:{rangedAccuracy:number;rangedVeteranAccuracy:number;rangedMilestoneDamage:number};thornhide:{reflectAtMilestone:number}};prepared:PreparedDefinition[];}
export class ProgressionError extends Error {code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.code=code;this.path=path;this.name='ProgressionError';}}
const fail=(code:string,path:string,message:string):never=>{throw new ProgressionError(code,path,message);};
const rec=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const num=(x:unknown,lo:number,hi:number,path:string):number=>Number.isSafeInteger(x)&&(x as number)>=lo&&(x as number)<=hi?x as number:fail('E_NUMBER',path,`Expected integer ${lo}–${hi}.`);
export const MAX_PROGRESSION_BYTES=64*1024;
export function readProgression(input:unknown):ProgressionDatabase {
 const root=typeof input==='string'?(()=>{if(new TextEncoder().encode(input).length>MAX_PROGRESSION_BYTES)fail('E_SIZE','$','Progression JSON exceeds 64 KiB.');try{return JSON.parse(input) as unknown;}catch{return fail('E_JSON','$','Malformed progression JSON.');}})():input;
 if(!rec(root))fail('E_FORMAT','$','Expected progression object.');
 const value=root as any;
 if(value.format!=='maxxia-progression'||value.version!==1)fail('E_FORMAT','$','Expected maxxia-progression version 1.');
 const max=num(value.maxLevel,1,20,'$.maxLevel');
 if(!Array.isArray(value.xpThresholds)||value.xpThresholds.length!==max+1||value.xpThresholds[0]!==0||value.xpThresholds[1]!==0)fail('E_CURVE','$.xpThresholds','Curve must have maxLevel+1 entries, with levels 0 and 1 starting at zero.');
 let prior=0;for(let level=2;level<=max;level++){const xp=num(value.xpThresholds[level],1,1_000_000_000,`$.xpThresholds[${level}]`);if(xp<=prior)fail('E_CURVE',`$.xpThresholds[${level}]`,'XP thresholds must increase strictly.');prior=xp;}
 num(value.trainingGoldPerLevel,0,100000,'$.trainingGoldPerLevel');
 if(!Array.isArray(value.attributeMilestoneLevels)||new Set(value.attributeMilestoneLevels).size!==value.attributeMilestoneLevels.length)fail('E_MILESTONES','$.attributeMilestoneLevels','Milestone list must contain unique levels.');
 for(const level of value.attributeMilestoneLevels)num(level,2,max,'$.attributeMilestoneLevels');
 if(!rec(value.proficiency))fail('E_PROFICIENCY','$.proficiency','Missing proficiency settings.');
 num(value.proficiency.base,0,20,'$.proficiency.base');num(value.proficiency.veteranLevel,2,20,'$.proficiency.veteranLevel');num(value.proficiency.veteranBonus,0,20,'$.proficiency.veteranBonus');
 const milestone=num(value.preparedMilestoneLevel,2,20,'$.preparedMilestoneLevel');const veteran=num(value.preparedVeteranLevel,milestone,20,'$.preparedVeteranLevel');
 if(!rec(value.traitBonuses)||!rec(value.traitBonuses.device_training)||!rec(value.traitBonuses.thornhide))fail('E_TRAIT','$.traitBonuses','Missing trait tuning.');
 for(const key of ['rangedAccuracy','rangedVeteranAccuracy','rangedMilestoneDamage'])num(value.traitBonuses.device_training[key],0,20,`$.traitBonuses.device_training.${key}`);
 num(value.traitBonuses.thornhide.reflectAtMilestone,0,20,'$.traitBonuses.thornhide.reflectAtMilestone');
 if(!Array.isArray(value.prepared)||value.prepared.length!==STYLES.length)fail('E_STYLES','$.prepared','Include each supported style exactly once.');
 const seen=new Set<string>();
 for(const [i,s] of value.prepared.entries()){
  const path=`$.prepared[${i}]`;if(!rec(s)||typeof s.id!=='string'||!(STYLES as readonly string[]).includes(s.id)||seen.has(s.id))fail('E_STYLE',path+'.id','Unsupported or duplicate style ID.');seen.add(s.id);
  if(typeof s.name!=='string'||s.name.trim().length===0||s.name.length>100)fail('E_STYLE',path+'.name','Invalid display name.');
  if(!['weapon','device','natural'].includes(s.operation as string))fail('E_STYLE',path+'.operation','Invalid attack operation.');
  if(s.requiredTrait!==null&&!(CLASS_TRAITS as readonly string[]).includes(s.requiredTrait as string))fail('E_STYLE',path+'.requiredTrait','Unknown required trait.');
  if(!['physical','lightning'].includes(s.damageType as string))fail('E_STYLE',path+'.damageType','Unsupported damage type.');
  for(const k of ['attackBonus','attackBonusAtVeteran','damageBonus','damageBonusAtMilestone','ignoreDefense','defenseBonus','defenseAtVeteran'])num(s[k],k==='attackBonus'?-20:0,20,path+'.'+k);
  if(typeof s.damageBonusAtMilestoneReplacesBase!=='boolean')fail('E_STYLE',path+'.damageBonusAtMilestoneReplacesBase','Expected boolean.');
  for(const k of ['dice','diceAtMilestone','diceAtVeteran'])if(s[k]!==null&&(typeof s[k]!=='string'||! /^(?:[1-9][0-9]?d(?:4|6|8|10|12|20)|[1-9][0-9]?)$/.test(s[k] as string)))fail('E_DICE',path+'.'+k,'Unsafe or invalid damage dice.');
  if(s.dice===null)fail('E_DICE',path+'.dice','Base dice are required.');
  // Configured operations cannot silently change the meaning of a class trait or turn into arbitrary scripts.
  if((s.operation==='device'&&s.requiredTrait!=='device_training')||(s.operation==='natural'&&s.requiredTrait!=='mutant_biology')||(s.id==='standard'&&s.requiredTrait!==null))fail('E_OPERATION',path,'Prepared operation and trait disagree.');
 }
 return root as unknown as ProgressionDatabase;
}
let active:ProgressionDatabase=readProgression(baseline);
export function installProgression(input:unknown):void{active=structuredClone(readProgression(input));}
export function resetProgression():void{active=readProgression(baseline);}
export function progression():Readonly<ProgressionDatabase>{return active;}
export function preparedDefinition(id:PreparedStyle):Readonly<PreparedDefinition>{const def=active.prepared.find(p=>p.id===id)??Object.values(CLASSES).flatMap(c=>c.styleDefinitions??[]).find(s=>s.id===id);if(!def)throw new ProgressionError('E_STYLE','$.prepared',`Missing style ${id}.`);return def;}
export const milestone=(level:number):boolean=>level>=active.preparedMilestoneLevel;
export const veteran=(level:number):boolean=>level>=active.preparedVeteranLevel;
