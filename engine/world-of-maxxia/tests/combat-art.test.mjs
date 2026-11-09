import test from 'node:test';
import assert from 'node:assert/strict';
import {CombatArt} from '../src/client/combat-art.ts';
class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;this.naturalWidth=512;this.complete=true;}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 setAttribute(k,v){this.attributes[k]=v;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 getContext(){return {clearRect(){},drawImage(){},imageSmoothingEnabled:false};}
}
test('actor nodes persist through selection refresh, play hurt/death, and clear on map changes',()=>{
 const prior={document:globalThis.document,Image:globalThis.Image,matchMedia:globalThis.matchMedia};
 globalThis.document={createElement:tag=>new Node(tag)};globalThis.Image=Node;globalThis.matchMedia=()=>({matches:false});
 try{
  const stage=new Node(),art=new CombatArt(stage),enemy={id:'imp',kindId:'dust_imp',hp:9,x:3,y:8};
  const state=hp=>({currentMapId:'map_test',combat:{encounters:{enc:{id:'enc',mapId:'map_test',enemies:[{...enemy,hp}]}}}});
  art.sync([enemy],'imp','map_test');const node=stage.children[0];art.update(performance.now());assert.equal(node.dataset.clip,'idle');
  art.sync([{...enemy,hp:6}],null,'map_test');assert.equal(stage.children[0],node);assert.equal(node.dataset.selected,'false');
  art.observe(state(9),state(6),[]);art.update(performance.now());assert.equal(node.dataset.clip,'hurt');
  art.update(performance.now()+230);assert.equal(node.dataset.clip,'idle');
  art.observe(state(6),state(0),[]);art.sync([],null,'map_test');assert.equal(stage.children.length,1,'dead actor survives living-target refresh');
  art.update(performance.now());assert.equal(node.dataset.clip,'death');art.update(performance.now()+700);assert.equal(stage.children.length,0);assert.equal(stage.hidden,true);
  art.sync([enemy],null,'map_test');art.sync([],null,'other_map');assert.equal(stage.children.length,0);
 } finally {for(const [key,value] of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
test('enemy attack then lethal hit queues death without losing it during refresh',()=>{
 const prior={document:globalThis.document,Image:globalThis.Image,matchMedia:globalThis.matchMedia};
 globalThis.document={createElement:tag=>new Node(tag)};globalThis.Image=Node;globalThis.matchMedia=()=>({matches:false});
 try{
  const stage=new Node(),art=new CombatArt(stage),enemy={id:'imp',kindId:'dust_imp',hp:9,x:3,y:8};
  const state=hp=>({currentMapId:'m',combat:{encounters:{e:{id:'e',mapId:'m',enemies:[{...enemy,hp}]}}}});
  art.sync([enemy],'imp','m');const node=stage.children[0];const now=performance.now();
  art.observe(state(9),state(0),['Dust Imp misses Ada.']);art.sync([],null,'m');art.update(now+10);assert.equal(node.dataset.clip,'attack');
  art.update(now+410);assert.equal(node.dataset.clip,'death');art.update(now+1100);assert.equal(stage.hidden,true);
 }finally{for(const [k,v] of Object.entries(prior)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}
});
