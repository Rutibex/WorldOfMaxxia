import {perceivedMap} from '../shared/project/perception-contracts.ts';
import {drawTerrain} from './terrain-layer.ts';
import {SpriteLayer} from './sprite-layer.ts';
import type {SpriteDefinition,SpriteInstance} from '../shared/project/sprite-contracts.ts';
import type Phaser from 'phaser';
import {DEFAULT_ENVIRONMENT,materialAt,resolveEnvironment,environmentResourceIds,type EnvironmentDatabase,type EnvironmentProfile} from '../shared/project/environments.ts';
import type {ResourceResolver} from '../shared/project/resources.ts';
import {TownEnvironment,type TownImages} from './town-environment.ts';
import {TOWN_TEXTURES} from './town-art.ts';
import {UPPER_TEXTURES,type UpperArtState} from './upper-art.ts';
import {UpperEnvironment,type UpperImages} from './upper-environment.ts';
import {VAULT_TEXTURES} from './vault-art.ts';
import {VaultEnvironment,type VaultImages} from './vault-environment.ts';
import {doorAt, type GridMap, type GridState} from '../shared/rules/grid.ts';
import {castRay, CAMERA_PLANE, scenerySlots, type ViewPose} from '../shared/rules/perspective.ts';
const W=440,H=280;
function canvas(w:number,h:number):HTMLCanvasElement{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function wallTexture(door:boolean):HTMLCanvasElement{
  const c=canvas(64,64),g=c.getContext('2d')!;g.fillStyle=door?'#493b2c':'#405056';g.fillRect(0,0,64,64);
  if(door){
    for(let x=0;x<64;x+=8){g.fillStyle=x%16?'#6b563a':'#786341';g.fillRect(x+1,0,6,64);g.fillStyle='#a38b53';g.fillRect(x+2,1,1,62);}
    g.fillStyle='#302e28';g.fillRect(0,12,64,6);g.fillRect(0,47,64,6);g.fillStyle='#b09c63';
    for(const y of [13,48])for(let x=5;x<64;x+=12)g.fillRect(x,y,2,2);
    g.strokeStyle='#cfb475';g.lineWidth=2;g.strokeRect(43,29,5,7);
  }else{
    for(let y=0;y<64;y+=16)for(let x=-16;x<64;x+=32){const shift=y%32?16:0;g.fillStyle=((x+y)%3===0)?'#4c5a5d':'#45545a';g.fillRect(x+shift+1,y+1,30,14);g.fillStyle='#68716b';g.fillRect(x+shift+1,y+1,30,1);g.fillStyle='#263840';g.fillRect(x+shift+1,y+14,30,1);}
    for(let i=0;i<84;i++){const x=(i*17+11)%64,y=(i*29+7)%64;g.fillStyle=i%3?'#72807533':'#0f222b33';g.fillRect(x,y,1,1);}
  }return c;
}
function sceneryTexture(kind:string):HTMLCanvasElement{
  const c=canvas(64,96),g=c.getContext('2d')!;g.imageSmoothingEnabled=false;
  g.fillStyle='#111e2399';g.beginPath();g.ellipse(32,88,24,5,0,0,Math.PI*2);g.fill();
  if(kind==='npc'){g.fillStyle='#b7a185';g.fillRect(25,21,15,18);g.fillStyle='#5e7e7c';g.fillRect(19,40,28,40);g.fillStyle='#263a41';g.fillRect(20,79,10,9);g.fillRect(36,79,10,9);g.fillStyle='#d4bc7f';g.fillRect(20,58,26,5);
  }else if(kind==='chest_closed'||kind==='chest_open'){
    g.fillStyle='#79543b';g.fillRect(9,52,46,34);g.fillStyle='#b29a62';g.fillRect(11,57,42,5);g.fillRect(17,52,5,34);g.fillRect(42,52,5,34);
    if(kind==='chest_open'){g.fillStyle='#513926';g.fillRect(10,30,44,18);g.fillStyle='#151a1b';g.fillRect(14,49,36,10);g.fillStyle='#e0c16c';g.fillRect(24,50,12,4);}else{g.fillStyle='#936c44';g.fillRect(10,42,44,15);g.fillStyle='#cab578';g.fillRect(29,57,7,10);}
  }else if(kind==='lever_off'||kind==='lever_on'){
    g.fillStyle='#6a7879';g.fillRect(17,69,30,18);g.fillStyle='#ac9d70';g.lineWidth=7;g.strokeStyle='#ac9d70';g.beginPath();g.moveTo(32,72);g.lineTo(kind==='lever_off'?18:46,38);g.stroke();g.fillStyle=kind==='lever_off'?'#b56b53':'#83b8a2';g.fillRect(kind==='lever_off'?12:40,31,12,12);
  }else if(kind==='marker'){g.fillStyle='#7d8580';g.fillRect(13,75,38,10);g.fillStyle='#b5bdac';g.fillRect(18,71,28,5);
  }else if(kind==='mirror'){
    g.fillStyle='#948b65';g.fillRect(13,13,38,66);g.fillStyle='#d0c28a';g.fillRect(16,10,32,7);g.fillStyle='#1c4d5d';g.fillRect(18,18,28,56);g.fillStyle='#70b4bd';
    for(let y=24;y<70;y+=10)g.fillRect(22,y,19,1);
    g.fillStyle='#a49c78';g.fillRect(10,79,44,5);g.fillRect(8,85,48,5);
    g.fillStyle='#e8d8a4';g.fillRect(30,29,4,23);g.fillRect(22,38,20,4);
  }else if(kind==='brazier'){
    g.fillStyle='#6f776b';g.fillRect(22,58,20,28);g.fillRect(16,86,32,4);g.fillStyle='#a79a6a';g.fillRect(14,50,36,8);g.fillStyle='#e7ad4d';g.fillRect(21,27,23,23);g.fillRect(26,17,12,15);g.fillStyle='#ffe7a1';g.fillRect(28,30,8,20);
  }else if(kind==='crystal'){
    g.fillStyle='#69766d';g.fillRect(18,77,28,12);g.fillStyle='#899583';g.fillRect(14,72,36,7);
    g.fillStyle='#89c6c1';g.beginPath();g.moveTo(32,15);g.lineTo(46,41);g.lineTo(32,65);g.lineTo(19,41);g.closePath();g.fill();g.fillStyle='#c7ecdc';g.beginPath();g.moveTo(32,15);g.lineTo(32,65);g.lineTo(19,41);g.closePath();g.fill();
  }else{
    g.fillStyle='#948264';g.fillRect(29,8,4,78);g.fillRect(9,14,46,3);g.fillStyle='#6e5669';g.fillRect(14,17,36,52);g.fillStyle='#cdbb89';g.fillRect(29,28,5,23);g.fillRect(20,37,23,5);g.fillRect(22,65,20,4);g.fillStyle='#7c8778';g.fillRect(22,85,20,4);
  }return c;
}
/** Wall pass owns occlusion; reusable scenery layers project through its depth buffer. */
export class PerspectiveRenderer {
  private texture: Phaser.Textures.CanvasTexture;
  private context: CanvasRenderingContext2D;
  private wall=wallTexture(false);private door=wallTexture(true);
  private props=new Map<string,HTMLCanvasElement>();
  private environmentProfiles:Map<string,EnvironmentProfile>;
  private environmentImages=new Map<string,CanvasImageSource>();
  private spriteLayers=new Map<string,SpriteLayer>();private activeSpriteLayer?:SpriteLayer;
  private painters=new Map<string,TownEnvironment|UpperEnvironment|VaultEnvironment>();
  constructor(private scene:Phaser.Scene,environments:EnvironmentDatabase={format:'maxxia-environments',version:1,profiles:[DEFAULT_ENVIRONMENT]},resolver:ResourceResolver|null=null){
    this.environmentProfiles=new Map(environments.profiles.map(p=>[p.id,p]));
    const ids=new Set(environments.profiles.flatMap(environmentResourceIds));
    for(const id of ids){if(resolver&&!resolver.byId.has(id))throw new Error(`Environment asset missing: ${id}`);const texture=scene.textures.get(`environment-${id}`);const image=texture.getSourceImage() as HTMLImageElement|HTMLCanvasElement;this.environmentImages.set(id,image);}
    const texture=scene.textures.createCanvas('world-view',W,H);if(!texture)throw new Error('Unable to create viewport texture.');
    this.texture=texture;this.context=texture.context;
    scene.add.image(8,8,'world-view').setOrigin(0);
    const frame=scene.add.graphics();frame.lineStyle(2,0x827c60);frame.strokeRect(7,7,442,282);frame.lineStyle(1,0x171f24);frame.strokeRect(4,4,448,288);
    for(const k of ['mirror','brazier','crystal','banner','chest_closed','chest_open','lever_off','lever_on','marker','npc'])this.props.set(k,sceneryTexture(k));
  }
  private drawGround(map:GridMap,state:GridState,pose:ViewPose,art?:UpperArtState):void{
    const ctx=this.context,fx=Math.sin(pose.angle),fy=-Math.cos(pose.angle),rx=Math.cos(pose.angle),ry=Math.sin(pose.angle),depths=new Float64Array(W);
    const piles=(art?.ground??[]).filter(c=>c.mapId===map.id).map(c=>{const dx=c.x+.5-pose.x,dy=c.y+.5-pose.y;return {...c,depth:dx*fx+dy*fy,lateral:dx*rx+dy*ry};}).filter(c=>c.depth>.2&&c.depth<4.5).sort((a,b)=>b.depth-a.depth);
    if(!piles.length)return;for(let x=0;x<W;x++){const side=2*(x+.5)/W-1;depths[x]=castRay(map,state,pose.x,pose.y,fx+rx*CAMERA_PLANE*side,fy+ry*CAMERA_PLANE*side).distance;}
    for(const c of piles){const key=c.corpse?'ground-corpse':'ground-'+c.definitionId;if(!this.scene.textures.exists(key))continue;const image=this.scene.textures.get(key).getSourceImage() as HTMLImageElement,size=c.corpse?.48:.22,height=H*size/c.depth,width=height,left=W*.5*(1+c.lateral/(c.depth*CAMERA_PLANE))-width/2,top=H/2+H/(2*c.depth)-height;ctx.globalAlpha=(c.empty?.42:1)*Math.max(.4,1-c.depth*.1);for(let x=Math.max(0,Math.floor(left));x<Math.min(W,Math.ceil(left+width));x++){if(c.depth>=depths[x]-.008)continue;const u=Math.max(0,Math.min(image.width-1,Math.floor((x-left)/width*image.width)));ctx.drawImage(image,u,0,1,image.height,x,top,1,height);}ctx.globalAlpha=1;}
  }
  private drawSprites(map:GridMap,state:GridState,pose:ViewPose,time:number,profile:EnvironmentProfile,instances:readonly SpriteInstance[],art:UpperArtState|undefined,paused:boolean,reduced:boolean):void{
    let layer=this.spriteLayers.get(profile.id);
    if(!layer){
      const definitions=new Map((profile.sprites??[]).map(s=>[s.id,s])),images=new Map(this.environmentImages);
      for(const [kind,image]of this.props){const id='fallback_'+kind,resourceId='procedural_'+kind;definitions.set(id,{id,sources:[{resourceId,width:64,height:96}],frames:[{source:0,x:0,y:0,width:64,height:96}],pivot:{x:.5,y:1},animations:[{id:'idle',frames:[0],fps:0,loop:false}],defaultAnimation:'idle',fallback:'placeholder'});images.set(resourceId,image);}
      layer=new SpriteLayer(definitions,images);this.spriteLayers.set(profile.id,layer);
    }
    // Original legacy scenery is painted by its compatibility adapter. New presets share fallback props.
    const props:SpriteInstance[]=profile.scene?.legacyScenery?[]:map.props.map(p=>({id:'prop:'+p.id,spriteId:'fallback_'+p.kind,x:p.x,y:p.y,scale:.82,facing:0}));
    const ground:SpriteInstance[]=[];
    for(const c of (art?.ground??[]).filter(c=>c.mapId===map.id)){
      const key=c.corpse?'ground-corpse':'ground-'+c.definitionId;if(!this.scene.textures.exists(key))continue;const image=this.scene.textures.get(key).getSourceImage() as HTMLImageElement,id='pile_'+key;
      layer.define({id,sources:[{resourceId:key,width:image.width,height:image.height}],frames:[{source:0,x:0,y:0,width:image.width,height:image.height}],pivot:{x:.5,y:1},animations:[{id:'idle',frames:[0],fps:0,loop:false}],defaultAnimation:'idle',fallback:'hide'},[[key,image]]);
      ground.push({id:'ground:'+c.id,spriteId:id,x:c.x,y:c.y,scale:c.corpse?.48:.22,facing:0,opacity:c.empty?.42:1});
    }
    layer.render(this.context,map,state,pose,time,[...props,...ground,...instances],paused,reduced);this.activeSpriteLayer=layer;
  }
  present(events:readonly {actorId:string;targetIds:string[];hit?:boolean;family?:string}[]):void{for(const event of events){if(['heal','guard','block','cure','revive','ward'].includes(event.family??''))continue;this.activeSpriteLayer?.react(event.actorId,'attack');if(event.hit)for(const id of event.targetIds)this.activeSpriteLayer?.react(id,'hurt');}}
  hitTest(x:number,y:number):SpriteInstance['target']|null{return this.activeSpriteLayer?.hitTest(x,y)??null;}
  get spriteDiagnostics():readonly string[]{return this.activeSpriteLayer?.diagnostics??[];}
  render(map:GridMap,state:GridState,pose:ViewPose,time:number,art?:UpperArtState,instances:readonly SpriteInstance[]=[],paused=false,reducedMotion=false):void{
    map=perceivedMap(map,state);
    const ctx=this.context;ctx.imageSmoothingEnabled=false;this.activeSpriteLayer?.clear();this.activeSpriteLayer=undefined;
    const authored=!!(map.perception||map.terrain||map.spritePlacements?.length||map.enemyAppearances?.length);
    if(authored)map={...map,props:map.props.filter(p=>!map.spritePlacements?.some(s=>s.propId===p.id))};
    const profile=resolveEnvironment(map,this.environmentProfiles);
    if(profile.scene){
      let painter=this.painters.get(profile.id);const layout=profile.scene;
      if(!painter){
        const images=(keys:readonly string[],prefix:string)=>Object.fromEntries(keys.map(k=>[k,layout.textures?.[k]?this.environmentImages.get(layout.textures[k])!:this.scene.textures.get(`${prefix}-${k}`).getSourceImage()]));
        painter=layout.renderer==='courtyard'?new TownEnvironment(images(TOWN_TEXTURES,'town') as TownImages,undefined,layout):layout.renderer==='waterworks'?new UpperEnvironment(images(UPPER_TEXTURES,'upper') as UpperImages,undefined,layout):new VaultEnvironment(images(VAULT_TEXTURES,'vault') as VaultImages,undefined,layout);
        this.painters.set(profile.id,painter);
      }
      // All painters consume the same immutable geometry/camera and art snapshot.
      painter.render(ctx,map,state,pose,art,time);
      drawTerrain(ctx,map,state,pose);
      if(authored)this.drawSprites(map,state,pose,time,profile,instances,art,paused,reducedMotion);else this.drawGround(map,state,pose,art);
      if(layout.tintStrength){ctx.globalAlpha=layout.tintStrength;ctx.fillStyle=layout.tintColor!;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
      this.texture.refresh();return;
    }
    const mats=new Map(profile.materials.map(m=>[m.id,m]));
    const textureAt=(surface:'floor'|'wall'|'ceiling',x:number,y:number)=>{
      const id=map.materials?materialAt({materials:map.materials},surface,x,y):`material_${surface}_default`;
      const material=mats.get(id);return material?.resourceId?this.environmentImages.get(material.resourceId):undefined;
    };
    const fx=Math.sin(pose.angle),fy=-Math.cos(pose.angle),rx=Math.cos(pose.angle)*CAMERA_PLANE,ry=Math.sin(pose.angle)*CAMERA_PLANE;
    ctx.fillStyle=profile.skyColor;ctx.fillRect(0,0,W,H/2);
    const sky=profile.skyResourceId&&this.environmentImages.get(profile.skyResourceId);
    if(sky)ctx.drawImage(sky,0,0,W,H/2);
    for(let y=H/2+1;y<H;y+=2){
      const d=H/(2*(y-H/2)),light=Math.max(.12,1/(1+d*.17));
      for(let x=0;x<W;x+=2){const side=2*x/W-1,wx=pose.x+d*(fx+rx*side),wy=pose.y+d*(fy+ry*side);
        const u=wx-Math.floor(wx),v=wy-Math.floor(wy),mortar=u<.025||v<.025;
        const check=(Math.floor(wx)+Math.floor(wy))%2===0;const base=mortar?32:check?82:73;
        const floorImage=textureAt('floor',Math.floor(wx),Math.floor(wy));
        if(floorImage){const src=floorImage as {width:number;height:number};ctx.drawImage(floorImage,Math.min(src.width-1,Math.floor(u*src.width)),Math.min(src.height-1,Math.floor(v*src.height)),1,1,x,y,2,2);ctx.fillStyle=`rgba(4,15,24,${1-light})`;ctx.fillRect(x,y,2,2);}
        else{ctx.fillStyle=`rgb(${Math.floor(base*.82*light)},${Math.floor(base*light)},${Math.floor(base*1.06*light)})`;ctx.fillRect(x,y,2,2);}
        const ceilImage=textureAt('ceiling',Math.floor(wx),Math.floor(wy));
        if(ceilImage){const src=ceilImage as {width:number;height:number};ctx.drawImage(ceilImage,Math.min(src.width-1,Math.floor(u*src.width)),Math.min(src.height-1,Math.floor(v*src.height)),1,1,x,H-1-y,2,2);ctx.fillStyle=`rgba(4,15,24,${1-light})`;ctx.fillRect(x,H-1-y,2,2);}
        else{const ceil=Math.floor((mortar?23:41)*light);ctx.fillStyle=`rgb(${ceil},${ceil+8},${ceil+13})`;ctx.fillRect(x,H-1-y,2,2);}
      }
    }
    const depths=new Float64Array(W);
    for(let x=0;x<W;x++){
      const camera=2*(x+.5)/W-1,hit=castRay(map,state,pose.x,pose.y,fx+rx*camera,fy+ry*camera);
      depths[x]=hit.distance;const height=H/hit.distance,top=(H-height)/2;
      const isDoor=!!doorAt(map,hit.x,hit.y);
      const tex=isDoor?undefined:textureAt('wall',hit.x,hit.y);
      const img=(tex??(isDoor?this.door:this.wall)) as {width:number;height:number}&CanvasImageSource;
      ctx.drawImage(img,Math.min(img.width-1,Math.floor(hit.u*img.width)),0,1,img.height,x,top,1,height);
      const darkness=Math.min(.87,(hit.side===1?.18:0)+hit.distance*profile.fogStrength);ctx.fillStyle=`rgba(${parseInt(profile.fogColor.slice(1,3),16)},${parseInt(profile.fogColor.slice(3,5),16)},${parseInt(profile.fogColor.slice(5,7),16)},${darkness})`;ctx.fillRect(x,top,1,height);
    }
    for(const slot of authored?[]:scenerySlots(map,pose)){
      const sprite=this.props.get(slot.kind)!;const height=Math.min(H*3,H*.82/slot.depth),width=height*2/3;
      const left=slot.screenX*W-width/2,top=H/2+H/(2*slot.depth)-height;
      for(let x=Math.max(0,Math.floor(left));x<Math.min(W,Math.ceil(left+width));x++){
        if(slot.depth>=depths[x]-.01)continue;
        const u=Math.max(0,Math.min(63,Math.floor((x-left)/width*64)));ctx.globalAlpha=Math.max(.3,1-slot.depth*.11);
        ctx.drawImage(sprite,u,0,1,96,x,top,1,height);
      }ctx.globalAlpha=1;
    }
    if(!profile.scene)drawTerrain(ctx,map,state,pose);
    if(authored)this.drawSprites(map,state,pose,time,profile,instances,art,paused,reducedMotion);
    ctx.fillStyle=`rgba(209,167,83,${.015+.006*Math.sin(time/270)})`;ctx.fillRect(0,0,W,H);
    this.texture.refresh();
  }
}
