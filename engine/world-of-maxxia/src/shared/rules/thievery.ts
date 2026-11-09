/** Persistent bonus theft pools, separate from victory loot. */
import type {CampaignState,MapRegistry} from './campaign.ts';
import {derived,modifier,type Character} from './party.ts';
import {giveItem,LOOT_CACHES} from './inventory.ts';
import {ITEMS} from '../content/items.ts';
import {SeededRng} from './rng.ts';
export interface ThieveryState {prizes:Record<string,string>;stolen:string[];unlocked:string[];discovered:string[];bashed:string[];}
export const initialThievery=():ThieveryState=>({prizes:{},stolen:[],unlocked:[],discovered:[],bashed:[]});
export const STEAL_TABLE:Record<string,readonly [string,string]>={dust_imp:['item_spark_capsule','item_treasure_gem'],stone_mite:['item_antidote','item_copper_ring'],gallery_watcher:['item_healing_scroll','item_echo_staff'],cistern_rat:['item_wake_salts','item_treasure_gem'],sludge_leech:['item_antidote','item_healing_scroll'],pipe_goblin:['item_healing_draught','item_buckler'],bell_wraith:['item_healing_scroll','item_echo_staff'],valve_sentinel:['item_spark_capsule','item_cistern_carapace'],bell_heart:['item_treasure_gem','item_bellkeeper_blade'],npc:['item_healing_draught','item_treasure_gem']};
export function bestThief(s:CampaignState):Character|undefined{return s.party.order.map(id=>s.party.characters[id]).filter(c=>c.hp>0&&!c.conditions.some(v=>v.id==='asleep')).sort((a,b)=>derived(b).attributes.DEX-derived(a).attributes.DEX)[0];}
export function stealBonus(s:CampaignState,rng:SeededRng,hero:Character,id:string,kind:string,dc:number):string {
 const t=s.thievery;if(t.stolen.includes(id))return 'Already stolen: this target has no bonus item left.';
 const pool=STEAL_TABLE[kind]??STEAL_TABLE.npc;
 if(!t.prizes[id]){t.prizes[id]=pool[rng.integer(1,100)<=15?1:0];s.rollCount++;}
 const roll=rng.integer(1,20),bonus=modifier(derived(hero).attributes.DEX);s.rollCount++;
 if(roll+bonus<dc)return `${hero.name} fails to steal (d20 ${roll} ${bonus>=0?'+':''}${bonus} vs DC ${dc}). The item remains.`;
 const prize=t.prizes[id];if(!giveItem(s.inventory,hero.id,prize))return `${hero.name}'s backpack is full. The target keeps its item.`;
 t.stolen.push(id);return `${hero.name} steals ${ITEMS[prize].name}${prize===pool[1]?' (rare)':''}! This target has no bonus item left.`;
}
export function validateThievery(raw:unknown,s:CampaignState,registry:MapRegistry):void{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('Invalid thievery state.');const t=raw as ThieveryState;
 const enemies=Object.values(s.combat.encounters).flatMap(e=>e.enemies.map(v=>[v.id,v.kindId] as const));const targets=new Map<string,string>([...enemies,...['npc_tessa_bell','npc_orro_vane','npc_sister_vale','npc_captain_brann','npc_pell_glass','npc_nera_salt','npc_aunt_vell','npc_iona_reed'].map(id=>[id,'npc'] as const)]);
 if(!t.prizes||typeof t.prizes!=='object'||Array.isArray(t.prizes)||Object.keys(t.prizes).length>64)throw new TypeError('Invalid theft prizes.');
 for(const [id,prize] of Object.entries(t.prizes))if(!targets.has(id)||!STEAL_TABLE[targets.get(id)!]?.includes(prize))throw new TypeError('Unknown theft prize.');
 const caches=LOOT_CACHES.map(c=>c.id as string),discover=[...caches,...Object.values(registry).flatMap(m=>(m.traps??[]).map(v=>`trap:${m.id}:${v.id}`))];
 for(const [list,allowed] of [[t.stolen,Object.keys(t.prizes)],[t.unlocked,caches],[t.discovered,discover],[t.bashed,caches]] as [string[],string[]][]){if(!Array.isArray(list)||list.length>128||new Set(list).size!==list.length||list.some(id=>!allowed.includes(id)))throw new TypeError('Invalid thievery progress.');}

}
export {chestDC,hiddenCache} from '../content/field-actions.ts';
