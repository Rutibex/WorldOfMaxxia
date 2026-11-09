/** MP20: pack-composed race identities. Legacy heroes without raceId are Human. */
import {ABILITIES,type Ability} from './classes.ts';
export const DEFAULT_RACE_ID='core:race:human';
export interface LevelGrant {id:string;minLevel:number;}
export interface RaceDefinition {id:string;name:string;description:string;attributeBonuses:Partial<Record<Ability,number>>;resistances:Partial<Record<'physical'|'fire'|'cold'|'lightning'|'poison'|'arcane'|'holy'|'necrotic',number>>;traits:string[];abilityGrants:LevelGrant[];}
const defaultHuman:RaceDefinition={id:DEFAULT_RACE_ID,name:'Human',description:'An adaptable adventurer of the classic rules profile.',attributeBonuses:{},resistances:{},traits:[],abilityGrants:[]};
export const RACES:Record<string,RaceDefinition>={};
export const RACE_IDS:string[]=[];
const raceId=/^[a-z][a-z0-9_]{0,47}:race:[a-z][a-z0-9_]{0,79}$/;
const abilityId=/^[a-z][a-z0-9_]{0,47}:ability:[a-z][a-z0-9_]{0,79}$/;
const keyId=/^[a-z][a-z0-9_]{0,47}:[a-z][a-z0-9_]{0,47}:[a-z][a-z0-9_]{0,79}$/;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const fail=(path:string):never=>{throw new TypeError('Invalid race definition at '+path);};
export function readRaceDefinition(input:unknown):RaceDefinition{
 if(!obj(input))fail('$');const v=input as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['id','name','description','attributeBonuses','resistances','traits','abilityGrants'].includes(k))||!raceId.test(String(v.id))||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||typeof v.description!=='string'||v.description.length>1500)fail('$.identity');
 const attrs=v.attributeBonuses??{},res=v.resistances??{},traits=v.traits??[],grants=v.abilityGrants??[];
 if(!obj(attrs)||Object.entries(attrs).some(([k,n])=>!ABILITIES.includes(k as Ability)||!Number.isSafeInteger(n)||(n as number)<-3||(n as number)>3))fail('$.attributeBonuses');
 if(!obj(res)||Object.entries(res).some(([k,n])=>!['physical','fire','cold','lightning','poison','arcane','holy','necrotic'].includes(k)||!Number.isSafeInteger(n)||(n as number)<-25||(n as number)>25))fail('$.resistances');
 if(!Array.isArray(traits)||traits.length>12||new Set(traits).size!==traits.length||traits.some(t=>typeof t!=='string'||!keyId.test(t)))fail('$.traits');
 if(!Array.isArray(grants)||grants.length>32||new Set(grants.map(g=>g?.id)).size!==grants.length||grants.some(g=>!obj(g)||Object.keys(g).sort().join('|')!=='id|minLevel'||!abilityId.test(String(g.id))||!Number.isInteger(g.minLevel)||(g.minLevel as number)<1||(g.minLevel as number)>20))fail('$.abilityGrants');
 return structuredClone({...v,attributeBonuses:attrs,resistances:res,traits,abilityGrants:grants}) as unknown as RaceDefinition;
}
export function readRaceDatabase(input:unknown):RaceDefinition[]{if(!Array.isArray(input)||input.length<1||input.length>128)fail('$.races');const races=(input as unknown[]).map(readRaceDefinition);if(new Set(races.map(r=>r.id)).size!==races.length)fail('$.races.duplicate');return races;}
export function installRaceDatabase(input:unknown):void{const values=readRaceDatabase(input);for(const id of Object.keys(RACES))delete RACES[id];RACE_IDS.splice(0,RACE_IDS.length);for(const r of values){RACES[r.id]=r;RACE_IDS.push(r.id);}}
export function resetRaceDatabase():void{installRaceDatabase([defaultHuman]);}
export function humanRace():RaceDefinition{return structuredClone(defaultHuman);}
export function raceFor(value:{raceId?:string}):RaceDefinition{return RACES[value.raceId??DEFAULT_RACE_ID]??RACES[DEFAULT_RACE_ID];}
resetRaceDatabase();
