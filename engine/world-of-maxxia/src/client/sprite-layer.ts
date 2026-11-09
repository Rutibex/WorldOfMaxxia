import {elevationAt} from '../shared/project/terrain-contracts.ts';
/** MP25 common billboard/atlas painter. Same code serves every map and scene preset. */
import {castRay,CAMERA_PLANE,type ViewPose} from '../shared/rules/perspective.ts';import type {GridMap,GridState} from '../shared/rules/grid.ts';
import {spriteFrameIndex,type SpriteDefinition,type SpriteInstance,type SpriteFrame} from '../shared/project/sprite-contracts.ts';
const W=440,H=280;
type Hit={instance:SpriteInstance;frame:SpriteFrame;source?:Uint8ClampedArray;sourceWidth:number;left:number;top:number;width:number;height:number;visible:boolean[];placeholder:boolean};
export class SpriteLayer{
 readonly diagnostics:string[]=[];private warnings=new Set<string>();private hits:Hit[]=[];private clock=0;private tick?:number;private mapId='';private clips=new Map<string,{animation:string;started:number}>();private seen=new Set<string>();private reactions=new Map<string,{animation:string;started:number}>();private pixels=new Map<CanvasImageSource,Uint8ClampedArray|null>();
 private definitions:Map<string,SpriteDefinition>;private images:Map<string,CanvasImageSource>;
 constructor(definitions:ReadonlyMap<string,SpriteDefinition>,images:ReadonlyMap<string,CanvasImageSource>){this.definitions=new Map(definitions);this.images=new Map(images);}
 define(definition:SpriteDefinition,sources:readonly [string,CanvasImageSource][]){this.definitions.set(definition.id,definition);for(const [id,image]of sources)this.images.set(id,image);}
 react(id:string,animation:'attack'|'hurt'){this.reactions.set('enemy:'+id,{animation,started:this.clock});}
 private warn(message:string){if(this.warnings.has(message))return;this.warnings.add(message);if(this.diagnostics.length<64)this.diagnostics.push(message);console.warn('MP25 sprite: '+message);}
 private alpha(image:CanvasImageSource,width:number,height:number):Uint8ClampedArray|null{
  if(this.pixels.has(image))return this.pixels.get(image)!;
  let data:Uint8ClampedArray|null=null;try{const c=document.createElement('canvas');c.width=width;c.height=height;const g=c.getContext('2d')!;g.drawImage(image,0,0);data=g.getImageData(0,0,width,height).data;}catch{this.warn('Image cannot be sampled for transparent hotspots.');}this.pixels.set(image,data);return data;
 }
 render(ctx:CanvasRenderingContext2D,map:GridMap,state:GridState,pose:ViewPose,time:number,instances:readonly SpriteInstance[],paused=false,reducedMotion=false):void{
  this.hits=[];if(this.mapId!==map.id){this.mapId=map.id;this.clips.clear();this.reactions.clear();this.seen.clear();this.tick=undefined;this.clock=0;}
  if(paused)this.tick=undefined;else if(Number.isFinite(time)){if(this.tick!==undefined)this.clock+=Math.max(0,Math.min(1000,time-this.tick));this.tick=time;}
  const fx=Math.sin(pose.angle),fy=-Math.cos(pose.angle),rx=Math.cos(pose.angle),ry=Math.sin(pose.angle),rays=Array.from({length:W},(_,x)=>{const c=2*(x+.5)/W-1;return castRay(map,state,pose.x,pose.y,fx+rx*CAMERA_PLANE*c,fy+ry*CAMERA_PLANE*c);});
  if(instances.length>512)this.warn('Scene exceeds 512 sprite instances; excess instances are omitted.');
  const live=new Set<string>();const projected=instances.slice(0,512).map(instance=>{const dx=instance.x+.5-pose.x,dy=instance.y+.5-pose.y;return {instance,depth:dx*fx+dy*fy,lateral:dx*rx+dy*ry};}).filter(p=>p.depth>.18&&p.depth<4.5).sort((a,b)=>b.depth-a.depth||a.instance.id.localeCompare(b.instance.id));
  for(const {instance,depth,lateral}of projected){const s=this.definitions.get(instance.spriteId);if(!s){this.warn('Unknown sprite '+instance.spriteId);continue;}
   if(instance.requiresSeen&&!this.seen.has(instance.id))continue;if(!instance.requiresSeen)this.seen.add(instance.id);
   let selected=instance.animation;const reaction=this.reactions.get(instance.id);
   if(reaction){const name=instance.reactions?.[reaction.animation]??reaction.animation,c=s.animations.find(c=>c.id===name),duration=c?(c.fps?c.frames.length*1000/c.fps:160):0;if(c&&this.clock-reaction.started<duration)selected=name;else this.reactions.delete(instance.id);}
   const animation=s.animations.find(c=>c.id===selected)?.id??s.defaultAnimation;let clip=this.clips.get(instance.id);if(!clip||clip.animation!==animation){clip={animation,started:this.clock};this.clips.set(instance.id,clip);}if(reaction&&this.reactions.has(instance.id))clip.started=reaction.started;live.add(instance.id);
   const cameraFacing=((Math.round(pose.angle/(Math.PI/2))%4)+4)%4,relative=(instance.facing-cameraFacing+6)%4,frame=s.frames[spriteFrameIndex(s,animation,reducedMotion?0:this.clock-clip.started,relative)],source=s.sources[frame.source],image=this.images.get(source.resourceId),size=image as {width?:number;height?:number}|undefined;
   let placeholder=!image||size?.width!==source.width||size?.height!==source.height,alpha:Uint8ClampedArray|null=null;
   if(!placeholder){alpha=this.alpha(image!,source.width,source.height);if(!alpha)placeholder=true;}
   if(placeholder){this.warn(s.id+': missing/unreadable image or dimensions differ for '+source.resourceId);if(s.fallback==='hide')continue;}
   const height=Math.min(H*3,H*instance.scale/depth),width=height*frame.width/frame.height,center=W*.5*(1+lateral/(depth*CAMERA_PLANE)),left=center-width*s.pivot.x,top=H/2+H*(.5+.16*(elevationAt(map,state,state.x,state.y)-elevationAt(map,state,instance.x,instance.y)))/depth-height*s.pivot.y;
   if(left>=W||left+width<=0||top>=H||top+height<=0)continue;
   const visible=Array<boolean>(W).fill(false);ctx.globalAlpha=(instance.opacity??1)*Math.max(.3,1-depth*.11);
   for(let x=Math.max(0,Math.floor(left));x<Math.min(W,Math.ceil(left+width));x++){
    const ray=rays[x];if(depth>=ray.distance-.008&&!(instance.allowOpaqueTarget&&ray.x===instance.x&&ray.y===instance.y))continue;visible[x]=true;
    if(placeholder){ctx.fillStyle=(Math.floor((x-left)/8)%2)?'#a459a1':'#443b54';ctx.fillRect(x,top,1,height);}
    else{const u=Math.max(0,Math.min(frame.width-1,Math.floor((x-left)/width*frame.width)));ctx.drawImage(image!,frame.x+u,frame.y,1,frame.height,x,top,1,height);}
   }ctx.globalAlpha=1;
   if(visible.some(Boolean))this.hits.push({instance,frame,source:alpha??undefined,sourceWidth:source.width,left,top,width,height,visible,placeholder});
  }
  for(const id of this.clips.keys())if(!live.has(id)){this.clips.delete(id);this.reactions.delete(id);}
 }
 /** Topmost opaque pixel wins; decorative sprites block click-through too. */
 hitTest(x:number,y:number):SpriteInstance['target']|null{
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=W||y<0||y>=H)return null;
  for(let i=this.hits.length-1;i>=0;i--){const h=this.hits[i],u=(x-h.left)/h.width,v=(y-h.top)/h.height;if(u<0||u>=1||v<0||v>=1||!h.visible[Math.floor(x)])continue;
   if(!h.placeholder){const px=h.frame.x+Math.min(h.frame.width-1,Math.floor(u*h.frame.width)),py=h.frame.y+Math.min(h.frame.height-1,Math.floor(v*h.frame.height));if((h.source?.[(py*h.sourceWidth+px)*4+3]??0)<16)continue;}
   const hot=h.instance.hotspot??{x:0,y:0,width:1,height:1};if(u<hot.x||v<hot.y||u>=hot.x+hot.width||v>=hot.y+hot.height)return null;
   return h.instance.target??null;
  }return null;
 }
 clear(){this.hits=[];}
}
