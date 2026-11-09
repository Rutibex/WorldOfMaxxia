import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedEffectsFromMessages,EFFECT_ATLASES,effectDuration} from '../src/client/spell-effects.ts';
import {CombatArt} from '../src/client/combat-art.ts';

class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;this.naturalWidth=512;this.complete=true;this.className='';}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 setAttribute(k,v){this.attributes[k]=v;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 getContext(){return {clearRect(){},drawImage(){},imageSmoothingEnabled:false};}
}

test('message planning maps representative spells and ranged volleys to reusable effect families',()=>{
 const spark=plannedEffectsFromMessages(['Ada casts Spark Lance (2 SP).']);
 assert.equal(spark[0].kind,'missile_arcane');
 const fire=plannedEffectsFromMessages(['Ada casts Burning Fan (3 SP).']);
 assert.equal(fire[0].kind,'burst_firefan');
 const bow=plannedEffectsFromMessages(["Ada's Short Bow misses Dust Imp."]);
 assert.equal(bow[0].kind,'missile_arrow');
 assert(Object.keys(EFFECT_ATLASES).length>=12);
 assert(effectDuration('missile_arcane')>0);
});

test('combat art spawns spell effect overlay without changing actor flow',()=>{
 const prior={document:globalThis.document,Image:globalThis.Image,matchMedia:globalThis.matchMedia};
 globalThis.document={createElement:tag=>new Node(tag)};globalThis.Image=Node;globalThis.matchMedia=()=>({matches:false});
 try{
  const stage=new Node(),art=new CombatArt(stage),enemy={id:'imp',kindId:'dust_imp',hp:9,x:3,y:8};
  const before={currentMapId:'map_test',party:{order:['hero_a'],characters:{hero_a:{hp:8,conditions:[]}}},combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{...enemy,hp:9}]}}}};
  const after={currentMapId:'map_test',party:{order:['hero_a'],characters:{hero_a:{hp:8,conditions:[]}}},combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{...enemy,hp:4}]}}}};
  art.sync([enemy],'imp','map_test');
  art.observe(before,after,['Ada casts Spark Lance (2 SP).','Spark Lance deals 5 arcane damage to dust imp (4 HP remaining).']);
  assert(stage.children.some(node=>node.className==='combat-effect-layer'));
  const layer=stage.children.find(node=>node.className==='combat-effect-layer');
  assert(layer.children.length>=1);
  art.update(performance.now()+50);
 }finally{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
