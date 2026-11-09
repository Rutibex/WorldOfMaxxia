import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMapRegistry,newCampaign,serializeCampaign} from '../src/shared/rules/campaign.ts';
import {SeededRng} from '../src/shared/rules/rng.ts';
import {newScopedState,validateScopedState,applyScopedAction,readScopedValue} from '../src/shared/rules/scoped-state.ts';
import {CampaignInstanceStore,INSTANCE_PREFIX,validateInstanceIdentity} from '../src/shared/saves/campaign-instances.ts';
import {CampaignStore,SAVE_PREFIX} from '../src/shared/saves/campaign-store.ts';
import {projectCampaignStorage} from '../src/client/project-boot.ts';
const root=new URL('../public/content/',import.meta.url);
const registry=validateMapRegistry(['town','galleries','vault'].map(name=>JSON.parse(readFileSync(new URL(name+'.json',root)))));
const storage=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const identity={projectId:'project_world_of_maxxia',adventureId:'firstlight',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:'a'.repeat(64),providers:[{id:'core',version:'1.0.1'},{id:'brass',version:'1.0.0'}]};
const uid=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const newStore=(s=storage(),lock=identity)=>new CampaignInstanceStore(s,registry,lock);
const flag='brass:flag:lever_open',count='brass:counter:turns',collection='brass:collection:clues';

test('MP07 two instances of the SAME adventure remain independent across save/load and restarts',()=>{
 const db=storage(),first=newStore(db),left=newCampaign(registry),right=newCampaign(registry);
 left.elapsedMinutes=91;left.party.resources.gold=144;left.maps.map_town.doors.town_north_gate=true;left.rng=new SeededRng('left').snapshot();left.rollCount=8;
 right.elapsedMinutes=7;right.party.resources.gold=712;right.rng=new SeededRng('right').snapshot();right.rollCount=2;
 const a=first.create('Left timeline',left,newScopedState(),uid(1));
 let scoped=applyScopedAction(first.getScopedState(),{kind:'flag',address:{scope:'local',mapId:'map_town'},key:flag,value:true},registry);
 scoped=applyScopedAction(scoped,{kind:'collection-add',address:{scope:'campaign'},key:collection,value:'record'},registry);
 first.setScopedState(scoped);first.save('auto',left);
 const b=first.create('Right timeline',right,newScopedState(),uid(2));
 assert.notEqual(a,b);assert.equal(first.load('auto').party.resources.gold,712);
 const restarted=newStore(db);assert.equal(restarted.listInstances().length,2);
 restarted.activate(a);const recoveredA=restarted.load('auto');assert.equal(recoveredA.elapsedMinutes,91);assert.equal(recoveredA.party.resources.gold,144);assert.equal(recoveredA.maps.map_town.doors.town_north_gate,true);
 assert.equal(readScopedValue(restarted.getScopedState(),{scope:'local',mapId:'map_town'},'flag',flag,registry),true);
 assert.deepEqual(readScopedValue(restarted.getScopedState(),{scope:'campaign'},'collection',collection,registry),['record']);
 restarted.activate(b);const recoveredB=restarted.load('auto');assert.equal(recoveredB.elapsedMinutes,7);assert.equal(recoveredB.party.resources.gold,712);assert.equal(recoveredB.maps.map_town.doors.town_north_gate,false);
 assert.equal(readScopedValue(restarted.getScopedState(),{scope:'local',mapId:'map_town'},'flag',flag,registry),false);
});

