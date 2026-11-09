import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {UPPER_PROPS,UPPER_TEXTURES,UPPER_CACHES,upperAsset,emptyUpperArt,upperSprites,knownUpperTraps,validateUpperArt,upperArtState} from '../src/client/upper-art.ts';
import {UpperEnvironment} from '../src/client/upper-environment.ts';
import {LOOT_CACHES} from '../src/shared/rules/inventory.ts';
import {initialGridState} from '../src/shared/rules/grid.ts';
import {viewPose} from '../src/shared/rules/perspective.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),map=JSON.parse(readFileSync(root+'public/content/galleries.json','utf8'));
test('all thirteen authored Upper Cistern props have explicit production art',()=>{
 validateUpperArt(map);assert.equal(Object.keys(UPPER_PROPS).length,13);assert.equal(new Set(Object.values(UPPER_PROPS).map(p=>p.texture)).size,13);
 assert.throws(()=>validateUpperArt({...map,props:[...map.props,{id:'missing_art'}]}),/Missing upper/);
});
test('visual treasure anchors match all five authoritative first-floor loot caches',()=>{
 assert.deepEqual(UPPER_CACHES,LOOT_CACHES.filter(c=>c.mapId===map.id).map(({id,x,y})=>({id,x,y})));
});
test('chests, returned quest items, stair seal and daily fountains follow saved state without resetting',()=>{
 const state=initialGridState(map),fresh=emptyUpperArt(),first=upperSprites(map,state,fresh);assert.equal(first.find(p=>p.id==='cache_upper_archive').texture,'chest-closed');assert.equal(first.find(p=>p.id==='scene_upper_descent').texture,'stair-sealed');
 const art={...fresh,claimed:['cache_upper_archive'],seenScenes:['scene_upper_ledger','scene_upper_tools'],flags:['flag_upper_descent_ready'],fountainDays:{[map.id+':gallery_moon_pool']:1},valveSequence:['scene_vault_copper']};
 const before=JSON.stringify(art),next=upperSprites(map,state,art);assert.equal(next.find(p=>p.id==='cache_upper_archive').texture,'chest-open');assert.equal(next.find(p=>p.id==='scene_upper_ledger').texture,'ledger-empty','stays empty after quest item leaves party');assert.equal(next.find(p=>p.id==='scene_upper_tools').texture,'tools-empty');assert.equal(next.find(p=>p.id==='scene_upper_descent').texture,'stair-open');assert.equal(next.find(p=>p.id==='gallery_moon_pool').spent,true);
 assert.equal(upperSprites(map,state,{...art,elapsedMinutes:1000}).find(p=>p.id==='gallery_moon_pool').spent,false);assert.equal(JSON.stringify(art),before);
 const source={inventory:{claimed:art.claimed},quests:{questItems:[],seenScenes:art.seenScenes,flags:art.flags,valveSequence:art.valveSequence},expedition:{triggeredTraps:[],fountainDays:art.fountainDays},elapsedMinutes:0};assert.deepEqual(upperArtState(source),{...art,questItems:[],triggeredTraps:[],elapsedMinutes:0});
});
test('unknown traps and unrevealed secret passages do not receive revealing artwork',()=>{
 const state=initialGridState(map),art=emptyUpperArt();assert.equal(knownUpperTraps(map,art).length,0);assert(!upperSprites(map,state,art).some(p=>p.texture==='secret-open'));
 const known={...art,triggeredTraps:[map.id+':gallery_sigil_snare']};assert.deepEqual(knownUpperTraps(map,known).map(t=>[t.id,t.texture]),[['gallery_sigil_snare','rune-spent']]);
 const revealed={...state,secrets:{...state.secrets,gallery_hidden_arch:true}};assert.equal(upperSprites(map,revealed,art).filter(p=>p.texture==='secret-open').length,1);
});
test('all 34 production textures have 128x128 dimensions and preserve sprite alpha',()=>{
 assert.equal(UPPER_TEXTURES.length,34);
 for(const [i,key] of UPPER_TEXTURES.entries()){const b=readFileSync(root+'public/'+upperAsset(key));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),128);assert.equal(b.readUInt32BE(20),128);if(i>=9)assert.equal(b[25],6,key+' must retain RGBA');}
});
function factory(w,h){return {getContext(){return {clearRect(){},drawImage(){},getImageData(){return {data:new Uint8ClampedArray(w*h*4).fill(200)};},createImageData(x,y){return {data:new Uint8ClampedArray(x*y*4),width:x,height:y};}};}};}
function context(){return {calls:[],imageSmoothingEnabled:true,globalAlpha:1,drawImage(im){this.calls.push(im.key);},putImageData(){},fillRect(){},fillText(){}};}
test('production indoor renderer clips props by walls and never mutates map, grid or presentation state',()=>{
 const images=Object.fromEntries(UPPER_TEXTURES.map(key=>[key,{key}])),painter=new UpperEnvironment(images,factory),art=emptyUpperArt();
 const base={id:map.id,name:'Occlusion fixture',rows:['#######','#..#..#','#..#..#','#.....#','#######'],spawn:{x:1,y:2,facing:1},doors:[],props:[{id:'scene_upper_glass',kind:'mirror',x:4,y:2,name:'Glass',description:''}]};
 const state=initialGridState(base),before=JSON.stringify({base,state,art}),a=context();painter.render(a,base,state,viewPose(state),art);assert(!a.calls.includes('glass-chime'));assert.equal(JSON.stringify({base,state,art}),before);
 const open={...base,rows:['#######','#..#..#','#.....#','#.....#','#######']},b=context();painter.render(b,open,state,viewPose(state),art);assert(b.calls.includes('glass-chime'));assert.equal(b.globalAlpha,1);
});

test('hidden caches receive artwork only after discovery or prior claimed progress',()=>{const state=initialGridState(map),art=emptyUpperArt();assert(!upperSprites(map,state,art).some(p=>p.id==='cache_gallery_star'));assert(upperSprites(map,state,{...art,discovered:['cache_gallery_star']}).some(p=>p.id==='cache_gallery_star'));assert.equal(upperSprites(map,state,{...art,claimed:['cache_gallery_star']}).find(p=>p.id==='cache_gallery_star').texture,'chest-open');});
