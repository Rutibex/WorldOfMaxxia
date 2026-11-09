/** Original starter adventurers and provisional gear values for the computer demo. */
export const ABILITIES=['STR','DEX','CON','INT','WIS','CHA'] as const;
export type Ability=typeof ABILITIES[number];
export type Attributes=Record<Ability,number>;
import {CLASSES,CLASS_IDS,type ClassId} from './classes.ts';
import {ACTORS,DEFAULT_PARTY} from './actors.ts';
export {CLASSES,CLASS_IDS};
export type {ClassId};
export interface StarterGear{id:string;name:string;slot:'melee'|'ranged'|'body'|'offhand';dice?:string;armor?:number;weight?:'light'|'medium'|'heavy';accuracy?:number;}
export const STARTER_GEAR:Record<string,StarterGear>={
 item_sword:{id:'item_sword',name:'Sword',slot:'melee',dice:'1d8'},
 item_dagger:{id:'item_dagger',name:'Dagger',slot:'melee',dice:'1d4'},
 item_staff:{id:'item_staff',name:'Staff',slot:'melee',dice:'1d6'},
 item_mace:{id:'item_mace',name:'Mace',slot:'melee',dice:'1d6'},
 item_spear:{id:'item_spear',name:'Spear',slot:'melee',dice:'1d6'},
 item_crossbow:{id:'item_crossbow',name:'Crossbow',slot:'ranged',dice:'1d8'},
 item_cloth_robe:{id:'item_cloth_robe',name:'Cloth Robe',slot:'body',armor:0,weight:'light'},
 item_leather_coat:{id:'item_leather_coat',name:'Leather Coat',slot:'body',armor:2,weight:'light'},
 item_ring_mail:{id:'item_ring_mail',name:'Ring Mail',slot:'body',armor:3,weight:'medium'},
 item_plate_harness:{id:'item_plate_harness',name:'Plate Harness',slot:'body',armor:6,weight:'heavy'},
 item_round_shield:{id:'item_round_shield',name:'Round Shield',slot:'offhand',armor:2}
};
/** Mutable view of the active actor starter records, ordered by project configuration. */
export const STARTER_HEROES:import('./actors.ts').ActorSeed[]=[];
export function syncStarterHeroes():void {STARTER_HEROES.splice(0,STARTER_HEROES.length,...DEFAULT_PARTY.map(id=>ACTORS[id]));}
syncStarterHeroes();
