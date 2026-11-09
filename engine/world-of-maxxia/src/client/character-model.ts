import {raceFor} from '../shared/content/races.ts';
import {ABILITIES,CLASSES,DAMAGE_TYPES,derived,modifier,training,conditionLabels,portraitState,preparedInfo,type Character,type PartyState} from '../shared/rules/party.ts';
import {strikeProfile} from '../shared/rules/noncaster.ts';
import {SPELLS,type MagicState} from '../shared/rules/magic.ts';
export const CHARACTER_TABS=['stats','inventory','spellbook','abilities','awards','party'] as const;
export type CharacterTab=typeof CHARACTER_TABS[number];
export const signed=(n:number)=>n>=0?'+'+n:String(n);
const damage=(dice:string,bonus:number)=>dice+(bonus?signed(bonus):'');
const NAMES:Record<string,string>={STR:'Strength',DEX:'Dexterity',CON:'Constitution',INT:'Intelligence',WIS:'Wisdom',CHA:'Charisma'};
export function inspectedCharacter(party:PartyState):Character{return party.characters[party.selectedId]??party.characters[party.order[0]];}
export function characterSummary(c:Character,magic:MagicState){
 const d=derived(c),melee=strikeProfile(c,'melee'),ranged=c.equipment.ranged?strikeProfile(c,'ranged'):null,t=training(c),spell=SPELLS[magic.readied[c.id]??''];
 const ready=c.combatSetup.quickAction==='cast'?(spell?.name??'No spell readied'):c.combatSetup.quickAction==='attack'?melee.label:c.combatSetup.quickAction==='block'?'Block':'Run';
 return {c,d,melee,ranged,training:t,conditions:conditionLabels(c),portraitState:portraitState(c),className:CLASSES[c.classId].name,casting:!!CLASSES[c.classId].casting,prepared:preparedInfo(c.combatSetup.prepared).name,readiedSpell:spell?.name??'None',quick:ready,meleeDamage:damage(melee.dice,melee.damageBonus),rangedDamage:ranged?damage(ranged.dice,ranged.damageBonus):'—',attributes:ABILITIES.map(id=>({id,label:NAMES[id],value:d.attributes[id],base:c.attributes[id],bonus:c.attributeBonuses[id],modifier:modifier(d.attributes[id])})),resistances:DAMAGE_TYPES.map(id=>({id,label:id[0].toUpperCase()+id.slice(1),value:d.resistances[id]})),knownSpells:(magic.known[c.id]??[]).filter(id=>SPELLS[id]?.classId===c.classId).length};
}
export function statExplanation(c:Character,key:string):string{
 const d=derived(c),t=training(c),cls=CLASSES[c.classId];
 if(ABILITIES.includes(key as typeof ABILITIES[number])){const a=key as typeof ABILITIES[number];return `${NAMES[a]}: ${c.attributes[a]} base ${signed(c.attributeBonuses[a])} adjustment ${signed(raceFor(c).attributeBonuses[a]??0)} race = ${d.attributes[a]}. Modifier ${signed(modifier(d.attributes[a]))}.${cls.primary===a?' Your class’s primary attribute.':''}`;}
 if(key==='Defense')return `Defense ${d.defense}: 10 base, armor ${signed(d.armorBonus)}, shield ${signed(d.shieldBonus)}, Dexterity ${signed(d.dexContribution)}, prepared defense ${signed(d.preparedDefense)}. Temporary party wards are additional combat effects.`;
 if(key==='Melee'||key==='Melee damage'){const p=strikeProfile(c,'melee');return `${p.label}: ${signed(p.attackBonus)} to hit, ${damage(p.dice,p.damageBonus)} damage. This is the prepared routine used by Attack; damage is at least 1 on a hit.`;}
 if(key==='Ranged'||key==='Ranged damage'){const p=strikeProfile(c,'ranged');return c.equipment.ranged?`${p.label}: ${signed(p.attackBonus)} to hit, ${damage(p.dice,p.damageBonus)} damage. Shoot requires a clear firing lane.`:'No ranged weapon equipped.';}
 if(key==='Spell DC')return d.spellDC===null?'This class uses prepared attacks instead of spell points.':`Spell DC ${d.spellDC}: 10 + proficiency ${d.proficiency} + ${cls.casting} modifier ${signed(modifier(d.attributes[cls.casting!]))}.`;
 if(key==='HP')return `${c.hp} / ${d.maxHP} hit points. ${c.hp===0?'Fallen; ordinary healing cannot revive this adventurer.':'Healing and damage persist between encounters.'}`;
 if(key==='SP')return cls.casting?`${c.sp} / ${d.maxSP} spell points. Cast spells from your class’s own list; readied spells are used by Quick Fight when configured.`:'This class has no spell-point pool.';
 if(key==='Experience')return t.capped?'Level 5: the demo level cap.':`${c.xp} XP. Level ${t.nextLevel} requires ${t.nextXP} XP and ${t.cost} gold at Captain Brann’s training hall. ${t.eligible?'Ready to train.':t.remainingXP+' more XP needed.'}`;
 if(key==='Conditions')return conditionLabels(c).length?conditionLabels(c).join(', ')+'. '+c.conditions.map(v=>`${v.id}: ${v.remaining===null?'until cured':v.remaining+' '+v.unit}`).join(' · '):'Good: no adverse conditions. Reading this screen does not advance time.';
 const resistance=DAMAGE_TYPES.find(id=>id===key);if(resistance)return `${resistance[0].toUpperCase()+resistance.slice(1)} resistance: ${d.resistances[resistance]}%. Includes equipment bonuses; bounded from −50% to +75%.`;
 return 'Choose a statistic to inspect it. F1–F6 switches character without changing tabs.';
}
export function partyComparison(party:PartyState,magic:MagicState){const heroes=party.order.map(id=>characterSummary(party.characters[id],magic));return {heroes,rows:[{label:'Level',values:heroes.map(h=>String(h.c.level))},{label:'HP',values:heroes.map(h=>`${h.c.hp}/${h.d.maxHP}`)},{label:'SP',values:heroes.map(h=>h.casting?`${h.c.sp}/${h.d.maxSP}`:'—')},{label:'Defense',values:heroes.map(h=>String(h.d.defense))},{label:'Melee',values:heroes.map(h=>signed(h.melee.attackBonus))},{label:'Damage',values:heroes.map(h=>h.meleeDamage)},{label:'Ranged',values:heroes.map(h=>h.ranged?signed(h.ranged.attackBonus)+' · '+h.rangedDamage:'—')},{label:'Spell DC',values:heroes.map(h=>h.d.spellDC===null?'—':String(h.d.spellDC))},{label:'Condition',values:heroes.map(h=>h.conditions.join(', ')||'Good')},{label:'Readied spell',values:heroes.map(h=>h.casting?h.readiedSpell:'—')},{label:'Quick action',values:heroes.map(h=>h.quick)}]};}
