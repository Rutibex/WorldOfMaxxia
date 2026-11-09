import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CombatArt} from '../src/client/combat-art.ts';
import {ANIMATED_ENEMY_ATLASES,CISTERN_RAT,SLUDGE_LEECH,PIPE_GOBLIN,clipFrame,clipDuration} from '../src/client/art-production.ts';
import {ENEMY_KINDS,ENCOUNTER_SEEDS} from '../src/shared/rules/combat.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const batch2=['cistern_rat','sludge_leech','pipe_goblin'];
test('batch two animates exactly the already-authored vault rat, leech and goblin; retains first batch',()=>{
 assert.deepEqual(Object.keys(ANIMATED_ENEMY_ATLASES).slice(0,6),['dust_imp','stone_mite','gallery_watcher',...batch2]);
 for(const id of batch2){
  assert(ENEMY_KINDS[id],id+' must be an existing combat kind');
  assert(ENCOUNTER_SEEDS.some(e=>e.mapId==='map_resonator_vault'&&e.enemies.some(v=>v.kindId===id)),id+' must have a seeded real vault encounter');
 }
 for(const id of ['dust_imp','stone_mite','gallery_watcher'])assert(ANIMATED_ENEMY_ATLASES[id].url,'prior batch must remain');
 assert(ANIMATED_ENEMY_ATLASES.valve_sentinel,'batch three must now be animated');
});
test('all batch two atlases have 16 transparent frames, complete timed clips and anchored outlines',()=>{
 for(const atlas of [CISTERN_RAT,SLUDGE_LEECH,PIPE_GOBLIN]){
  assert.equal(atlas.cell,128);assert.equal(atlas.columns,4);assert.deepEqual(atlas.anchor,[.5,.96]);
  assert.deepEqual(Object.keys(atlas.clips),['idle','attack','hurt','death']);
  assert.deepEqual(atlas.clips.idle.frames,[0,1,2,3,4,5]);
  assert.deepEqual(atlas.clips.attack.frames,[6,7,8,9]);
  assert.deepEqual(atlas.clips.hurt.frames,[10,11]);
  assert.deepEqual(atlas.clips.death.frames,[12,13,14,15]);
  assert.equal(atlas.clips.idle.loop,true);assert(['attack','hurt','death'].every(n=>atlas.clips[n].loop===false));
  for(const clip of Object.values(atlas.clips))assert(clip.ms>=100&&clip.ms<=200);
  assert.equal(clipFrame(atlas.clips.idle,clipDuration('idle',atlas)),0);
  assert.equal(clipFrame(atlas.clips.death,100_000),15);
  assert.equal(clipFrame(atlas.clips.attack,100_000,true),9);
  const png=readFileSync(root+'public/'+atlas.url);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),512);assert.equal(png.readUInt32BE(20),512);assert.equal(png[25],6);
 }
});
class Node{
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;this.naturalWidth=512;this.complete=true;}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 setAttribute(k,v){this.attributes[k]=v;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 getContext(){return {clearRect(){},drawImage(){},imageSmoothingEnabled:false};}
}
function mocked(fn){const previous={document:globalThis.document,Image:globalThis.Image,matchMedia:globalThis.matchMedia};
 globalThis.document={createElement:tag=>new Node(tag)};globalThis.Image=Node;globalThis.matchMedia=()=>({matches:false});
 try{fn();}finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}
test('real vault enemy IDs use 128px animated canvases at distance anchors, including Phase 29 sentinel',()=>mocked(()=>{
 const stage=new Node(),art=new CombatArt(stage),enemies=batch2.map((kindId,i)=>({id:'vault'+i,kindId,x:3,y:2+i,hp:ENEMY_KINDS[kindId].hp}));
 enemies.push({id:'sentinel',kindId:'valve_sentinel',x:3,y:5,hp:ENEMY_KINDS.valve_sentinel.hp});
 art.sync(enemies,'vault1','map_resonator_vault',{x:3,y:1,facing:2});art.update(performance.now());
 assert.equal(stage.children.length,4);
 for(const [i,node] of stage.children.slice(0,3).entries()){
  assert.equal(node.dataset.kind,batch2[i]);assert.equal(node.dataset.animated,'true');assert.equal(node.children[0].tag,'canvas');assert.equal(node.children[0].width,128);assert.equal(node.children[0].height,128);
  assert.equal(node.dataset.distance,String(i+1));assert(node.children[0].dataset.frame!==undefined);
 }
 assert.equal(stage.children[1].dataset.selected,'true');assert.equal(stage.children[3].children[0].tag,'canvas');assert.equal(stage.children[3].dataset.animated,'true');
}));
test('batch two attack, damage and death queue without mutating combat state or losing dying actor',()=>mocked(()=>{
 const stage=new Node(),art=new CombatArt(stage),enemies=batch2.map((kindId,i)=>({id:'vault'+i,kindId,x:3,y:2+i,hp:ENEMY_KINDS[kindId].hp}));
 const wrap=(list)=>({currentMapId:'map_resonator_vault',combat:{encounters:{enc_vault_drain:{id:'enc_vault_drain',mapId:'map_resonator_vault',enemies:list}}}});
 art.sync(enemies,null,'map_resonator_vault');const nodes=stage.children.slice(),now=performance.now();
 const damaged=enemies.map(e=>({...e,hp:e.hp-1})),before=JSON.stringify({enemies,damaged});
 art.observe(wrap(enemies),wrap(damaged),['Cistern Rat hits Venn.','Sludge Leech misses Venn.','Pipe Goblin hits Venn.']);
 art.update(now+50);nodes.forEach(n=>assert.equal(n.dataset.clip,'attack'));
 art.update(now+550);nodes.forEach(n=>assert.equal(n.dataset.clip,'hurt'));
 art.update(now+1050);
 const defeated=damaged.map(e=>({...e,hp:0}));art.observe(wrap(damaged),wrap(defeated),[]);art.sync([],null,'map_resonator_vault');art.update(performance.now()+20);
 nodes.forEach(n=>assert.equal(n.dataset.clip,'death'));
 art.update(performance.now()+2000);assert.equal(stage.children.length,0);assert.equal(stage.hidden,true);
 assert.equal(JSON.stringify({enemies,damaged}),before,'animations are presentational only');
}));
