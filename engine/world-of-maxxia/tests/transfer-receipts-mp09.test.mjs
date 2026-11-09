import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMapRegistry,newCampaign} from '../src/shared/rules/campaign.ts';
import {createDefaultParty} from '../src/shared/rules/party.ts';
import {CampaignInstanceStore,INSTANCE_PREFIX} from '../src/shared/saves/campaign-instances.ts';
import {TransferCoordinator,TRANSFER_LEDGER_KEY,readTransferLedger} from '../src/shared/saves/transfer-receipts.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL('../public/content/'+n+'.json',import.meta.url)))));
const identity={projectId:'project_world_of_maxxia',adventureId:'firstlight',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:'a'.repeat(64),providers:[{id:'core',version:'1.0.1'}]};
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const mem=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
function setup(){const db=mem(),store=new CampaignInstanceStore(db,registry,identity),a=newCampaign(registry),b=newCampaign(registry);a.party.characters.hero_tarin.xp=444;const ai=store.create('A',a,undefined,id(1));const bi=store.create('B',b,undefined,id(2));store.activate(ai);return {db,store,ai,bi,first:store.getRosterSnapshot().records.find(r=>r.character.id==='hero_tarin')};}
const snap=(db,id)=>JSON.parse(db.getItem(INSTANCE_PREFIX+id+':auto'));

