import {validatePerceptionState} from '../project/perception-contracts.ts';
import {validateTerrainState,terrainEverFloor,terrainTransportSafe,edgeBlocked} from '../project/terrain-contracts.ts';
import {terrainStandable} from './grid.ts';
import {initialGround,migrateGround,validateGround,type GroundState} from './ground.ts';
import {initialThievery,validateThievery,type ThieveryState} from './thievery.ts';
/** Phase 6 campaign model: map state is keyed by stable map ID, the clock is shared. */
import {createDefaultParty, validateParty, defaultCombatSetup, type PartyState} from './party.ts';
import {initialGridState, isOpaque, tileAt, type GridMap, type GridState, type Facing} from './grid.ts';
import {normalizeMapDocument} from '../project/map-document.ts';
import {SeededRng, type RngSnapshot} from './rng.ts';
import {initialCombatState,validateCombat,type CombatState} from './combat.ts';
import {respawnOnEntry} from '../content/encounters.ts';
import {initialMagicState,validateMagic,expireMagic,type MagicState} from './magic.ts';
import {backpackItems,assignBackpackSlots,rewardLoot,initialInventory,validateInventory,type InventoryState} from './inventory.ts';
import {initialExpedition,validateExpedition,type ExpeditionState,settleExpeditionTime} from './expedition.ts';
import {initialServices,validateServices,type ServicesState} from './services.ts';
import {initialQuests,validateQuests,migrateQuests,onTravelQuest,type QuestState} from './quests.ts';

