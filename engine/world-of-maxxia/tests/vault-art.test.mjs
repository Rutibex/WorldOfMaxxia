import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {VAULT_PROPS,VAULT_TEXTURES,VAULT_CACHES,vaultAsset,vaultSprites,knownVaultTraps,validateVaultArt} from '../src/client/vault-art.ts';
import {emptyUpperArt,upperArtState} from '../src/client/upper-art.ts';
import {VaultEnvironment} from '../src/client/vault-environment.ts';
import {LOOT_CACHES} from '../src/shared/rules/inventory.ts';
import {initialGridState} from '../src/shared/rules/grid.ts';
import {viewPose} from '../src/shared/rules/perspective.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),map=JSON.parse(readFileSync(root+'public/content/vault.json','utf8'));
test('all nine authored Resonator Vault props have explicit production art',()=>{
 validateVaultArt(map);assert.equal(Object.keys(VAULT_PROPS).length,9);assert.equal(new Set(Object.values(VAULT_PROPS).map(p=>p.texture)).size,9);
 assert.throws(()=>validateVaultArt({...map,props:[...map.props,{id:'missing_art'}]}),/Missing vault/);
});
test('visual treasure anchors match both authoritative second-floor loot caches',()=>{
 assert.deepEqual(VAULT_CACHES,LOOT_CACHES.filter(c=>c.mapId===map.id).map(({id,x,y})=>({id,x,y})));
});
test('valves, gate, shortcut, quest objects and daily spring follow saved state without resetting',()=>{
 const state=initialGridState(map),fresh=emptyUpperArt(),first=vaultSprites(map,state,fresh);assert.equal(first.find(p=>p.id==='cache_vault_rest').texture,'chest-closed');assert.equal(first.find(p=>p.id==='scene_vault_copper').texture,'copper-valve');assert.equal(first.find(p=>p.id==='door_bell_heart_seal'),undefined);
 const art={...fresh,claimed:['cache_vault_rest'],seenScenes:['scene_vault_echo','scene_vault_regulator'],flags:['flag_vault_valves'],questItems:['item_quest_regulator'],valveSequence:['scene_vault_copper'],fountainDays:{[map.id+':fountain_vault_rest']:1}};
 const progressed={...state,doors:{door_bell_heart_seal:true},secrets:{secret_vault_shortcut:true}},before=JSON.stringify(art),next=vaultSprites(map,progressed,art);
 assert.equal(next.find(p=>p.id==='cache_vault_rest').texture,'chest-open');assert.equal(next.find(p=>p.id==='scene_vault_copper').texture,'copper-valve-on');assert.equal(next.find(p=>p.id==='scene_vault_echo').texture,'echo-empty');assert.equal(next.find(p=>p.id==='scene_vault_regulator').texture,'regulator-empty');assert.equal(next.find(p=>p.id==='door_bell_heart_seal').texture,'door-open');assert.equal(next.find(p=>p.id==='secret_vault_shortcut').texture,'secret-open');assert.equal(next.find(p=>p.id==='fountain_vault_rest').spent,true);
 assert.equal(vaultSprites(map,progressed,{...art,elapsedMinutes:1000}).find(p=>p.id==='fountain_vault_rest').spent,false);assert.equal(JSON.stringify(art),before);
 const source={inventory:{claimed:art.claimed},quests:{questItems:art.questItems,seenScenes:art.seenScenes,flags:art.flags,valveSequence:art.valveSequence},expedition:{triggeredTraps:[],fountainDays:art.fountainDays},elapsedMinutes:0};assert.deepEqual(upperArtState(source),{...art,triggeredTraps:[],elapsedMinutes:0});
});
test('unknown traps and unrevealed secrets do not receive revealing artwork',()=>{
 const state=initialGridState(map),art=emptyUpperArt();assert.equal(knownVaultTraps(map,art).length,0);assert(!vaultSprites(map,state,art).some(p=>p.texture==='secret-open'));
 const known={...art,triggeredTraps:[map.id+':trap_vault_leech',map.id+':trap_vault_moth']};assert.deepEqual(knownVaultTraps(map,known).map(t=>[t.id,t.texture]),[['trap_vault_leech','leech-spent'],['trap_vault_moth','spark-spent']]);
});
test('all 31 production textures have 128x128 dimensions and preserve sprite alpha',()=>{
 assert.equal(VAULT_TEXTURES.length,31);
 for(const [i,key] of VAULT_TEXTURES.entries()){const b=readFileSync(root+'public/'+vaultAsset(key));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),128);assert.equal(b.readUInt32BE(20),128);if(i>=8)assert.equal(b[25],6,key+' must retain RGBA');}
});
function factory(w,h){return {getContext(){return {clearRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray(w*h*4).fill(200)};},createImageData(x,y){return {data:new Uint8ClampedArray(x*y*4),width:x,height:y};}};}};}
function context(){return {calls:[],imageSmoothingEnabled:true,globalAlpha:1,drawImage(im){this.calls.push(im.key);},putImageData(){},fillRect(){},fillText(){},font:'',textAlign:''};}
test('production vault renderer clips props by walls and never mutates map, grid or presentation state',()=>{
 const images=Object.fromEntries(VAULT_TEXTURES.map(key=>[key,{key}])),painter=new VaultEnvironment(images,factory),art=emptyUpperArt();
 const base={id:map.id,name:'Occlusion fixture',rows:['#######','#..#..#','#..#..#','#.....#','#######'],spawn:{x:1,y:2,facing:1},doors:[],props:[{id:'scene_vault_warning',kind:'banner',x:4,y:2,name:'Warning',description:''}],secrets:[],traps:[],fountains:[]};
 const state=initialGridState(base),before=JSON.stringify({base,state,art}),a=context();painter.render(a,base,state,viewPose(state),art);assert(!a.calls.includes('warning-tablet'));assert.equal(JSON.stringify({base,state,art}),before);
 const open={...base,rows:['#######','#..#..#','#.....#','#.....#','#######']},b=context();painter.render(b,open,state,viewPose(state),art);assert(b.calls.includes('warning-tablet'));assert.equal(b.globalAlpha,1);
});