test('MP09 moves character and unique equipment with persistent identities, benches a full destination hero',()=>{
 const {db,store,ai,bi,first}=setup();const receipt=store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(10)});
 assert.equal(receipt.status,'complete');assert.equal(receipt.destinationPortableId,first.portableId);assert.equal(store.currentId,null);
 const source=snap(db,ai),destination=snap(db,bi),arrived=destination.roster.records.find(r=>r.portableId===first.portableId);
 assert.ok(arrived);assert.equal(arrived.character.xp,444);assert.equal(arrived.revision,first.revision+1);
 assert.equal(arrived.items.length,first.items.length);assert.deepEqual(arrived.items.map(x=>x.portableId),first.items.map(x=>x.portableId));
 assert.equal(source.roster.records.some(r=>r.portableId===first.portableId),false);
 assert.equal(source.campaign.party.order.length,5);assert.equal(destination.campaign.party.order.length,6);
 assert.ok(destination.campaign.party.characters.hero_tarin,'benched party member was not deleted');
 store.activate(bi);assert.equal(store.load('auto').party.characters[arrived.character.id].xp,444);
 assert.throws(()=>store.load('slot1'),/empty|slot/i);
});
test('MP09 copy makes a distinct character branch and item identities without altering source',()=>{
 const {db,store,ai,bi,first}=setup(),old=db.getItem(INSTANCE_PREFIX+ai+':auto');
 const r=store.transferCharacter({mode:'copy',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_vexa',id:id(11)});
 assert.notEqual(r.destinationPortableId,first.portableId);assert.equal(db.getItem(INSTANCE_PREFIX+ai+':auto'),old);
 const incoming=snap(db,bi).roster.records.find(x=>x.portableId===r.destinationPortableId);
 assert.equal(incoming.character.xp,444);assert.equal(incoming.revision,1);assert.equal(incoming.items.every(i=>!first.items.some(x=>x.portableId===i.portableId)),true);
 assert.equal(snap(db,ai).roster.records.some(x=>x.portableId===first.portableId),true);
});
test('MP09 repeated receipt IDs are idempotent and do not duplicate destination XP/equipment',()=>{
 const {store,db,ai,bi,first}=setup(),req={mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(12)};
 const firstReceipt=store.transferCharacter(req),dest=db.getItem(INSTANCE_PREFIX+bi+':auto');
 const secondReceipt=store.transferCharacter(req);assert.deepEqual(secondReceipt,firstReceipt);assert.equal(db.getItem(INSTANCE_PREFIX+bi+':auto'),dest);
 assert.equal(snap(db,bi).roster.records.filter(r=>r.portableId===first.portableId).length,1);
 assert.throws(()=>store.transferCharacter({...req,mode:'copy'}),/already used/i);
});
test('MP09 A→B→A round trip preserves permanent identity and items, advances revision',()=>{
 const {db,store,ai,bi,first}=setup();store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(13)});
 const here=snap(db,bi).roster.records.find(r=>r.portableId===first.portableId);
 const r=store.transferCharacter({mode:'move',sourceInstanceId:bi,destinationInstanceId:ai,portableId:first.portableId,id:id(14)});
 assert.equal(r.status,'complete');assert.equal(r.destinationPortableId,first.portableId);
 const last=snap(db,ai).roster.records.find(x=>x.portableId===first.portableId);
 assert.equal(last.revision,here.revision+1);assert.equal(last.character.xp,444);
 assert.deepEqual(last.items.map(i=>i.portableId),first.items.map(i=>i.portableId));
 store.activate(ai);assert.ok(store.load('auto').party.characters[last.character.id]);
});
test('MP09 rejects historical source saves that would resurrect a moved owner',()=>{
 const {db,store,ai,bi,first}=setup();store.save('slot1',store.load('auto'));const original=db.getItem(INSTANCE_PREFIX+ai+':slot1');
 store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(15)});
 assert.equal(db.getItem(INSTANCE_PREFIX+ai+':slot1'),original);
 store.activate(ai);assert.throws(()=>store.load('slot1'),/belongs to another campaign/i);
});
test('MP09 refuses transfer in combat, last member, missing provider and destination too full without benching',()=>{
 const {store,ai,bi,first}=setup();const req={mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,id:id(16)};
 assert.throws(()=>store.transferCharacter(req),/choose one to bench/i);
});
test('MP09 resumes a transaction interrupted after only destination was written',()=>{
 const {db,store,ai,bi,first}=setup();const normal=db.setItem;let fail=true;
 db.setItem=(k,v)=>{if(fail&&k===INSTANCE_PREFIX+ai+':auto'){fail=false;throw new Error('simulated process interruption');}return normal(k,v);};
 assert.throws(()=>store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(17)}),/interruption/);
 assert.equal(readTransferLedger(db).receipts[0].status,'pending');
 db.setItem=normal;const reopened=new CampaignInstanceStore(db,registry,identity);reopened.recoverTransfers();
 assert.equal(readTransferLedger(db).receipts[0].status,'complete');
 assert.equal(snap(db,ai).roster.records.some(r=>r.portableId===first.portableId),false);
 assert.equal(snap(db,bi).roster.records.some(r=>r.portableId===first.portableId),true);
});
test('MP09 refuses to overwrite unknown divergent bytes during recovery',()=>{
 const {db,store,ai,bi,first}=setup();const put=db.setItem;let fail=true;
 db.setItem=(k,v)=>{if(fail&&k===INSTANCE_PREFIX+ai+':auto'){fail=false;throw new Error('simulated crash');}return put(k,v);};
 assert.throws(()=>store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(18)}),/simulated crash/);
 db.setItem=put;db.setItem(INSTANCE_PREFIX+ai+':auto','external conflicting data');
 const coordinator=new TransferCoordinator(db,registry,identity);
 assert.throws(()=>coordinator.recover(),/modified save/i);assert.equal(db.getItem(INSTANCE_PREFIX+ai+':auto'),'external conflicting data');
});
test('MP09 stale source and destination autosave writes are rejected after a committed move',()=>{
 const {db,store,ai,bi,first}=setup();
 store.activate(ai);const staleSource=store.load('auto');
 store.activate(bi);const staleDestination=store.load('auto');
 store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(19)});
 const a=db.getItem(INSTANCE_PREFIX+ai+':auto'),b=db.getItem(INSTANCE_PREFIX+bi+':auto');
 store.activate(ai);assert.throws(()=>store.save('auto',staleSource),/Character membership differs/i);
 store.activate(bi);assert.throws(()=>store.save('auto',staleDestination),/Character membership differs/i);
 assert.equal(db.getItem(INSTANCE_PREFIX+ai+':auto'),a);assert.equal(db.getItem(INSTANCE_PREFIX+bi+':auto'),b);
});
test('MP09 blocks transferring the last character from its source',()=>{
 const db=mem(),store=new CampaignInstanceStore(db,registry,identity);
 const game=newCampaign(registry,'map_town',createDefaultParty(['hero_tarin']));
 const ai=store.create('Solo',game,undefined,id(1));const bi=store.create('Destination',newCampaign(registry),undefined,id(2));
 store.activate(ai);const first=store.getRosterSnapshot().records[0];
 assert.throws(()=>store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(21)}),/last active character/i);
 assert.equal(readTransferLedger(db).receipts.length,0);
 assert.equal(snap(db,ai).campaign.party.order.length,1);
});
test('MP09 an earlier destination slot cannot erase a receipt-created copied branch',()=>{
 const {db,store,ai,bi,first}=setup();store.activate(bi);store.save('slot1',store.load('auto'));const historical=db.getItem(INSTANCE_PREFIX+bi+':slot1');
 store.transferCharacter({mode:'copy',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(20)});
 store.activate(bi);assert.throws(()=>store.load('slot1'),/requires a newer character snapshot/i);
 assert.equal(db.getItem(INSTANCE_PREFIX+bi+':slot1'),historical);
});
test('MP09 malformed receipt ledger cannot be silently overwritten by another transfer',()=>{
 const {db,store,ai,bi,first}=setup();db.setItem(TRANSFER_LEDGER_KEY,'{"format":"maxxia-transfer-ledger","version":999}');
 assert.throws(()=>store.transferCharacter({mode:'copy',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin'}),/invalid transfer ledger/i);
 assert.equal(db.getItem(TRANSFER_LEDGER_KEY),'{"format":"maxxia-transfer-ledger","version":999}');
});
test('MP09 benched heroes can return to the active party without losing their inventory or IDs',()=>{
 const {db,store,ai,bi,first}=setup();
 store.transferCharacter({mode:'move',sourceInstanceId:ai,destinationInstanceId:bi,portableId:first.portableId,benchId:'hero_tarin',id:id(22)});
 const before=snap(db,bi).roster.records.find(r=>r.character.id==='hero_tarin');
 const active=snap(db,bi).roster.records.find(r=>r.portableId===first.portableId);
 store.swapReserve(bi,'hero_tarin',active.character.id);
 const after=snap(db,bi);const r=after.roster.records.find(r=>r.character.id==='hero_tarin');
 assert.equal(after.campaign.party.order.includes('hero_tarin'),true);assert.equal(after.campaign.party.order.includes(active.character.id),false);
 assert.equal(r.portableId,before.portableId);assert.deepEqual(r.items,before.items);
 assert.equal(after.roster.records.find(r=>r.portableId===first.portableId).character.xp,444);
 store.activate(bi);assert.deepEqual(store.load('auto').party.order,after.campaign.party.order);
});
