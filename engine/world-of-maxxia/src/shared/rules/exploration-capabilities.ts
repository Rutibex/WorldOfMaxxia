/** MP23 reusable exploration capability matching and atomic staged state updates. */
import {edgeBlocked,terrainTransportSafe,elevationAt} from '../project/terrain-contracts.ts';
import {DIRECTIONS,isOpaque,type GridMap} from './grid.ts';
import type {CampaignState,MapRegistry} from './campaign.ts';
import type {ScopedState} from './scoped-state.ts';
import {readScopedValue,applyScopedAction} from './scoped-state.ts';
import type {PlacedEntity,CapabilityMethod} from './placed-entities.ts';
import {ITEMS} from '../content/items.ts';
import {listedEffects} from '../content/effect-definitions.ts';
import {abilityGranted,checkAbility,spendExplorationAbility} from './abilities.ts';
import {settleExpeditionTime} from './expedition.ts';
export type Provider={kind:'ability'|'item';id:string;instanceId?:string};
const flagKey=(e:PlacedEntity,suffix:string)=>{const [ns,,name]=e.id.split(':');return `${ns}:flag:${name}_${suffix}`;};
const flag=(scope:ScopedState,map:GridMap,e:PlacedEntity,suffix:string,registry:MapRegistry)=>readScopedValue(scope,{scope:'local',mapId:map.id},'flag',flagKey(e,suffix),registry)===true;
/** Only cardinal Manhattan distance up to four; diagonal sealed corners cannot be targeted. */
export function inCapabilityRange(s:CampaignState,map:GridMap,e:PlacedEntity,range:number,sight:boolean):boolean {
 const w=s.maps[map.id],dx=e.x-w.x,dy=e.y-w.y;
 if(Math.abs(dx)+Math.abs(dy)>range)return false;
 if(!sight)return Math.abs(elevationAt(map,w,w.x,w.y)-elevationAt(map,w,e.x,e.y))<=1&&!edgeBlocked(map,w,w.x,w.y,e.x,e.y)&&range===1&&(dx===0&&dy===0||Math.abs(dx)+Math.abs(dy)===1);
 const count=Math.max(Math.abs(dx),Math.abs(dy));
 if(!count)return true;
 let px=w.x,py=w.y;
 for(let k=1;k<=count;k++){
   const nx=Math.round(w.x+dx*k/count),ny=Math.round(w.y+dy*k/count);
   if(nx===px||ny===py){if(edgeBlocked(map,w,px,py,nx,ny))return false;}else if(edgeBlocked(map,w,px,py,nx,py)||edgeBlocked(map,w,px,py,px,ny)||edgeBlocked(map,w,nx,py,nx,ny)||edgeBlocked(map,w,px,ny,nx,ny))return false;
   if(k<count&&isOpaque(map,w,nx,ny))return false;
   if(nx!==px&&ny!==py&&isOpaque(map,w,nx,py)&&isOpaque(map,w,px,ny))return false;
   px=nx;py=ny;
 }
 return true;
}
function already(s:CampaignState,scope:ScopedState,map:GridMap,e:PlacedEntity,m:CapabilityMethod,registry:MapRegistry):string|null {
 const w=s.maps[map.id];
 if(m.outcome==='reveal'&&(e.kind==='secret'?w.secrets[e.secretId!]===true:flag(scope,map,e,'found',registry)))return 'Already revealed.';
 if(m.outcome==='unlock'&&(flag(scope,map,e,'unlocked',registry)||(e.kind==='door'&&w.doors[e.doorId!])))return 'Already unlocked.';
 if(m.outcome==='open'&&(e.kind==='door'?w.doors[e.doorId!]:flag(scope,map,e,'opened',registry)))return 'Already open.';
 if(m.outcome==='disarm'&&s.expedition.triggeredTraps.includes(`${map.id}:${e.hazardId}`))return 'Already disarmed.';
 return null;
}
export function capabilityProvider(s:CampaignState,scope:ScopedState,map:GridMap,e:PlacedEntity,m:CapabilityMethod,registry:MapRegistry):{provider?:Provider;reason:string}{
 if(s.combat.active||s.combat.defeated)return {reason:'Unavailable in combat or defeat.'};
 const hero=s.party.characters[s.party.selectedId];if(!hero||!s.party.order.includes(hero.id)||hero.hp<=0)return {reason:'Select a conscious adventurer.'};
 const done=already(s,scope,map,e,m,registry);if(done)return {reason:done};
 for(const effect of listedEffects().filter(a=>a.exploration?.tags.includes(m.tag)).sort((a,b)=>a.id.localeCompare(b.id))){
  if(!abilityGranted(hero,effect)||!inCapabilityRange(s,map,e,effect.exploration!.range,effect.exploration!.requiresSight))continue;
  const blocked=checkAbility(hero,effect,s);if(!blocked)return {provider:{kind:'ability',id:effect.id},reason:''};
 }
 for(const item of s.inventory.items.filter(i=>i.ownerId===hero.id).sort((a,b)=>a.id.localeCompare(b.id))){
  const def=ITEMS[item.definitionId];if(!def?.exploration?.tags.includes(m.tag)||!inCapabilityRange(s,map,e,def.exploration.range,def.exploration.requiresSight)||def.attunement&&!item.attuned||def.maxCharges>0&&item.charges===0)continue;
  return {provider:{kind:'item',id:def.id,instanceId:item.id},reason:''};
 }
 return {reason:`Requires ${m.tag} capability, valid range/line of sight, and available resource or item charges.`};
}
export function capabilityCanReveal(s:CampaignState,scope:ScopedState,map:GridMap,e:PlacedEntity,registry:MapRegistry):boolean {
 return !!e.capabilities?.some(m=>m.outcome==='reveal'&&capabilityProvider(s,scope,map,e,m,registry).provider);
}
export function capabilityInMenu(s:CampaignState,scope:ScopedState,map:GridMap,e:PlacedEntity,registry:MapRegistry):boolean{
 return !!e.capabilities?.some(m=>capabilityProvider(s,scope,map,e,m,registry).provider);
}
export function executeCapability(source:CampaignState,scope:ScopedState,registry:MapRegistry,e:PlacedEntity,id:string):{state:CampaignState;scoped:ScopedState;changed:boolean;message:string;blocked?:boolean;routine?:PlacedEntity['onUse']} {
 const map=registry[source.currentMapId],m=e.capabilities?.find(m=>m.id===id);
 const no=(message:string)=>({state:source,scoped:scope,changed:false,message,blocked:true});
 if(!m)return no('Unknown capability method.');
 const available=capabilityProvider(source,scope,map,e,m,registry);
 if(!available.provider)return no(available.reason);
 if(m.outcome==='traverse'){
  const dest=m.destination!,w=source.maps[map.id];
  if(!inCapabilityRange(source,map,{...e,x:dest.x,y:dest.y},4,true)||isOpaque(map,w,dest.x,dest.y)||!terrainTransportSafe(map,w,dest.x,dest.y))return no('Traversal destination is obstructed or beyond safe line of sight.');
  if(Object.values(source.combat.encounters).some(enc=>enc.mapId===map.id&&enc.enemies.some(enemy=>enemy.hp>0&&enemy.x===dest.x&&enemy.y===dest.y)))return no('A living enemy occupies the traversal destination.');
  if(w.x===dest.x&&w.y===dest.y)return no('Already at destination.');
 }
 const s=structuredClone(source);let scoped=structuredClone(scope);
 const heroId=s.party.selectedId,p=available.provider;
 if(p.kind==='ability')spendExplorationAbility(s,p.id,heroId,m.minutes);
 else {const item=s.inventory.items.find(i=>i.id===p.instanceId&&i.ownerId===heroId);if(!item)return no('Capability item is unavailable.');if(ITEMS[item.definitionId].maxCharges>0)item.charges--;}
 const set=(suffix:string)=>{scoped=applyScopedAction(scoped,{kind:'flag',address:{scope:'local',mapId:map.id},key:flagKey(e,suffix),value:true},registry);};
 switch(m.outcome){
  case 'unlock':set('unlocked');break;
  case 'open':set('unlocked');if(e.kind==='door')s.maps[map.id].doors[e.doorId!]=true;else set('opened');break;
  case 'reveal':set('found');if(e.kind==='secret')s.maps[map.id].secrets[e.secretId!]=true;break;
  case 'disarm':s.expedition.triggeredTraps.push(`${map.id}:${e.hazardId}`);break;
  case 'use':set('used');break;
  case 'traverse':{const dest=m.destination!,w=s.maps[map.id];w.x=dest.x;w.y=dest.y;const key=`${dest.x},${dest.y}`;if(!w.visited.includes(key))w.visited.push(key);break;}
 }
 s.elapsedMinutes+=m.minutes;s.maps[map.id].minutes+=m.minutes;settleExpeditionTime(s);
 return {state:s,scoped,changed:true,message:`${e.name}: ${m.label} using ${p.id}.`,...(m.outcome==='use'&&e.onUse?{routine:e.onUse}:{})};
}
