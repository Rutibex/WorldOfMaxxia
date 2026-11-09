import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CombatArt} from '../src/client/combat-art.ts';
import {ANIMATED_ENEMY_ATLASES,BELL_WRAITH,VALVE_SENTINEL,BELL_HEART,animationClip,clipFrame,clipDuration} from '../src/client/art-production.ts';
import {ENEMY_KINDS,ENCOUNTER_SEEDS} from '../src/shared/rules/combat.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const batch=['bell_wraith','valve_sentinel','bell_heart'];
test('all nine existing combat species now have production animation atlases',()=>{
 assert.deepEqual(Object.keys(ANIMATED_ENEMY_ATLASES),Object.keys(ENEMY_KINDS));
 for(const id of batch){assert(ENEMY_KINDS[id]);assert(ENCOUNTER_SEEDS.some(e=>e.mapId==='map_resonator_vault'&&e.enemies.some(v=>v.kindId===id)),id+' has an authored encounter');}
 assert.equal(ENEMY_KINDS.bell_heart.hp,65);
});
test('all three final normal atlases and supplemental boss sheet carry complete correctly sequenced RGBA clips',()=>{
 for(const atlas of [BELL_WRAITH,VALVE_SENTINEL,BELL_HEART]){
  assert.equal(atlas.cell,128);assert.equal(atlas.columns,4);assert.deepEqual(atlas.anchor,[.5,.96]);
  for(const [name,indices] of Object.entries({idle:[0,1,2,3,4,5],attack:[6,7,8,9],hurt:[10,11],death:[12,13,14,15]})){
   const c=animationClip(atlas,name);assert.deepEqual(c.frames,indices);assert(c.ms>0);assert.equal(c.loop,name==='idle');
   assert(clipDuration(name,atlas)>0);assert.equal(clipFrame(c,100_000),name==='idle'?c.frames[(Math.floor(100_000/c.ms)%c.frames.length)]:c.frames.at(-1));
  }
  const b=readFileSync(root+'public/'+atlas.url);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),512);assert.equal(b.readUInt32BE(20),512);assert.equal(b[25],6);
 }
 assert(!BELL_WRAITH.special&&!VALVE_SENTINEL.special);assert(BELL_HEART.special);
 for(const [name,indices] of Object.entries({telegraph:[0,1,2,3],discharge:[4,5,6,7],recovery:[8,9,10,11]})){
  assert.deepEqual(animationClip(BELL_HEART,name).frames,indices);assert.equal(animationClip(BELL_HEART,name).loop,false);
  assert.equal(clipFrame(animationClip(BELL_HEART,name),100_000),indices.at(-1));
  assert.equal(clipFrame(animationClip(BELL_HEART,name),100_000,true),indices.at(-1));
 }
 const b=readFileSync(root+'public/'+BELL_HEART.special.url);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),512);assert.equal(b.readUInt32BE(20),512);assert.equal(b[25],6);
});
class Node{
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;this.naturalWidth=512;this.complete=true;this.drawn=[];}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 setAttribute(k,v){this.attributes[k]=v;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 getContext(){return {clearRect(){},drawImage:(...args)=>this.drawn.push(args),imageSmoothingEnabled:false};}
}
function withMock(fn){const before={document:globalThis.document,Image:globalThis.Image,matchMedia:globalThis.matchMedia};
 globalThis.document={createElement:tag=>new Node(tag)};globalThis.Image=Node;globalThis.matchMedia=()=>({matches:false});
 try{fn();}finally{for(const [k,v] of Object.entries(before)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
}
const one={id:'enemy_bell_heart',kindId:'bell_heart',x:12,y:2,hp:65};
const wrap=enemies=>({currentMapId:'map_resonator_vault',combat:{encounters:{enc_bell_heart:{id:'enc_bell_heart',mapId:'map_resonator_vault',enemies}}}});
test('battle boss telegraph → discharge → recovery uses the real messages and special atlas, not an autonomous timer',()=>withMock(()=>{
 const stage=new Node(),art=new CombatArt(stage);art.sync([one],one.id,'map_resonator_vault',{x:12,y:3,facing:0});
 const boss=stage.children[0],canvas=boss.children[0];assert.equal(boss.dataset.animated,'true');assert.equal(canvas.tag,'canvas');assert.equal(boss.dataset.distance,'1');
 const initial=JSON.stringify(one);const now=performance.now();
 art.observe(wrap([one]),wrap([one]),['BELL-HEART TELEGRAPH — its brass ribs glow. A resonant discharge is coming; Block to brace!']);art.update(now+20);
 assert.equal(boss.dataset.clip,'telegraph');assert.equal(boss.children.at(-1).textContent,'CHARGING — BLOCK!');assert.equal(boss.children.at(-1).hidden,false);assert.equal(canvas.drawn.at(-1)[0].src,BELL_HEART.special.url);
 art.update(now+900);assert.equal(boss.dataset.clip,'idle');
 art.observe(wrap([one]),wrap([one]),['The Bell-Heart Custodian releases a thunderous resonant wave!']);art.update(performance.now()+20);
 assert.equal(boss.dataset.clip,'discharge');assert.equal(boss.children.at(-1).textContent,'RESONANT WAVE');
 art.update(performance.now()+850);assert.equal(boss.dataset.clip,'idle');
 art.observe(wrap([one]),wrap([one]),['The Custodian cools and exposes its regulator core. Its defenses falter for one round.']);art.update(performance.now()+20);
 assert.equal(boss.dataset.clip,'recovery');assert.equal(boss.children.at(-1).textContent,'CORE EXPOSED');
 assert.equal(JSON.stringify(one),initial,'rendering cannot modify enemy state');
}));
test('newly created actor does not lose an early boss telegraph emitted before first sync',()=>withMock(()=>{
 const stage=new Node(),art=new CombatArt(stage);art.observe(wrap([one]),wrap([one]),['BELL-HEART TELEGRAPH — its brass ribs glow. A resonant discharge is coming; Block to brace!']);
 art.sync([one],one.id,'map_resonator_vault');art.update(performance.now()+10);
 assert.equal(stage.children[0].dataset.clip,'telegraph');
}));
test('boss death overrides charged special and plays complete death before removal',()=>withMock(()=>{
 const stage=new Node(),art=new CombatArt(stage);art.sync([one],one.id,'map_resonator_vault');
 art.observe(wrap([one]),wrap([one]),['BELL-HEART TELEGRAPH — its brass ribs glow. A resonant discharge is coming; Block to brace!']);
 const dead={...one,hp:0};art.observe(wrap([one]),wrap([dead]),['Victory! 350 XP per surviving adventurer, 120 gold recovered.']);
 art.sync([],null,'map_resonator_vault');art.update(performance.now()+15);
 assert.equal(stage.children[0].dataset.clip,'death');assert.equal(stage.hidden,false);
 art.update(performance.now()+clipDuration('death',BELL_HEART)+200);
 assert.equal(stage.children.length,0);assert.equal(stage.hidden,true);
}));
