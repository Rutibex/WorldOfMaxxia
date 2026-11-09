import {SPELLS,type MagicState,type SpellDefinition} from '../shared/rules/magic.ts';
import {spellAllowed} from '../shared/content/spells.ts';
import {derived,type Character,type PartyState} from '../shared/rules/party.ts';
export function spellbookEntries(hero:Character,magic:MagicState){return Object.values(SPELLS).filter(s=>spellAllowed(hero.classId,s.id)).map(spell=>({spell,known:(magic.known[hero.id]??[]).includes(spell.id),readied:magic.readied[hero.id]===spell.id,levelLocked:hero.level<spell.level}));}
/** Target-specific feedback is separate from caster/context/SP validation. */
export function allyTargetReason(spell:SpellDefinition,ally:Character,magic:MagicState):string|null{
 if(spell.target==='dead_ally')return ally.hp===0?null:'Must be fallen';
 if(ally.hp===0)return 'Fallen';
 if(spell.effect==='heal'&&ally.hp>=derived(ally).maxHP)return 'Already at full health';
 if(spell.effect==='cure'&&!ally.conditions.some(c=>c.id==='poisoned'))return 'Not poisoned';
 if(spell.effect==='break_curse'&&!ally.conditions.some(c=>c.id==='cursed')&&!magic.itemCurses[ally.id]?.length)return 'No curse to break';
 return null;
}
export function spellTargetLabel(spell:SpellDefinition,party:PartyState,targetId:string|undefined,enemies:{id:string;name:string}[],steps:1|2):string{
 if(spell.target==='ally'||spell.target==='dead_ally')return targetId?party.characters[targetId]?.name??'Choose an ally':'Choose an ally';
 if(spell.target==='enemy')return enemies.find(e=>e.id===targetId)?.name??'Choose an enemy';
 if(spell.target==='enemies')return 'All encounter targets';
 if(spell.target==='party')return 'Entire party';
 if(spell.effect==='fold')return `${steps} square${steps===1?'':'s'} forward`;
 if(spell.target==='object')return 'Facing adjacent lock';
 return 'Current surroundings';
}
