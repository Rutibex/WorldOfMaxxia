import {effectDefinition,EffectFault} from '../content/effect-definitions.ts';
import {applyEffect} from './effects.ts';
import {dropItem,makeGroundItem} from './ground.ts';
import {MONSTERS} from '../content/monsters.ts';
import {DIRECTIONS} from './grid.ts';
import {chestDC,hiddenCache} from './thievery.ts';
/** Phase 13 inventory: fixed catalog, unique instances, safe transactions, authored loot. */
import {ITEMS,ITEM_CATEGORIES,type ItemCategory, type ItemDefinition} from '../content/items.ts';
import {canUseStartingGear,derived,heal,updateMember,type Character} from './party.ts';
import type {CampaignState} from './campaign.ts';
export const ITEM_LIMIT_PER_CATEGORY=9;
export const ITEM_LIMIT_TOTAL=216;
export const ITEM_SLOTS=['melee','ranged','body','offhand','accessoryA','accessoryB'] as const;
export type EquipmentSlot=typeof ITEM_SLOTS[number];
export interface ItemInstance{attuned?:boolean;cursed?:boolean;backpackSlot?:number;id:string;ownerId:string;definitionId:string;count:number;charges:number;durability:number;identified:boolean;equipped:EquipmentSlot|null;}
export interface GroundDrop{id:string;mapId:string;x:number;y:number;definitionId:string;}
export const BACKPACK_SORTS=['manual','name','category','value'] as const;
export type BackpackSort=typeof BACKPACK_SORTS[number];
export interface InventoryState{backpackSort:Record<string,BackpackSort>;items:ItemInstance[];nextId:number;claimed:string[];drops:GroundDrop[];}
// Legacy ID lookup retained for save migration and old tests; live corpses use MM15 catalogue.
import {lootTableForEncounter} from '../content/loot.ts';
import {SeededRng} from './rng.ts';
import defaultLoot from '../content/loot-default.json' with {type:'json'};
export const LOOT_TABLE:Record<string,string[]>=Object.fromEntries(defaultLoot.assignments.map(a=>[a.encounterId,defaultLoot.tables.find(t=>t.id===a.tableId)!.entries.map(e=>e.itemId)]));
export const LOOT_CACHES=[
 {id:'cache_gallery_mirror',mapId:'map_diagnostic_galleries',x:7,y:8,items:['item_glass_thorn','item_regulator_lens','item_healing_scroll']},
 {id:'cache_gallery_star',mapId:'map_diagnostic_galleries',x:8,y:2,items:['item_custodian_seal','item_bellkeeper_blade','item_recall_token']},
 {id:'cache_gallery_brazier',mapId:'map_diagnostic_galleries',x:2,y:2,items:['item_cistern_carapace','item_spark_capsule']},
 {id:'cache_upper_archive',mapId:'map_diagnostic_galleries',x:11,y:2,items:['item_antidote','item_wake_salts']},
 {id:'cache_upper_sluice',mapId:'map_diagnostic_galleries',x:11,y:13,items:['item_copper_ring','item_spark_capsule']},
 {id:'cache_vault_rest',mapId:'map_resonator_vault',x:3,y:11,items:['item_healing_draught','item_antidote']},
 {id:'cache_vault_bypass',mapId:'map_resonator_vault',x:11,y:10,items:['item_spark_capsule','item_treasure_gem']},
 {id:'cache_town_market',mapId:'map_town',x:9,y:11,items:['item_quayward_charm','item_tessa_silver_brooch','item_antidote']}
] as const;
const safeCount=(value:unknown,max:number)=>Number.isSafeInteger(value)&&(value as number)>=0&&(value as number)<=max;
export function validateInventory(raw:unknown,party:CampaignState['party']):InventoryState{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('Invalid inventory root.');
 const inventory=raw as InventoryState;
 if(!Array.isArray(inventory.items)||inventory.items.length>ITEM_LIMIT_TOTAL||!safeCount(inventory.nextId,100000000)||inventory.nextId<1||!Array.isArray(inventory.drops)||inventory.drops.length>48||!Array.isArray(inventory.claimed)||inventory.claimed.length>64||new Set(inventory.claimed).size!==inventory.claimed.length)throw new TypeError('Invalid inventory limits.');
 if(!inventory.backpackSort||typeof inventory.backpackSort!=='object'||Array.isArray(inventory.backpackSort)||Object.entries(inventory.backpackSort).some(([id,mode])=>!Object.hasOwn(party.characters,id)||!BACKPACK_SORTS.includes(mode)))throw new TypeError('Invalid backpack sorting.');
 const knownCaches=new Set([...LOOT_CACHES.map(c=>c.id),...Object.keys(LOOT_TABLE).map(k=>`reward_${k}`)]);
 if(inventory.claimed.some(v=>typeof v!=='string'||!knownCaches.has(v)))throw new TypeError('Invalid claimed loot.');
 const dropIds=new Set<string>();for(const drop of inventory.drops){if(!drop||typeof drop.id!=='string'||!/^drop_[a-z0-9_]{1,48}$/.test(drop.id)||dropIds.has(drop.id)||!['map_town','map_diagnostic_galleries','map_resonator_vault'].includes(drop.mapId)||!safeCount(drop.x,63)||!safeCount(drop.y,63)||!ITEMS[drop.definitionId]||!Object.entries(LOOT_TABLE).some(([enc,ids])=>ids.some((id,i)=>drop.id===`drop_${enc}_${i}`&&id===drop.definitionId)))throw new TypeError('Invalid ground loot.');dropIds.add(drop.id);}
 const uniqueIds=new Set<string>();const categories:Record<string,Record<ItemCategory,number>>=Object.fromEntries(Object.keys(party.characters).map(id=>[id,{weapons:0,armor:0,accessories:0,misc:0}]));
 const positions=new Set<string>();for(const i of inventory.items){if(i?.backpackSlot!==undefined){const k=i.ownerId+":"+i.backpackSlot;if(!safeCount(i.backpackSlot,35)||i.equipped||positions.has(k))throw new TypeError("Invalid or duplicate backpack cell.");positions.add(k);}}
 const matched=new Set<string>();let highestId=0;
 for(const instance of inventory.items){
  if(!instance||typeof instance!=='object'||typeof instance.id!=='string'||!/^stack_[0-9]{1,9}$/.test(instance.id)||uniqueIds.has(instance.id)||!Object.hasOwn(party.characters,instance.ownerId)||!Object.hasOwn(ITEMS,instance.definitionId)||!safeCount(instance.count,20)||instance.count<1||typeof instance.identified!=='boolean')throw new TypeError('Invalid item instance or duplicate ID.');
  uniqueIds.add(instance.id);highestId=Math.max(highestId,Number(instance.id.slice(6)));const d=ITEMS[instance.definitionId];categories[instance.ownerId][d.category]++;
  if(instance.attuned!==undefined&&typeof instance.attuned!=='boolean'||instance.cursed!==undefined&&typeof instance.cursed!=='boolean'||instance.attuned&&!d.attunement||instance.attuned&&instance.count!==1||instance.cursed&&instance.count!==1)throw new TypeError('Invalid item binding or attunement.');
  if(d.unique&&instance.count!==1)throw new TypeError('Unique items cannot stack.');
  if(!safeCount(instance.charges,d.maxCharges)||!safeCount(instance.durability,d.maxDurability))throw new TypeError('Invalid charges or durability.');
  if(instance.equipped!==null){
   const slot=instance.equipped;
   if(!ITEM_SLOTS.includes(slot)||!d.slot||!(d.slot===slot||(d.slot==='accessory'&&['accessoryA','accessoryB'].includes(slot)))||instance.count!==1||instance.durability===0&&d.maxDurability>0||!canUseStartingGear(party.characters[instance.ownerId].classId,d.id)||d.attunement&&!instance.attuned||!meetsEquipRequirements(party.characters[instance.ownerId],d))throw new TypeError('Invalid equipped item.');
   const key=`${instance.ownerId}:${slot}`;if(matched.has(key))throw new TypeError('Two items equipped in one slot.');matched.add(key);
   if(party.characters[instance.ownerId].equipment[slot]!==d.id)throw new TypeError('Equipped instance and character mismatch.');
  }
 }
 if(inventory.nextId<=highestId)throw new TypeError('Inventory serial counter must exceed all item IDs.');
 for(const id of Object.keys(party.characters)){if(inventory.items.filter(i=>i.ownerId===id&&i.attuned).length>3)throw new TypeError('Only three items may be attuned.');for(const cat of ITEM_CATEGORIES)if(categories[id][cat]>ITEM_LIMIT_PER_CATEGORY)throw new TypeError('Item category is over capacity.');
  for(const slot of ITEM_SLOTS)if(party.characters[id].equipment[slot]&&!matched.has(`${id}:${slot}`))throw new TypeError('Equipment exists without an owned equipped item.');
 }
 return inventory;
}
export function initialInventory(party:CampaignState['party']):InventoryState{
 if(!Array.isArray(party.order)||party.order.length<1||party.order.length>6)throw new TypeError('Invalid legacy party.');const inv:InventoryState={backpackSort:{},items:[],nextId:1,claimed:[],drops:[]};
 for(const id of party.order){const c=party.characters[id];for(const slot of ITEM_SLOTS){const def=c.equipment[slot];if(def)giveItem(inv,id,def,1,slot);}}
 // Migrate legacy starter supplies to actual consumables instead of duplicating them.
 const carrier=party.order[1]??party.order[0];const supplies=party.resources.supplies;if(!supplies||typeof supplies!=='object'||Object.keys(supplies).length>40)throw new TypeError('Invalid legacy supplies.');for(const [id,count] of Object.entries(supplies)){if(!ITEMS[id]||!Number.isSafeInteger(count)||count<0||count>40)throw new TypeError('Invalid legacy supply counts.');for(let n=0;n<count;n++){if(!giveItem(inv,carrier,id))throw new TypeError('Legacy supplies exceed inventory capacity.');}}
 party.resources.supplies={};return inv;
}
export function itemCategoryCount(inv:InventoryState,owner:string,category:ItemCategory):number{return inv.items.filter(i=>i.ownerId===owner&&ITEMS[i.definitionId].category===category).length;}
export function giveItem(inv:InventoryState,ownerId:string,definitionId:string,count=1,equipped:EquipmentSlot|null=null):ItemInstance|null{
 const d=ITEMS[definitionId];if(!d||!Number.isInteger(count)||count<1||count>20)return null;
 if(!d.unique&&!equipped&&d.maxCharges===0){const existing=inv.items.find(i=>i.ownerId===ownerId&&i.definitionId===definitionId&&!i.equipped&&i.count+count<=20&&i.durability===d.maxDurability&&i.identified);if(existing){existing.count+=count;return existing;}}
 if(inv.items.length>=ITEM_LIMIT_TOTAL||itemCategoryCount(inv,ownerId,d.category)>=ITEM_LIMIT_PER_CATEGORY)return null;
 const item:ItemInstance={id:`stack_${inv.nextId++}`,ownerId,definitionId,count,charges:d.maxCharges,durability:d.maxDurability,identified:!d.unique&&!d.resistance, equipped};inv.items.push(item);if(!equipped)assignBackpackSlots(inv);return item;
}
export function itemName(item:ItemInstance):string{return item.identified?ITEMS[item.definitionId].name:'Unidentified '+({weapons:'weapon',armor:'armor',accessories:'accessory',misc:'item'} as const)[ITEMS[item.definitionId].category];}
export function meetsEquipRequirements(hero:Character,item:ItemDefinition):boolean{const r=item.equipRequirements;return !r||(hero.level>=(r.minLevel??1)&&(!r.classIds||r.classIds.includes(hero.classId))&&(!r.raceIds||r.raceIds.includes(hero.raceId??'core:race:human')));}
export interface ItemCommand {action:'attune'|'unattune'|'drop'|'equip'|'remove'|'transfer'|'discard'|'use'|'identify'|'repair'|'sell'|'split'|'sort'|'move';itemId:string;position?:number;sort?:BackpackSort;splitCount?:number;targetId?:string;slot?:EquipmentSlot;}
export interface ItemResult{state:CampaignState;changed:boolean;message:string;usedTurn:boolean;}
function no(s:CampaignState,message:string):ItemResult{return {state:s,changed:false,message,usedTurn:false};}
function refreshEquipped(s:CampaignState,ownerId:string,item:ItemInstance):void{if(!item.equipped)return;const hero=s.party.characters[ownerId],slot=item.equipped;hero.equipment[slot]=null;item.equipped=null;}
function eligibleUse(d:ItemDefinition,hero:Character,s:CampaignState):string|null{
 if(d.effect==='none')return 'This item has no activation.';
 if(hero.hp===0)return 'Dead heroes cannot use items.';
 if(['ward','reveal'].includes(d.effect)&&s.magic.effects.some(e=>e.kind===(d.effect==='ward'?'stone_skin':'glass_eye')&&e.expiresAtMinute!>s.elapsedMinutes))return 'That item effect is already active.';
 if(d.effect==='heal'&&hero.hp>=derived(hero).maxHP)return 'HP is already full.';
 if(d.effect==='antidote'&&!hero.conditions.some(c=>c.id==='poisoned'))return 'No poison to cure.';
 if(d.effect==='wake'&&!hero.conditions.some(c=>c.id==='asleep'))return 'Not asleep.';
 if(d.effect==='courage'&&hero.conditions.some(c=>c.id==='frightened')===false)return 'No fear to cure.';
 if(d.effect==='escape'&&!s.combat.active)return 'Smoke Bomb can only be used in combat.';
 if(d.effect==='escape'&&s.combat.active?.encounterId==='enc_bell_heart')return 'The Bell-Heart seals the chamber; no smoke can conceal an escape.';
 if(['acid','spark','venom'].includes(d.effect)&&!s.combat.active)return 'Attack consumables need a combat target.';
 if(d.effect==='recall'&&(s.combat.active||s.currentMapId==='map_town'))return 'Recall is available only outside combat and away from town.';
 if(d.effect==='identify'&&!s.inventory.items.some(i=>i.ownerId===hero.id&&!i.identified))return 'No unknown items to identify.';
 return null;
}
/** Mutation only after complete validation; on any failed action input state remains unchanged. */
export function itemAction(source:CampaignState,request:ItemCommand):ItemResult{
 if(request.action==='drop')return {...dropItem(source,request.itemId),usedTurn:false};
 if(request.action==='sort'){if(source.combat.active)return no(source,'Sorting is unavailable during combat.');if(!source.party.order.includes(request.itemId)||!BACKPACK_SORTS.includes(request.sort!))return no(source,'Invalid backpack sort.');const s=structuredClone(source);s.inventory.backpackSort[request.itemId]=request.sort!;if(request.sort!=='manual')backpackItems(s.inventory,request.itemId).forEach((i,n)=>i.backpackSlot=n);return {state:s,changed:true,message:'Backpack sorted.',usedTurn:false};}
 const found=source.inventory.items.find(i=>i.id===request.itemId);if(!found)return no(source,'Item does not exist.');
 const d=ITEMS[found.definitionId],owner=source.party.characters[found.ownerId];if(!owner)return no(source,'Unknown owner.');
 if(request.action==='move'){
  if(source.combat.active)return no(source,'Backpack rearrangement is unavailable during combat.');
  if(!safeCount(request.position,35))return no(source,'Choose a valid backpack cell.');
  if(found.equipped&&(found.cursed||source.magic.itemCurses[owner.id]?.includes(found.definitionId)))return no(source,'Cursed equipment cannot be removed.');
  const cells=backpackCells(source.inventory,owner.id),prior=cells.indexOf(found),other=cells[request.position!];
  if(other?.id===found.id)return no(source,'Already in this cell.');
  const s=structuredClone(source),item=s.inventory.items.find(i=>i.id===found.id)!;
  if(item.equipped){refreshEquipped(s,owner.id,item);delete item.backpackSlot;}
  if(other){const swap=s.inventory.items.find(i=>i.id===other.id)!;if(prior>=0)swap.backpackSlot=prior;else delete swap.backpackSlot;}
  item.backpackSlot=request.position!;s.inventory.backpackSort[owner.id]='manual';assignBackpackSlots(s.inventory);
  return {state:s,changed:true,message:'Placed '+itemName(item)+' in backpack cell '+(request.position!+1)+'.',usedTurn:false};
 }

 if(source.combat.active&&['attune','unattune','equip','remove','transfer','discard','identify','repair','sell','split'].includes(request.action))return no(source,'Only Use is available during combat.');
 if(source.combat.active&&source.combat.active.turnOrder[source.combat.active.turnIndex]!==owner.id)return no(source,'Only the acting character can use an item in combat.');
 let target:string|null=null;
 if(request.action==='attune'){if(!d.attunement||found.attuned||found.equipped||found.count!==1||!found.identified||!meetsEquipRequirements(owner,d))return no(source,'The item cannot be attuned.');if(source.inventory.items.filter(i=>i.ownerId===owner.id&&i.attuned).length>=3)return no(source,'The character already has three attuned items.');}
 if(request.action==='unattune'&&(!found.attuned||found.equipped||found.cursed||source.magic.itemCurses[owner.id]?.includes(found.definitionId)))return no(source,'Remove and unbind the item before ending attunement.');
 if(request.action==='equip'){
  target=request.slot??(d.slot==='accessory'?(owner.equipment.accessoryA?'accessoryB':'accessoryA'):d.slot);
  if(!d.slot||!target||!ITEM_SLOTS.includes(target as EquipmentSlot)||!(target===d.slot||(d.slot==='accessory'&&['accessoryA','accessoryB'].includes(target))))return no(source,'Not an equippable slot.');
  if(!canUseStartingGear(owner.classId,d.id)||!meetsEquipRequirements(owner,d))return no(source,'Cannot equip: class, race or level requirement not met.');
  if(d.attunement&&!found.attuned)return no(source,'Attune this artifact first.');
  if(d.maxDurability>0&&found.durability===0)return no(source,'Repair the broken item first.');
  if(found.equipped===target)return no(source,'Already equipped.');
  if(found.count!==1)return no(source,'Split the stack before equipping.');
  if(found.equipped&&(found.cursed||source.magic.itemCurses[owner.id]?.includes(found.definitionId)))return no(source,'Cursed equipment cannot be removed.');
  const previous=source.inventory.items.find(i=>i.ownerId===owner.id&&i.equipped===target);
  if(previous&&(previous.cursed||source.magic.itemCurses[owner.id]?.includes(previous.definitionId)))return no(source,'Cursed equipment cannot be removed.');
 }
 if(request.action==='remove'&&!found.equipped)return no(source,'This item is not equipped.');
 if(['remove','transfer','discard','sell'].includes(request.action)&&(found.cursed||found.equipped&&source.magic.itemCurses[owner.id]?.includes(found.definitionId)))return no(source,'Cursed equipment cannot be removed.');
 if(request.action==='transfer'){
  if(!request.targetId||request.targetId===owner.id||!source.party.order.includes(request.targetId))return no(source,'Select a different party member.');
  if(found.equipped)return no(source,'Unequip the item before transferring.');
  if(itemCategoryCount(source.inventory,request.targetId,d.category)>=ITEM_LIMIT_PER_CATEGORY)return no(source,'Recipient inventory category is full.');
 }
 if(['transfer','discard','sell'].includes(request.action)&&found.attuned)return no(source,'End attunement before disposing of this item.');
 if(request.action==='discard'&&found.equipped)return no(source,'Unequip before discarding.');
 if(request.action==='split'&&(found.equipped||found.attuned||found.cursed||d.unique||found.count<2||!Number.isInteger(request.splitCount)||request.splitCount!<1||request.splitCount!>=found.count||itemCategoryCount(source.inventory,owner.id,d.category)>=ITEM_LIMIT_PER_CATEGORY))return no(source,'Cannot split this stack (capacity or count).');
 if(request.action==='sell'&&(found.equipped||source.currentMapId!=='map_town'||source.combat.active))return no(source,'Sell only unequipped items in town.');
 if(request.action==='repair'&&(d.maxDurability===0||found.durability===d.maxDurability||source.currentMapId!=='map_town'))return no(source,'Repairs are only needed and available for damaged equipment in town.');
 if(request.action==='identify'&&found.identified)return no(source,'Already identified.');
 const cost=request.action==='repair'?Math.max(1,Math.ceil((d.maxDurability-found.durability)*d.price/(d.maxDurability*5))):request.action==='identify'?Math.max(5,Math.ceil(d.price/10)):0;
 if(cost>source.party.resources.gold)return no(source,`Need ${cost} gold.`);
 if(request.action==='use'){
  if(d.attunement&&!found.attuned)return no(source,'Attune this artifact before using it.');
  if(found.charges===0&&d.maxCharges>0)return no(source,'The item has no charges left.');
  if(d.effect!=='composed'&&request.targetId&&!source.party.order.includes(request.targetId))return no(source,'Invalid target character.');
  const patient=d.effect==='composed'?owner:request.targetId?source.party.characters[request.targetId]:owner;
  const problem=eligibleUse(d,patient,source);if(problem)return no(source,problem);
 }
 if(!['attune','unattune','equip','remove','transfer','discard','use','identify','repair','sell','split'].includes(request.action))return no(source,'Unknown item command.');
 const s=structuredClone(source),i=s.inventory.items.find(item=>item.id===found.id)!,hero=s.party.characters[i.ownerId];let message='';let usedTurn=false;
 if(request.action==='attune'){i.attuned=true;message=`Attuned ${d.name}.`;}
 if(request.action==='unattune'){i.attuned=false;message=`Ended attunement to ${d.name}.`;}
 if(request.action==='equip'){
  if(i.equipped)refreshEquipped(s,hero.id,i);
  const prior=s.inventory.items.find(t=>t.ownerId===i.ownerId&&t.equipped===target);if(prior)refreshEquipped(s,hero.id,prior);
  delete i.backpackSlot;i.equipped=target as EquipmentSlot;hero.equipment[i.equipped]=d.id;if(d.curseOnEquip)i.cursed=true;message=`Equipped ${d.name} in ${target}.`;
 }
 if(request.action==='remove'){refreshEquipped(s,hero.id,i);message=`Removed ${d.name}.`;}
 if(request.action==='transfer'){delete i.backpackSlot;i.ownerId=request.targetId!;message=`Transferred ${d.name} to ${s.party.characters[i.ownerId].name}.`;}
 if(request.action==='discard'||request.action==='sell'){
  if(request.action==='sell')s.party.resources.gold+=Math.max(1,Math.floor(d.price/2))*i.count;
  s.inventory.items=s.inventory.items.filter(it=>it.id!==i.id);message=request.action==='sell'?`Sold ${d.name} for ${Math.max(1,Math.floor(d.price/2))*i.count} gold.`:`Discarded ${d.name}.`;
 }
 if(request.action==='split'){const amount=request.splitCount!;i.count-=amount;const split={...i,id:`stack_${s.inventory.nextId++}`,count:amount,equipped:null};delete split.backpackSlot;s.inventory.items.push(split);message=`Split ${amount} ${d.name} into a new stack.`;}
 if(request.action==='identify'){s.party.resources.gold-=cost;i.identified=true;message=`Identified ${d.name} for ${cost} gold.`;}
 if(request.action==='repair'){s.party.resources.gold-=cost;i.durability=d.maxDurability;message=`Repaired ${d.name} for ${cost} gold.`;}
 if(request.action==='use'){
  if(d.curseOnUse)i.cursed=true;
  const patient=request.targetId?s.party.characters[request.targetId]:hero;
  if(d.effect==='composed'){if(effectDefinition(d.effectId!)?.activation)return no(source,'A character-only ability cannot be invoked by an item.');const outcomes=applyEffect(s,d.effectId!,hero.id,request.targetId??(s.combat.active?.targetId??hero.id));message=outcomes.map(v=>`${v.targetId}: ${v.operation} ${v.outcome}${v.amount!==undefined?' '+v.amount:''}`).join('; ');}
  if(d.effect==='heal'){s.party=updateMember(s.party,heal(patient,d.power));message=`${patient.name} restores up to ${d.power} HP.`;}
  if(['antidote','wake','courage'].includes(d.effect)){const ailment=d.effect==='antidote'?'poisoned':d.effect==='wake'?'asleep':'frightened';s.party=updateMember(s.party,{...patient,conditions:patient.conditions.filter(c=>c.id!==ailment)});message=`${patient.name} is free of ${ailment}.`;}
  if(d.effect==='ward'||d.effect==='reveal'){const kind=d.effect==='ward'?'stone_skin':'glass_eye';s.magic.effects=s.magic.effects.filter(e=>e.kind!==kind);s.magic.effects.push({kind,targetId:'party',expiresAtMinute:s.elapsedMinutes+Math.max(1,Math.min(30,d.power))});message=`${d.name}: ${kind} for ${Math.max(1,Math.min(30,d.power))} minutes.`;}
  if(d.effect==='light'){s.magic.effects=s.magic.effects.filter(e=>e.kind!=='light');s.magic.effects.push({kind:'light',targetId:'party',expiresAtMinute:s.elapsedMinutes+60});message='A torch lights the road for 60 minutes.';}
  if(d.effect==='identify'){const unknown=s.inventory.items.find(v=>v.ownerId===hero.id&&!v.identified);if(unknown){unknown.identified=true;message=`Identified ${ITEMS[unknown.definitionId].name}.`;}}
  if(d.effect==='recall'){const town=s.maps.map_town;const k='7,12';s.currentMapId='map_town';s.maps.map_town={...town,x:7,y:12,facing:0,visited:town.visited.includes(k)?town.visited:[...town.visited,k]};s.elapsedMinutes+=10;message='Recall returns the party to Firstlight Village.';}
  if(d.effect==='escape'){const map=s.maps[s.currentMapId];const origin=s.currentMapId==='map_town'?{x:7,y:12}:{x:2,y:8};const key=`${origin.x},${origin.y}`;s.maps[s.currentMapId]={...map,...origin,visited:map.visited.includes(key)?map.visited:[...map.visited,key]};s.combat.active=null;message='The party escapes through a cloud of smoke.';}
  if(['acid','spark','venom'].includes(d.effect)){
   const a=s.combat.active!,enc=s.combat.encounters[a.encounterId],enemy=enc.enemies.find(t=>t.id===a.targetId&&t.hp>0)??enc.enemies.find(t=>t.hp>0);
   if(!enemy)return no(source,'No enemy target available.');enemy.hp=Math.max(0,enemy.hp-d.power);message=`${d.name} deals ${d.power} damage to ${enemy.kindId.replaceAll('_',' ')}.`;
  }
  if(i.charges>0)i.charges--;else if(d.maxCharges===0){i.count--;if(i.count===0)s.inventory.items=s.inventory.items.filter(v=>v.id!==i.id);}
  usedTurn=!!source.combat.active;
 }
 assignBackpackSlots(s.inventory);return {state:s,changed:true,message,usedTurn};
}
export function wearEquipped(s:CampaignState,ownerId:string,slot:'melee'|'ranged'|'body'|'offhand'):string|null{
 const item=s.inventory.items.find(it=>it.ownerId===ownerId&&it.equipped===slot),d=item?ITEMS[item.definitionId]:null;
 if(!item||!d||!d.maxDurability)return null;item.durability=Math.max(0,item.durability-1);
 if(item.durability===0){refreshEquipped(s,ownerId,item);s.magic.itemCurses[ownerId]=s.magic.itemCurses[ownerId].filter(id=>id!==d.id);return `${d.name} breaks and is unequipped!`; }return null;
}
export function groundDropHere(s:CampaignState){const w=s.maps[s.currentMapId];return s.inventory.drops.find(drop=>drop.mapId===s.currentMapId&&Math.abs(drop.x-w.x)+Math.abs(drop.y-w.y)<=1);}
export function cacheHere(s:CampaignState){const world=s.maps[s.currentMapId];return LOOT_CACHES.find(cache=>cache.mapId===s.currentMapId&&!s.inventory.claimed.includes(cache.id)&&(!hiddenCache(cache.id)||s.thievery.discovered.includes(cache.id))&&((cache.x===world.x&&cache.y===world.y)||(cache.x===world.x+DIRECTIONS[world.facing].x&&cache.y===world.y+DIRECTIONS[world.facing].y)));}
export function claimCache(source:CampaignState):ItemResult{
 if(source.combat.active)return no(source,'Finish combat before taking treasure.');const cache=cacheHere(source);if(!cache){const found=groundDropHere(source);if(!found)return no(source,'No unclaimed cache is close enough.');const s=structuredClone(source);if(!giveItem(s.inventory,s.party.selectedId,found.definitionId))return no(source,'No room for dropped treasure.');s.inventory.drops=s.inventory.drops.filter(d=>d.id!==found.id);return {state:s,changed:true,usedTurn:false,message:`Recovered ${ITEMS[found.definitionId].name} from the ground.`};}
 if(chestDC(cache.id)&&!source.thievery.unlocked.includes(cache.id))return no(source,'The chest is locked. Use Pick Lock (D) or Bash (B).');
 const s=structuredClone(source);const owner=s.party.selectedId;const granted:string[]=[];
 const contents=cache.items.filter((_,index)=>!s.thievery.bashed.includes(cache.id)||index!==cache.items.length-1);
 for(const item of contents){if(!giveItem(s.inventory,owner,item)){return no(source,`No room for ${ITEMS[item].name} in ${s.party.characters[owner].name}'s ${ITEMS[item].category} bag.`);}granted.push(ITEMS[item].name);}
 s.inventory.claimed.push(cache.id);return {state:s,changed:true,usedTurn:false,message:`Treasure found: ${granted.join(', ')}. Check Items on ${s.party.characters[owner].name}.`};
}
/** MM15: generate each corpse exactly once. Rolls use a stable per-enemy seed,
 * preserving combat RNG and the original guaranteed legacy drops. */
