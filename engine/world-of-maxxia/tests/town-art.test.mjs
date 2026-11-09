import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {TOWN_TEXTURES,TOWN_PROPS,townAsset,facadeAt,validateTownArt} from '../src/client/town-art.ts';
import {TownEnvironment} from '../src/client/town-environment.ts';
import {initialGridState} from '../src/shared/rules/grid.ts';
import {viewPose} from '../src/shared/rules/perspective.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const town=JSON.parse(readFileSync(root+'public/content/town.json','utf8'));
test('every existing town object has explicit art, no generic-kind substitution',()=>{
 validateTownArt(town);assert.equal(town.props.length,17);assert.equal(Object.keys(TOWN_PROPS).length,17);
 assert.equal(new Set(Object.values(TOWN_PROPS).map(p=>p.texture)).size,17);
 assert.throws(()=>validateTownArt({...town,props:[...town.props,{id:'unmapped_prop'}]}),/Missing town art/);
 assert.throws(()=>validateTownArt({...town,props:town.props.slice(1)}),/Unknown town art content ID/);
});
test('all 27 town texture paths have correct logical dimensions and transparent props',()=>{
 assert.equal(TOWN_TEXTURES.length,27);
 const props=new Set([...Object.values(TOWN_PROPS).map(p=>p.texture),'gate-open']);
 for(const key of TOWN_TEXTURES){const b=readFileSync(root+'public/'+townAsset(key));assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(b.readUInt32BE(16),key==='sky'?1320:128);assert.equal(b.readUInt32BE(20),key==='sky'?440:128);if(props.has(key))assert.equal(b[25],6,key+' must retain RGBA transparency');}
});
test('town style assignment is deterministic and separates shrine, guild, forge and houses',()=>{
 assert.equal(facadeAt(2,3),'guild');assert.equal(facadeAt(6,3),'shrine');assert.equal(facadeAt(10,11),'forge');assert.equal(facadeAt(4,11),'house');
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)assert(TOWN_TEXTURES.includes(facadeAt(x,y)));
});
function fakeSurface(w,h){return {getContext(){return {drawImage(){},getImageData(){return {data:new Uint8ClampedArray(w*h*4).fill(200)};},createImageData(x,y){return {data:new Uint8ClampedArray(x*y*4),width:x,height:y};}};}};}
function fakeContext(){const calls=[];return {calls,imageSmoothingEnabled:true,globalAlpha:1,drawImage(source){calls.push(source.key);},putImageData(){},fillRect(){},strokeRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},fillText(){},measureText(s){return {width:s.length*5};}};}
const images=Object.fromEntries(TOWN_TEXTURES.map(key=>[key,{key}]));
function occlusionMap(blocked){return {id:'map_town',name:'Art occlusion fixture',rows:['#######','#..#..#',blocked?'#..#..#':'#.....#','#.....#','#######'],spawn:{x:1,y:2,facing:1},doors:[],props:[{id:'sign_npc_tessa_bell',kind:'banner',x:4,y:2,name:'Silver Lantern',description:''}]};}
test('production scenery columns are blocked by intervening walls and revealed in an open lane',()=>{
 const painter=new TownEnvironment(images,fakeSurface),blocked=occlusionMap(true),open=occlusionMap(false),a=fakeContext(),b=fakeContext();
 painter.render(a,blocked,initialGridState(blocked),viewPose(blocked.spawn));assert(!a.calls.includes('sign-tavern'));
 painter.render(b,open,initialGridState(open),viewPose(open.spawn));assert(b.calls.includes('sign-tavern'));
});
test('production town render is presentation-only and uses authored door states',()=>{
 const painter=new TownEnvironment(images,fakeSurface),state=initialGridState(town),before=JSON.stringify({town,state});
 const closed=fakeContext();painter.render(closed,town,state,viewPose(state));assert(closed.calls.includes('blue-door'));assert.equal(JSON.stringify({town,state}),before);
 const openState={...state,doors:{...state.doors,town_south_gate:true}},open=fakeContext();painter.render(open,town,openState,viewPose(openState));assert(open.calls.includes('gate-open'));assert.equal(open.globalAlpha,1);
});
