import {projectEnemies,type EnemyProjection,ENEMY_VIEW_WIDTH,ENEMY_VIEW_HEIGHT} from './enemy-projection.ts';
import {viewPose,type ViewPose} from '../shared/rules/perspective.ts';
import type {GridMap,GridState} from '../shared/rules/grid.ts';
import {SPELLS} from '../shared/rules/magic.ts';
import type {PresentationEvent} from '../shared/rules/presentation.ts';
import {ANIMATED_ENEMY_ATLASES,DUST_IMP,animationClip,clipFrame,clipDuration,type AnimationName,type EnemyAtlas} from './art-production.ts';
import type {EnemyState} from '../shared/rules/combat.ts';
import {ENEMY_KINDS} from '../shared/rules/combat.ts';
import type {CampaignState} from '../shared/rules/campaign.ts';
import {feedbackArt,feedbackCuesFromMessages,type FeedbackCue} from './phase30-art.ts';
import {EFFECT_ATLASES,effectFrame,effectDuration,plannedEffectsFromMessages,changedEnemyIds,changedAllyIds,type EffectKind,effectsForEvent} from './spell-effects.ts';
import {IMPACT_ATLASES,impactFrame,impactDuration,plannedImpactBursts,type ImpactKind} from './status-effects.ts';
interface Actor {enemy:EnemyState;node:HTMLDivElement;canvas?:HTMLCanvasElement;name:HTMLElement;bar:HTMLElement;phase?:HTMLElement;atlas:EnemyAtlas;image?:HTMLImageElement;specialImage?:HTMLImageElement;queue:AnimationName[];clip:AnimationName;started:number;dead:boolean;dying?:boolean;lastFrame:number;lastAsset?:HTMLImageElement;projection?:EnemyProjection;projectionDirty?:boolean;}
interface FloatingFeedback{id:number;node:HTMLDivElement;started:number;duration:number;lane:number;cue:FeedbackCue;}
interface EffectSprite{id:number;kind:EffectKind;node:HTMLDivElement;sprite:HTMLDivElement;started:number;duration:number;from:{x:number;y:number};to:{x:number;y:number};mode:'missile'|'burst';targetId?:string;}
interface ImpactSprite{id:number;kind:ImpactKind;node:HTMLDivElement;sprite:HTMLDivElement;started:number;duration:number;at:{x:number;y:number};targetId?:string;}
/**
 * Combat presentation layer only. Enemy sheets, feedback icons, and Phase 30.2A
 * spell/missile effects never modify campaign rules, timing, saves, or AI logic.
 */
