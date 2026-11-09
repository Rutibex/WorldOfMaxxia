import {packCondition} from '../content/effect-definitions.ts';
import {passiveModifiers,checkAbilityState,type AbilityState} from './abilities.ts';
import {validateAuthoredCondition,conditionModifier,conditionResistance} from './condition-effects.ts';
import {ABILITIES,CLASS_IDS,CLASSES,STARTER_GEAR,STARTER_HEROES,type Attributes,type Ability,type ClassId} from '../content/party.ts';
import {ITEMS} from '../content/items.ts';
import {RACES,DEFAULT_RACE_ID,raceFor} from '../content/races.ts';
import {PREPARED_STYLES,hasTrait,canEquip,type PreparedStyle} from '../content/classes.ts';
import {progression,preparedDefinition,milestone,veteran} from '../content/progression.ts';
import {portraitForLegacyNumber,ACTORS,DEFAULT_PARTY,PORTRAITS} from '../content/actors.ts';
export {ABILITIES,CLASSES,STARTER_GEAR};
export const DAMAGE_TYPES=['physical','fire','cold','lightning','poison','arcane','holy','necrotic'] as const;
export type DamageType=typeof DAMAGE_TYPES[number];
export const CONDITION_IDS=['poisoned','asleep','frightened','cursed','drunk','hungry'] as const;
export type ConditionId=string;
export interface Condition{stacks?:number;id:ConditionId;remaining:number|null;unit:'ticks'|'turns'|'minutes'|'persistent';}
export type QuickAction='attack'|'block'|'run'|'cast';
export type {PreparedStyle};
export {PREPARED_STYLES};
export const PREPARED_INFO:Record<PreparedStyle,{name:string;description:string}>={
 measured:{name:'Measured Steel',description:'Reliable swordwork: +1 to melee accuracy. Level 3 grants +1 melee damage; level 5 gains another +1 accuracy.'},
 power:{name:'Power Stroke',description:'Commit to each blow: -1 melee accuracy, +2 damage. Veteran melee bonuses still apply.'},
 bastion:{name:'Bastion',description:'Shielded assault: +2 passive Defense while prepared, -1 melee accuracy. Attack stays a single action.'},
 needle:{name:'Needle Device',description:'A free, built-in DEX device attack, 1d4 damage; +1 accuracy and ignores 2 enemy Defense. Improved from level 3.'},
 spark:{name:'Spark Coil',description:'A free, built-in DEX device attack, 1d4 damage with +1 electric impact (+2 at level 3).'},
 claws:{name:'Rending Claws',description:'Natural CON melee: 1d6 damage (1d8 at level 3, 1d10 at level 5), ignoring equipped weapon damage.'},
 carapace:{name:'Carapace',description:'Hardened hide: +2 Defense (+3 at level 5), using an equipped melee weapon. At level 3, struck attackers take 1 thorn damage.'},
 standard:{name:'Standard Attack',description:'Uses equipped weapon. Quick Fight can cast a readied spell when a valid target and enough SP are available.'}
};
/** Current prepared style labels follow the project database, not the bundled original titles. */
export function preparedInfo(id:PreparedStyle):{name:string;description:string}{const authored=Object.values(CLASSES).flatMap(c=>c.styleDefinitions??[]).find(s=>s.id===id);return {name:preparedDefinition(id).name,description:authored?.description??PREPARED_INFO[id]?.description??'Authored combat style.'};}
export function defaultPrepared(classId:ClassId):PreparedStyle{return PREPARED_STYLES[classId][0];}
export interface CombatSetup{prepared:PreparedStyle;quickAction:QuickAction;}
export function defaultCombatSetup(classId:ClassId):CombatSetup{return {prepared:defaultPrepared(classId),quickAction:'attack'};}
export interface Character{
 id:string;name:string;classId:ClassId;raceId?:string;creationChoiceId?:string;portrait:number;portraitId?:string;age:number;heritage:string;
 attributes:Attributes;attributeBonuses:Attributes;level:number;xp:number;hp:number;sp:number;abilityState?:AbilityState;
 baseResistances:Record<DamageType,number>;conditions:Condition[];awards:string[];combatSetup:CombatSetup;
 equipment:{melee:string|null;ranged:string|null;body:string|null;offhand:string|null;accessoryA:string|null;accessoryB:string|null;preferredAttack:'melee'|'ranged'};
}
export interface PartyState{characters:Record<string,Character>;order:string[];selectedId:string;resources:{gold:number;food:number;bankGold:number;supplies:Record<string,number>};}
export function modifier(score:number):number{return Math.floor((score-10)/2);}
export function proficiency(level:number):number{const p=progression().proficiency;return level>=p.veteranLevel?p.veteranBonus:p.base;}
export function effectiveAttributes(c:Character):Attributes{const race=raceFor(c),choice=CLASSES[c.classId]?.creationChoices?.find(x=>x.id===c.creationChoiceId);return Object.fromEntries(ABILITIES.map(a=>[a,Math.min(30,Math.max(1,c.attributes[a]+c.attributeBonuses[a]+(race.attributeBonuses[a]??0)+(choice?.attributeBonuses?.[a]??0)))])) as Attributes;}
const has=(c:Character,id:ConditionId)=>c.conditions.some(v=>v.id===id);
export const XP_THRESHOLDS=[0,0,250,750,1600,2800]; // Backward-compatible snapshot; use progression().xpThresholds for live projects.
export function training(c:Character){const settings=progression(),capped=c.level>=settings.maxLevel,nextXP=capped?null:settings.xpThresholds[c.level+1];return {capped,nextLevel:capped?null:c.level+1,nextXP,remainingXP:capped?0:Math.max(0,nextXP!-c.xp),eligible:!capped&&c.xp>=nextXP!,cost:capped?0:settings.trainingGoldPerLevel*(c.level+1)};}
export function derived(c:Character){
 const cls=CLASSES[c.classId],a=effectiveAttributes(c),con=modifier(a.CON),dex=modifier(a.DEX);
 const maxHP=Math.max(1,cls.hpBase+con+(c.level-1)*Math.max(1,cls.hpGain+con));
 const maxSP=cls.casting?cls.spBase+cls.spAttributeMultiplier*Math.max(0,modifier(a[cls.casting]))+cls.spGain*(c.level-1):0;
 const armor=c.equipment.body?ITEMS[c.equipment.body]:undefined,shield=c.equipment.offhand?ITEMS[c.equipment.offhand]:undefined;
 const dexContribution=Math.min(dex,armor?.weight==='heavy'?0:armor?.weight==='medium'?2:Infinity);
 const passive=passiveModifiers(c);
 const style=preparedDefinition(c.combatSetup.prepared);
 const preparedDefense=(style.requiredTrait===null||hasTrait(c.classId,style.requiredTrait))?(veteran(c.level)?style.defenseAtVeteran:style.defenseBonus):0;
 const defense=passive.defense+conditionModifier(c.conditions,'defense')+10+(armor?.armor??0)+(shield?.armor??0)+dexContribution+preparedDefense-(has(c,'cursed')?2:0);
 const weaponId=c.equipment[c.equipment.preferredAttack],weapon=weaponId?ITEMS[weaponId]:undefined;
 const attackAbility:Ability=c.equipment.preferredAttack==='ranged'?'DEX':'STR';
 const attackPenalty=(has(c,'frightened')?2:0)+(has(c,'drunk')?2:0);
 const attackBonus=passive.attack+conditionModifier(c.conditions,'attack')+proficiency(c.level)+modifier(a[attackAbility])+(weapon?.accuracy??0)-attackPenalty;
 return {attributes:a,maxHP,maxSP,defense,dexContribution,armorBonus:armor?.armor??0,shieldBonus:shield?.armor??0,proficiency:proficiency(c.level),attackAbility,attackBonus,weaponName:weapon?.name??'Unarmed',weaponDice:weapon?.dice??'1',damageBonus:modifier(a[attackAbility])-(has(c,'hungry')?1:0),spellDC:cls.casting?10+proficiency(c.level)+modifier(a[cls.casting]):null,preparedDefense,resistances:Object.fromEntries(DAMAGE_TYPES.map(t=>[t,Math.max(-50,Math.min(75,c.baseResistances[t]+(raceFor(c).resistances[t]??0)+conditionResistance(c.conditions,t)+(['accessoryA','accessoryB'] as const).reduce((sum,slot)=>{const item=c.equipment[slot]?ITEMS[c.equipment[slot]!]:undefined;return sum+(item?.resistance===t?item.resistBonus:0);},0)))])) as Record<DamageType,number>};
}
export function createDefaultParty(ids:readonly string[]=DEFAULT_PARTY):PartyState{
 const characters:Record<string,Character>={};
 for(const id of ids){
  const seed=ACTORS[id];if(!seed)throw new TypeError(`Unknown starting actor ${id}.`);
  const c:Character={id:seed.id,name:seed.name,classId:seed.classId,portrait:seed.portrait,portraitId:seed.portraitId,age:seed.age,heritage:seed.heritage,attributes:{...seed.attributes},attributeBonuses:Object.fromEntries(ABILITIES.map(a=>[a,0])) as Attributes,level:1,xp:0,hp:0,sp:0,baseResistances:Object.fromEntries(DAMAGE_TYPES.map(t=>[t,0])) as Record<DamageType,number>,conditions:[],awards:[],combatSetup:defaultCombatSetup(seed.classId),equipment:{melee:seed.equipment.melee,ranged:seed.equipment.ranged,body:seed.equipment.body,offhand:seed.equipment.offhand,accessoryA:null,accessoryB:null,preferredAttack:seed.equipment.preferredAttack}};
  const d=derived(c);c.hp=d.maxHP;c.sp=d.maxSP;characters[c.id]=c;
 }
 const order=[...ids];return {characters,order,selectedId:order[0],resources:{gold:300,food:48,bankGold:0,supplies:{item_healing_draught:2,item_antidote:2}}};
}
export function selectMember(p:PartyState,id:string):PartyState{if(!p.order.includes(id))throw new RangeError('Character is not in the active party.');return {...p,selectedId:id};}
export function exchangeMembers(p:PartyState,from:string,to:string):PartyState{
 const a=p.order.indexOf(from),b=p.order.indexOf(to);if(a<0||b<0)throw new RangeError('Both characters must be active.');
 if(a===b)return p;const order=[...p.order];[order[a],order[b]]=[order[b],order[a]];return {...p,order};
}
export function updateMember(p:PartyState,c:Character):PartyState{if(!p.characters[c.id]||!p.order.includes(c.id))throw new RangeError('Unknown party member.');return {...p,characters:{...p.characters,[c.id]:c}};}
export function damage(c:Character,amount:number):Character{
 if(!Number.isSafeInteger(amount)||amount<0)throw new RangeError('Damage must be a nonnegative integer.');
 if(!amount)return c;return {...c,hp:Math.max(0,c.hp-amount),conditions:c.conditions.filter(v=>v.id!=='asleep')};
}
export function heal(c:Character,amount:number):Character{
 if(!Number.isSafeInteger(amount)||amount<0)throw new RangeError('Healing must be a nonnegative integer.');
 return c.hp===0?c:{...c,hp:Math.min(derived(c).maxHP,c.hp+amount)};
}
export function spendSP(c:Character,amount:number):Character{if(!Number.isSafeInteger(amount)||amount<0||c.hp===0||amount>c.sp)throw new RangeError('Spell points unavailable.');return {...c,sp:c.sp-amount};}
export function withCondition(c:Character,condition:Condition):Character{if(!validateAuthoredCondition(condition)&&(!CONDITION_IDS.includes(condition.id as typeof CONDITION_IDS[number])||!['ticks','turns','minutes','persistent'].includes(condition.unit)||(condition.remaining!==null&&(!Number.isSafeInteger(condition.remaining)||condition.remaining<1))||condition.stacks!==undefined))throw new RangeError('Invalid condition.');return {...c,conditions:[...c.conditions.filter(v=>v.id!==condition.id),{...condition}]};}
export function withAttributeBonus(c:Character,ability:Ability,bonus:number):Character{
 if(!ABILITIES.includes(ability)||!Number.isInteger(bonus)||bonus< -30||bonus>30)throw new RangeError('Invalid attribute bonus.');
 const before=derived(c),next={...c,attributeBonuses:{...c.attributeBonuses,[ability]:bonus}},after=derived(next);
 return {...next,hp:c.hp===0?0:Math.min(after.maxHP,c.hp+Math.max(0,after.maxHP-before.maxHP)),sp:Math.min(c.sp,after.maxSP)};
}
export function portraitState(c:Character):'normal'|'hurt'|'afflicted'|'dead'{if(c.hp===0)return 'dead';if(c.conditions.length)return 'afflicted';return c.hp<derived(c).maxHP*.5?'hurt':'normal';}
export function healthColor(c:Character):'green'|'yellow'|'red'|'blue'{const ratio=c.hp/derived(c).maxHP;return c.hp===0?'blue':ratio>=.75?'green':ratio>=.25?'yellow':'red';}
export function conditionLabels(c:Character):string[]{return [...(c.hp===0?['Dead']:[]),...c.conditions.map(v=>(packCondition(v.id)?.name??(v.id[0].toUpperCase()+v.id.slice(1)))+((v.stacks??1)>1?' ×'+v.stacks:''))];}
export function canUseStartingGear(classId:ClassId,id:string):boolean{return !!ITEMS[id]&&canEquip(classId,ITEMS[id]);}
/** Structural validation for safe future save boundaries; not a save/load implementation. */
export function validateParty(value:unknown):PartyState{
 if(!value||typeof value!=='object')throw new TypeError('Party must be an object.');const p=value as PartyState;
 if(!p.characters||typeof p.characters!=='object'||!Array.isArray(p.order)||p.order.length<1||p.order.length>6||new Set(p.order).size!==p.order.length||Object.keys(p.characters).length<p.order.length||Object.keys(p.characters).length>24||!p.order.includes(p.selectedId)||p.order.some(id=>!Object.hasOwn(p.characters,id)))throw new TypeError('Invalid party membership.');
 for(const id of Object.keys(p.characters)){
  const c=p.characters[id];if(!c||c.id!==id||typeof id!=='string'||!/^hero_[a-z0-9_]+$/.test(id)||typeof c.name!=='string'||c.name.trim().length<1||c.name.length>24||/[\x00-\x1f\x7f]/.test(c.name)||!Object.hasOwn(CLASSES,c.classId)||!Object.hasOwn(RACES,c.raceId??DEFAULT_RACE_ID)||(c.creationChoiceId!==undefined&&!CLASSES[c.classId].creationChoices?.some(x=>x.id===c.creationChoiceId))||!Number.isInteger(c.portrait)||c.portrait<0||c.portrait>11||!Number.isInteger(c.age)||c.age<1||typeof c.heritage!=='string'||!Number.isInteger(c.level)||c.level<1||c.level>progression().maxLevel||!Number.isSafeInteger(c.xp)||c.xp<0)throw new TypeError('Invalid character identity/progression.');
  for(const a of ABILITIES)if(!c.attributes||!c.attributeBonuses||!Number.isInteger(c.attributes[a])||c.attributes[a]<1||c.attributes[a]>18||!Number.isInteger(c.attributeBonuses[a])||c.attributeBonuses[a]< -30||c.attributeBonuses[a]>30)throw new TypeError('Invalid attributes.');
  for(const t of DAMAGE_TYPES)if(!c.baseResistances||!Number.isFinite(c.baseResistances[t])||c.baseResistances[t]< -50||c.baseResistances[t]>75)throw new TypeError('Invalid resistance.');
  if(c.portraitId!==undefined&&!Object.hasOwn(PORTRAITS,c.portraitId))throw new TypeError('Unknown portrait set.');
  if(CLASSES[c.classId].creationChoices?.length&&(!c.creationChoiceId||!CLASSES[c.classId].creationChoices?.some(x=>x.id===c.creationChoiceId)))throw new TypeError('Invalid character starting choice.');
  if(!c.combatSetup||!PREPARED_STYLES[c.classId]?.includes(c.combatSetup.prepared)||!['attack','block','run','cast'].includes(c.combatSetup.quickAction)||(c.combatSetup.quickAction==='cast'&&!CLASSES[c.classId].casting))throw new TypeError('Invalid class combat setup.');
  if(!c.equipment||!['melee','ranged'].includes(c.equipment.preferredAttack))throw new TypeError('Invalid equipment.');
  for(const slot of ['melee','ranged','body','offhand','accessoryA','accessoryB'] as const){const item=c.equipment[slot];if(item!==null&&(!ITEMS[item]||!((ITEMS[item].slot===slot)||(ITEMS[item].slot==='accessory'&&['accessoryA','accessoryB'].includes(slot)))||!canUseStartingGear(c.classId,item)))throw new TypeError('Unknown or misplaced starting equipment.');}
  if(!Array.isArray(c.conditions)||c.conditions.length>16||new Set(c.conditions.map(v=>v.id)).size!==c.conditions.length||!Array.isArray(c.awards)||c.awards.some(v=>typeof v!=='string'))throw new TypeError('Invalid character records.');
  for(const condition of c.conditions)withCondition({...c,conditions:[]},condition);
  checkAbilityState(c);
  const d=derived(c);if(!Number.isSafeInteger(c.hp)||c.hp<0||c.hp>d.maxHP||!Number.isSafeInteger(c.sp)||c.sp<0||c.sp>d.maxSP)throw new TypeError('Vitals exceed their bounds.');
 }
 if(!p.resources||[p.resources.gold,p.resources.food,p.resources.bankGold].some(v=>!Number.isSafeInteger(v)||v<0)||!p.resources.supplies||Object.values(p.resources.supplies).some(v=>!Number.isSafeInteger(v)||v<0))throw new TypeError('Invalid party resources.');
 return p;
}
