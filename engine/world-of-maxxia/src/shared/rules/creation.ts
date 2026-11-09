/** Phase 19: bounded, deterministic character creation. No random rolling or new combat resources. */
import {ABILITIES,CLASS_IDS,CLASSES,STARTER_HEROES,type Ability,type Attributes,type ClassId} from '../content/party.ts';
import {PORTRAIT_ORDER,portraitForLegacyNumber} from '../content/actors.ts';
import {RACES,DEFAULT_RACE_ID} from '../content/races.ts';
import {createDefaultParty,defaultCombatSetup,derived,validateParty,type Character,type PartyState,DAMAGE_TYPES,canUseStartingGear} from './party.ts';
export const PORTRAIT_COUNT=12; // Legacy save index bound. New portraits use portraitId.
export const portraitChoices=()=>PORTRAIT_ORDER;
export const ROSTER_LIMIT=24;
export const ATTRIBUTE_TOTAL=76;
export const RECRUIT_COST=40;
export interface HeroBlueprint{name:string;classId:ClassId;raceId?:string;creationChoiceId?:string;portrait:number;portraitId?:string;attributes:Attributes;}
export function proposedHero(slot:number,classId:ClassId=CLASS_IDS[slot%CLASS_IDS.length]):HeroBlueprint{
 const attributes=Object.fromEntries(ABILITIES.map(a=>[a,a===CLASSES[classId].primary?16:12])) as Attributes;
 return {name:slot<STARTER_HEROES.length?STARTER_HEROES[slot].name:`Adventurer ${slot+1}`,classId,raceId:DEFAULT_RACE_ID,creationChoiceId:CLASSES[classId].creationChoices?.[0]?.id,portrait:slot%PORTRAIT_COUNT,portraitId:portraitForLegacyNumber(slot%PORTRAIT_COUNT),attributes};
}
export function validateBlueprint(raw:unknown):HeroBlueprint {
 if(!raw||typeof raw!=='object')throw new TypeError('Character creation is incomplete.');
 const v=raw as HeroBlueprint;
 if(typeof v.name!=='string'||!v.name.trim()||v.name!==v.name.trim()||v.name.length>24||/[\x00-\x1f\x7f<>]/.test(v.name))throw new TypeError('Character name must be 1–24 printable characters.');
 if(!Object.hasOwn(CLASSES,v.classId)||!Object.hasOwn(RACES,v.raceId??DEFAULT_RACE_ID)||(CLASSES[v.classId].creationChoices?.length&&!CLASSES[v.classId].creationChoices?.some(x=>x.id===v.creationChoiceId))||(!CLASSES[v.classId].creationChoices?.length&&v.creationChoiceId!==undefined)||!Number.isInteger(v.portrait)||v.portrait<0||v.portrait>=PORTRAIT_COUNT||(v.portraitId!==undefined&&!PORTRAIT_ORDER.includes(v.portraitId)))throw new TypeError('Choose a valid class and portrait.');
 if(!v.attributes||ABILITIES.some(a=>!Number.isInteger(v.attributes[a])||v.attributes[a]<8||v.attributes[a]>16)||ABILITIES.reduce((n,a)=>n+v.attributes[a],0)!==ATTRIBUTE_TOTAL)throw new TypeError(`Spend exactly ${ATTRIBUTE_TOTAL} attribute points (each score 8–16).`);
 return v;
}
export function makeHero(spec:HeroBlueprint,id:string):Character {
 const b=validateBlueprint(spec);
 if(!/^hero_[a-z0-9_]+$/.test(id))throw new TypeError('Invalid hero ID.');
 const seed=STARTER_HEROES.find(h=>h.classId===b.classId)??STARTER_HEROES[0];
 const char:Character={id,name:b.name,classId:b.classId,raceId:b.raceId??DEFAULT_RACE_ID,...(b.creationChoiceId?{creationChoiceId:b.creationChoiceId}:{}),portrait:b.portrait,portraitId:b.portraitId??portraitForLegacyNumber(b.portrait),age:seed.age,heritage:seed.heritage,attributes:{...b.attributes},attributeBonuses:Object.fromEntries(ABILITIES.map(a=>[a,0])) as Attributes,level:1,xp:0,hp:1,sp:0,baseResistances:Object.fromEntries(DAMAGE_TYPES.map(t=>[t,0])) as Character['baseResistances'],conditions:[],awards:[],combatSetup:defaultCombatSetup(b.classId),equipment:{melee:seed.equipment.melee,ranged:seed.equipment.ranged,body:seed.equipment.body,offhand:seed.equipment.offhand,accessoryA:null,accessoryB:null,preferredAttack:seed.equipment.preferredAttack}};
 Object.assign(char.equipment,CLASSES[b.classId].starterEquipment??{},CLASSES[b.classId].creationChoices?.find(x=>x.id===b.creationChoiceId)?.starterEquipment??{});
 // Choose starter equipment that is allowed for newly duplicated classes.
 for(const slot of ['melee','ranged','body','offhand'] as const)if(char.equipment[slot]&&!canUseStartingGear(b.classId,char.equipment[slot]!))char.equipment[slot]=null;
 const d=derived(char);char.hp=d.maxHP;char.sp=d.maxSP;return char;
}
export function createCustomParty(blueprints:readonly HeroBlueprint[]):PartyState {
 if(!Array.isArray(blueprints)||blueprints.length!==6)throw new TypeError('Create exactly six adventurers.');
 if(new Set(blueprints.map(b=>validateBlueprint(b).name.toLocaleLowerCase())).size!==6)throw new TypeError('Each adventurer must have a different name.');
 const base=createDefaultParty(),characters:Record<string,Character>={},order:string[]=[];
 blueprints.forEach((b,i)=>{const id=`hero_custom_${String(i+1).padStart(3,'0')}`;order.push(id);characters[id]=makeHero(b,id);});
 return validateParty({...base,characters,order,selectedId:order[0]});
}
export function nextHeroId(party:PartyState):string {
 for(let i=1;i<=999;i++){const id=`hero_custom_${String(i).padStart(3,'0')}`;if(!Object.hasOwn(party.characters,id))return id;}
 throw new RangeError('No available roster ID.');
}