export const CAMPAIGN_FORMAT = 'world-of-maxxia-campaign';
export const CAMPAIGN_VERSION = 18;
export const MAX_SAVE_BYTES = 256 * 1024;
export interface CampaignState {
  format: typeof CAMPAIGN_FORMAT;
  version: typeof CAMPAIGN_VERSION;
  currentMapId: string;
  maps: Record<string, GridState>;
  party: PartyState;
  elapsedMinutes: number;
  rng: RngSnapshot;
  rollCount: number;
  combat: CombatState;
  magic: MagicState;
  /** Reserved content state; later phases may extend this with a version migration. */
  quests: QuestState;
  inventory: InventoryState;
  expedition: ExpeditionState;
  services: ServicesState;
  thievery: ThieveryState;
  ground: GroundState;
}
export interface MapRegistry { [mapId: string]: GridMap; }
export interface Portal {id:string;x:number;y:number;targetMapId:string;targetX:number;targetY:number;targetFacing:Facing;targetArrivalId?:string;activation?:'interact'|'step';}
export interface TravelMap extends GridMap {portals?: Portal[];arrivals?:{id:string;name:string;x:number;y:number;facing:Facing}[];}
const isRecord = (v:unknown): v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const boundedInt = (v:unknown, max=100000000): v is number => Number.isSafeInteger(v) && (v as number)>=0 && (v as number)<=max;
const keyCoord = (x:number,y:number) => `${x},${y}`;
export function validateMapRegistry(values:unknown[]):MapRegistry {
  const maps:MapRegistry=Object.create(null);
  if(values.length<1||values.length>20)throw new TypeError('A project needs 1–20 maps.');
  for(const value of values){
    const map=normalizeMapDocument(value) as TravelMap;
    if(Object.hasOwn(maps,map.id))throw new TypeError('Duplicate map ID.');
    maps[map.id]=map;
  }
  for(const map of Object.values(maps) as TravelMap[]){
    if(map.recovery){const r=map.recovery;if(!isRecord(r)||Object.keys(r).some(k=>!['mapId','arrivalId'].includes(k))||!(maps[r.mapId] as TravelMap)?.arrivals?.some(a=>a.id===r.arrivalId))throw new TypeError('Invalid authored recovery arrival');}
    const portals=map.portals??[];
    if(!Array.isArray(portals)||portals.length>12)throw new TypeError('Invalid portal list.');
    const ids=new Set<string>(),usedCells=new Set<string>();
    for(const p of portals){
      if(!isRecord(p)||typeof p.id!=='string'||!/^[a-z0-9_]{1,48}$/.test(p.id)||ids.has(p.id)||!boundedInt(p.x,63)||!boundedInt(p.y,63)||tileAt(map,p.x,p.y)!=='.'||typeof p.targetMapId!=='string'||!Object.hasOwn(maps,p.targetMapId)||!boundedInt(p.targetX,63)||!boundedInt(p.targetY,63)||![0,1,2,3].includes(p.targetFacing)|| (p.activation!==undefined&&p.activation!=='interact'&&p.activation!=='step'))throw new TypeError(`Invalid portal in ${map.id}.`);
      if(p.targetArrivalId!==undefined){
        const arrivals=(maps[p.targetMapId] as TravelMap).arrivals??[];
        if(typeof p.targetArrivalId!=='string'||!arrivals.some(a=>a.id===p.targetArrivalId))throw new TypeError(`Unknown destination arrival ${String(p.targetArrivalId)} in portal ${p.id} (${map.id}).`);
      }else if(tileAt(maps[p.targetMapId],p.targetX,p.targetY)!=='.')throw new TypeError(`Blocked destination in portal ${p.id} (${map.id}).`);
      const targetMap=maps[p.targetMapId],arrival=p.targetArrivalId?(targetMap as TravelMap).arrivals?.find(a=>a.id===p.targetArrivalId):undefined,dx=arrival?.x??p.targetX,dy=arrival?.y??p.targetY;for(const config of targetMap.terrain?.configurations??[]){const state={...initialGridState(targetMap),terrain:{version:1 as const,configurationId:config.id}};if(!terrainTransportSafe(targetMap,state,dx,dy))throw new TypeError('Portal destination must remain safe in every configuration.');}
      if(usedCells.has(`${p.x},${p.y}`))throw new TypeError(`Two portals occupy the same square in ${map.id}.`);
      usedCells.add(`${p.x},${p.y}`);
      ids.add(p.id);
    }
  }
  return maps;
}
export function newCampaign(registry:MapRegistry, startMapId='map_town', customParty?:PartyState):CampaignState {
  if(!Object.hasOwn(registry,startMapId))throw new TypeError('Unknown starting map.');
  const party=customParty?structuredClone(validateParty(customParty)):createDefaultParty();const state:CampaignState={format:CAMPAIGN_FORMAT,version:18,currentMapId:startMapId,maps:Object.fromEntries(Object.entries(registry).map(([id,map])=>[id,initialGridState(map)])),party,elapsedMinutes:0,rng:new SeededRng('maxxia-first-light').snapshot(),rollCount:0,combat:initialCombatState(registry),magic:initialMagicState(party),quests:initialQuests(),inventory:initialInventory(party),expedition:initialExpedition(),services:initialServices(),thievery:initialThievery(),ground:{nextId:1,containers:[]}};state.ground=initialGround(state,registry);return state;
}
/** Validate the entire untrusted document, including nested party/map state. */
export function validateCampaign(value:unknown, registry:MapRegistry):CampaignState {
  if(!isRecord(value)||value.format!==CAMPAIGN_FORMAT)throw new TypeError('Not a World of Maxxia campaign save.');
  if(value.version!==CAMPAIGN_VERSION)throw new TypeError(`Unsupported campaign version ${String(value.version)}; original data was not changed.`);
  const s=value as unknown as CampaignState;
  if(typeof s.currentMapId!=='string'||!Object.hasOwn(registry,s.currentMapId)||!isRecord(s.maps))throw new TypeError('Unknown current map.');
  const ids=Object.keys(registry);
  if(Object.keys(s.maps).length!==ids.length||ids.some(id=>!Object.hasOwn(s.maps,id)))throw new TypeError('Map registry mismatch; save left untouched.');
  for(const id of ids){
    const map=registry[id],world=s.maps[id];
    if(isRecord(world))validateTerrainState(map,world as unknown as GridState);
    if(!isRecord(world)||!Number.isInteger(world.x)||!Number.isInteger(world.y)||![0,1,2,3].includes(world.facing)||(!terrainStandable(map,world,world.x,world.y))||!boundedInt(world.minutes)||!isRecord(world.doors)||!isRecord(world.secrets)||!Array.isArray(world.visited))throw new TypeError(`Invalid state for ${id}.`);
    validatePerceptionState(map,world);
    if(world.visited.length>4096||new Set(world.visited).size!==world.visited.length||world.visited.some(k=>typeof k!=='string'||!/^[0-9]{1,2},[0-9]{1,2}$/.test(k)||isOpaque(map,{...world,doors:{...world.doors, ...Object.fromEntries(map.doors.map(d=>[d.id,true]))}},Number(k.split(',')[0]),Number(k.split(',')[1]))&&!(map.terrain&&terrainEverFloor(map,Number(k.split(',')[0]),Number(k.split(',')[1])))))throw new TypeError('Invalid explored map cells.');
    const expected=map.doors.map(d=>d.id);
    if(Object.keys(world.doors).length!==expected.length||expected.some(key=>typeof world.doors[key]!=='boolean'))throw new TypeError('Door state does not match map.');
    if(Object.keys(world.secrets).length!==(map.secrets??[]).length||(map.secrets??[]).some(secret=>typeof world.secrets[secret.id]!=='boolean')||(map.secrets??[]).some(secret=>world.visited.includes(keyCoord(secret.x,secret.y))&&!world.secrets[secret.id]))throw new TypeError('Secret passages do not match map state.');
    if(!world.visited.includes(keyCoord(world.x,world.y)))throw new TypeError('Party position must be discovered.');
  }
  validateParty(s.party);
  validateCombat(s.combat,registry,s.party.order,s.currentMapId);
  for(const e of Object.values(s.combat.encounters))if(registry[e.mapId].terrain&&e.enemies.some(v=>v.hp>0&&!terrainStandable(registry[e.mapId],s.maps[e.mapId],v.x,v.y)))throw new TypeError('Living enemy embedded in terrain.');
  validateMagic(s.magic,s);
  if(!boundedInt(s.elapsedMinutes)||!boundedInt(s.rollCount))throw new TypeError('Invalid shared clock or roll count.');
  validateQuests(s.quests);
  // MM04: demo-specific invariants only apply when their authored objects exist.
  if(registry.map_resonator_vault?.doors.some(d=>d.id==='door_bell_heart_seal')&&s.maps.map_resonator_vault.doors.door_bell_heart_seal!==s.quests.flags.includes('flag_vault_valves'))throw new TypeError('Bell-Heart gate state contradicts the valve puzzle.');
  if(s.quests.mainStage===6&&s.combat.encounters.enc_bell_heart&&!s.combat.encounters.enc_bell_heart.cleared)throw new TypeError('Regulator progress requires a defeated Bell-Heart.');
  validateInventory(s.inventory,s.party);if(s.inventory.drops.length)throw new TypeError('Legacy drops must be migrated.');
  validateExpedition(s.expedition,s,registry);
  validateServices(s.services);
  validateThievery(s.thievery,s,registry);
  validateGround(s.ground,s,registry);
  const rng=new SeededRng(1);rng.restore(s.rng);
  return s;
}
/** Conservative chained migration from Phase 6 and 7 saves. Reject malformed/unknown versions. */
export function upgradeCampaign(value:unknown,registry?:MapRegistry):unknown {
  if(!isRecord(value)||value.format!==CAMPAIGN_FORMAT)return value;
  let candidate=value;
  if(candidate.version===1&&!Object.hasOwn(candidate,'combat'))candidate={...candidate,version:2,combat:initialCombatState(registry)};
  if(candidate.version===2&&isRecord(candidate.party)&&isRecord(candidate.party.characters)){
    // Migrate only old valid-shaped characters with no Phase 8 setup. Unknown partial data is rejected.
    const characters=candidate.party.characters;
    if(Object.values(characters).every(c=>isRecord(c)&&typeof c.classId==='string'&&!Object.hasOwn(c,'combatSetup'))){
      const migrated=Object.fromEntries(Object.entries(characters).map(([id,c])=>[id,{...c as object,combatSetup:defaultCombatSetup((c as {classId:import('../content/party.ts').ClassId}).classId)}]));
      candidate={...candidate,version:3,party:{...candidate.party,characters:migrated}};
    }
  }
  if(candidate.version===3&&!Object.hasOwn(candidate,'magic')&&isRecord(candidate.party)&&isRecord(candidate.party.characters)){
    // Original Phase 8 character setup remains unchanged; magic is supplied from the caster roster.
    candidate={...candidate,version:4,magic:initialMagicState(candidate.party as unknown as PartyState)};
  }
  if(candidate.version===4)candidate={...candidate,version:5};
  if(candidate.version===5&&isRecord(candidate.magic)&&isRecord(candidate.party)&&Array.isArray(candidate.party.order))candidate={...candidate,version:6,magic:{...candidate.magic,itemCurses:Object.hasOwn(candidate.magic,'itemCurses')?candidate.magic.itemCurses:Object.fromEntries((candidate.party.order as string[]).map(id=>[id,[]]))}};
  if(candidate.version===6)candidate={...candidate,version:7};
  if(candidate.version===7&&isRecord(candidate.party)&&isRecord(candidate.party.characters)&&isRecord(candidate.inventory)&&Array.isArray(candidate.inventory.items)){
    const party=structuredClone(candidate.party) as unknown as PartyState;
    const inventory=initialInventory(party);
    // Reserved legacy inventory entries are normally empty; malformed nonempty entries cannot silently disappear.
    if(candidate.inventory.items.length!==0)return candidate;
    candidate={...candidate,version:8,party,inventory};
  }
  if(candidate.version===8&&isRecord(candidate.maps)){
    const maps=Object.fromEntries(Object.entries(candidate.maps).map(([id,world])=>[id,isRecord(world)?{...world,secrets:Object.fromEntries((registry?.[id]?.secrets??[]).map(secret=>[secret.id,false]))}:world]));
    // Populate secret IDs from the immutable registry during parse (registry-aware post-migration).
    candidate={...candidate,version:9,maps,expedition:initialExpedition(),services:initialServices()};
  }
  if(candidate.version===9)candidate={...candidate,version:10,services:initialServices()};
  if(candidate.version===10&&registry&&isRecord(candidate.maps)&&isRecord(candidate.quests)){
    // The authored 16x16 village replaces Phase 15's 11x11 diagnostic map.
    // Preserve the campaign and other map unchanged. Map old town exploration onto
    // walkable cells only, retaining valid open door states and moving inaccessible
    // legacy positions to the new south entrance. Unknown versions remain rejected.
    const oldTown=candidate.maps.map_town;
    if(!isRecord(oldTown)||!isRecord(oldTown.doors)||!Array.isArray(oldTown.visited)||typeof oldTown.x!=='number'||typeof oldTown.y!=='number')return candidate;
    const map=registry.map_town,doors=Object.fromEntries(map.doors.map(d=>[d.id,(oldTown.doors as Record<string,unknown>)[d.id]===true]));
    const original=oldTown as unknown as GridState;
    const provisional={...original,doors,secrets:Object.fromEntries((map.secrets??[]).map(d=>[d.id,false]))};
    const valid=(x:number,y:number)=>!isOpaque(map,provisional,x,y);
    const x=valid(original.x,original.y)?original.x:map.spawn.x;
    const y=valid(original.x,original.y)?original.y:map.spawn.y;
    const keep=[...(original.visited as string[])].filter(k=>typeof k==='string'&&/^[0-9]{1,2},[0-9]{1,2}$/.test(k)&&valid(Number(k.split(',')[0]),Number(k.split(',')[1])));
    const visited=[...new Set([...keep,`${x},${y}`])];
    const migratedTown={...provisional,x,y,visited};
    const oldQuests=candidate.quests as unknown as {flags:string[];notes:string[]};
    if(!Array.isArray(oldQuests.flags)||!Array.isArray(oldQuests.notes))return candidate;
    candidate={...candidate,version:11,maps:{...candidate.maps,map_town:migratedTown},quests:migrateQuests(oldQuests)};
  }

  if(candidate.version===11&&registry&&isRecord(candidate.maps)){
    const oldWorld=candidate.maps.map_diagnostic_galleries;
    if(!isRecord(oldWorld)||!isRecord(oldWorld.doors)||!isRecord(oldWorld.secrets)||!Array.isArray(oldWorld.visited)||!isRecord(candidate.combat)||!isRecord(candidate.expedition))return candidate;
    const upper=registry.map_diagnostic_galleries,world=oldWorld as unknown as GridState;
    const doors=Object.fromEntries(upper.doors.map(d=>[d.id,world.doors[d.id]===true]));
    const secrets=Object.fromEntries((upper.secrets??[]).map(d=>[d.id,world.secrets[d.id]===true]));
    const upgraded={...world,doors,secrets};
    const valid=(x:number,y:number)=>!isOpaque(upper,upgraded,x,y);
    if(!Number.isInteger(world.x)||!Number.isInteger(world.y)||!Array.isArray(world.visited))return candidate;
    if(!valid(world.x,world.y)){upgraded.x=upper.spawn.x;upgraded.y=upper.spawn.y;}
    upgraded.visited=[...new Set([...world.visited.filter(k=>typeof k==='string'&&/^[0-9]{1,2},[0-9]{1,2}$/.test(k)&&valid(Number(k.split(',')[0]),Number(k.split(',')[1]))),`${upgraded.x},${upgraded.y}`])];
    const initial=initialCombatState();const combats=candidate.combat as unknown as CombatState;
    if(!isRecord(combats.encounters))return candidate;
    const encounters={...initial.encounters,...combats.encounters};
    const nextExp=candidate.expedition as unknown as ExpeditionState;
    candidate={...candidate,version:12,maps:{...candidate.maps,map_diagnostic_galleries:upgraded},combat:{...combats,encounters},expedition:nextExp};
  }
  if(candidate.version===12&&registry&&isRecord(candidate.maps)&&isRecord(candidate.combat)&&isRecord(candidate.quests)){
    const vault=registry.map_resonator_vault;
    if(!vault||!isRecord(candidate.combat.encounters))return candidate;
    const fresh=initialCombatState();const old=candidate.combat as unknown as CombatState;
    const q=candidate.quests as unknown as Record<string,unknown>;
    // Do not erase existing encounters or rewards. Add only new lower-floor content.
    candidate={...candidate,version:13,
      maps:{...candidate.maps,map_resonator_vault:initialGridState(vault)},
      combat:{...old,encounters:{...fresh.encounters,...old.encounters}},
      quests:{...q,valveSequence:[],ending:null}};
  }
  if(candidate.version===13)candidate={...candidate,version:14};
  if(candidate.version===14&&isRecord(candidate.inventory))candidate={...candidate,version:15,inventory:{...candidate.inventory,backpackSort:{}}};
  if(candidate.version===15&&isRecord(candidate.inventory)&&Array.isArray(candidate.inventory.items)){const inventory=structuredClone(candidate.inventory) as unknown as InventoryState;for(const item of inventory.items)if(item&&typeof item==='object')delete item.backpackSlot;assignBackpackSlots(inventory);for(const owner of new Set(inventory.items.map(i=>i.ownerId)))if(inventory.backpackSort[owner]&&inventory.backpackSort[owner]!=='manual')backpackItems(inventory,owner).forEach((i,n)=>i.backpackSlot=n);candidate={...candidate,version:16,inventory};}
  if(candidate.version===16)candidate={...candidate,version:17,thievery:initialThievery()};
  if(candidate.version===17&&registry){const next=structuredClone(candidate) as unknown as CampaignState;next.version=18;next.ground=migrateGround(next,registry);for(const e of Object.values(next.combat.encounters))if(!e.rewarded)rewardLoot(next,e.id);candidate=next as unknown as Record<string,unknown>;}
  return candidate;
}
export function parseCampaign(text:string,registry:MapRegistry):CampaignState {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_SAVE_BYTES)throw new TypeError('Save is too large or invalid.');
  try{return validateCampaign(upgradeCampaign(JSON.parse(text) as unknown,registry),registry);}catch(e){if(e instanceof SyntaxError)throw new TypeError('Save is not valid JSON.');throw e;}
}
export function serializeCampaign(state:CampaignState,registry:MapRegistry):string {
  validateCampaign(state,registry);
  const text=JSON.stringify(state);
  if(new TextEncoder().encode(text).length>MAX_SAVE_BYTES)throw new RangeError('Save exceeds maximum size.');
  return text;
}
/** Step transfers are called ONLY after a successful real movement, never after a transfer.
 * Interact transfers retain legacy Space-on-or-ahead behavior. No new save fields are needed.
 */
