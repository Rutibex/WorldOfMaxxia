import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,validateMapRegistry,parseCampaign,serializeCampaign} from '../src/shared/rules/campaign.ts';
import {dispatchSimulation,replaySimulation,validateSimulationCommand} from '../src/shared/rules/simulation.ts';
import {moveExpedition,restExpedition} from '../src/shared/rules/expedition.ts';
import {beginEncounter,combatAction} from '../src/shared/rules/combat.ts';
const root=new URL('../public/content/',import.meta.url);
const maps=validateMapRegistry(['town','galleries','vault'].map(name=>JSON.parse(readFileSync(new URL(name+'.json',root)))));
const fresh=()=>newCampaign(maps);
const dungeon=()=>{const s=fresh();s.currentMapId='map_diagnostic_galleries';return s;};
const emptyCombat=s=>{for(const encounter of Object.values(s.combat.encounters)){for(const enemy of encounter.enemies)enemy.hp=0;encounter.cleared=true;encounter.rewarded=true;}return s;};
const at=(s,id,x,y,facing)=>{s.currentMapId=id;const w=s.maps[id];w.x=x;w.y=y;w.facing=facing;const key=`${x},${y}`;if(!w.visited.includes(key))w.visited.push(key);return s;};
test('MP11 navigation uses the identical rules as direct expedition and emits ordered typed events',()=>{
 const s=fresh(),action={type:'grid',action:'forward'};
 const direct=moveExpedition(s,maps,'forward'),via=dispatchSimulation(s,maps,action);
 assert.equal(via.status,'applied');assert.deepEqual(via.state,direct.state);assert.deepEqual(s,fresh());
 assert.equal(via.events[0].type,'command.accepted');assert.equal(via.events[1].type,'state.changed');
 assert.ok(via.events.some(e=>e.type==='position.changed'));assert.ok(via.events.some(e=>e.type==='time.advanced'));
 assert.equal(via.events.at(-1).type,'message');
});
test('MP11 blocked movement and invalid commands are non-mutating and have different statuses',()=>{
 const s=at(fresh(),'map_town',7,13,2),text=JSON.stringify(s);
 const blocked=dispatchSimulation(s,maps,{type:'grid',action:'forward'});
 assert.equal(blocked.status,'blocked');assert.equal(blocked.changed,false);assert.equal(JSON.stringify(blocked.state),text);
 for(const cmd of [{type:'grid',action:'teleport'},{type:'combat',action:'target'}, {type:'roll',min:8,max:2},{type:'untrusted'},null]){
  const fail=dispatchSimulation(s,maps,cmd);assert.equal(fail.status,'failed');assert.equal(fail.errorCode,'E_COMMAND');assert.equal(JSON.stringify(fail.state),text);
 }
});
test('MP11 deterministic seeded roll agrees with canonical RNG and survives saves',()=>{
 const s=fresh(),r=dispatchSimulation(s,maps,{type:'roll',min:1,max:20});
 assert.equal(r.status,'applied');assert.equal(r.events.filter(e=>e.type==='roll.result').length,1);
 assert.equal(r.state.rollCount,1);assert.notEqual(r.state.rng.state,s.rng.state);
 assert.deepEqual(parseCampaign(serializeCampaign(r.state,maps),maps),r.state);
 const replay=dispatchSimulation(parseCampaign(serializeCampaign(s,maps),maps),maps,{type:'roll',min:1,max:20});assert.deepEqual(replay,r);
});
test('MP11 rest and exploration actions share expedition rules, and no-op search is an actual ten-minute action',()=>{
 const s=emptyCombat(fresh());const r=dispatchSimulation(s,maps,{type:'expedition',action:'rest'});
 assert.deepEqual(r.state,restExpedition(s,maps).state);assert.equal(r.state.elapsedMinutes,480);
 const search=dispatchSimulation(s,maps,{type:'expedition',action:'search'});assert.equal(search.changed,true);assert.equal(search.state.elapsedMinutes,10);
});
test('MP11 battle initiative and block match the original rules and preserve transient presentation',()=>{
 const s=dungeon(),start=dispatchSimulation(s,maps,{type:'combat',action:'engage'});assert.equal(start.status,'applied');
 assert.deepEqual(start.state,beginEncounter(s,maps).state);
 const next=dispatchSimulation(start.state,maps,{type:'combat',action:'block'});
 assert.deepEqual(next.state,combatAction(start.state,maps,'block').state);
 assert.deepEqual(next.presentation,next.events.filter(e=>e.type==='presentation').map(e=>e.value));
});
test('MP11 recorded movement and rolls replay to identical state and event logs, independent of wall time',()=>{
 const cmds=[{type:'grid',action:'forward'},{type:'grid',action:'turn_right'},{type:'roll',min:1,max:20},{type:'grid',action:'forward'}];
 const a=replaySimulation(fresh(),maps,cmds),b=replaySimulation(fresh(),maps,cmds);
 assert.deepEqual(a,b);assert.deepEqual(parseCampaign(serializeCampaign(a.state,maps),maps),a.state);
});
test('MP11 triggers have stable priority/id ordering and are processed after the causal event',()=>{
 const calls=[];const triggers=[
  {id:'z',priority:5,onEvent:e=>{if(e.type==='roll.result')calls.push('z');return null;}},
  {id:'a',priority:5,onEvent:e=>{if(e.type==='roll.result')calls.push('a');return null;}},
  {id:'first',priority:-1,onEvent:e=>{if(e.type==='roll.result')calls.push('first');return null;}}
 ];
 const r=dispatchSimulation(fresh(),maps,{type:'roll',min:1,max:6},{triggers});
 assert.equal(r.status,'applied');assert.deepEqual(calls,['first','a','z']);
});
test('MP11 trigger follow-up actions remain inside the same atomic commit',()=>{
 const s=fresh(),trigger={id:'follow',priority:0,onEvent:e=>e.type==='roll.result'?{type:'roll',min:1,max:6}:null};
 const r=dispatchSimulation(s,maps,{type:'roll',min:1,max:10},{triggers:[trigger] ,maxCommands:2});
 assert.equal(r.status,'failed','re-entry beyond budget rejects entire transaction');
 assert.deepEqual(r.state,s);assert.equal(r.errorCode,'E_COMMAND_LIMIT');
 const once={id:'follow-once',priority:0,onEvent:e=>e.type==='roll.result'&&e.max===10?{type:'roll',min:1,max:6}:null};
 const ok=dispatchSimulation(s,maps,{type:'roll',min:1,max:10},{triggers:[once],maxCommands:2});
 assert.equal(ok.status,'applied');assert.equal(ok.state.rollCount,2);
 assert.deepEqual(ok.events.filter(e=>e.type==='roll.result').map(e=>e.max),[10,6]);
});
test('MP11 a blocked trigger rolls back earlier staged reward and RNG changes',()=>{
 const s=at(fresh(),'map_town',7,13,2),text=JSON.stringify(s);
 const trigger={id:'block',priority:0,onEvent:e=>e.type==='roll.result'?{type:'grid',action:'forward'}:null};
 const result=dispatchSimulation(s,maps,{type:'roll',min:1,max:20},{triggers:[trigger]});
 assert.equal(result.status,'failed');assert.equal(result.errorCode,'E_ATOMIC');assert.equal(JSON.stringify(result.state),text);
 assert.deepEqual(result.events.map(e=>e.type),['command.failed']);
});
test('MP11 malformed handler output and thrown handler exception roll back, never emit partial success events',()=>{
 const s=fresh();for(const onEvent of [()=>({type:'not-a-command'}),()=>{throw Error('script failure');}]){
  const r=dispatchSimulation(s,maps,{type:'roll',min:1,max:10},{triggers:[{id:'bad',priority:0,onEvent}]});
  assert.equal(r.status,'failed');assert.deepEqual(r.state,s);assert.deepEqual(r.events.map(e=>e.type),['command.failed']);
 }
});
test('MP11 event and trigger budgets stop infinite self-activation without modifying source',()=>{
 const s=fresh(),cycle={id:'loop',priority:0,onEvent:e=>e.type==='command.accepted'?{type:'roll',min:1,max:6}:null};
 const r=dispatchSimulation(s,maps,{type:'roll',min:1,max:6},{triggers:[cycle],maxCommands:3});
 assert.equal(r.status,'failed');assert.ok(['E_COMMAND_LIMIT','E_REENTRY'].includes(r.errorCode));assert.deepEqual(r.state,s);
 const budget=dispatchSimulation(s,maps,{type:'roll',min:1,max:20},{maxEvents:2});assert.equal(budget.errorCode,'E_EVENT_LIMIT');assert.deepEqual(budget.state,s);
});
test('MP11 loot/service/invalid item commands do not grant inventory or mutate user state on failure',()=>{
 const s=fresh(),before=JSON.stringify(s);
 for(const command of [{type:'item',request:{action:'use',itemId:'stack_does_not_exist'}},
  {type:'loot',request:{containerId:'fake'}},{type:'service',request:{serviceId:'unknown',action:'purchase'}}]){
  const r=dispatchSimulation(s,maps,command);assert.equal(r.changed,false);assert.equal(JSON.stringify(s),before);
 }
});
test('MP11 reciprocal step portals do not bounce and advance only one travel cost',()=>{
 const fixture=structuredClone(maps);fixture.map_town.portals.push(
  {id:'mp11_step_one',x:7,y:11,targetMapId:'map_town',targetX:6,targetY:12,targetFacing:1,activation:'step'},
  {id:'mp11_step_two',x:6,y:12,targetMapId:'map_town',targetX:7,targetY:11,targetFacing:2,activation:'step'}
 );
 const s=fresh(),r=dispatchSimulation(s,fixture,{type:'grid',action:'forward'});
 assert.equal(r.status,'applied');assert.equal(r.state.maps.map_town.x,6);assert.equal(r.state.maps.map_town.y,12);
 assert.equal(r.state.elapsedMinutes,6,'one movement minute plus one five-minute journey');
 assert.equal(r.events.filter(e=>e.type==='position.changed').length,1);
});
test('MP11 validateSimulationCommand exports a precise runtime contract',()=>{
 assert.deepEqual(validateSimulationCommand({type:'grid',action:'interact'}),{type:'grid',action:'interact'});
 assert.throws(()=>validateSimulationCommand({type:'grid',action:'break_quest'}),/Unsupported/);
});
test('MP11 active member selection and order changes use the same validated command boundary',()=>{
 const s=fresh(),second=s.party.order[1];const chosen=dispatchSimulation(s,maps,{type:'party',action:'select',heroId:second});
 assert.equal(chosen.status,'applied');assert.equal(chosen.state.party.selectedId,second);assert.equal(s.party.selectedId,s.party.order[0]);
 const reordered=dispatchSimulation(chosen.state,maps,{type:'party',action:'exchange',heroId:second,otherId:s.party.order[0]});
 assert.equal(reordered.state.party.order[0],second);
 const invalid=dispatchSimulation(s,maps,{type:'party',action:'select',heroId:'unavailable'});
 assert.equal(invalid.status,'failed');assert.deepEqual(invalid.state,s);
});
test('MP11 prepared and Quick Fight settings are persisted through the shared rules boundary',()=>{
 const s=fresh();const id=s.party.order[0],style=s.party.characters[id].combatSetup.prepared;
 const r=dispatchSimulation(s,maps,{type:'party',action:'quick',heroId:id,quickAction:'block'});
 assert.equal(r.status,'applied');assert.equal(r.state.party.characters[id].combatSetup.quickAction,'block');
 assert.equal(r.state.party.characters[id].combatSetup.prepared,style);
 assert.deepEqual(parseCampaign(serializeCampaign(r.state,maps),maps),r.state);
});
test('MP11 a failed follow-up cannot partially claim real Firstlight treasure or duplicate rewards',()=>{
 const s=at(fresh(),'map_town',9,11,0),original=JSON.stringify(s);
 const trigger={id:'reject-after-treasure',priority:0,onEvent:e=>e.type==='state.changed'&&e.areas.includes('inventory')?{type:'item',request:{action:'use',itemId:'stack_missing'}}:null};
 const rejected=dispatchSimulation(s,maps,{type:'grid',action:'interact'},{triggers:[trigger]});
 assert.equal(rejected.status,'failed');assert.equal(rejected.errorCode,'E_ATOMIC');
 assert.equal(JSON.stringify(rejected.state),original);assert.equal(JSON.stringify(s),original);
 assert.equal(s.inventory.claimed.includes('cache_town_market'),false);
 const good=dispatchSimulation(s,maps,{type:'grid',action:'interact'});assert.equal(good.status,'applied');
 assert.equal(good.state.inventory.claimed.filter(id=>id==='cache_town_market').length,1);
 const again=dispatchSimulation(good.state,maps,{type:'grid',action:'interact'});
 assert.equal(again.state.inventory.claimed.filter(id=>id==='cache_town_market').length,1);
 assert.equal(again.state.inventory.items.length,good.state.inventory.items.length);
});
