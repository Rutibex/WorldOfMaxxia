/** MM13: editable monster definitions and bounded deterministic attack choice. */
import bundled from './monsters-default.json' with {type:'json'};
export const MAX_MONSTERS_BYTES=256*1024;
export type MonsterAbilityKind='strike'|'spectral';
export type MonsterAbilityWhen='always'|'odd_round'|'even_round'|'hurt'|'healthy';
export interface MonsterAbility {id:string;kind:MonsterAbilityKind;weight:number;when:MonsterAbilityWhen;bonusDamage:number;}
/** MP22 bounded, deterministic decision rules; one ordinary monster action per turn. */
export type MonsterBehaviorWhen='always'|'hurt'|'healthy'|'adjacent'|'distant'|'odd_round'|'even_round';
export type MonsterBehaviorAction='strike'|'approach'|'guard'|'heal'|'summon';
export interface MonsterBehaviorRule {id:string;priority:number;when:MonsterBehaviorWhen;action:MonsterBehaviorAction;amount?:number;kindId?:string;maxUses?:number;lifetimeRounds?:number;}
export interface MonsterHealthPhase {atOrBelowPercent:number;title:string;attackBonus:number;defenseBonus:number;damageBonus:number;}
export interface MonsterBehavior {rules:MonsterBehaviorRule[];phases?:MonsterHealthPhase[];}
export interface MonsterDefinition {behavior?:MonsterBehavior;id:string;name:string;hp:number;defense:number;attack:number;damage:string;speed:number;xp:number;gold:number;symbol:string;attributes:{DEX:number;WIS:number;CON:number};undead:boolean;resistances:Record<string,number>;visualId:string;guaranteedLootItemId?:string;aiPattern:'standard'|'resonance';abilities:MonsterAbility[];}
export interface MonsterDatabase {format:'maxxia-monsters';version:1;monsters:MonsterDefinition[];}
export class MonsterDatabaseError extends Error {code:string;path:string;constructor(code:string,path:string,message:string){super(`${code} at ${path}: ${message}`);this.code=code;this.path=path;this.name='MonsterDatabaseError';}}
const bad=(code:string,path:string,message:string):never=>{throw new MonsterDatabaseError(code,path,message);};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=/^[a-z][a-z0-9_]{1,79}$/;
const BUNDLED_VISUALS=Object.fromEntries((bundled.monsters as Array<{id:string}>).map(m=>[m.id,true]));
const damageTypes=['physical','fire','cold','lightning','poison','arcane','holy','necrotic'];
export function readMonsterDatabase(input:unknown):MonsterDatabase {
 let value:unknown=input;
 if(typeof input==='string'){if(new TextEncoder().encode(input).byteLength>MAX_MONSTERS_BYTES)bad('E_SIZE','$','Monster database exceeds 256 KiB.');try{value=JSON.parse(input);}catch{bad('E_JSON','$','Malformed monster JSON.');}}
 if(!record(value)||value.format!=='maxxia-monsters'||value.version!==1||!Array.isArray(value.monsters)||value.monsters.length<1||value.monsters.length>256)bad('E_FORMAT','$','Require maxxia-monsters v1 with 1–256 records.');
 const ids=new Set<string>();const db=value as unknown as MonsterDatabase;
 for(const [i,m] of db.monsters.entries()){
  const p=`$.monsters[${i}]`;if(!record(m))bad('E_RECORD',p,'Expected monster object.');
  if(typeof m.id!=='string'||!(id.test(m.id)||/^[a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79}$/.test(m.id))||ids.has(m.id))bad('E_ID',p+'.id','Invalid or duplicate permanent ID.');ids.add(m.id);
  if(typeof m.name!=='string'||!m.name.trim()||m.name.length>100||typeof m.symbol!=='string'||!m.symbol.length||m.symbol.length>8)bad('E_NAME',p,'Invalid name or map symbol.');
  for(const [key,min,max] of [['hp',1,100000],['defense',0,200],['attack',-100,200],['speed',0,200],['xp',0,1000000],['gold',0,1000000]] as const)if(!Number.isSafeInteger(m[key])||m[key]<min||m[key]>max)bad('E_NUMBER',p+'.'+key,`Expected integer ${min}–${max}.`);
  if(typeof m.damage!=='string'||!(/^(?:[1-9]|[12][0-9])d(?:[2-9]|[1-9][0-9]|100)$/.test(m.damage)||/^(?:[1-9]|[1-9][0-9])$/.test(m.damage)))bad('E_DAMAGE',p+'.damage','Use a bounded dice expression such as 1d6 or a positive integer.');
  if(!record(m.attributes))bad('E_ATTRIBUTES',p+'.attributes','Missing saving throw attributes.');
  for(const key of ['DEX','WIS','CON'] as const)if(!Number.isSafeInteger(m.attributes[key])||m.attributes[key]<1||m.attributes[key]>100)bad('E_ATTRIBUTES',p+'.attributes.'+key,'Attribute must be 1–100.');
  if(typeof m.undead!=='boolean')bad('E_UNDEAD',p+'.undead','Undead must be a boolean.');
  if(!record(m.resistances)||Object.keys(m.resistances).length>8)bad('E_RESIST',p+'.resistances','Invalid damage resistances.');
  for(const [key,percent] of Object.entries(m.resistances))if(!damageTypes.includes(key)||!Number.isSafeInteger(percent)||percent<0||percent>100)bad('E_RESIST',p+'.resistances.'+key,'Resistance must be a supported type and reduction 0–100%.');
  if(m.guaranteedLootItemId!==undefined&&(typeof m.guaranteedLootItemId!=='string'||!/^([a-z][a-z0-9_]{0,47}:item:[a-z][a-z0-9_]{0,79}|item_[a-z0-9_]{1,70})$/.test(m.guaranteedLootItemId)))bad('E_LOOT',p+'.guaranteedLootItemId','Invalid guaranteed item reference.');
  if(typeof m.visualId!=='string'||!Object.hasOwn(BUNDLED_VISUALS,m.visualId))bad('E_VISUAL',p+'.visualId','Visual ID must be an existing supported atlas key.');
  if(!['standard','resonance'].includes(m.aiPattern))bad('E_PATTERN',p+'.aiPattern','Unknown special AI pattern.');
  if(!Array.isArray(m.abilities)||m.abilities.length<1||m.abilities.length>8)bad('E_AI',p+'.abilities','Expected 1–8 attack choices.');
  const abilities=new Set<string>();let unconditional=0;
  for(const [j,a] of m.abilities.entries()){
   const path=`${p}.abilities[${j}]`;
   if(!record(a)||typeof a.id!=='string'||!id.test(a.id)||abilities.has(a.id)||!['strike','spectral'].includes(a.kind)||!['always','odd_round','even_round','hurt','healthy'].includes(a.when)||!Number.isSafeInteger(a.weight)||a.weight<1||a.weight>100||!Number.isSafeInteger(a.bonusDamage)||a.bonusDamage<0||a.bonusDamage>100)bad('E_AI',path,'Invalid attack choice, condition, weight or bonus.');
   abilities.add(a.id);if(a.when==='always')unconditional++;
  }
  if(!unconditional&&!(m.abilities.some(a=>a.when==='odd_round')&&m.abilities.some(a=>a.when==='even_round')))bad('E_AI',p+'.abilities','AI choices must cover every round or include an always option.');
  if(m.behavior!==undefined){
   const b=m.behavior as MonsterBehavior;
   if(!record(b)||Object.keys(b).some(k=>!['rules','phases'].includes(k))||!Array.isArray(b.rules)||b.rules.length<1||b.rules.length>8)bad('E_BEHAVIOR',p+'.behavior','Expected 1–8 priority rules.');
   const seen=new Set<string>();let fallback=false;
   for(const [j,r]of b.rules.entries()){
    const path=`${p}.behavior.rules[${j}]`;
    if(!record(r)||Object.keys(r).some(k=>!['id','priority','when','action','amount','kindId','maxUses','lifetimeRounds'].includes(k))||typeof r.id!=='string'||!id.test(r.id)||seen.has(r.id)||!Number.isSafeInteger(r.priority)||r.priority<0||r.priority>100||!['always','hurt','healthy','adjacent','distant','odd_round','even_round'].includes(r.when)||!['strike','approach','guard','heal','summon'].includes(r.action))bad('E_BEHAVIOR',path,'Invalid bounded behaviour rule.');
    seen.add(r.id);if(r.when==='always'&&['strike','guard','approach'].includes(r.action))fallback=true;
    if(r.action==='heal'&&(!Number.isSafeInteger(r.amount)||(r.amount??0)<1||(r.amount??0)>20)||r.action!=='heal'&&r.amount!==undefined)bad('E_BEHAVIOR',path,'Heal requires a bounded amount.');
    if(r.action==='summon'){
     if(typeof r.kindId!=='string'||!(/^([a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79}|[a-z][a-z0-9_]{1,79})$/.test(r.kindId))||!Number.isSafeInteger(r.maxUses)||(r.maxUses??0)<1||(r.maxUses??0)>3||!Number.isSafeInteger(r.lifetimeRounds)||(r.lifetimeRounds??0)<1||(r.lifetimeRounds??0)>6)bad('E_BEHAVIOR',path,'Summon requires known monster ID, maxUses 1–3, lifetime 1–6.');
    }else if(r.kindId!==undefined||r.maxUses!==undefined||r.lifetimeRounds!==undefined)bad('E_BEHAVIOR',path,'Non-summon action has summon-only fields.');
   }
   if(!fallback)bad('E_BEHAVIOR',p+'.behavior.rules','A safe always/strike, always/guard or always/approach fallback is required.');
   if(b.phases!==undefined){if(!Array.isArray(b.phases)||b.phases.length>3)bad('E_PHASE',p+'.behavior.phases','At most three threshold phases.');let previous=101;
    for(const [j,v]of b.phases.entries()){
     if(!record(v)||Object.keys(v).some(k=>!['atOrBelowPercent','title','attackBonus','defenseBonus','damageBonus'].includes(k))||!Number.isSafeInteger(v.atOrBelowPercent)||v.atOrBelowPercent<1||v.atOrBelowPercent>=previous||typeof v.title!=='string'||!v.title||v.title.length>100||!['attackBonus','defenseBonus','damageBonus'].every(k=>Number.isSafeInteger(v[k])&&Math.abs(v[k] as number)<=5))bad('E_PHASE',`${p}.behavior.phases[${j}]`,'Health thresholds must descend and bonuses must be bounded.');previous=v.atOrBelowPercent as number;
    }
   }
  }

 }
 return db;
}
export const MONSTERS:Record<string,MonsterDefinition>={};
export function installMonsterDatabase(input:unknown):void {const db=readMonsterDatabase(input);for(const key of Object.keys(MONSTERS))delete MONSTERS[key];for(const m of db.monsters)MONSTERS[m.id]=m;}
export function resetMonsterDatabase():void{installMonsterDatabase(bundled);}
export function monsterSaveAttribute(kindId:string,attribute:'DEX'|'WIS'|'CON'):number{return MONSTERS[kindId]?.attributes[attribute]??10;}
export function monsterUndead(kindId:string):boolean{return MONSTERS[kindId]?.undead??false;}
export function monsterDamageAfterResistance(kindId:string,type:string,amount:number,bonus=0):number {const percent=Math.max(-50,Math.min(75,(MONSTERS[kindId]?.resistances[type]??0)+bonus));return Math.max(0,Math.floor(amount*(100-percent)/100));}
/** The only weighted RNG draw is when more than one eligible attack exists. */
export function pickMonsterAbility(monster:MonsterDefinition,round:number,hp:number,roll:(min:number,max:number)=>number):MonsterAbility {
 const eligible=monster.abilities.filter(a=>a.when==='always'||a.when==='odd_round'&&round%2===1||a.when==='even_round'&&round%2===0||a.when==='hurt'&&hp*2<monster.hp||a.when==='healthy'&&hp*2>=monster.hp);
 const choices=eligible.length?eligible:monster.abilities.filter(a=>a.when==='always');
 if(!choices.length)throw new MonsterDatabaseError('E_AI_RUNTIME','$.abilities','No eligible attack.');
 if(choices.length===1)return choices[0];
 let rollValue=roll(1,choices.reduce((total,a)=>total+a.weight,0));for(const choice of choices){rollValue-=choice.weight;if(rollValue<=0)return choice;}return choices[choices.length-1];
}
resetMonsterDatabase();