export function travelCampaign(state:CampaignState,registry:MapRegistry,activation:'interact'|'step'='interact',previous?:{mapId:string;x:number;y:number}):{state:CampaignState;message:string}|null {
  if(activation==='step'&&(!previous||previous.mapId!==state.currentMapId||previous.x===state.maps[state.currentMapId].x&&previous.y===state.maps[state.currentMapId].y))return null;
  const map=registry[state.currentMapId] as TravelMap,world=state.maps[map.id];
  const dirs=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}],d=dirs[world.facing];
  const portal=map.portals?.find(p=>(p.activation??'interact')===activation &&
    (activation==='step'?(p.x===world.x&&p.y===world.y):
     (p.x===world.x&&p.y===world.y)||(p.x===world.x+d.x&&p.y===world.y+d.y&&!edgeBlocked(map,world,world.x,world.y,p.x,p.y)&&!isOpaque(map,world,p.x,p.y))));
  if(!portal)return null;
  if(portal.id==='portal_town_to_dungeon'&&!state.quests.questItems.includes('item_quest_cistern_key'))return null;
  if(portal.id==='portal_upper_to_vault'&&!state.quests.flags.includes('flag_upper_descent_ready'))return null;
  if(portal.id==='portal_vault_shortcut'&&!state.quests.questItems.includes('item_quest_regulator'))return null;
  const arrival=portal.targetArrivalId?(registry[portal.targetMapId] as TravelMap).arrivals?.find(a=>a.id===portal.targetArrivalId):undefined;
  const x=arrival?.x??portal.targetX,y=arrival?.y??portal.targetY,facing=arrival?.facing??portal.targetFacing;
  const target=state.maps[portal.targetMapId],key=keyCoord(x,y);
  if(!terrainTransportSafe(registry[portal.targetMapId],target,x,y)||isOpaque(registry[portal.targetMapId],target,x,y))return null;
  const destination:GridState={...target,x,y,facing,visited:target.visited.includes(key)?target.visited:[...target.visited,key]};
  const next=structuredClone(state);next.currentMapId=portal.targetMapId;next.maps[portal.targetMapId]=destination;next.elapsedMinutes+=5;respawnOnEntry(next,portal.targetMapId);onTravelQuest(next,state.currentMapId,portal.targetMapId);expireMagic(next);
  return {state:next,message:`Travelled to ${registry[portal.targetMapId].name}.`};
}
