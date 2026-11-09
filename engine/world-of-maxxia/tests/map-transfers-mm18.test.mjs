import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMapDocument} from '../src/shared/project/map-document.ts';
import {validateMapRegistry,newCampaign,travelCampaign,validateCampaign} from '../src/shared/rules/campaign.ts';
import {applyGridAction} from '../src/shared/rules/grid.ts';

const original=JSON.parse(readFileSync(new URL('../public/projects/SingleMapProof/maps/map_single_room.json',import.meta.url),'utf8'));
const fixture=()=>{
 const a=structuredClone(original),b=structuredClone(original);
 a.id='map_landing';a.name='Landing';b.id='map_tower';b.name='Tower';
 a.arrivals[0]={id:'arrival_start',name:'Starting room',x:4,y:3,facing:1};
 b.arrivals[0]={id:'arrival_start',name:'Tower start',x:4,y:3,facing:2};
 b.arrivals.push({id:'arrival_stairs',name:'Top of stairs',x:3,y:4,facing:3});
 a.objects.portals=[{id:'portal_ascending',x:5,y:3,targetMapId:b.id,targetArrivalId:'arrival_stairs',targetX:3,targetY:4,targetFacing:3,activation:'step'}];
 b.objects.portals=[{id:'portal_descending',x:3,y:4,targetMapId:a.id,targetArrivalId:'arrival_start',targetX:4,targetY:3,targetFacing:1,activation:'interact'}];
 return {a,b};
};

test('MM18 two new maps connect by a named arrival; step triggers after real movement only',()=>{
 const {a,b}=fixture();const registry=validateMapRegistry([a,b]);
 const state=newCampaign(registry,'map_landing');validateCampaign(state,registry);
 const before=state.maps.map_landing;
 const move=applyGridAction(registry.map_landing,before,'forward');assert(move.moved);
 assert.equal(move.state.x,5);
 const moved={...state,maps:{...state.maps,map_landing:move.state}};
 assert.equal(travelCampaign(moved,registry),null,'interact must not trigger a step-only portal');
 assert.equal(travelCampaign(moved,registry,'step'),null,'step requires a previous movement position');
 const crossed=travelCampaign(moved,registry,'step',{mapId:'map_landing',x:before.x,y:before.y});
 assert(crossed);assert.equal(crossed.state.currentMapId,'map_tower');
 assert.equal(crossed.state.maps.map_tower.x,3);assert.equal(crossed.state.maps.map_tower.y,4);
 assert.equal(crossed.state.maps.map_tower.facing,3);
 assert.equal(travelCampaign(crossed.state,registry,'step'),null,'a transfer arrival cannot auto-bounce');
 const returned=travelCampaign(crossed.state,registry);
 assert(returned);assert.equal(returned.state.currentMapId,'map_landing');
 assert.equal(returned.state.maps.map_landing.x,4);assert.equal(returned.state.maps.map_landing.facing,1);
 validateCampaign(returned.state,registry);
});

test('MM18 destination arrival ID is authoritative when its coordinates or facing change',()=>{
 const {a,b}=fixture();b.arrivals[1]={...b.arrivals[1],x:6,y:2,facing:0};
 const registry=validateMapRegistry([a,b]);const state=newCampaign(registry,'map_landing');
 state.maps.map_landing.x=5;state.maps.map_landing.y=3;state.maps.map_landing.visited.push('5,3');
 const crossed=travelCampaign(state,registry,'step',{mapId:'map_landing',x:4,y:3});
 assert(crossed);assert.equal(crossed.state.maps.map_tower.x,6);
 assert.equal(crossed.state.maps.map_tower.y,2);assert.equal(crossed.state.maps.map_tower.facing,0);
});

test('MM18 invalid arrival links, activation, duplicate transfers, blocked geometry are rejected',()=>{
 const {a,b}=fixture();
 const reject=fn=>{const maps=[structuredClone(a),structuredClone(b)];fn(maps[0],maps[1]);assert.throws(()=>validateMapRegistry(maps));};
 reject((one)=>{one.objects.portals[0].targetArrivalId='arrival_unknown';});
 reject((one)=>{one.objects.portals[0].targetMapId='map_missing';});
 reject((one)=>{one.objects.portals[0].activation='autorun';});
 reject((one)=>{one.objects.portals.push({...one.objects.portals[0],id:'portal_extra'});});
 reject((one)=>{one.objects.portals[0].x=0;});
 reject((one)=>{one.objects.portals[0].targetArrivalId='../../invalid';});
 reject((one,two)=>{two.arrivals=two.arrivals.filter(p=>p.id!=='arrival_stairs');});
 assert.equal(validateMapDocument(a).objects.portals[0].activation,'step');
});

test('MM18 legacy coordinate-only transfer still uses Space with no content or save migration',()=>{
 const {a,b}=fixture();delete a.objects.portals[0].targetArrivalId;delete a.objects.portals[0].activation;
 a.objects.portals[0].targetX=2;a.objects.portals[0].targetY=2;a.objects.portals[0].targetFacing=2;
 const registry=validateMapRegistry([a,b]);const state=newCampaign(registry,'map_landing');
 state.maps.map_landing.x=5;state.maps.map_landing.y=3;state.maps.map_landing.visited.push('5,3');
 assert.equal(travelCampaign(state,registry,'step',{mapId:'map_landing',x:4,y:3}),null);
 const crossed=travelCampaign(state,registry);
 assert(crossed);assert.equal(crossed.state.maps.map_tower.x,2);assert.equal(crossed.state.maps.map_tower.y,2);
});

test('MM18 shipped two-area proof is a valid indexed project with both transfer types',()=>{
 const read=part=>JSON.parse(readFileSync(new URL('../public/projects/TransferProof/'+part,import.meta.url),'utf8'));
 const index=read('maps/index.json');const maps=index.maps.map(m=>read('maps/'+m.path));
 const registry=validateMapRegistry(maps);
 assert.equal(Object.keys(registry).length,2);
 assert.equal(registry.map_landing.portals[0].activation,'step');
 assert.equal(registry.map_tower.portals[0].activation,'interact');
 assert.equal(registry.map_landing.portals[0].targetArrivalId,'arrival_top_of_stairs');
 assert.equal(read('TransferProof.maxxia').start.map.id,'map_landing');
});