test('MP07 save/reload reproduces subsequent seeded rolls and game clock',()=>{
 const db=storage(),store=newStore(db),game=newCampaign(registry),rng=new SeededRng('chronicle');
 game.elapsedMinutes+=114;game.rng=rng.snapshot();game.rollCount=0;store.create('Replay',game,newScopedState(),uid(3));
 const firstRoll=rng.integer(1,20),secondRoll=rng.integer(1,100);
 store.save('slot1',game);const resumed=store.load('slot1'),again=new SeededRng(1);again.restore(resumed.rng);
 assert.equal(again.integer(1,20),firstRoll);assert.equal(again.integer(1,100),secondRoll);assert.equal(resumed.elapsedMinutes,114);
 const result=applyScopedAction(store.getScopedState(),{kind:'counter',address:{scope:'campaign'},key:count,delta:3},registry);
 store.setScopedState(result);store.save('slot2',game);store.load('slot1');assert.equal(readScopedValue(store.getScopedState(),{scope:'campaign'},'counter',count,registry),0);
 store.load('slot2');assert.equal(readScopedValue(store.getScopedState(),{scope:'campaign'},'counter',count,registry),3);
});

test('MP07 explicit map-local scopes separate map locations; negative and overflow counters rejected atomically',()=>{
 const initial=newScopedState();let s=applyScopedAction(initial,{kind:'counter',address:{scope:'local',mapId:'map_town'},key:count,delta:-3},registry);
 s=applyScopedAction(s,{kind:'counter',address:{scope:'campaign'},key:count,delta:2},registry);
 assert.equal(readScopedValue(s,{scope:'local',mapId:'map_town'},'counter',count,registry),-3);
 assert.equal(readScopedValue(s,{scope:'local',mapId:'map_resonator_vault'},'counter',count,registry),0);
 assert.equal(readScopedValue(s,{scope:'campaign'},'counter',count,registry),2);
 assert.equal(readScopedValue(initial,{scope:'campaign'},'counter',count,registry),0);
 assert.throws(()=>applyScopedAction(s,{kind:'counter',address:{scope:'campaign'},key:count,delta:100000001},registry),/overflow/);
 assert.throws(()=>applyScopedAction(s,{kind:'flag',address:{scope:'local',mapId:'missing'},key:flag,value:true},registry),/map/);
 assert.equal(readScopedValue(s,{scope:'campaign'},'counter',count,registry),2);
});

test('MP07 typed flags and collections reject wrong kinds, unknown maps, invalid values and prototype keys',()=>{
 const actions=[
  {kind:'flag',address:{scope:'campaign'},key:count,value:true},
  {kind:'counter',address:{scope:'campaign'},key:flag,delta:1},
  {kind:'collection-add',address:{scope:'campaign'},key:collection,value:'__proto__'},
  {kind:'flag',address:{scope:'local',mapId:'unknown'},key:flag,value:true},
  {kind:'flag',address:{scope:'campaign'},key:'__proto__',value:true},
 ];
 for(const action of actions)assert.throws(()=>applyScopedAction(newScopedState(),action,registry));
 const s=applyScopedAction(newScopedState(),{kind:'collection-add',address:{scope:'campaign'},key:collection,value:'clue_one'},registry);
 assert.deepEqual(applyScopedAction(s,{kind:'collection-add',address:{scope:'campaign'},key:collection,value:'clue_one'},registry).campaign.collections[collection],['clue_one']);
 assert.deepEqual(applyScopedAction(s,{kind:'collection-remove',address:{scope:'campaign'},key:collection,value:'clue_one'},registry).campaign.collections[collection],[]);
 const invalid=structuredClone(s);invalid.local.unknown={flags:{},counters:{},collections:{}};assert.throws(()=>validateScopedState(invalid,registry),/Unknown/);
});

test('MP07 unchanged legacy format-18 slots remain readable and byte-identical through instance saves',()=>{
 const db=storage(),legacy=new CampaignStore(db,registry),game=newCampaign(registry);legacy.save('slot1',game);const old=db.getItem(SAVE_PREFIX+'slot1');
 const store=newStore(db);store.create('Independent',game,newScopedState(),uid(4));game.elapsedMinutes=123;store.save('auto',game);
 assert.equal(db.getItem(SAVE_PREFIX+'slot1'),old);assert.deepEqual(legacy.load('slot1'),newCampaign(registry));
 const imported=store.importText(serializeCampaign(game,registry));assert.equal(imported.campaign.elapsedMinutes,123);assert.deepEqual(imported.scoped,newScopedState());
});

