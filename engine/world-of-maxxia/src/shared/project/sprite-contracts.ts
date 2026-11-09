/** MP25 bounded image/atlas and placement contracts. Presentation never changes simulation. */
import type {GridMap} from '../rules/grid.ts';
export interface SpriteSource{resourceId:string;width:number;height:number;}
export interface SpriteFrame{source:number;x:number;y:number;width:number;height:number;}
export interface SpriteClip{id:string;frames:number[];fps:number;loop:boolean;}
export interface SpriteDefinition{id:string;sources:SpriteSource[];frames:SpriteFrame[];animations:SpriteClip[];defaultAnimation:string;pivot:{x:number;y:number};directionOffsets?:[number,number,number,number];fallback:'placeholder'|'hide';}
export interface SpritePlacement{mount?:'floor'|'wall';id:string;spriteId:string;x:number;y:number;scale:number;facing:0|1|2|3;entityId?:string;propId?:string;animation?:string;stateAnimations?:Record<string,string>;hotspot?:{x:number;y:number;width:number;height:number};}
export interface EnemyAppearance{kindId:string;spriteId:string;scale:number;facing:0|1|2|3;stateAnimations?:Record<string,string>;}
export interface SpriteInstance{id:string;spriteId:string;x:number;y:number;scale:number;facing:number;animation?:string;hotspot?:SpritePlacement['hotspot'];requiresSeen?:boolean;reactions?:Record<string,string>;opacity?:number;allowOpaqueTarget?:boolean;target?:{kind:'entity'|'enemy';id:string};}
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v),id=/^[a-z][a-z0-9_]{0,47}$/,resource=/^(?:asset_[a-z0-9_]{1,89}|[a-z][a-z0-9_]{0,47}:resource:[a-z][a-z0-9_]{0,79})$/;
const bad=(p:string,m:string):never=>{throw new TypeError('MP25 '+p+': '+m);};
function fields(v:unknown,keys:string[],p:string):asserts v is Record<string,unknown>{if(!obj(v)||Object.keys(v).some(k=>!keys.includes(k)))bad(p,'Invalid object or unknown field.');}
const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
const number=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function spriteResourceIds(sprites:readonly SpriteDefinition[]=[]):string[]{return [...new Set(sprites.flatMap(s=>s.sources.map(s=>s.resourceId)))];}
export function validateSpriteDefinitions(value:unknown,p='sprites',image?:(id:string)=>void):asserts value is SpriteDefinition[]{
 if(!Array.isArray(value)||value.length>64)bad(p,'Expected up to 64 sprite definitions.');const ids=new Set<string>(),sources=new Map<string,string>();let pixels=0;
 for(const [i,raw]of (value as unknown[]).entries()){
  const at=p+'['+i+']';fields(raw,['id','sources','frames','animations','defaultAnimation','pivot','directionOffsets','fallback'],at);const s=raw as unknown as SpriteDefinition;
  if(typeof s.id!=='string'||!id.test(s.id)||ids.has(s.id))bad(at+'.id','Invalid or duplicate sprite ID.');ids.add(s.id);
  if(!Array.isArray(s.sources)||!s.sources.length||s.sources.length>8)bad(at+'.sources','Expected 1–8 sources.');
  for(const [j,source]of s.sources.entries()){fields(source,['resourceId','width','height'],at+'.sources['+j+']');if(typeof source.resourceId!=='string'||!resource.test(source.resourceId)||!integer(source.width,1,4096)||!integer(source.height,1,4096))bad(at+'.sources['+j+']','Invalid resource or dimensions (1–4096).');const size=source.width+'x'+source.height;if(sources.has(source.resourceId)&&sources.get(source.resourceId)!==size)bad(at+'.sources','Conflicting dimensions for one resource.');if(!sources.has(source.resourceId)){sources.set(source.resourceId,size);pixels+=source.width*source.height;if(pixels>16777216)bad(p,'Sprite sources exceed the 16-megapixel decoded-image budget.');}image?.(source.resourceId);}
  if(!Array.isArray(s.frames)||!s.frames.length||s.frames.length>256)bad(at+'.frames','Expected 1–256 atlas rectangles.');
  for(const [j,f]of s.frames.entries()){fields(f,['source','x','y','width','height'],at+'.frames['+j+']');if(!integer(f.source,0,s.sources.length-1)||!integer(f.x,0,4095)||!integer(f.y,0,4095)||!integer(f.width,1,4096)||!integer(f.height,1,4096)||f.x+f.width>s.sources[f.source].width||f.y+f.height>s.sources[f.source].height)bad(at+'.frames['+j+']','Frame rectangle exceeds its source.');}
  fields(s.pivot,['x','y'],at+'.pivot');if(!number(s.pivot.x,0,1)||!number(s.pivot.y,0,1))bad(at+'.pivot','Expected normalized pivot.');
  if(s.directionOffsets!==undefined&&(!Array.isArray(s.directionOffsets)||s.directionOffsets.length!==4||s.directionOffsets.some(n=>!integer(n,0,255))))bad(at+'.directionOffsets','Expected four bounded frame offsets.');
  if(!Array.isArray(s.animations)||!s.animations.length||s.animations.length>16)bad(at+'.animations','Expected 1–16 named clips.');const clips=new Set<string>();
  for(const [j,c]of s.animations.entries()){fields(c,['id','frames','fps','loop'],at+'.animations['+j+']');if(typeof c.id!=='string'||!id.test(c.id)||clips.has(c.id)||!Array.isArray(c.frames)||!c.frames.length||c.frames.length>64||c.frames.some(n=>!integer(n,0,s.frames.length-1)||(s.directionOffsets??[0]).some(offset=>n+offset>=s.frames.length))||!number(c.fps,0,24)||typeof c.loop!=='boolean')bad(at+'.animations['+j+']','Invalid clip, frame reference, direction offset or playback rate.');clips.add(c.id);}
  if(!clips.has(s.defaultAnimation)||!['placeholder','hide'].includes(s.fallback))bad(at,'Missing default animation or invalid fallback.');
 }
}
function animationMap(v:unknown,p:string){if(v===undefined)return;fields(v,['idle','used','closed','open','claimed','active','guarded','attack','hurt','dead'],p);if(Object.values(v).some(s=>typeof s!=='string'||!id.test(s)))bad(p,'Invalid state animation mapping.');}
export function validateSpritePlacements(map:GridMap):void{
 if(map.spritePlacements!==undefined){if(!Array.isArray(map.spritePlacements)||map.spritePlacements.length>128)bad(map.id+'.spritePlacements','Expected up to 128 placements.');const ids=new Set<string>(),bindings=new Set<string>();
  for(const [i,p]of map.spritePlacements.entries()){
   const at=map.id+'.spritePlacements['+i+']';fields(p,['id','spriteId','x','y','scale','facing','entityId','propId','animation','stateAnimations','hotspot','mount'],at);
   if(typeof p.id!=='string'||!id.test(p.id)||ids.has(p.id)||typeof p.spriteId!=='string'||!id.test(p.spriteId)||!integer(p.x,0,map.rows[0].length-1)||!integer(p.y,0,map.rows.length-1)||!number(p.scale,.1,3)||!integer(p.facing,0,3))bad(at,'Invalid placement, scale or facing.');ids.add(p.id);
   if(p.mount!==undefined&&!['floor','wall'].includes(p.mount)||p.mount==='wall'&&!['#','D'].includes(map.rows[p.y][p.x]))bad(at+'.mount','Wall mounts require an authored wall or door cell.');
   if(p.entityId!==undefined&&p.propId!==undefined)bad(at,'Choose one semantic binding.');
   if(p.entityId!==undefined||p.propId!==undefined){const key=p.entityId??p.propId!,source=p.entityId!==undefined?map.entities?.find(e=>e.id===p.entityId):map.props.find(e=>e.id===p.propId);if(!source||source.x!==p.x||source.y!==p.y||bindings.has(key))bad(at,'Binding must be unique and match its entity/prop cell.');bindings.add(key);}
   else if(map.rows[p.y][p.x]!=='.'&&p.mount!=='wall')bad(at,'Unbound scenery must be placed on floor.');
   if(p.hotspot!==undefined){fields(p.hotspot,['x','y','width','height'],at+'.hotspot');const h=p.hotspot;if(!number(h.x,0,1)||!number(h.y,0,1)||!number(h.width,.01,1)||!number(h.height,.01,1)||h.x+h.width>1||h.y+h.height>1||!p.entityId)bad(at+'.hotspot','Expected a normalized rectangle on an entity-bound sprite.');}
   if(p.animation!==undefined&&(typeof p.animation!=='string'||!id.test(p.animation)))bad(at+'.animation','Invalid clip.');animationMap(p.stateAnimations,at+'.stateAnimations');
  }
 }
 if(map.enemyAppearances!==undefined){if(!Array.isArray(map.enemyAppearances)||map.enemyAppearances.length>32)bad(map.id+'.enemyAppearances','Expected up to 32 enemy appearances.');const ids=new Set<string>();for(const e of map.enemyAppearances){fields(e,['kindId','spriteId','scale','facing','stateAnimations'],map.id+'.enemyAppearances');if(typeof e.kindId!=='string'||!/^(?:[a-z][a-z0-9_]{0,63}|[a-z][a-z0-9_]{0,47}:monster:[a-z][a-z0-9_]{0,79})$/.test(e.kindId)||ids.has(e.kindId)||typeof e.spriteId!=='string'||!id.test(e.spriteId)||!number(e.scale,.1,3)||!integer(e.facing,0,3))bad(map.id+'.enemyAppearances','Invalid or duplicate enemy appearance.');ids.add(e.kindId);animationMap(e.stateAnimations,map.id+'.enemyAppearances');}}
}
export function validateSpriteBindings(map:GridMap,sprites:readonly SpriteDefinition[]):void{
 const definitions=new Map(sprites.map(s=>[s.id,s]));
 for(const p of [...(map.spritePlacements??[]),...(map.enemyAppearances??[])]){const s=definitions.get(p.spriteId);if(!s)bad(map.id+'.sprites','Unknown profile sprite '+p.spriteId);for(const clip of [...Object.values(p.stateAnimations??{}),...('animation'in p&&p.animation?[p.animation]:[])])if(!s!.animations.some(c=>c.id===clip))bad(map.id+'.sprites','Unknown animation '+clip);}
}
/** Explicit visual time only: no RNG, campaign clocks or state writes. */
export function spriteFrameIndex(s:SpriteDefinition,animation:string|undefined,elapsed:number,relativeFacing=0):number{
 const clip=s.animations.find(c=>c.id===animation)??s.animations.find(c=>c.id===s.defaultAnimation)!;
 const tick=clip.fps?Math.floor(Math.max(0,Number.isFinite(elapsed)?elapsed:0)*clip.fps/1000):0,index=clip.loop?tick%clip.frames.length:Math.min(tick,clip.frames.length-1);
 return clip.frames[index]+(s.directionOffsets?.[((relativeFacing%4)+4)%4]??0);
}
