import test from 'node:test';
import assert from 'node:assert/strict';
import {CONDITION_MARKS,IMPACT_ATLASES,impactDuration,plannedImpactBursts} from '../src/client/status-effects.ts';
import {CombatArt} from '../src/client/combat-art.ts';

class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;this.naturalWidth=512;this.complete=true;this.className='';this.src='';}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 setAttribute(k,v){this.attributes[k]=v;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 getContext(){return {clearRect(){},drawImage(){},imageSmoothingEnabled:false};}
}

test('status art registry covers all supported party conditions and impact families',()=>{
 assert.equal(Object.keys(CONDITION_MARKS).length,6);
 assert.equal(CONDITION_MARKS.poisoned.label,'Poisoned');
 assert(Object.keys(IMPACT_ATLASES).length>=10);
 assert(impactDuration('arcane')>0);
});

test('impact planning maps enemy and ally events to rendered flash families',()=>{
 const before={currentMapId:'map_test',party:{order:['hero_a'],characters:{hero_a:{name:'Ada',hp:4,conditions:[]}}},combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{id:'imp',kindId:'dust_imp',hp:9}]}}}};
 const enemyAfter={currentMapId:'map_test',party:{order:['hero_a'],characters:{hero_a:{name:'Ada',hp:4,conditions:[]}}},combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{id:'imp',kindId:'dust_imp',hp:3}]}}}};
 const plans=plannedImpactBursts(before,enemyAfter,['Spark Lance deals 6 arcane damage to dust imp (3 HP remaining).']);
 assert.equal(plans[0].kind,'arcane');
 assert.deepEqual(plans[0].enemyIds,['imp']);
 const allyAfter={currentMapId:'map_test',party:{order:['hero_a'],characters:{hero_a:{name:'Ada',hp:7,conditions:[]}}},combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{id:'imp',kindId:'dust_imp',hp:9}]}}}};
 const heal=plannedImpactBursts(before,allyAfter,['Ada restores up to 3 HP.']);
 assert.equal(heal[0].kind,'heal');
 assert.deepEqual(heal[0].allyIds,['hero_a']);
});

test('combat art spawns impact overlays alongside effect overlays',()=>{
 const prior={document:globalThis.document,Image:globalThis.Image,matchMedia:globalThis.matchMedia};
 globalThis.document={createElement:tag=>new Node(tag)};globalThis.Image=Node;globalThis.matchMedia=()=>({matches:false});
 try{
  const stage=new Node(),art=new CombatArt(stage),enemy={id:'imp',kindId:'dust_imp',hp:9,x:3,y:8};
  const before={currentMapId:'map_test',party:{order:['hero_a'],characters:{hero_a:{name:'Ada',hp:8,conditions:[]}}},combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{...enemy,hp:9}]}}}};
  const after={currentMapId:'map_test',party:{order:['hero_a'],characters:{hero_a:{name:'Ada',hp:8,conditions:[]}}},combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{...enemy,hp:4}]}}}};
  art.sync([enemy],'imp','map_test');
  art.observe(before,after,['Ada casts Spark Lance (2 SP).','Spark Lance deals 5 arcane damage to dust imp (4 HP remaining).']);
  assert(stage.children.some(node=>node.className==='combat-impact-layer'));
  const layer=stage.children.find(node=>node.className==='combat-impact-layer');
  assert(layer.children.length>=1);
  art.update(performance.now()+50);
 }finally{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