test('MP07 locked catalogue/provenance cannot be silently adopted and files remain unchanged',()=>{
 const db=storage(),store=newStore(db);store.create('Locked',newCampaign(registry),newScopedState(),uid(5));const original=db.getItem(INSTANCE_PREFIX+uid(5)+':auto');
 const changed={...identity,providers:[{id:'core',version:'1.0.1'},{id:'brass',version:'1.1.0'}]};
 const other=newStore(db,changed);assert.equal(other.listInstances()[0].valid,false);
 assert.throws(()=>other.activate(uid(5)),/no readable slots/);
 assert.equal(db.getItem(INSTANCE_PREFIX+uid(5)+':auto'),original);
 assert.throws(()=>validateInstanceIdentity({...identity,catalogueHash:'broken'}),/identity/);
});

test('MP07 damaged manual slots never overwrite without an explicit backup and valid slots survive',()=>{
 const db=storage(),store=newStore(db);store.create('Protected',newCampaign(registry),newScopedState(),uid(6));
 const key=INSTANCE_PREFIX+uid(6)+':slot2';db.setItem(key,'not-json');
 assert.equal(store.list()[2].valid,false);assert.throws(()=>store.save('slot2',newCampaign(registry)),/damaged/);assert.equal(db.getItem(key),'not-json');
 store.save('slot2',newCampaign(registry),true);assert.equal(db.getItem(key+':backup'),'not-json');assert.equal(store.list()[2].valid,true);
});

test('MP07 failed index write rolls back only new instance and leaves older instances/saves untouched',()=>{
 const db=storage(),store=newStore(db);store.create('First',newCampaign(registry),newScopedState(),uid(7));
 const original=db.getItem(INSTANCE_PREFIX+uid(7)+':auto'),set=db.setItem.bind(db);
 db.setItem=(key,value)=>{if(key===INSTANCE_PREFIX+'index')throw new Error('STORAGE_QUOTA');set(key,value);};
 assert.throws(()=>store.create('Second',newCampaign(registry),newScopedState(),uid(8)),/STORAGE_QUOTA/);
 assert.equal(db.getItem(INSTANCE_PREFIX+uid(8)+':auto'),null);assert.equal(db.getItem(INSTANCE_PREFIX+uid(7)+':auto'),original);
});

test('MP07 distinct enabled catalogues remain isolated when MP06 prefixes are used',()=>{
 const db=storage(),a=projectCampaignStorage(db,'project_world_of_maxxia','a'.repeat(64)),b=projectCampaignStorage(db,'project_world_of_maxxia','b'.repeat(64));
 const ia={...identity,catalogueHash:'a'.repeat(64)},ib={...identity,catalogueHash:'b'.repeat(64)};
 const storeA=newStore(a,ia),storeB=newStore(b,ib);
 storeA.create('Same adventure A',newCampaign(registry),newScopedState(),uid(9));
 assert.equal(storeB.listInstances().length,0);storeB.create('Same adventure B',newCampaign(registry),newScopedState(),uid(10));
 assert.equal(storeA.listInstances().length,1);assert.equal(storeB.listInstances().length,1);
});

test('MP07 export/import roundtrip includes instance identity and scoped state; foreign identity rejected',()=>{
 const db=storage(),store=newStore(db),game=newCampaign(registry);store.create('Export',game,newScopedState(),uid(11));
 store.setScopedState(applyScopedAction(store.getScopedState(),{kind:'flag',address:{scope:'campaign'},key:flag,value:true},registry));
 const text=store.exportText(game),copy=store.importText(text);assert.equal(readScopedValue(copy.scoped,{scope:'campaign'},'flag',flag,registry),true);
 const altered=JSON.parse(text);altered.identity.catalogueHash='b'.repeat(64);assert.throws(()=>store.importText(JSON.stringify(altered)),/exact original/);
 assert.equal(store.load('auto').elapsedMinutes,0);
});
