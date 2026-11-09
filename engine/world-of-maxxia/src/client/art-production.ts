/** Presentation-only data; no animation state is written into campaign saves. */
export type ClipName='idle'|'attack'|'hurt'|'death';
export type BossClipName='telegraph'|'discharge'|'recovery';
export type AnimationName=ClipName|BossClipName;
export interface Clip {frames:readonly number[];ms:number;loop:boolean;}
export interface EnemyAtlas {url:string;cell:number;columns:number;anchor:readonly number[];clips:Record<ClipName,Clip>;special?:{url:string;clips:Record<BossClipName,Clip>};}
export const DUST_IMP={url:'assets/art/dust-imp.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5,6,7],ms:145,loop:true},
 attack:{frames:[8,9,10],ms:125,loop:false},
 hurt:{frames:[11],ms:210,loop:false},
 death:{frames:[12,13,14,15],ms:160,loop:false}
}} satisfies EnemyAtlas;
/** Phase 27: approved Dust Imp atlas and two new original, registered 16-frame enemy sheets. */
export const STONE_MITE={url:'assets/art/enemies/stone-mite.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:165,loop:true},
 attack:{frames:[6,7,8,9],ms:115,loop:false},
 hurt:{frames:[10,11],ms:115,loop:false},
 death:{frames:[12,13,14,15],ms:145,loop:false}
}} satisfies EnemyAtlas;
export const GALLERY_WATCHER={url:'assets/art/enemies/gallery-watcher.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:175,loop:true},
 attack:{frames:[6,7,8,9],ms:130,loop:false},
 hurt:{frames:[10,11],ms:130,loop:false},
 death:{frames:[12,13,14,15],ms:165,loop:false}
}} satisfies EnemyAtlas;
/** Phase 28: three more original 16-frame vault enemy atlases. */
export const CISTERN_RAT={url:'assets/art/enemies/cistern-rat.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:135,loop:true},
 attack:{frames:[6,7,8,9],ms:108,loop:false},
 hurt:{frames:[10,11],ms:130,loop:false},
 death:{frames:[12,13,14,15],ms:155,loop:false}
}} satisfies EnemyAtlas;
export const SLUDGE_LEECH={url:'assets/art/enemies/sludge-leech.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:180,loop:true},
 attack:{frames:[6,7,8,9],ms:125,loop:false},
 hurt:{frames:[10,11],ms:145,loop:false},
 death:{frames:[12,13,14,15],ms:165,loop:false}
}} satisfies EnemyAtlas;
export const PIPE_GOBLIN={url:'assets/art/enemies/pipe-goblin.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:155,loop:true},
 attack:{frames:[6,7,8,9],ms:112,loop:false},
 hurt:{frames:[10,11],ms:145,loop:false},
 death:{frames:[12,13,14,15],ms:165,loop:false}
}} satisfies EnemyAtlas;
/** Phase 29: final two ordinary enemies and a real boss with a separate telegraph/discharge/recovery sheet. */
export const BELL_WRAITH={url:'assets/art/enemies/bell-wraith.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:170,loop:true},
 attack:{frames:[6,7,8,9],ms:115,loop:false},
 hurt:{frames:[10,11],ms:135,loop:false},
 death:{frames:[12,13,14,15],ms:170,loop:false}
}} satisfies EnemyAtlas;
export const VALVE_SENTINEL={url:'assets/art/enemies/valve-sentinel.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:180,loop:true},
 attack:{frames:[6,7,8,9],ms:125,loop:false},
 hurt:{frames:[10,11],ms:120,loop:false},
 death:{frames:[12,13,14,15],ms:160,loop:false}
}} satisfies EnemyAtlas;
export const BELL_HEART={url:'assets/art/enemies/bell-heart.png',cell:128,columns:4,anchor:[.5,.96],clips:{
 idle:{frames:[0,1,2,3,4,5],ms:175,loop:true},
 attack:{frames:[6,7,8,9],ms:120,loop:false},
 hurt:{frames:[10,11],ms:140,loop:false},
 death:{frames:[12,13,14,15],ms:200,loop:false}
},special:{url:'assets/art/enemies/bell-heart-special.png',clips:{
 telegraph:{frames:[0,1,2,3],ms:185,loop:false},
 discharge:{frames:[4,5,6,7],ms:135,loop:false},
 recovery:{frames:[8,9,10,11],ms:175,loop:false}
}}} satisfies EnemyAtlas;
export const ANIMATED_ENEMY_ATLASES:Readonly<Record<string,EnemyAtlas>>={dust_imp:DUST_IMP,stone_mite:STONE_MITE,gallery_watcher:GALLERY_WATCHER,cistern_rat:CISTERN_RAT,sludge_leech:SLUDGE_LEECH,pipe_goblin:PIPE_GOBLIN,bell_wraith:BELL_WRAITH,valve_sentinel:VALVE_SENTINEL,bell_heart:BELL_HEART};
/** Resolve an ordinary or boss-only clip from the production metadata. */
export function animationClip(atlas:EnemyAtlas,name:AnimationName):Clip{
 if(name==='telegraph'||name==='discharge'||name==='recovery'){
  if(!atlas.special)throw new Error(`No boss special animation for ${name}`);
  return atlas.special.clips[name];
 }
 return atlas.clips[name];
}

export function clipFrame(clip:Clip,elapsed:number,reduced=false):number{
 if(reduced)return clip.frames[clip.loop?0:clip.frames.length-1];
 const n=Math.floor(Math.max(0,elapsed)/clip.ms);
 return clip.frames[clip.loop?n%clip.frames.length:Math.min(n,clip.frames.length-1)];
}
export function clipDuration(name:AnimationName,atlas:EnemyAtlas=DUST_IMP):number{const c=animationClip(atlas,name);return c.frames.length*c.ms;}
export const PORTRAIT_PROOF=5;
export const PORTRAIT_STATES=['normal','hurt','afflicted','dead'] as const;
import {PORTRAITS,portraitForLegacyNumber,type PortraitState} from '../shared/content/actors.ts';
import type {ResourceResolver} from '../shared/project/resources.ts';
let portraitResources:ResourceResolver|null=null;
export function configurePortraitArt(resolver:ResourceResolver|null){portraitResources=resolver;}
export function portraitSetAsset(id:string|undefined,number:number,state:PortraitState):string|null {
 const set=PORTRAITS[id??portraitForLegacyNumber(number)];const resource=set&&portraitResources?.byId.get(set.states[state]);
 return resource?.url??portraitAsset(number,state);
}
export function portraitAsset(index:number,state:typeof PORTRAIT_STATES[number]):string|null{
 if(!Number.isInteger(index)||index<0||index>=12)return null;
 return index===PORTRAIT_PROOF?`assets/art/witch-${state}.png`:`assets/art/portraits/${String(index).padStart(2,'0')}-${state}.png`;
}
export function tavernFrame(elapsed:number,reduced=false):number{
 // Long open-eye hold, short blink, then warm smile. No game-time dependency.
 if(reduced)return 0;
 const t=Math.max(0,elapsed)%3600;return t<2300?0:t<2420?1:t<2540?2:3;
}
