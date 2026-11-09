/** MP25 read-only projection from authoritative object/combat state to presentation instances. */
import type {GridMap} from './grid.ts';import type {CampaignState,MapRegistry} from './campaign.ts';import type {ScopedState} from './scoped-state.ts';import {entityVisible,entityView} from './objects.ts';import {currentEnemies} from './combat.ts';import type {SpriteInstance} from '../project/sprite-contracts.ts';
export function sceneSpriteInstances(map:GridMap,s:CampaignState,scope:ScopedState,registry:MapRegistry):SpriteInstance[]{
 const result:SpriteInstance[]=[];
 for(const p of map.spritePlacements??[]){const e=p.entityId?map.entities?.find(e=>e.id===p.entityId):undefined;if(e&&!entityVisible(s,scope,map,e,registry))continue;const state=e?entityView(s,scope,map,e,registry).state:'idle';result.push({id:p.id,spriteId:p.spriteId,x:p.x,y:p.y,scale:p.scale,facing:p.facing,animation:p.stateAnimations?.[state]??p.animation??state,hotspot:p.hotspot,allowOpaqueTarget:p.mount==='wall'||e?.kind==='door'||e?.kind==='secret',...(e?{target:{kind:'entity' as const,id:e.id}}:{})});}
 const active=s.combat.active;
 for(const e of Object.values(s.combat.encounters).filter(c=>c.mapId===map.id).flatMap(c=>c.enemies)){const p=map.enemyAppearances?.find(p=>p.kindId===e.kindId);if(!p||e.hp<=0&&!p.stateAnimations?.dead)continue;const state=e.hp<=0?'dead':(e.guardUntilRound??-1)>=(active?.round??0)?'guarded':active?.turnOrder[active.turnIndex]===e.id?'active':'idle';result.push({id:'enemy:'+e.id,spriteId:p.spriteId,x:e.x,y:e.y,scale:p.scale,facing:p.facing,animation:p.stateAnimations?.[state]??state,requiresSeen:e.hp<=0,reactions:p.stateAnimations,...(e.hp>0?{target:{kind:'enemy' as const,id:e.id}}:{})});}
 return result;
}
