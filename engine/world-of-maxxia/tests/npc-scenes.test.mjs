import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {NPC_SCENES,npcSceneFor,npcSceneFrame,npcFramePosition,createNpcSceneElement,updateNpcSceneElement,validateNpcScenes} from '../src/client/npc-scenes.ts';
import {TOWN_SERVICES} from '../src/shared/rules/services.ts';
import {tavernFrame} from '../src/client/art-production.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
test('complete town cast maps exactly eight scenes to the existing service IDs',()=>{
 assert.deepEqual(Object.keys(NPC_SCENES),TOWN_SERVICES.map(n=>n.id));
 for(const [id,scene] of Object.entries(NPC_SCENES)){assert.equal(scene.id,id);assert(TOWN_SERVICES.some(n=>n.id===id));assert(scene.description.includes(scene.name));}
 for(const id of ['toString','unrecognized'])assert.equal(npcSceneFor(id),undefined);
 assert.equal(NPC_SCENES.npc_tessa_bell.url,'assets/art/tessa-loop.png');
});
test('each idle loop honours its own holds, all four frame boundaries and full wrap',()=>{
 for(const scene of Object.values(NPC_SCENES)){
  let start=0;for(let frame=0;frame<4;frame++){assert.equal(npcSceneFrame(scene,start),frame);assert.equal(npcSceneFrame(scene,start+scene.durations[frame]-1),frame);start+=scene.durations[frame];}
  assert.equal(npcSceneFrame(scene,start),0);assert.equal(npcSceneFrame(scene,-1),0);assert.equal(npcSceneFrame(scene,Infinity),0);
  for(const t of [0,2400,3700,90000])assert.equal(npcSceneFrame(scene,t,true),0);
 }
 for(let t=0;t<7500;t+=17)assert.equal(npcSceneFrame(NPC_SCENES.npc_tessa_bell,t),tavernFrame(t),'retained Tessa timing');
 assert.deepEqual([0,1,2,3].map(npcFramePosition),['0% 0%','100% 0%','0% 100%','100% 100%']);
});
test('all eight shipped scene atlases contain four 440x280 frame slots',()=>{
 for(const scene of Object.values(NPC_SCENES)){const b=readFileSync(root+'public/'+scene.url);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),880);assert.equal(b.readUInt32BE(20),560);}
});
test('shared scene elements retain identity, update frames and freeze without substituting another NPC',()=>{
 const saved=globalThis.document;globalThis.document={createElement:()=>({dataset:{},style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;}})};
 try{
  assert.equal(createNpcSceneElement('unrecognized'),null);
  for(const scene of Object.values(NPC_SCENES)){
   const element=createNpcSceneElement(scene.id);assert.equal(element.dataset.npcScene,scene.id);assert.equal(element.attributes.role,'img');assert.equal(element.attributes['aria-label'],scene.description);assert(element.style.backgroundImage.includes(scene.url));
   const blink=scene.durations[0]+scene.durations[1];updateNpcSceneElement(element,blink);assert.equal(element.dataset.frame,'2');assert.equal(element.style.backgroundPosition,'0% 100%');
   updateNpcSceneElement(element,blink,true);assert.equal(element.dataset.frame,'0');assert.equal(element.style.backgroundPosition,'0% 0%');
   assert.equal(element.dataset.npcScene,scene.id);
  }
 }finally{if(saved===undefined)delete globalThis.document;else globalThis.document=saved;}
});

test('complete scene validation rejects missing, wrong-speaker, duplicate-image and broken timing definitions',()=>{
 validateNpcScenes(TOWN_SERVICES);
 const missing={...NPC_SCENES};delete missing.npc_iona_reed;assert.throws(()=>validateNpcScenes(TOWN_SERVICES,missing),/coverage/);
 const wrong={...NPC_SCENES,npc_pell_glass:{...NPC_SCENES.npc_pell_glass,id:'npc_nera_salt'}};assert.throws(()=>validateNpcScenes(TOWN_SERVICES,wrong),/mismatched/);
 const duplicate={...NPC_SCENES,npc_iona_reed:{...NPC_SCENES.npc_iona_reed,url:NPC_SCENES.npc_tessa_bell.url}};assert.throws(()=>validateNpcScenes(TOWN_SERVICES,duplicate),/shared/);
 const timing={...NPC_SCENES,npc_aunt_vell:{...NPC_SCENES.npc_aunt_vell,durations:[2400,0,120,900]}};assert.throws(()=>validateNpcScenes(TOWN_SERVICES,timing),/timing/);
});
test('each guild and quest destination has a distinct accessible speaker and image',()=>{
 const ids=['npc_pell_glass','npc_nera_salt','npc_aunt_vell','npc_iona_reed'];
 assert.equal(new Set(ids.map(id=>npcSceneFor(id).url)).size,4);
 for(const id of ids){const scene=npcSceneFor(id),service=TOWN_SERVICES.find(n=>n.id===id);assert.equal(scene.name,service.name);assert(scene.description.includes(service.name));}
});
