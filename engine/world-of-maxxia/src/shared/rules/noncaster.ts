/** MM09: data-described prepared routines. Selection stays instant and one-click. */
import {derived,effectiveAttributes,modifier,PREPARED_STYLES,type Character,type PreparedStyle,type QuickAction} from './party.ts';
import {ITEMS} from '../content/items.ts';
import {hasTrait,CLASSES} from '../content/classes.ts';
import {preparedDefinition,progression,milestone,veteran} from '../content/progression.ts';
export interface StrikeProfile {label:string;attackBonus:number;dice:string;damageBonus:number;ignoreDefense:number;damageType:'physical'|'lightning';}
export function strikeProfile(c:Character,range:'melee'|'ranged'):StrikeProfile {
 const d=derived({...c,equipment:{...c.equipment,preferredAttack:range}}),weapon=c.equipment[range]?ITEMS[c.equipment[range]!]:undefined;
 let profile:StrikeProfile={label:weapon?.name??'Unarmed',attackBonus:d.attackBonus,dice:weapon?.dice??'1',damageBonus:d.damageBonus,ignoreDefense:0,damageType:'physical'};
 const settings=progression(),style=preparedDefinition(c.combatSetup.prepared);
 if(range==='ranged'){
  if(hasTrait(c.classId,'device_training')&&weapon){const b=settings.traitBonuses.device_training;profile={...profile,label:`Trained ${profile.label}`,attackBonus:profile.attackBonus+b.rangedAccuracy+(veteran(c.level)?b.rangedVeteranAccuracy:0),damageBonus:profile.damageBonus+(milestone(c.level)?b.rangedMilestoneDamage:0)};}
  return profile;
 }
 if(style.requiredTrait!==null&&!hasTrait(c.classId,style.requiredTrait))return profile;
 if(style.operation==='device'||style.operation==='natural'){
  const attribute=style.operation==='device'?'DEX':'CON',attributeMod=modifier(effectiveAttributes(c)[attribute]);
  const penalty=d.attackBonus-(d.proficiency+modifier(d.attributes.STR)+(weapon?.accuracy??0));
  profile={label:style.name,attackBonus:d.proficiency+attributeMod+penalty,damageBonus:attributeMod+(c.conditions.some(v=>v.id==='hungry')?-1:0),dice:style.dice,ignoreDefense:0,damageType:style.damageType};
 } else if(style.id==='carapace')profile={...profile,label:`${style.name} · ${profile.label}`};
 else if(style.id!=='standard')profile={...profile,label:style.name};
 profile={...profile,attackBonus:profile.attackBonus+style.attackBonus+(veteran(c.level)?style.attackBonusAtVeteran:0),
  damageBonus:profile.damageBonus+(milestone(c.level)&&style.damageBonusAtMilestoneReplacesBase?style.damageBonusAtMilestone:style.damageBonus+(milestone(c.level)?style.damageBonusAtMilestone:0)),
  dice:veteran(c.level)&&style.diceAtVeteran?style.diceAtVeteran:milestone(c.level)&&style.diceAtMilestone?style.diceAtMilestone:profile.dice,
  ignoreDefense:style.ignoreDefense,damageType:style.damageType};
 return profile;
}
export function classStrikeText(c:Character):string {
 const p=strikeProfile(c,'melee'),d=derived(c);
 return `${p.label}: ${p.dice} ${p.damageBonus>=0?'+':''}${p.damageBonus} damage, attack ${p.attackBonus>=0?'+':''}${p.attackBonus}, ignores ${p.ignoreDefense} Defense · total Defense ${d.defense}.`;
}
export function setPrepared(c:Character,style:PreparedStyle):Character {
 if(!PREPARED_STYLES[c.classId]?.includes(style))throw new RangeError('That prepared style is not available to this class.');
 return {...c,combatSetup:{...c.combatSetup,prepared:style}};
}
export function setQuickAction(c:Character,action:QuickAction):Character {
 if(!['attack','block','run','cast'].includes(action)||(action==='cast'&&!CLASSES[c.classId]?.casting))throw new RangeError('Unknown Quick Fight default.');
 return {...c,combatSetup:{...c.combatSetup,quickAction:action}};
}
