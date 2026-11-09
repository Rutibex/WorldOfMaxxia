import {terrainEverFloor,edgeBlocked,elevationAt} from '../project/terrain-contracts.ts';
import {terrainStandable} from './grid.ts';
/** Tile-bound persistent items and remains, independent of automatic victory XP. */
import type {CampaignState,MapRegistry} from './campaign.ts';
import {ITEMS} from '../content/items.ts';
import {DIRECTIONS,isOpaque,tileAt} from './grid.ts';
import {validateInventory,assignBackpackSlots,itemCategoryCount,ITEM_LIMIT_PER_CATEGORY,ITEM_LIMIT_TOTAL,itemName,type ItemInstance} from './inventory.ts';
import {inspectUpperScene,inspectVaultScene} from './quests.ts';
import {interactExpedition} from './expedition.ts';
import {authoredPickups} from '../content/loot.ts';
export interface GroundEntry {id:string;item:ItemInstance|null;plotId:string|null;sceneId?:string;}
export interface GroundContainer {id:string;mapId:string;x:number;y:number;kind:'pile'|'corpse';name:string;enemyId?:string;gold:number;entries:GroundEntry[];}
export interface GroundState {nextId:number;containers:GroundContainer[];}
export interface LootRequest {containerId:string;entryId?:string;takeAll?:boolean;ownerId?:string;}
export interface GroundResult {state:CampaignState;changed:boolean;message:string;}
/** Back-compat view used in original quest labels and validation. */
export const PLOT_GROUND=[['map_diagnostic_galleries','scene_upper_ledger','item_quest_tessa_ledger','Tessa’s lost ledger'],['map_diagnostic_galleries','scene_upper_tools','item_quest_orro_tools','Orro’s tool roll'],['map_resonator_vault','scene_vault_echo','item_quest_nera_echo','Bottled echo'],['map_resonator_vault','scene_vault_regulator','item_quest_regulator','Bell-Heart regulator']] as const;
export function initialGround(s:CampaignState,registry:MapRegistry):GroundState {
 const containers:GroundContainer[]=[];
 for(const pickup of authoredPickups()){
  if(!registry[pickup.mapId]||pickup.legacyQuest&&s.quests.seenScenes.includes(pickup.legacyQuest.sceneId))continue;
  const entries:GroundEntry[]=[];
  for(const def of pickup.items){
   // Unique definitions must not be duplicated by multiple authored pickup placements.
   if(ITEMS[def.itemId].unique&&(s.inventory.items.some(i=>i.definitionId===def.itemId)||containers.some(c=>c.entries.some(e=>e.item?.definitionId===def.itemId))))continue;
   const item=makeGroundItem(s,def.itemId);item.count=def.count;entries.push({id:item.id,item,plotId:null});
  }
  if(pickup.legacyQuest)entries.push({id:pickup.legacyQuest.plotId,item:null,plotId:pickup.legacyQuest.plotId,sceneId:pickup.legacyQuest.sceneId});
  if(pickup.questItemId&&!s.quests.questItems.includes(pickup.questItemId))entries.push({id:pickup.questItemId,item:null,plotId:pickup.questItemId});
  containers.push({id:pickup.legacyQuest?'ground_'+pickup.legacyQuest.sceneId:'ground_pickup_'+pickup.id,mapId:pickup.mapId,x:pickup.x,y:pickup.y,kind:'pile',name:pickup.name,gold:pickup.gold,entries});
 }
 return {nextId:1,containers};
}
export function groundReachable(s:CampaignState,registry:MapRegistry,c:GroundContainer):boolean {if(c.mapId!==s.currentMapId)return false;const w=s.maps[s.currentMapId],d=DIRECTIONS[w.facing];return c.x===w.x&&c.y===w.y||c.x===w.x+d.x&&c.y===w.y+d.y&&Math.abs(elevationAt(registry[s.currentMapId],w,w.x,w.y)-elevationAt(registry[s.currentMapId],w,c.x,c.y))<=1&&!edgeBlocked(registry[s.currentMapId],w,w.x,w.y,c.x,c.y)&&!isOpaque(registry[s.currentMapId],w,c.x,c.y);}
export function nearbyGround(s:CampaignState,registry:MapRegistry):GroundContainer[]{return s.ground.containers.filter(c=>groundReachable(s,registry,c)&&(c.entries.length||c.gold));}
export function groundName(e:GroundEntry):string{return e.item?itemName(e.item)+(e.item.count>1?' ×'+e.item.count:''):authoredPickups().find(p=>p.legacyQuest?.plotId===e.plotId||p.questItemId===e.plotId)?.name??'Quest item';}
export function dropItem(source:CampaignState,itemId:string):GroundResult {
 const item=source.inventory.items.find(i=>i.id===itemId),no=(message:string)=>({state:source,changed:false,message});if(!item)return no('Select a carried item.');if(source.combat.active||source.combat.defeated)return no('Finish the encounter before dropping items.');if(item.equipped)return no('Unequip this item before dropping it.');if(item.cursed||item.attuned)return no('Uncurse or end attunement before dropping this item.');if(source.ground.containers.reduce((n,c)=>n+c.entries.length,0)>=400)return no('Too many items remain on the ground. Collect some first.');
 const s=structuredClone(source),w=s.maps[s.currentMapId],i=s.inventory.items.find(i=>i.id===itemId)!;delete i.backpackSlot;s.inventory.items=s.inventory.items.filter(v=>v.id!==itemId);let pile=s.ground.containers.find(c=>c.kind==='pile'&&!c.id.startsWith('ground_scene_')&&!c.id.startsWith('ground_pickup_')&&c.mapId===s.currentMapId&&c.x===w.x&&c.y===w.y);
 if(!pile){if(s.ground.containers.length>=200)return no('Too many ground piles. Collect some first.');pile={id:'ground_pile_'+s.ground.nextId++,mapId:s.currentMapId,x:w.x,y:w.y,kind:'pile',name:'Dropped items',gold:0,entries:[]};s.ground.containers.push(pile);}pile.entries.push({id:i.id,item:i,plotId:null});return {state:s,changed:true,message:`Dropped ${groundName(pile.entries.at(-1)!)} at ${w.x}, ${w.y}.`};
}
export function makeGroundItem(s:CampaignState,definitionId:string):ItemInstance {const d=ITEMS[definitionId];return {id:'stack_'+s.inventory.nextId++,definitionId,ownerId:s.party.selectedId,count:1,charges:d.maxCharges,durability:d.maxDurability,identified:!d.unique&&!d.resistance,equipped:null};}
export function lootGround(source:CampaignState,registry:MapRegistry,r:LootRequest):GroundResult {
 const no=(message:string)=>({state:source,changed:false,message});if(source.combat.active||source.combat.defeated)return no('Finish the encounter before looting.');const original=source.ground.containers.find(c=>c.id===r.containerId);if(!original||!groundReachable(source,registry,original))return no('Stand on this square or face it from the adjacent square to loot.');const owner=r.ownerId??source.party.selectedId;if(!source.party.order.includes(owner)||source.party.characters[owner].hp<=0)return no('Choose a conscious party member.');let s=structuredClone(source),c=s.ground.containers.find(c=>c.id===r.containerId)!,got:string[]=[],blocked:string[]=[];
 for(const id of r.takeAll?c.entries.map(e=>e.id):r.entryId?[r.entryId]:[]){const e=c.entries.find(e=>e.id===id);if(!e)continue;if(e.item){const item=e.item,d=ITEMS[item.definitionId];if(s.inventory.items.length>=ITEM_LIMIT_TOTAL||itemCategoryCount(s.inventory,owner,d.category)>=ITEM_LIMIT_PER_CATEGORY||s.inventory.items.filter(i=>i.ownerId===owner&&!i.equipped).length>=36){blocked.push(groundName(e)+' — backpack full');continue;}item.ownerId=owner;delete item.backpackSlot;s.inventory.items.push(item);assignBackpackSlots(s.inventory);got.push(groundName(e));c.entries=c.entries.filter(v=>v.id!==id);}else if(e.sceneId){const result=(c.mapId==='map_diagnostic_galleries'?inspectUpperScene:inspectVaultScene)(s,registry,e.sceneId);if(!result&&e.sceneId==='scene_upper_tools'){const disarm=interactExpedition(s,registry);if(disarm?.changed)return disarm;}if(!result?.changed||!result.state.quests.questItems.includes(e.plotId!)){blocked.push(result?.message??'Disarm this object’s trap first.');continue;}s=result.state;c=s.ground.containers.find(v=>v.id===r.containerId)??{...c,entries:[]};c.entries=c.entries.filter(v=>v.id!==id);got.push(groundName(e));}else if(e.plotId){
  // New project-authored quest pickups enter the quest ledger without invoking old scene scripts.
  const definition=authoredPickups().find(p=>p.id===c.id.slice('ground_pickup_'.length)&&p.questItemId===e.plotId);
  if(!definition||s.quests.questItems.includes(e.plotId)||s.quests.questItems.length>=128){blocked.push('Quest reward is unavailable.');continue;}
  s.quests.questItems.push(e.plotId);c.entries=c.entries.filter(v=>v.id!==id);got.push(definition.name);
 }}
 if((r.takeAll||r.entryId==='gold')&&c.gold){s.party.resources.gold+=c.gold;got.push(c.gold+' gold');c.gold=0;}if(!got.length)return no(blocked.join(' ')||'Nothing remains to loot.');if(c.kind==='pile'&&!c.entries.length&&!c.gold)s.ground.containers=s.ground.containers.filter(v=>v.id!==c.id);return {state:s,changed:true,message:'Collected '+got.join(', ')+'.'+(blocked.length?' Left behind: '+blocked.join('; ')+'.':'')};
}
export function migrateGround(s:CampaignState,registry:MapRegistry):GroundState {validateInventory(s.inventory,s.party);const g=initialGround(s,registry);for(const drop of s.inventory.drops){const item=makeGroundItem(s,drop.definitionId);g.containers.push({id:'ground_legacy_'+g.nextId++,mapId:drop.mapId,x:drop.x,y:drop.y,kind:'pile',name:'Unclaimed treasure',gold:0,entries:[{id:item.id,item,plotId:null}]});}s.inventory.drops=[];return g;}
export function validateGround(raw:unknown,s:CampaignState,registry:MapRegistry):void {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('Missing ground state.');const g=raw as GroundState,integer=(n:unknown,max:number)=>Number.isSafeInteger(n)&&(n as number)>=0&&(n as number)<=max;if(!integer(g.nextId,100000000)||g.nextId<1||!Array.isArray(g.containers)||g.containers.length>256)throw new TypeError('Invalid ground limits.');const ids=new Set<string>(),items=new Set(s.inventory.items.map(i=>i.id)),enemies=new Set<string>(),plots=new Set<string>();let total=0,highest=0,serial=0;
 for(const c of g.containers){if(!c||typeof c.id!=='string'||!/^ground_[a-z0-9_]{1,80}$/.test(c.id)||ids.has(c.id)||!registry[c.mapId]||!integer(c.x,63)||!integer(c.y,63)||(registry[c.mapId].terrain?!terrainEverFloor(registry[c.mapId],c.x,c.y):tileAt(registry[c.mapId],c.x,c.y)!=='.')||!['corpse','pile'].includes(c.kind)||typeof c.name!=='string'||c.name.length>100||!integer(c.gold,1000000)||!Array.isArray(c.entries)||(total+=c.entries.length)>512)throw new TypeError('Invalid ground container.');if(registry[c.mapId].terrain&&(c.entries.length||c.gold)&&!terrainStandable(registry[c.mapId],s.maps[c.mapId],c.x,c.y))throw new TypeError('Unclaimed ground loot embedded in terrain.');ids.add(c.id);if(c.id.startsWith('ground_pile_')||c.id.startsWith('ground_legacy_')){const value=Number(c.id.split('_').at(-1));if(!Number.isSafeInteger(value)||value<1)throw new TypeError('Invalid ground serial.');serial=Math.max(serial,value);}if(c.kind==='corpse'){const enemy=Object.values(s.combat.encounters).filter(e=>e.mapId===c.mapId).flatMap(e=>e.enemies).find(e=>e.id===c.enemyId);if(!enemy||enemy.hp!==0||enemies.has(enemy.id)||c.id!=='ground_corpse_'+enemy.id)throw new TypeError('Invalid corpse.');enemies.add(enemy.id);}
 const entryIds=new Set<string>();for(const e of c.entries){if(!e||typeof e.id!=='string'||entryIds.has(e.id))throw new TypeError('Invalid loot entry.');entryIds.add(e.id);if(e.item){const i=e.item,d=ITEMS[i.definitionId];if(e.plotId!==null||i.id!==e.id||!/^stack_[0-9]{1,9}$/.test(i.id)||items.has(i.id)||!d||!integer(i.count,20)||i.count<1||d.unique&&i.count!==1||!integer(i.charges,d.maxCharges)||!integer(i.durability,d.maxDurability)||typeof i.identified!=='boolean'||i.equipped!==null||i.backpackSlot!==undefined||!s.party.characters[i.ownerId])throw new TypeError('Invalid ground item.');items.add(i.id);highest=Math.max(highest,Number(i.id.slice(6)));}else{
 const legacy=!!e.sceneId;
 const spec=authoredPickups().find(p=>p.mapId===c.mapId&& (legacy?p.legacyQuest?.sceneId===e.sceneId&&p.legacyQuest?.plotId===e.plotId:p.questItemId===e.plotId&&c.id==='ground_pickup_'+p.id));
 const prop=legacy?registry[c.mapId].props.find(p=>p.id===e.sceneId):null;
 if(plots.has(e.plotId!)||!spec||e.id!==e.plotId||legacy&&(!prop||prop.x!==c.x||prop.y!==c.y||s.quests.seenScenes.includes(e.sceneId!))||!legacy&&(spec.x!==c.x||spec.y!==c.y||s.quests.questItems.includes(e.plotId!)))throw new TypeError('Invalid quest pickup.');plots.add(e.plotId!);
 }}
 }if(g.nextId<=serial||s.inventory.nextId<=highest)throw new TypeError('Ground serial counter is invalid.');
}
