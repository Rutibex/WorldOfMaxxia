import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateGridMap,initialGridState,applyGridAction,isOpaque,DIRECTIONS} from '../src/shared/rules/grid.ts';
import {castRay,scenerySlots,viewPose} from '../src/shared/rules/perspective.ts';
const map=validateGridMap(JSON.parse(await readFile(new URL('../public/content/galleries.json',import.meta.url),'utf8')));
const at=(x,y,facing=0)=>({...initialGridState(map),x,y,facing});

test('cardinal turn cycles and inverse turns preserve tiles and time',()=>{
 let s=initialGridState(map),original={...s};
 for(let i=0;i<4;i++)s=applyGridAction(map,s,'turn_right').state;
 assert.deepEqual(s,original);
 for(let i=0;i<4;i++)s=applyGridAction(map,s,'turn_left').state;
 assert.deepEqual(s,original);
});
test('forward/backward/strafe relative offsets are correct for all four facings',()=>{
 for(let f=0;f<4;f++){
  const base=at(6,2,f),v=DIRECTIONS[f];
  for(const [a,dx,dy] of [['forward',v.x,v.y],['backward',-v.x,-v.y],['strafe_left',v.y,-v.x],['strafe_right',-v.y,v.x]]){
   const r=applyGridAction(map,base,a);assert.deepEqual([r.state.x,r.state.y,r.state.facing,r.state.minutes],[6+dx,2+dy,f,1],`${f} ${a}`);
  }
 }
});
test('walls, map boundary and closed doors block without consuming time or changing state',()=>{
 for(const [s,a] of [[at(1,1,0),'forward'],[at(3,8,1),'forward'],[at(1,9,2),'forward']]){
  const r=applyGridAction(map,s,a);assert.equal(r.changed,false);assert.strictEqual(r.state,s);
 }
 assert.equal(isOpaque(map,initialGridState(map),-1,-1),true);
});
test('opening and closing doors changes collision, time and optical occlusion',()=>{
 const s=at(3,8,1),closedRay=castRay(map,s,3.5,8.5,1,0);
 assert.equal(closedRay.x,4);assert.equal(closedRay.distance,.5);
 const open=applyGridAction(map,s,'interact').state;
 assert.equal(open.doors.door_south,true);assert.equal(open.minutes,1);
 assert.equal(s.doors.door_south,false,'prior immutable state unchanged');
 assert.equal(applyGridAction(map,open,'forward').state.x,4);
 assert.equal(castRay(map,open,3.5,8.5,1,0).x,8);
 const shut=applyGridAction(map,open,'interact').state;
 assert.equal(shut.doors.door_south,false);assert.equal(shut.minutes,2);
});
test('visited cells deduplicate and scenery inspection costs a minute without moving',()=>{
 const s=at(6,8,1);const result=applyGridAction(map,s,'interact');
 assert.match(result.message,/mirror/i);assert.equal(result.state.minutes,s.minutes+1);assert.equal(result.state.x,s.x);assert.equal(s.minutes,0);
 let walk=initialGridState(map);walk=applyGridAction(map,walk,'forward').state;walk=applyGridAction(map,walk,'backward').state;
 assert.equal(new Set(walk.visited).size,walk.visited.length);assert.equal(walk.minutes,2);
});
test('sealed diagonal corners cannot leak a view into hidden cells',()=>{
 const m=validateGridMap({id:'map_corner',name:'Corner',rows:['#####','#.#.#','##..#','#...#','#####'],spawn:{x:1,y:1,facing:1},doors:[],props:[]});
 const hit=castRay(m,initialGridState(m),1.5,1.5,1,1);
 assert.equal(hit.distance,.5);assert.ok(hit.x===2&&hit.y===1||hit.x===1&&hit.y===2);
});
test('all floors and scenery can be reached when test doors are opened',()=>{
 const state=initialGridState(map);for(const d of map.doors)state.doors[d.id]=true;for(const d of map.secrets??[])state.secrets[d.id]=true;
 const pending=[[state.x,state.y]],seen=new Set();
 while(pending.length){const [x,y]=pending.pop();if(seen.has(`${x},${y}`))continue;seen.add(`${x},${y}`);for(const v of DIRECTIONS)if(!isOpaque(map,state,x+v.x,y+v.y))pending.push([x+v.x,y+v.y]);}
 for(let y=0;y<map.rows.length;y++)for(let x=0;x<map.rows[0].length;x++)if(map.rows[y][x]!=='#')assert.ok(seen.has(`${x},${y}`),`${x},${y}`);
});
test('depth/lateral slots follow camera basis and scenery behind camera is excluded',()=>{
 const pose=viewPose(at(3,8,1));const slots=scenerySlots(map,pose);const mirror=slots.find(s=>s.id==='prop_mirror');
 assert.ok(mirror);assert.equal(mirror.depth,4);assert.ok(Math.abs(mirror.lateral)<1e-8);assert.equal(mirror.depthSlot,3);
 assert.ok(!scenerySlots(map,viewPose(at(3,8,3))).some(s=>s.id==='prop_mirror'));
});
test('every passable map tile and cardinal heading yields finite bounded perspective rays',()=>{
 const state=initialGridState(map);for(const d of map.doors)state.doors[d.id]=true;
 for(let y=0;y<map.rows.length;y++)for(let x=0;x<map.rows[0].length;x++)if(map.rows[y][x]!== '#')for(let f=0;f<4;f++){
  const angle=f*Math.PI/2;
  for(const offset of [-.66,0,.66]){
   const hit=castRay(map,state,x+.5,y+.5,Math.sin(angle)+Math.cos(angle)*offset,-Math.cos(angle)+Math.sin(angle)*offset);
   assert.ok(Number.isFinite(hit.distance)&&hit.distance>0);assert.ok(hit.u>=0&&hit.u<1);
  }
 }
});
test('invalid map geometry, duplicate doors and missing definitions are rejected',()=>{
 assert.throws(()=>validateGridMap({...map,rows:['###','#.','###']}));
 assert.throws(()=>validateGridMap({...map,doors:[]}));
 assert.throws(()=>validateGridMap({...map,doors:[...map.doors,map.doors[0]]}));
 assert.throws(()=>validateGridMap({...map,spawn:{x:0,y:0,facing:0}}));
});
