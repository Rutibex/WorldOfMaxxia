/** MM07: project-owned classes, with traits and equipment tags rather than named-class rules. */
import baseline from './classes-default.json' with {type:'json'};
import type {ItemDefinition} from './items.ts';
export const ABILITIES=['STR','DEX','CON','INT','WIS','CHA'] as const;
export type Ability=typeof ABILITIES[number];
export type ClassId=string;
export const EQUIPMENT_TAGS=['melee:staff','melee:dagger','melee:mace','melee:sword','melee:general','ranged','shield','armor:light','armor:medium','armor:heavy','accessory'] as const;
export type EquipmentTag=typeof EQUIPMENT_TAGS[number];
export const CLASS_TRAITS=['martial_mastery','device_training','mutant_biology','thornhide'] as const;
export type ClassTrait=string;
export const STYLES=['measured','power','bastion','needle','spark','claws','carapace','standard'] as const;
export type PreparedStyle=string;
export interface ClassChoice {id:string;name:string;description:string;attributeBonuses?:Partial<Record<Ability,number>>;starterEquipment?:Partial<Record<'melee'|'ranged'|'body'|'offhand',string|null>>;abilityGrants?:{id:string;minLevel:number}[];}
export interface AuthoredStyle {id:string;name:string;description:string;operation:'weapon'|'device'|'natural';requiredTrait:string|null;attackBonus:number;attackBonusAtVeteran:number;damageBonus:number;damageBonusAtMilestone:number;damageBonusAtMilestoneReplacesBase:boolean;ignoreDefense:number;damageType:'physical'|'lightning';dice:string;diceAtMilestone:string|null;diceAtVeteran:string|null;defenseBonus:number;defenseAtVeteran:number;}
export interface ClassDefinition {id:ClassId;name:string;primary:Ability;hpBase:number;hpGain:number;casting:Ability|null;spBase:number;spGain:number;spAttributeMultiplier:number;role:string;features:string;starterEquipment?:Partial<Record<'melee'|'ranged'|'body'|'offhand',string|null>>;equipmentTags:EquipmentTag[];traits:ClassTrait[];preparedStyles:PreparedStyle[];styleDefinitions?:AuthoredStyle[];abilityGrants?:{id:string;minLevel:number}[];creationChoices?:ClassChoice[];}
export interface ClassDatabase{format:'maxxia-classes';version:1;classes:ClassDefinition[];}
export class ClassDatabaseError extends Error {code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.code=code;this.path=path;this.name='ClassDatabaseError';}}
const fail=(code:string,path:string,message:string):never=>{throw new ClassDatabaseError(code,path,message);};
const isRecord=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export const MAX_CLASSES_BYTES=128*1024;
export function readClassDatabase(input:unknown):ClassDatabase {
 const root=typeof input==='string'?(()=>{if(new TextEncoder().encode(input).length>MAX_CLASSES_BYTES)fail('E_SIZE','$','Classes exceed 128 KiB.');try{return JSON.parse(input) as unknown;}catch{return fail('E_JSON','$','Malformed JSON.');}})():input;
 if(!isRecord(root)||root.format!=='maxxia-classes'||root.version!==1||!Array.isArray(root.classes)||root.classes.length<1||root.classes.length>128)fail('E_FORMAT','$','Expected maxxia-classes v1 with 1–128 classes.');
 const used=new Set<string>();
 const classes:ClassDefinition[]=[];
 for(const [i,raw] of ((root as {classes:unknown[]}).classes).entries()){
  const p=`$.classes[${i}]`;
  if(!isRecord(raw))fail('E_TYPE',p,'Class must be an object.');
  const v=raw as Record<string,unknown>;
  if(typeof v.id!=='string'||!(/^(?:class_[a-z0-9_]{1,74}|[a-z][a-z0-9_]{1,75})$/.test(v.id)||/^[a-z][a-z0-9_]{0,47}:class:[a-z][a-z0-9_]{0,79}$/.test(v.id))||used.has(v.id))fail('E_ID',p+'.id','Invalid or duplicate class ID.');
  used.add(v.id as string);
  for(const field of ['name','role','features'])if(typeof v[field]!=='string'||(v[field] as string).length>(field==='name'?100:1500)||(field!=='features'&&!(v[field] as string).trim()))fail('E_TEXT',p+'.'+field,'Invalid text.');
  if(!ABILITIES.includes(v.primary as Ability))fail('E_PRIMARY',p+'.primary','Unknown primary ability.');
  if(v.casting!==null&&!ABILITIES.includes(v.casting as Ability))fail('E_CASTING',p+'.casting','Invalid casting attribute.');
  const fields:{[k:string]:[number,number]}={hpBase:[1,500],hpGain:[1,100],spBase:[0,500],spGain:[0,100],spAttributeMultiplier:[0,20]};
  for(const [key,[min,max]] of Object.entries(fields))if(!Number.isSafeInteger(v[key])||(v[key] as number)<min||(v[key] as number)>max)fail('E_NUMBER',p+'.'+key,'Value outside configured growth bounds.');
  if(v.casting===null&&(v.spBase!==0||v.spGain!==0||v.spAttributeMultiplier!==0))fail('E_SP',p,'Noncasters must have zero SP settings.');
  for(const field of ['equipmentTags','traits','preparedStyles'] as const){
   const a=v[field],max=field==='equipmentTags'?11:12;
   if(!Array.isArray(a)||a.length>max||(field!=='traits'&&a.length===0)||new Set(a).size!==a.length)fail('E_LIST',p+'.'+field,'Invalid or duplicate list.');
   const valid=(x:unknown):boolean=>typeof x==='string'&&(field==='equipmentTags'?(EQUIPMENT_TAGS as readonly string[]).includes(x):field==='traits'?(CLASS_TRAITS as readonly string[]).includes(x)||/^[a-z][a-z0-9_]{0,47}:trait:[a-z][a-z0-9_]{0,79}$/.test(x):(STYLES as readonly string[]).includes(x)||/^[a-z][a-z0-9_]{0,47}:style:[a-z][a-z0-9_]{0,79}$/.test(x));
   if((a as unknown[]).some((x:unknown)=>!valid(x)))fail('E_LIST',p+'.'+field,'Unsupported tag, trait or style.');
  }
  const abilityId=/^[a-z][a-z0-9_]{0,47}:ability:[a-z][a-z0-9_]{0,79}$/;
  const validateGrants=(raw:unknown,path:string)=>{if(raw===undefined)return;if(!Array.isArray(raw)||raw.length>32||new Set(raw.map(x=>x?.id)).size!==raw.length||raw.some(x=>!isRecord(x)||Object.keys(x).sort().join('|')!=='id|minLevel'||!abilityId.test(String(x.id))||!Number.isInteger(x.minLevel)||(x.minLevel as number)<1||(x.minLevel as number)>20))fail('E_GRANTS',path,'Invalid class/choice ability grant.');};
  validateGrants(v.abilityGrants,p+'.abilityGrants');
  if(v.creationChoices!==undefined){if(!Array.isArray(v.creationChoices)||v.creationChoices.length<1||v.creationChoices.length>12||new Set(v.creationChoices.map(x=>x?.id)).size!==v.creationChoices.length)fail('E_CHOICES',p+'.creationChoices','Invalid choices.');
   for(const [j,ch] of (v.creationChoices as Record<string,any>[]).entries()){const at=p+`.creationChoices[${j}]`;if(!isRecord(ch)||Object.keys(ch).some(k=>!['id','name','description','attributeBonuses','starterEquipment','abilityGrants'].includes(k))||typeof ch.id!=='string'||!/^[a-z][a-z0-9_]{0,79}$/.test(ch.id)||typeof ch.name!=='string'||!ch.name.trim()||ch.name.length>100||typeof ch.description!=='string'||ch.description.length>500)fail('E_CHOICES',at,'Invalid choice identity');if(ch.attributeBonuses!==undefined&&(!isRecord(ch.attributeBonuses)||Object.entries(ch.attributeBonuses).some(([k,n])=>!ABILITIES.includes(k as Ability)||!Number.isInteger(n)||(n as number)< -3||(n as number)>3)))fail('E_CHOICES',at+'.attributeBonuses','Invalid choice bonus');validateGrants(ch.abilityGrants,at+'.abilityGrants');if(ch.starterEquipment!==undefined&&(!isRecord(ch.starterEquipment)||Object.entries(ch.starterEquipment).some(([slot,id])=>!['melee','ranged','body','offhand'].includes(slot)||(id!==null&&(typeof id!=='string'||!/^([a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}|item_[a-z0-9_]{1,70})$/.test(id))))))fail('E_CHOICES',at+'.starterEquipment','Invalid starting item');}
  }
  if(v.styleDefinitions!==undefined){if(!Array.isArray(v.styleDefinitions)||v.styleDefinitions.length>12||new Set(v.styleDefinitions.map(x=>x?.id)).size!==v.styleDefinitions.length)fail('E_STYLE',p+'.styleDefinitions','Invalid style definitions');for(const [j,s] of (v.styleDefinitions as Record<string,any>[]).entries()){const at=p+`.styleDefinitions[${j}]`;if(!isRecord(s)||Object.keys(s).sort().join('|')!==['attackBonus','attackBonusAtVeteran','damageBonus','damageBonusAtMilestone','damageBonusAtMilestoneReplacesBase','damageType','defenseAtVeteran','defenseBonus','description','dice','diceAtMilestone','diceAtVeteran','id','ignoreDefense','name','operation','requiredTrait'].sort().join('|')||!(v.preparedStyles as string[]).includes((s as Record<string,string>).id)||!String(s.id).startsWith(String(v.id).split(':')[0]+':style:')||!['weapon','device','natural'].includes(String(s.operation))||!(s.requiredTrait===null||(v.traits as string[]).includes(s.requiredTrait as string))||!['physical','lightning'].includes(String(s.damageType))||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||typeof s.description!=='string'||s.description.length>500||typeof s.damageBonusAtMilestoneReplacesBase!=='boolean'||['attackBonus','attackBonusAtVeteran','damageBonus','damageBonusAtMilestone','ignoreDefense','defenseBonus','defenseAtVeteran'].some(k=>!Number.isInteger(s[k])||(s[k] as number)< (k==='attackBonus'?-20:0)||(s[k] as number)>20)||['dice','diceAtMilestone','diceAtVeteran'].some(k=>s[k]!==null&&(typeof s[k]!=='string'||!/^(?:[1-9][0-9]?d(?:4|6|8|10|12|20)|[1-9][0-9]?)$/.test(s[k] as string)))||s.dice===null)fail('E_STYLE',at,'Invalid authored prepared style');}}
  const custom=(v.preparedStyles as string[]).filter(x=>x.includes(':'));if(custom.some(id=>!(v.styleDefinitions as {id:string}[]|undefined)?.some(s=>s.id===id))||(v.styleDefinitions as {id:string}[]|undefined)?.some(s=>!custom.includes(s.id)))fail('E_STYLE',p+'.preparedStyles','Missing/unused authored style definition');

  if((v.preparedStyles as string[]).some(s=>['measured','power','bastion'].includes(s)&&!(v.traits as string[]).includes('martial_mastery')||['needle','spark'].includes(s)&&!(v.traits as string[]).includes('device_training')||['claws','carapace'].includes(s)&&!(v.traits as string[]).includes('mutant_biology')))fail('E_STYLE_TRAIT',p+'.preparedStyles','Class lacks the trait needed for a specialized prepared attack.');
  if(v.starterEquipment!==undefined&&(!isRecord(v.starterEquipment)||Object.keys(v.starterEquipment).length>4||Object.entries(v.starterEquipment).some(([slot,id])=>!['melee','ranged','body','offhand'].includes(slot)||(id!==null&&(typeof id!=='string'||!/^([a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}|item_[a-z0-9_]{1,70})$/.test(id))))))fail('E_STARTER',p+'.starterEquipment','Invalid starter equipment references.');
  classes.push(v as unknown as ClassDefinition);
 }
 return {format:'maxxia-classes',version:1,classes};
}
export const CLASSES:Record<string,ClassDefinition>={};
export const CLASS_IDS:string[]=[];
export const PREPARED_STYLES:Record<string,readonly PreparedStyle[]>={};
export function installClassDatabase(input:unknown):void {
 const data=readClassDatabase(input),next=Object.fromEntries(data.classes.map(c=>[c.id,c]));
 for(const id of Object.keys(CLASSES))delete CLASSES[id];Object.assign(CLASSES,next);
 CLASS_IDS.splice(0,CLASS_IDS.length,...data.classes.map(c=>c.id));
 for(const id of Object.keys(PREPARED_STYLES))delete PREPARED_STYLES[id];
 for(const c of data.classes)PREPARED_STYLES[c.id]=c.preparedStyles;
}
export function resetClassDatabase():void{installClassDatabase(baseline);}
export function hasTrait(classId:string,trait:ClassTrait):boolean{return !!CLASSES[classId]?.traits.includes(trait);}
export function canEquip(classId:string,item:ItemDefinition):boolean {
 const permissions=CLASSES[classId]?.equipmentTags;
 if(!permissions||!item.slot)return false;
 const fallback=item.slot==='melee'?'melee:general':item.slot==='body'?'armor:'+(item.weight??'medium'):item.slot==='offhand'?'shield':item.slot;
 return (item.equipmentTags?.length?item.equipmentTags:[fallback]).some(tag=>permissions.includes(tag as EquipmentTag));
}
installClassDatabase(baseline);