export function rewardLoot(s:CampaignState,encounterId:string):string{
 const encounter=s.combat.encounters[encounterId];if(!encounter)return '';let count=0;
 const table=lootTableForEncounter(encounterId);
 for(const [index,enemy] of encounter.enemies.entries()){
  if(enemy.summoned||enemy.hp>0||s.ground.containers.some(c=>c.enemyId===enemy.id))continue;
  const rng=new SeededRng('loot:'+encounterId+':'+enemy.id);
  const entries:import('./ground.ts').GroundEntry[]=[];
  const guaranteed=MONSTERS[enemy.kindId]?.guaranteedLootItemId;
  const rules=[...(table?.entries??[])];if(guaranteed)rules.push({memberIndex:index,itemId:guaranteed,chance:100,min:1,max:1});
  for(const rule of rules){
   if(rule.memberIndex!==index)continue;
   if(rule.chance<100&&rng.integer(1,100)>rule.chance)continue;
   const quantity=rule.min===rule.max?rule.min:rng.integer(rule.min,rule.max);
   const definition=ITEMS[rule.itemId];
   // Never mint a second instance of a unique item already owned or unclaimed.
   if(definition.unique&&(s.inventory.items.some(i=>i.definitionId===rule.itemId)||s.ground.containers.some(c=>c.entries.some(e=>e.item?.definitionId===rule.itemId))||entries.some(e=>e.item?.definitionId===rule.itemId)))continue;
   const item=makeGroundItem(s,rule.itemId);item.count=quantity;
   entries.push({id:item.id,item,plotId:null});
  }
  s.ground.containers.push({id:'ground_corpse_'+enemy.id,mapId:encounter.mapId,x:enemy.x,y:enemy.y,kind:'corpse',name:(MONSTERS[enemy.kindId]?.name??enemy.kindId)+' remains',enemyId:enemy.id,gold:MONSTERS[enemy.kindId]?.gold??0,entries});count++;
 }
 return count?`${count} corpse${count===1?' remains':'s remain'}. Face the remains or stand on their square and press Space to loot.`:'';
}