export class CombatArt {
 private actors=new Map<string,Actor>();private images=new Map<string,HTMLImageElement>();private specialImages=new Map<string,HTMLImageElement>();private feedbackImages=new Map<string,HTMLImageElement>();
 private pending=new Map<string,AnimationName[]>();private mapId='';private feedbacks:FloatingFeedback[]=[];private feedbackSerial=0;
 private effectSprites:EffectSprite[]=[];private effectSerial=0;private effectImages=new Map<EffectKind,HTMLImageElement>();
 private impactSprites:ImpactSprite[]=[];private impactSerial=0;
 private reactions:{id:string;clip:AnimationName;at:number}[]=[];
 private portraitLayer:HTMLDivElement;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 private stage:HTMLElement;private feedbackLayer:HTMLDivElement;private effectLayer:HTMLDivElement;private impactLayer:HTMLDivElement;
 constructor(stage:HTMLElement){
  this.stage=stage;this.portraitLayer=document.createElement('div');this.portraitLayer.className='portrait-vfx-layer';this.feedbackLayer=document.createElement('div');this.feedbackLayer.className='combat-feedback-layer';
  this.effectLayer=document.createElement('div');this.effectLayer.className='combat-effect-layer';
  this.impactLayer=document.createElement('div');this.impactLayer.className='combat-impact-layer';
  for(const [kind,atlas] of Object.entries(ANIMATED_ENEMY_ATLASES)){
   const image=new Image();image.src=atlas.url;this.images.set(kind,image);
   if(atlas.special){const special=new Image();special.src=atlas.special.url;this.specialImages.set(kind,special);}
  }
  for(const icon of ['attack','miss','guard','run','heal','cure','revive','arcane','fire','cold','lightning','holy','poison','necrotic','ward','debuff','bind','sleep','special'] as const){
   const image=new Image();image.src=feedbackArt(icon);this.feedbackImages.set(icon,image);
  }
  for(const [kind,atlas] of Object.entries(EFFECT_ATLASES) as [EffectKind,(typeof EFFECT_ATLASES)[EffectKind]][]){
   const image=new Image();image.src=atlas.url;this.effectImages.set(kind,image);
  }
 }
 private ensureLayer(layer:HTMLElement):void{
  const parent=((layer as unknown as {parentElement?:HTMLElement|null;parent?:HTMLElement|null}).parentElement)??((layer as unknown as {parent?:HTMLElement|null}).parent);
  if(parent!==this.stage)this.stage.append(layer);
 }
 private resetFeedback():void{for(const feedback of this.feedbacks)feedback.node.remove();this.feedbacks=[];this.feedbackLayer.replaceChildren();}
 private resetEffects():void{for(const fx of this.effectSprites)fx.node.remove();this.effectSprites=[];this.effectLayer.replaceChildren();}
 private resetImpacts():void{for(const fx of this.impactSprites)fx.node.remove();this.impactSprites=[];this.impactLayer.replaceChildren();}
 reset():void{this.actors.clear();this.pending.clear();this.reactions=[];this.portraitLayer.replaceChildren();this.portraitLayer.remove();this.resetFeedback();this.resetEffects();this.resetImpacts();this.stage.replaceChildren();this.stage.hidden=true;}
 private anchor(slot:number,distance=2):{x:number;y:number}{
  const xs=[24,50,76],ys=[62,56,62];const x=xs[Math.max(0,Math.min(xs.length-1,slot))]??50;const y=(ys[Math.max(0,Math.min(ys.length-1,slot))]??58)-(distance===1?8:distance===3?-4:0);return {x,y};
 }
 private actorAnchor(enemyId:string):{x:number;y:number}{
  const actor=this.actors.get(enemyId);if(!actor)return {x:50,y:56};
  if(actor.projection)return {x:actor.projection.centerX/ENEMY_VIEW_WIDTH*100,y:(actor.projection.top+actor.projection.height*.52)/ENEMY_VIEW_HEIGHT*100};
  return this.anchor(Number(actor.node.dataset.slot||1),Number(actor.node.dataset.distance||2));
 }
 private partyAnchor(index=1):{x:number;y:number}{return {x:8+Math.max(0,Math.min(5,index))*16.8,y:84};}
 private portraitPosition(id:string):{x:number;y:number}|null {const buttons=document.querySelectorAll?.<HTMLElement>('.portrait-slot');const node=buttons?Array.from(buttons).find(v=>v.dataset.characterId===id):undefined;const r=node?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null;}
 private placePortrait(node:HTMLElement,id?:string):boolean {if(!id)return false;const pos=this.portraitPosition(id);if(!pos)return false;node.style.left=`${pos.x}px`;node.style.top=`${pos.y}px`;return true;}
 private spawnFeedback(messages:readonly string[]):void{
  const cues=feedbackCuesFromMessages([...messages]);if(!cues.length)return;const now=performance.now();this.ensureLayer(this.feedbackLayer);
  for(const cue of cues){
   const node=document.createElement('div');node.className='combat-feedback';node.dataset.emphasis=cue.emphasis??'neutral';
   const img=document.createElement('img');img.className='combat-feedback-art';img.src=this.feedbackImages.get(cue.icon)?.src??feedbackArt(cue.icon);img.alt='';img.decoding='async';
   const label=document.createElement('span');label.className='combat-feedback-label';label.textContent=cue.label;
   node.append(img,label);this.feedbackLayer.append(node);
   this.feedbacks.push({id:++this.feedbackSerial,node,started:now,duration:850,lane:(this.feedbackSerial-1)%3,cue});
   while(this.feedbacks.length>8){const old=this.feedbacks.shift();old?.node.remove();}
  }
 }
 private spawnEffect(kind:EffectKind,from:{x:number;y:number},to:{x:number;y:number},delay=0,targetId?:string):void{
  this.ensureLayer(this.effectLayer);
  const atlas=EFFECT_ATLASES[kind],node=document.createElement('div');node.className=`combat-effect effect-${atlas.mode}`;node.dataset.kind=kind;
  const sprite=document.createElement('div');sprite.className='combat-effect-sprite';sprite.style.width=`${atlas.cell}px`;sprite.style.height=`${atlas.cell}px`;sprite.style.backgroundImage=`url(${atlas.url})`;sprite.style.backgroundRepeat='no-repeat';sprite.style.backgroundSize=`${atlas.cell*atlas.frames}px ${atlas.cell}px`;
  node.append(sprite);if(targetId&&document.body){document.body.append(this.portraitLayer);this.portraitLayer.append(node);}else this.effectLayer.append(node);node.style.opacity='0';
  while(this.effectSprites.length>=36){this.effectSprites.shift()?.node.remove();}
  this.effectSprites.push({id:++this.effectSerial,kind,node,sprite,started:performance.now()+delay,duration:atlas.mode==='missile'?240:effectDuration(kind),from,to,mode:atlas.mode,targetId});
 }
 private spawnImpact(kind:ImpactKind,at:{x:number;y:number},delay=0,targetId?:string):void{
  this.ensureLayer(this.impactLayer);
  const atlas=IMPACT_ATLASES[kind],node=document.createElement('div');node.className='combat-impact';node.dataset.kind=kind;
  const sprite=document.createElement('div');sprite.className='combat-impact-sprite';sprite.style.width=`${atlas.cell}px`;sprite.style.height=`${atlas.cell}px`;sprite.style.backgroundImage=`url(${atlas.url})`;sprite.style.backgroundRepeat='no-repeat';sprite.style.backgroundSize=`${atlas.cell*atlas.frames}px ${atlas.cell}px`;
  node.append(sprite);if(targetId&&document.body){document.body.append(this.portraitLayer);this.portraitLayer.append(node);}else this.impactLayer.append(node);node.style.opacity='0';
  while(this.impactSprites.length>=36){this.impactSprites.shift()?.node.remove();}
  this.impactSprites.push({id:++this.impactSerial,kind,node,sprite,started:performance.now()+delay,duration:impactDuration(kind),at,targetId});
 }
 private spawnPlannedImpacts(before:CampaignState,after:CampaignState,messages:readonly string[]):void{
  const plans=plannedImpactBursts(before,after,messages);if(!plans.length)return;
  for(const plan of plans){
   for(const id of plan.enemyIds){this.spawnImpact(plan.kind,this.actorAnchor(id));}
   for(const [i,id] of plan.allyIds.slice(0,3).entries()){void id;this.spawnImpact(plan.kind,this.partyAnchor(i));}
  }
 }
 private spawnPlannedEffects(before:CampaignState,after:CampaignState,messages:readonly string[]):void{
  const plans=plannedEffectsFromMessages(messages);if(!plans.length)return;
  const enemies=changedEnemyIds(before,after);const allies=changedAllyIds(before,after);
  for(const plan of plans){
   if(plan.scope==='enemy'){
    const id=enemies[0]??[...this.actors.keys()][0];if(!id)continue;
    const target=this.actorAnchor(id),from=plan.role==='missile'?this.partyAnchor(1):target;
    this.spawnEffect(plan.kind,from,target);
   }else if(plan.scope==='enemies'){
    const ids=enemies.length?enemies:[...this.actors.keys()].slice(0,3);
    if(!ids.length){this.spawnEffect(plan.kind,{x:50,y:42},{x:50,y:42});continue;}
    for(const id of ids){const target=this.actorAnchor(id);this.spawnEffect(plan.kind,plan.role==='missile'?this.partyAnchor(1):target,target);}
   }else if(plan.scope==='party'){
    const ids=allies.length?allies:['party-1','party-2','party-3'];
    ids.slice(0,3).forEach((_,i)=>{const pos=this.partyAnchor(i);this.spawnEffect(plan.kind,pos,pos);});
   }else if(plan.scope==='self'){
    const pos=this.partyAnchor(1);this.spawnEffect(plan.kind,pos,pos);
   }else this.spawnEffect(plan.kind,{x:50,y:48},{x:50,y:48});
  }
 }
 private presentEvents(before:CampaignState,after:CampaignState,events:readonly PresentationEvent[]):void {
  const now=performance.now();let offset=0;
  for(const event of events){
   const plans=effectsForEvent(event),missile=plans.some(p=>p.role==='missile'),arrival=offset+(missile&&!this.reduced.matches?240:0);
   const source=this.actors.has(event.actorId)?this.actorAnchor(event.actorId):this.partyAnchor(before.party.order.indexOf(event.actorId));
   const family=(['physical','fire','cold','lightning','poison','arcane','holy','necrotic','heal','guard'].includes(event.family)?event.family:'physical') as ImpactKind;
   for(const id of event.targetIds){
    const ally=!!after.party.characters[id];if(!ally&&this.actors.get(id)?.node.hidden)continue;const target=ally?this.partyAnchor(after.party.order.indexOf(id)):this.actorAnchor(id);
    for(const plan of plans){
     if(plan.scope==='center'){if(id!==event.targetIds[0])continue;this.spawnEffect(plan.kind,{x:50,y:48},{x:50,y:48},offset);continue;}
     this.spawnEffect(plan.kind,plan.role==='missile'?source:target,target,plan.role==='missile'?offset:arrival,ally?id:undefined);
    }
    // A missed shot still travels, but never flashes as a successful hit.
    if(event.hit!==false){
     if(!event.spellId||['damage','leech','turn_undead','bind','sleep','bones','echo','attack_debuff'].includes(SPELLS[event.spellId]?.effect))this.spawnImpact(event.guarded?'guard':family,target,arrival,ally?id:undefined);
     if(!ally){const old=Object.values(before.combat.encounters).flatMap(e=>e.enemies).find(e=>e.id===id),next=Object.values(after.combat.encounters).flatMap(e=>e.enemies).find(e=>e.id===id);if(old&&next&&next.hp<old.hp){const lastHit=events.filter(e=>e.hit!==false&&e.targetIds.includes(id)).at(-1)===event;const clip=next.hp<=0&&lastHit?'death':'hurt';this.reactions.push({id,clip,at:now+arrival});if(clip==='death'){const actor=this.actors.get(id);if(actor)actor.dying=true;}}}
    }else if(event.guarded)this.spawnImpact('guard',target,arrival,ally?id:undefined);
   }
   if(this.actors.has(event.actorId))this.reactions.push({id:event.actorId,clip:'attack',at:now+offset});
   offset+=90;
  }
 }
 observe(before:CampaignState,after:CampaignState,messages:readonly string[],events?:readonly PresentationEvent[]):void{
  if(before.currentMapId!==after.currentMapId){this.reset();this.mapId=after.currentMapId;if(events)this.presentEvents(after,after,events);return;}
  if(messages.length)this.spawnFeedback(messages);
  if(events!==undefined)this.presentEvents(before,after,events);
  else if(messages.length){this.spawnPlannedEffects(before,after,messages);this.spawnPlannedImpacts(before,after,messages);}
  const specials:AnimationName[]=[];
  for(const line of messages){
   if(line.startsWith('BELL-HEART TELEGRAPH'))specials.push('telegraph');
   else if(line.startsWith('The Bell-Heart Custodian releases a thunderous resonant wave!'))specials.push('discharge');
   else if(line.startsWith('The Custodian cools and exposes its regulator core.'))specials.push('recovery');
  }
  for(const e of Object.values(before.combat.encounters).filter(e=>e.mapId===before.currentMapId))for(const old of e.enemies){
   const next=after.combat.encounters[e.id]?.enemies.find(v=>v.id===old.id);if(!next||old.hp<=0)continue;
   const actor=this.actors.get(old.id),name=ENEMY_KINDS[old.kindId].name;
   const clips:AnimationName[]=[];
   if(ENEMY_KINDS[old.kindId]?.aiPattern==='resonance')clips.push(...specials);
   if(events===undefined&&messages.some(m=>m.startsWith(`${name} hits `)||m.startsWith(`${name} misses `)))clips.push('attack');
   if(arguments.length<4&&next.hp<old.hp)clips.push(next.hp<=0?'death':'hurt');
   if(actor){for(const event of clips)this.enqueue(actor,event);}
   else if(clips.length)this.pending.set(old.id,[...(this.pending.get(old.id)??[]),...clips]);
  }
 }
 private enqueue(a:Actor,clip:AnimationName,interrupt=false):void{
  if(clip==='death'){
   a.dead=true;a.queue=[];
   if(interrupt||a.clip==='idle'||a.atlas.special){a.clip='death';a.started=performance.now();a.lastFrame=-1;}else a.queue.push('death');
   return;
  }
  if(a.dead)return;
  if(a.clip==='idle'){a.clip=clip;a.started=performance.now();a.lastFrame=-1;}
  else{if(a.queue.length>=6)a.queue.shift();a.queue.push(clip);}
 }
 sync(enemies:readonly EnemyState[],selected:string|null,mapId:string,view?:{x:number;y:number;facing:number},spatial?:{map:GridMap;state:GridState;pose:ViewPose}):void{
  if(this.mapId!==mapId){const pending=new Map([...this.pending].filter(([id])=>enemies.some(e=>e.id===id)));this.reset();this.pending=pending;this.mapId=mapId;}
  const ids=new Set(enemies.map(e=>e.id));
  const candidates=[...enemies,...[...this.actors.values()].filter(a=>(a.dead||a.dying)&&!ids.has(a.enemy.id)).map(a=>a.enemy)];
  const projections=spatial?projectEnemies(spatial.map,spatial.state,spatial.pose,candidates):undefined;
  for(const [id,a] of this.actors)if(!ids.has(id)&&!a.dead&&!a.dying){a.node.remove();this.actors.delete(id);}
  enemies.forEach((enemy,slot)=>{
   let a=this.actors.get(enemy.id);const kind=ENEMY_KINDS[enemy.kindId],atlas=ANIMATED_ENEMY_ATLASES[kind.visualId];
   if(!a){
    const node=document.createElement('div');node.className='combat-foe';node.dataset.kind=kind.id;node.dataset.enemyId=enemy.id;
    let canvas:HTMLCanvasElement|undefined;
    if(atlas){canvas=document.createElement('canvas');canvas.width=atlas.cell;canvas.height=atlas.cell;canvas.className='foe-sprite';canvas.setAttribute('aria-hidden','true');node.dataset.animated='true';node.append(canvas);}
    else{const glyph=document.createElement('span');glyph.className='foe-glyph';glyph.textContent=kind.symbol;node.append(glyph);}
    const name=document.createElement('span');name.className='foe-name';name.textContent=kind.name;
    const health=document.createElement('span');health.className='foe-health';const bar=document.createElement('i');health.append(bar);node.append(name,health);
    let phase:HTMLElement|undefined;if(atlas?.special){phase=document.createElement('span');phase.className='foe-phase';phase.hidden=true;node.append(phase);}this.stage.append(node);
    a={enemy:{...enemy},node,canvas,name,bar,phase,atlas:atlas??DUST_IMP,image:this.images.get(kind.visualId),specialImage:this.specialImages.get(kind.visualId),queue:[],clip:'idle',started:performance.now(),dead:false,lastFrame:-1};this.actors.set(enemy.id,a);
    for(const event of this.pending.get(enemy.id)??[])this.enqueue(a,event);this.pending.delete(enemy.id);
   }
   a.enemy={...enemy};a.node.dataset.slot=String(slot);
   if(!spatial&&atlas&&view){const dx=enemy.x-view.x,dy=enemy.y-view.y;const forward=[-dy,dx,dy,-dx][view.facing]??1;const distance=Math.max(1,Math.min(3,forward>0?forward:Math.abs(dx)+Math.abs(dy)));const scale=distance===1?1:distance===2?.85:.7;a.node.style.transform=`scale(${scale})`;a.node.style.transformOrigin='center bottom';a.node.dataset.distance=String(distance);}
   a.node.dataset.selected=String(enemy.id===selected);a.node.setAttribute('aria-label',`${kind.name}, ${enemy.hp} of ${kind.hp} hit points`);a.bar.style.width=`${Math.max(0,enemy.hp)/kind.hp*100}%`;
  });
  if(projections)for(const [id,a] of this.actors){const projection=projections.get(id);a.projection=projection;a.projectionDirty=true;a.node.hidden=!projection;if(!projection)continue;const g=a.node.style;a.node.dataset.projected='true';a.node.dataset.distance=projection.depth.toFixed(3);g.left=`${projection.left/ENEMY_VIEW_WIDTH*100}%`;g.top=`${projection.top/ENEMY_VIEW_HEIGHT*100}%`;g.width=`${projection.width/ENEMY_VIEW_WIDTH*100}%`;g.height=`${projection.height/ENEMY_VIEW_HEIGHT*100}%`;g.zIndex=String(1000-Math.round(projection.depth*100));g.transform='none';a.name.hidden=!projection.centerVisible;const labelTop=Math.min(projection.height*.96,ENEMY_VIEW_HEIGHT-projection.top-24);a.name.style.top=`${labelTop/projection.height*100}%`;const health=a.bar.parentElement??(a.bar as unknown as {parent?:HTMLElement}).parent;if(health){health.hidden=!projection.centerVisible;health.style.top=`${(labelTop+14)/projection.height*100}%`;}}
  this.stage.hidden=this.actors.size===0&&this.feedbacks.length===0&&this.effectSprites.length===0&&this.impactSprites.length===0;
 }
 update(now:number,paused=false):void{
  for(const reaction of [...this.reactions])if(now>=reaction.at){const actor=this.actors.get(reaction.id);if(actor)this.enqueue(actor,reaction.clip,true);this.reactions=this.reactions.filter(v=>v!==reaction);}
  for(const [id,a] of this.actors){
   const reduced=this.reduced.matches||paused,duration=clipDuration(a.clip,a.atlas);
   if(a.clip!=='idle'&&now-a.started>=duration){if(a.clip==='death'){a.node.remove();this.actors.delete(id);continue;}a.clip=a.queue.shift()??'idle';a.started=now;a.lastFrame=-1;}
   const frame=clipFrame(animationClip(a.atlas,a.clip),now-a.started,reduced);a.node.dataset.clip=a.clip;
   const distance=Number(a.node.dataset.distance||1),base=distance===1?1:distance===2?.85:.7;const t=Math.max(0,Math.min(1,(now-a.started)/Math.max(1,duration)));let x=0,y=0,sx=1,sy=1;
   if(!reduced){const wave=Math.sin(Math.PI*t);if(a.clip==='attack'){y=-12*wave;sx+=.12*wave;sy+=.09*wave;}else if(a.clip==='hurt'){x=7*wave;sy-=.06*wave;}else if(a.clip==='death'){y=12*t;sy-=.22*t;}else if(a.clip==='telegraph'){y=-4*wave;sx+=.08*t;sy+=.07*t;}else if(a.clip==='discharge'){y=-15*wave;sx+=.16*wave;sy+=.13*wave;}else if(a.clip==='recovery'){y=5*wave;sy-=.08*wave;}else y=-1.5*Math.sin(2*Math.PI*t);}
   if(!a.projection)a.node.style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(base*sx).toFixed(3)},${(base*sy).toFixed(3)})`;
   const isSpecial=a.clip==='telegraph'||a.clip==='discharge'||a.clip==='recovery';const image=isSpecial?a.specialImage:a.image;
   if(a.phase){a.phase.hidden=!isSpecial;a.phase.textContent=a.clip==='telegraph'?'CHARGING — BLOCK!':a.clip==='discharge'?'RESONANT WAVE':a.clip==='recovery'?'CORE EXPOSED':'';}
   if(a.canvas&&image&&image.complete&&image.naturalWidth&&(frame!==a.lastFrame||image!==a.lastAsset||a.projectionDirty)){const g=a.canvas.getContext('2d');if(!g)continue;g.imageSmoothingEnabled=false;g.clearRect(0,0,a.atlas.cell,a.atlas.cell);const sourceX=(frame%a.atlas.columns)*a.atlas.cell,sourceY=Math.floor(frame/a.atlas.columns)*a.atlas.cell;if(a.projection){for(const span of a.projection.spans){const x=span.start*a.atlas.cell,w=(span.end-span.start)*a.atlas.cell;if(w>0)g.drawImage(image,sourceX+x,sourceY,w,a.atlas.cell,x,0,w,a.atlas.cell);}}else g.drawImage(image,sourceX,sourceY,a.atlas.cell,a.atlas.cell,0,0,a.atlas.cell,a.atlas.cell);a.projectionDirty=false;a.lastFrame=frame;a.lastAsset=image;a.canvas.dataset.frame=String(frame);}
  }
  for(const effect of [...this.effectSprites]){
   const reduced=this.reduced.matches||paused,atlas=EFFECT_ATLASES[effect.kind],age=now-effect.started;if(age<0){effect.node.style.opacity='0';continue;}if(age>=effect.duration){effect.node.remove();this.effectSprites=this.effectSprites.filter(entry=>entry.id!==effect.id);continue;}
   const t=Math.max(0,Math.min(1,age/effect.duration)),frame=effectFrame(effect.kind,effect.mode==='missile'?age/effect.duration*(atlas.ms*atlas.frames):age,reduced);if(effect.mode==='missile'&&!reduced){const angle=Math.atan2((effect.to.y-effect.from.y)*(this.stage.clientHeight||100),(effect.to.x-effect.from.x)*(this.stage.clientWidth||100))*180/Math.PI;effect.sprite.style.transform=`rotate(${angle+(effect.kind==='missile_arrow'?90:-135)}deg)`;}
   effect.sprite.style.backgroundPosition=`-${frame*atlas.cell}px 0px`;
   const travel=effect.mode==='missile'&&!reduced?t:1;const x=effect.from.x+(effect.to.x-effect.from.x)*travel,y=effect.from.y+(effect.to.y-effect.from.y)*travel;
   const scale=reduced?1:effect.mode==='missile'?(0.6+0.55*t):(0.7+0.45*Math.sin(Math.PI*t));const opacity=effect.mode==='missile'?(t<.12?t/.12:t>.86?(1-t)/.14:1):(Math.sin(Math.PI*Math.min(1,t))**.75);
   if(!this.placePortrait(effect.node,effect.targetId)){effect.node.style.left=`${x}%`;effect.node.style.top=`${y}%`;}effect.node.style.opacity=String(Math.max(0.05,Math.min(1,opacity)));effect.node.style.transform=`translate(-50%,-50%) scale(${scale.toFixed(3)})`;
  }
  for(const impact of [...this.impactSprites]){
   const reduced=this.reduced.matches||paused,atlas=IMPACT_ATLASES[impact.kind],age=now-impact.started;if(age<0){impact.node.style.opacity='0';continue;}if(age>=impact.duration){impact.node.remove();this.impactSprites=this.impactSprites.filter(entry=>entry.id!==impact.id);continue;}
   const t=Math.max(0,Math.min(1,age/impact.duration)),frame=impactFrame(impact.kind,age,reduced);impact.sprite.style.backgroundPosition=`-${frame*atlas.cell}px 0px`;
   const pop=reduced?1:.66+.52*Math.sin(Math.PI*Math.min(1,t));const opacity=t<.08?t/.08:t>.78?(1-t)/.22:1;
   if(!this.placePortrait(impact.node,impact.targetId)){impact.node.style.left=`${impact.at.x}%`;impact.node.style.top=`${impact.at.y}%`;}impact.node.style.opacity=String(Math.max(0.04,Math.min(1,opacity)));impact.node.style.transform=`translate(-50%,-50%) scale(${pop.toFixed(3)})`;
  }
  for(const feedback of [...this.feedbacks]){const age=now-feedback.started;const t=Math.max(0,Math.min(1,age/feedback.duration));if(age>=feedback.duration){feedback.node.remove();this.feedbacks=this.feedbacks.filter(entry=>entry.id!==feedback.id);continue;}const x=(feedback.lane-1)*122+(!this.reduced.matches&&!paused&&feedback.cue.emphasis==='bad'?8*Math.sin(t*Math.PI*3):0);const y=this.reduced.matches||paused?-10:-10-34*t;const scale=this.reduced.matches||paused?1:1.02-.12*t;feedback.node.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;feedback.node.style.opacity=String(t<.1?t/.1:t>.76?(1-t)/.24:1);}
  if(this.feedbacks.length===0&&((((this.feedbackLayer as unknown as {parentElement?:HTMLElement|null;parent?:HTMLElement|null}).parentElement)??((this.feedbackLayer as unknown as {parent?:HTMLElement|null}).parent))))this.feedbackLayer.remove();
  if(this.effectSprites.length===0&&((((this.effectLayer as unknown as {parentElement?:HTMLElement|null;parent?:HTMLElement|null}).parentElement)??((this.effectLayer as unknown as {parent?:HTMLElement|null}).parent))))this.effectLayer.remove();
  if(this.impactSprites.length===0&&((((this.impactLayer as unknown as {parentElement?:HTMLElement|null;parent?:HTMLElement|null}).parentElement)??((this.impactLayer as unknown as {parent?:HTMLElement|null}).parent))))this.impactLayer.remove();
  this.stage.hidden=this.actors.size===0&&this.feedbacks.length===0&&this.effectSprites.length===0&&this.impactSprites.length===0;
 }
}
