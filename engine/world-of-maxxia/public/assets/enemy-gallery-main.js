import {ANIMATED_ENEMY_ATLASES,clipFrame,clipDuration} from './enemy-review-art-production.js';
const names={dust_imp:'Dust Imp',stone_mite:'Stone Mite',gallery_watcher:'Gallery Watcher',cistern_rat:'Cistern Rat',sludge_leech:'Sludge Leech',pipe_goblin:'Pipe Goblin',bell_wraith:'Bell Wraith',valve_sentinel:'Valve Sentinel',bell_heart:'Bell-Heart Custodian'};
const $=id=>document.getElementById(id),list=[],grid=$('enemy-grid');
const clips=['idle','attack','hurt','death','telegraph','discharge','recovery'];
for(const [id,atlas] of Object.entries(ANIMATED_ENEMY_ATLASES)){
 const card=document.createElement('section');card.className='card';card.dataset.batch=['dust_imp','stone_mite','gallery_watcher'].includes(id)?'one':['cistern_rat','sludge_leech','pipe_goblin'].includes(id)?'two':'three';const h=document.createElement('h2');h.textContent=names[id]||id;const wrap=document.createElement('div');wrap.className='sprite-frame';const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;canvas.setAttribute('aria-label',h.textContent+' animation frame');wrap.append(canvas);const controls=document.createElement('div');controls.className='controls';const readout=document.createElement('p');readout.className='readout';const info=document.createElement('p');info.className='tag';info.textContent=atlas.special?'Idle · Attack · Hurt · Death · Telegraph · Discharge · Recovery':'Idle · Attack · Hurt · Death';card.append(h,wrap,controls,readout,info);grid.append(card);
 const image=new Image();image.src=atlas.url;const specialImage=atlas.special?new Image():null;if(specialImage)specialImage.src=atlas.special.url;const state={id,atlas,image,specialImage,canvas,wrap,controls,readout,card,clip:'idle',started:performance.now(),lastFrame:-1};list.push(state);
 for(const clip of clips.filter(c=>atlas.special||!['telegraph','discharge','recovery'].includes(c))){const button=document.createElement('button');button.textContent=clip[0].toUpperCase()+clip.slice(1);button.dataset.clip=clip;button.setAttribute('aria-pressed',String(clip==='idle'));button.addEventListener('click',()=>start(state,clip));controls.append(button);}
 image.onerror=()=>{readout.textContent='Missing sprite atlas: '+atlas.url;};
}
function start(state,clip){state.clip=clip;state.started=performance.now();state.lastFrame=-1;for(const button of state.controls.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.clip===clip));}
let pauseStarted=null,pausedTotal=0;
$('pause').addEventListener('change',()=>{if($('pause').checked){pauseStarted=performance.now();}else if(pauseStarted!==null){const elapsed=performance.now()-pauseStarted;for(const a of list)a.started+=elapsed;pauseStarted=null;}});
$('size').addEventListener('change',()=>{for(const item of list)item.wrap.style.width=$('size').value==='2'?'256px':'192px';});
$('group').addEventListener('change',()=>{for(const item of list)item.card.hidden=$('group').value!=='all'&&item.card.dataset.batch!==$('group').value;});
for(const clip of clips.slice(0,4))$('all-'+clip).addEventListener('click',()=>{for(const a of list)start(a,clip);});
function tick(now){const reduced=$('reduce').checked||window.matchMedia('(prefers-reduced-motion: reduce)').matches,freeze=$('pause').checked;
 for(const a of list){const special=['telegraph','discharge','recovery'].includes(a.clip);const img=special?a.specialImage:a.image;if(!img||!img.complete||!img.naturalWidth)continue;
 const elapsed=Math.max(0,(freeze?(pauseStarted??now):now)-a.started),spec=special?a.atlas.special.clips[a.clip]:a.atlas.clips[a.clip],frame=clipFrame(spec,elapsed,reduced);
 if(frame!==a.lastFrame){const g=a.canvas.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,128,128);g.drawImage(img,(frame%a.atlas.columns)*a.atlas.cell,Math.floor(frame/a.atlas.columns)*a.atlas.cell,a.atlas.cell,a.atlas.cell,0,0,128,128);a.lastFrame=frame;}
 a.readout.textContent='Frame '+(frame+1)+' / 16  ·  '+a.clip+'  ·  '+(clipDuration(a.clip,a.atlas))+'ms'+(reduced?'  ·  reduced motion':'');
 }
 requestAnimationFrame(tick);
}requestAnimationFrame(tick);
