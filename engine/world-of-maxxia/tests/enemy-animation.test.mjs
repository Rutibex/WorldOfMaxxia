import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CombatArt} from '../src/client/combat-art.ts';
import {ANIMATED_ENEMY_ATLASES,STONE_MITE,GALLERY_WATCHER,DUST_IMP,clipFrame,clipDuration} from '../src/client/art-production.ts';
import {ENEMY_KINDS} from '../src/shared/rules/combat.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const covered=['dust_imp','stone_mite','gallery_watcher'];
test('first batch uses existing enemy IDs and complete four-state original sprite clips',()=>{
 assert.deepEqual(Object.keys(ANIMATED_ENEMY_ATLASES).slice(0,3),covered);
 for(const kind of covered){const atlas=ANIMATED_ENEMY_ATLASES[kind];assert(ENEMY_KINDS[kind]);assert.equal(atlas.cell,128);assert.equal(atlas.columns,4);assert.deepEqual(atlas.anchor,[.5,.96]);
  const all=Object.entries(atlas.clips);assert.deepEqual(all.map(([name])=>name),['idle','attack','hurt','death']);
  assert.equal(all[0][1].loop,true);for(const [name,clip] of all){assert(clip.frames.length>0,name);assert(Number.isInteger(clip.ms)&&clip.ms>0);assert(clip.frames.every(f=>Number.isInteger(f)&&f>=0&&f<16));assert(clipDuration(name,atlas)>0);}assert.equal(atlas.clips.death.frames.at(-1),15);
 }
 assert.equal(DUST_IMP.url,'assets/art/dust-imp.png','approved Phase 20 Dust Imp asset is preserved');
});
test('Stone Mite and Gallery Watcher atlases ship transparent 4x4 128px sheets with idle attack hurt death',()=>{
 for(const atlas of [STONE_MITE,GALLERY_WATCHER]){const b=readFileSync(root+'public/'+atlas.url);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),512);assert.equal(b.readUInt32BE(20),512);assert.equal(b[25],6,'RGBA transparency is required');
  assert.deepEqual(atlas.clips.idle.frames,[0,1,2,3,4,5]);assert.deepEqual(atlas.clips.attack.frames,[6,7,8,9]);assert.deepEqual(atlas.clips.hurt.frames,[10,11]);assert.deepEqual(atlas.clips.death.frames,[12,13,14,15]);
  assert.equal(clipFrame(atlas.clips.idle,clipDuration('idle',atlas)),0);assert.equal(clipFrame(atlas.clips.death,999999),15);assert.equal(clipFrame(atlas.clips.hurt,0,true),11);
 }
});
class Node{
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;this.naturalWidth=512;this.complete=true;this.count=0;}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 setAttribute(k,v){this.attributes[k]=v;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 getContext(){return {clearRect(){},drawImage(){this.count++},imageSmoothingEnabled:false};}
}
const withMock=(fn)=>{const prior={document:globalThis.document,Image:globalThis.Image,matchMedia:globalThis.matchMedia};globalThis.document={createElement:tag=>new Node(tag)};globalThis.Image=Node;globalThis.matchMedia=()=>({matches:false});try{fn();}finally{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
test('all first-batch enemies retain animation while the Phase 29 sentinel also animates',()=>withMock(()=>{
 const stage=new Node(),art=new CombatArt(stage),enemies=covered.map((kindId,i)=>({id:kindId,kindId,x:1,y:i+1,hp:ENEMY_KINDS[kindId].hp}));
 enemies.push({id:'valve_sentinel',kindId:'valve_sentinel',x:1,y:4,hp:ENEMY_KINDS.valve_sentinel.hp});
 art.sync(enemies,'stone_mite','map_diagnostic_galleries',{x:1,y:0,facing:2});
 assert.equal(stage.children.length,4);
 for(let i=0;i<3;i++){const node=stage.children[i];assert.equal(node.dataset.animated,'true');assert.equal(node.children[0].tag,'canvas');assert.equal(node.children[0].width,128);assert.equal(node.dataset.distance,String(Math.min(3,i+1)));}
 assert.equal(stage.children[1].dataset.selected,'true');assert.equal(stage.children[3].children[0].tag,'canvas');assert.equal(stage.children[3].dataset.animated,'true');
 art.update(performance.now());for(let i=0;i<3;i++)assert(stage.children[i].children[0].dataset.frame!==undefined);
}));
test('all three species retain hurt/death frames and actors survive removal until death clip completes',()=>withMock(()=>{
 const stage=new Node(),art=new CombatArt(stage);const species=covered.map((kindId,i)=>({id:'e'+i,kindId,x:1,y:i+1,hp:ENEMY_KINDS[kindId].hp}));
 const make=(enemies)=>({currentMapId:'map_diagnostic_galleries',combat:{encounters:{fight:{id:'fight',mapId:'map_diagnostic_galleries',enemies}}}});
 art.sync(species,null,'map_diagnostic_galleries');const nodes=stage.children.slice();const damaged=species.map(e=>({...e,hp:e.hp-2}));
 art.observe(make(species),make(damaged),[]);art.sync(damaged,null,'map_diagnostic_galleries');const now=performance.now();art.update(now+15);
 nodes.forEach(n=>assert.equal(n.dataset.clip,'hurt'));
 const dead=damaged.map(e=>({...e,hp:0}));art.update(now+400);art.observe(make(damaged),make(dead),[]);art.sync([],null,'map_diagnostic_galleries');art.update(now+450);nodes.forEach(n=>assert.equal(n.dataset.clip,'death'));
 art.update(now+1200);assert.equal(stage.children.length,0);assert.equal(stage.hidden,true);
}));
