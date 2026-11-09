/** MP26 simulation operations; callers retain the enclosing atomic transaction. */
import type {CampaignState,MapRegistry} from './campaign.ts';import {canCross,isOpaque,terrainStandable,type GridMap,type GridState} from './grid.ts';
import {configuration,terrainCell,forcedCell,terrainTransportSafe,elevationAt} from '../project/terrain-contracts.ts';import {settleExpeditionTime} from './expedition.ts';
export class TerrainFault extends Error{readonly code='E_TERRAIN';}
const dirs=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
export interface EntryPlan{cells:{x:number;y:number}[];minutes:number;damage:number;facing?:0|1|2|3;messages:string[];}
export function terrainEntryPlan(map:GridMap,world:GridState,occupied:readonly {x:number;y:number}[]):EntryPlan{
 let x=world.x,y=world.y;const plan:EntryPlan={cells:[],minutes:0,damage:0,messages:[]},seen=new Set<string>();
 for(let hop=0;;hop++){
  if(hop>=8||seen.has(x+','+y))throw new TerrainFault('Forced route loops or exceeds eight entry cells.');seen.add(x+','+y);
  if(isOpaque(map,world,x,y)||occupied.some(e=>e.x===x&&e.y===y))throw new TerrainFault('A wall or living enemy blocks the terrain route.');
  const c=terrainCell(map,world,x,y);plan.cells.push({x,y});plan.minutes+=(hop?1:0)+(c?.minutes??0);plan.damage+=c?.damage??0;
  if(c&&c.kind!=='floor')plan.messages.push(c.kind==='pit'?`A pit drops the party to ${c.destination!.x}, ${c.destination!.y}.`:c.kind==='conveyor'?'The conveyor carries the party onward.':c.kind==='teleporter'?'The teleporter relocates the party.':c.kind==='liquid'?`Liquid crossing${c.minutes?' costs '+c.minutes+' extra minutes':''}${c.damage?' and '+c.damage+' HP per conscious hero':''}.`:'The party crosses the bridge.');
  if(!forcedCell(c))return plan;
  if(c!.facing!==undefined)plan.facing=c!.facing;
  if(c!.kind==='conveyor'){const d=dirs[c!.direction!];if(!canCross(map,world,x,y,x+d.x,y+d.y))throw new TerrainFault('The conveyor destination is blocked.');x+=d.x;y+=d.y;}else{x=c!.destination!.x;y=c!.destination!.y;}
 }
}
/** A walkable return path to the immutable anchor; ordinary doors may be opened. */
export function canRecover(map:GridMap,world:GridState):boolean{
 if(!map.terrain)return true;const target=map.terrain.recovery,w={...world,doors:Object.fromEntries(map.doors.map(d=>[d.id,world.doors[d.id]||!d.lockDC&&!d.questLocked&&!map.entities?.some(e=>e.kind==='door'&&e.doorId===d.id&&!!e.lock)]))},queue=[{x:w.x,y:w.y}],seen=new Set([w.x+','+w.y]);
 for(let n=0;n<queue.length&&n<4096;n++){const p=queue[n];if(p.x===target.x&&p.y===target.y)return true;for(const d of dirs){const x=p.x+d.x,y=p.y+d.y,k=x+','+y;if(seen.has(k)||!canCross(map,w,p.x,p.y,x,y)||!terrainStandable(map,w,x,y))continue;seen.add(k);queue.push({x,y});}}
 return false;
}
export function changeTerrain(source:CampaignState,registry:MapRegistry,id:string):{state:CampaignState;changed:boolean;message:string;from?:string;to?:string}{
 const map=registry[source.currentMapId],t=map.terrain,w=source.maps[map.id],from=configuration(map,w)?.id;const no=(message:string)=>({state:source,changed:false,message});
 if(!t)return no('There is no route control here.');if(source.combat.active||source.combat.defeated)return no('Terrain controls are unavailable during combat or defeat.');if(!source.party.order.some(id=>source.party.characters[id].hp>0))return no('A conscious adventurer must operate the terrain control.');
 if(!t.configurations.some(c=>c.id===id))return no('That route layout is unavailable.');if(from===id)return no('That route layout is already active.');
 const reset=id===t.initialConfigurationId&&w.x===t.recovery.x&&w.y===t.recovery.y;if(!reset&&!t.transitions.some(a=>a.from===from&&a.to===id))return no('That route change is unavailable from the current layout.');
 const s=structuredClone(source),next=s.maps[map.id];next.terrain={version:1,configurationId:id};
 if(!terrainStandable(map,next,next.x,next.y))return no('Terrain change would embed or strand the party on an unsafe tile.');
 if(Object.values(s.combat.encounters).filter(e=>e.mapId===map.id).flatMap(e=>e.enemies).some(e=>e.hp>0&&!terrainStandable(map,next,e.x,e.y)))return no('Terrain change would embed a living enemy.');
 if(s.ground.containers.some(c=>c.mapId===map.id&&(c.entries.length||c.gold)&&!terrainStandable(map,next,c.x,c.y)))return no('Terrain change would bury unclaimed ground loot.');
 if(!canRecover(map,next))return no('Terrain change would disconnect the party from the recovery control.');
 s.elapsedMinutes+=t.changeMinutes;next.minutes+=t.changeMinutes;settleExpeditionTime(s);
 return {state:s,changed:true,from,to:id,message:`The route changes to ${t.configurations.find(c=>c.id===id)!.name}. ${t.changeMinutes} minute(s) spent.`};
}