/** Stable ordering never leaks unidentified properties; instances and quantities are untouched. */
export function backpackItems(inv:InventoryState,ownerId:string):ItemInstance[]{
 const mode=inv.backpackSort[ownerId]??'manual';const items=inv.items.filter(i=>i.ownerId===ownerId&&!i.equipped);
 if(mode==='manual')return backpackCells(inv,ownerId).filter((i):i is ItemInstance=>!!i);
 return items.sort((a,b)=>{const da=ITEMS[a.definitionId],db=ITEMS[b.definitionId];return (mode==='category'?ITEM_CATEGORIES.indexOf(da.category)-ITEM_CATEGORIES.indexOf(db.category):mode==='value'?(b.identified?db.price:0)-(a.identified?da.price:0):0)||itemName(a).localeCompare(itemName(b))||Number(a.id.slice(6))-Number(b.id.slice(6));});
}

/** Resolve legacy/unplaced items into free cells, retaining every explicitly placed stack. */
export function backpackCells(inv:InventoryState,ownerId:string):(ItemInstance|undefined)[]{
 const cells:(ItemInstance|undefined)[]=Array(36).fill(undefined),items=inv.items.filter(i=>i.ownerId===ownerId&&!i.equipped);
 for(const i of items)if(i.backpackSlot!==undefined)cells[i.backpackSlot]=i;
 for(const i of items)if(i.backpackSlot===undefined){const free=cells.findIndex(i=>!i);if(free>=0)cells[free]=i;}
 return cells;
}
export function assignBackpackSlots(inv:InventoryState):void{
 for(const i of inv.items)if(i.equipped)delete i.backpackSlot;
 for(const owner of new Set(inv.items.map(i=>i.ownerId)))backpackCells(inv,owner).forEach((i,n)=>{if(i)i.backpackSlot=n;});
}
