import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateWorkspace} from '../../../tools/validate-map-workspace.mjs';
import {initialGridState,applyGridAction} from '../src/shared/rules/grid.ts';
const base=JSON.parse(fs.readFileSync(new URL('../public/projects/SingleMapProof/maps/map_single_room.json',import.meta.url)));
function payload(){const map=structuredClone(base);map.id='map_geometry_proof';map.name='Geometry Proof';return {index:{format:'maxxia-map-index',version:1,maps:[{id:map.id,path:map.id+'.json'}]},maps:{[map.id]:map},start:{map:{id:map.id},x:4,y:3,facing:2}};}
test('MM17 new map ID uses canonical adapter and actual movement/collision',()=>{
 const p=payload(),doc=p.maps.map_geometry_proof;doc.geometry.rows[4]='#...#...#';
 const registry=validateWorkspace(p),map=registry.map_geometry_proof;let state=initialGridState(map);
 const blocked=applyGridAction(map,state,'forward');assert.equal(blocked.moved,false);
 state=applyGridAction(map,state,'strafe_right').state;
 assert.equal(applyGridAction(map,state,'forward').moved,true);
 assert.equal(map.name,'Geometry Proof');assert.equal(doc.id,'map_geometry_proof');
});
test('MM17 save guard rejects a blocked project start',()=>{const p=payload();p.start.x=0;assert.throws(()=>validateWorkspace(p),/Starting position/);});
test('MM17 save guard rejects damaged border and door without definition',()=>{
 const p=payload();p.maps.map_geometry_proof.geometry.rows[0]='.########';assert.throws(()=>validateWorkspace(p),/perimeter/);
 const q=payload();q.maps.map_geometry_proof.geometry.rows[2]='#..D....#';assert.throws(()=>validateWorkspace(q),/door tile/);
});
test('MM17 save guard checks incoming portal destinations after geometry edits',()=>{
 const p=payload(),other=structuredClone(base);other.id='map_other';p.maps.map_other=other;p.index.maps.push({id:other.id,path:'map_other.json'});
 other.objects.portals.push({id:'portal_proof',x:2,y:2,targetMapId:'map_geometry_proof',targetX:3,targetY:3,targetFacing:0});
 validateWorkspace(p);p.maps.map_geometry_proof.geometry.rows[3]='#..#....#';assert.throws(()=>validateWorkspace(p),/portal/);
});
test('MM17 save guard accepts all shipped map-index projects',()=>{
 const root=new URL('../public/projects/',import.meta.url);
 for(const folder of ['WorldOfMaxxia','ExpansionProof','SingleMapProof']){
  const dir=folder==='WorldOfMaxxia'?new URL('../',root):new URL(folder+'/',root);
  const file=folder==='WorldOfMaxxia'?'WorldOfMaxxia.maxxia':folder+'.maxxia',manifest=JSON.parse(fs.readFileSync(new URL(file,dir)));
  const indexUrl=new URL(manifest.content.index,dir),index=JSON.parse(fs.readFileSync(indexUrl));
  const maps=Object.fromEntries(index.maps.map(m=>[m.id,JSON.parse(fs.readFileSync(new URL(m.path,indexUrl)))]));
  validateWorkspace({index,maps,start:manifest.start});
 }
});
test('MM17 editor stdin validator executes and returns errors without writes',()=>{
 const url=new URL('../../../tools/validate-map-workspace.mjs',import.meta.url);
 const good=spawnSync(process.execPath,['--experimental-strip-types',url.pathname],{input:JSON.stringify(payload()),encoding:'utf8'});assert.equal(good.status,0,good.stderr);
 const p=payload();delete p.maps.map_geometry_proof;
 const bad=spawnSync(process.execPath,['--experimental-strip-types',url.pathname],{input:JSON.stringify(p),encoding:'utf8'});assert.equal(bad.status,1);assert.match(bad.stderr,/declare id/);
});
