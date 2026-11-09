import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMapRegistry,newCampaign} from '../src/shared/rules/campaign.ts';
import {CampaignStore,SAVE_PREFIX} from '../src/shared/saves/campaign-store.ts';
import {CampaignInstanceStore,INSTANCE_PREFIX} from '../src/shared/saves/campaign-instances.ts';
import {TRANSFER_LEDGER_KEY,readTransferLedger} from '../src/shared/saves/transfer-receipts.ts';
import {CatalogueUpgradeCoordinator,previewCatalogueUpgrade,UPGRADE_JOURNAL_KEY} from '../src/shared/saves/catalogue-upgrades.ts';
import {inspectPortableCharacter,PortableRosterVault} from '../src/shared/saves/portable-roster.ts';
import {itemPortability,campaignQuestItemIds} from '../src/shared/saves/item-portability.ts';
import {ITEMS} from '../src/shared/content/items.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL('../public/content/'+n+'.json',import.meta.url)))));
const from={projectId:'project_world_of_maxxia',adventureId:'firstlight',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:'a'.repeat(64),providers:[{id:'core',version:'1.0.1'}]};
const to={...from,catalogueHash:'b'.repeat(64),providers:[{id:'core',version:'1.0.2'}]};
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);}};};
const setup=()=>{const source=memory(),target=memory(),store=new CampaignInstanceStore(source,registry,from),a=store.create('A',newCampaign(registry),undefined,id(1)),b=store.create('B',newCampaign(registry),undefined,id(2));return {source,target,store,a,b,upgrade:new CatalogueUpgradeCoordinator(source,target,registry,from,to)};};
const s=(db,i,slot='auto')=>JSON.parse(db.getItem(INSTANCE_PREFIX+i+':'+slot));

test('MP10 explicitly previews core version/hash upgrades without modifying either storage',async()=>{
 const {source,target,store,a,upgrade}=setup(),before=[...source.data],preview=await upgrade.preview();
 assert.equal(preview.status,'ready');assert.equal(preview.instances,2);assert.match(preview.changes.join(' '),/1\.0\.1 → 1\.0\.2/);
 assert.deepEqual([...source.data],before);assert.equal(target.data.size,0);assert.equal(preview.token.length,64);
});
test('MP10 adoption migrates complete instance library with permanent items, scoped state, old saves, and untouched source',async()=>{
 const {source,target,store,a,b,upgrade}=setup();store.activate(a);const game=store.load('auto');game.party.characters.hero_tarin.xp+=217;store.save('slot1',game);
 store.save('auto',game);const state=store.getScopedState();state.campaign.flags['core:flag:lamp_lit']=true;store.setScopedState(state);store.save('auto',game);
 const legacy=new CampaignStore(source,registry);legacy.save('slot1',newCampaign(registry));
 const old=[...source.data],record=s(source,a).roster.records.find(r=>r.character.id==='hero_tarin');
 const pre=await upgrade.preview(),journal=await upgrade.adopt(pre.token);assert.equal(journal.status,'complete');assert.deepEqual([...source.data],old);
 assert.ok(target.getItem(UPGRADE_JOURNAL_KEY));assert.equal(target.getItem(SAVE_PREFIX+'slot1'),source.getItem(SAVE_PREFIX+'slot1'));assert.equal(new CampaignStore(target,registry).load('slot1').version,18);
 const restored=new CampaignInstanceStore(target,registry,to);restored.activate(a);const loaded=restored.load('auto');assert.equal(loaded.party.characters.hero_tarin.xp,217);assert.equal(restored.getScopedState().campaign.flags['core:flag:lamp_lit'],true);
 const next=s(target,a).roster.records.find(r=>r.character.id==='hero_tarin');assert.equal(record.portableId,next.portableId);assert.deepEqual(record.items.map(x=>x.portableId),next.items.map(x=>x.portableId));assert.equal(next.source.version,'1.0.2');
 assert.equal(restored.listInstances().length,2);assert.deepEqual(restored.load('slot1').party.characters.hero_tarin.xp,217);
});
test('MP10 disabled required provider blocks adoption and preserves complete opaque hero records',async()=>{
 const {source,target,store,a}=setup();const withExtra={...from,providers:[...from.providers,{id:'brass',version:'1.0.0'}]};
 const other=memory(),oldStore=new CampaignInstanceStore(other,registry,withExtra);oldStore.create('Needs brass',newCampaign(registry),undefined,id(4));const original=[...other.data];
 const p=await previewCatalogueUpgrade(other,target,withExtra,to);
 assert.equal(p.status,'blocked');assert.match(p.blockers.join(' '),/Missing provider brass/);assert.equal(p.opaqueRecords,6);
 const upgrade=new CatalogueUpgradeCoordinator(other,target,registry,withExtra,to);
 await assert.rejects(upgrade.adopt(p.token),/blocked/i);assert.deepEqual([...other.data],original);assert.equal(target.data.size,0);
});
test('MP10 migration recovers interrupted destination writes without modifying source',async()=>{
 const {source,target,a,upgrade}=setup(),original=[...source.data],pre=await upgrade.preview(),set=target.setItem;let fail=true;
 target.setItem=(key,value)=>{if(fail&&key===INSTANCE_PREFIX+a+':auto'){fail=false;throw new Error('simulated interrupted adoption');}set(key,value);};
 await assert.rejects(upgrade.adopt(pre.token),/interrupted adoption/);
 assert.equal(JSON.parse(target.getItem(UPGRADE_JOURNAL_KEY)).status,'pending');assert.deepEqual([...source.data],original);
 target.setItem=set;const result=await upgrade.recover();assert.equal(result.status,'complete');new CampaignInstanceStore(target,registry,to).activate(a);
});
test('MP10 refuses recovery when destination was independently changed, protecting new data',async()=>{
 const {source,target,a,upgrade}=setup(),pre=await upgrade.preview(),set=target.setItem;let fail=true;
 target.setItem=(key,value)=>{if(fail&&key===INSTANCE_PREFIX+a+':auto'){fail=false;throw Error('simulated crash');}set(key,value);};
 await assert.rejects(upgrade.adopt(pre.token),/crash/);target.setItem=set;
 const key=INSTANCE_PREFIX+a+':auto';target.setItem(key,'independent player data');
 await assert.rejects(upgrade.recover(),/modified|conflict|destination/i);assert.equal(target.getItem(key),'independent player data');
});
test('MP10 completed upgrade can roll back only while target is unchanged',async()=>{
 const {source,target,upgrade,a}=setup(),before=[...source.data],pre=await upgrade.preview();await upgrade.adopt(pre.token);
 const done=await upgrade.rollback();assert.equal(done.status,'rolled-back');assert.equal(target.getItem(INSTANCE_PREFIX+'index'),null);assert.equal(target.getItem(INSTANCE_PREFIX+a+':auto'),null);assert.deepEqual([...source.data],before);
 const again=setup(),p=await again.upgrade.preview();await again.upgrade.adopt(p.token);again.target.setItem(INSTANCE_PREFIX+again.a+':auto','new progress');
 await assert.rejects(again.upgrade.rollback(),/rollback refused/i);assert.equal(again.target.getItem(INSTANCE_PREFIX+again.a+':auto'),'new progress');
});
test('MP10 source modifications after preview invalidate explicit confirmation token',async()=>{
 const {source,target,store,a,upgrade}=setup(),pre=await upgrade.preview();store.activate(a);const game=store.load('auto');game.party.characters.hero_tarin.xp++;store.save('auto',game);
 await assert.rejects(upgrade.adopt(pre.token),/changed after confirmation/);assert.equal(target.data.size,0);
});
test('MP10 incompatible adventure or unavailable rules reject adoption without creating data',async()=>{
 const {source,target}=setup(),different={...to,adventureId:'catalogue_proof'};
 const p=await previewCatalogueUpgrade(source,target,from,different);assert.equal(p.status,'blocked');assert.match(p.blockers.join(' '),/different projects or adventures/);
});
test('MP10 provider aliases require explicit declaration, and cannot silently rewrite old definition IDs',async()=>{
 const source=memory(),target=memory(),oldLock={...from,providers:[...from.providers,{id:'oldspell',version:'1.0.0'}]},newLock={...to,providers:[...to.providers,{id:'newspell',version:'1.0.0'}]};
 const store=new CampaignInstanceStore(source,registry,oldLock);store.create('Alias test',newCampaign(registry),undefined,id(8));
 assert.equal((await previewCatalogueUpgrade(source,target,oldLock,newLock)).status,'blocked');
 const alias=[{from:'oldspell',to:'newspell'}],pre=await previewCatalogueUpgrade(source,target,oldLock,newLock,alias);assert.equal(pre.status,'ready');
 const coordinator=new CatalogueUpgradeCoordinator(source,target,registry,oldLock,newLock,alias);await coordinator.adopt(pre.token);assert.equal(new CampaignInstanceStore(target,registry,newLock).listInstances().length,1);
});
test('MP10 receipt ledger is retained byte-for-byte and protects transfers after catalogue adoption',async()=>{
 const {source,target,store,a,b,upgrade}=setup();store.activate(a);const record=store.getRosterSnapshot().records[0];
 store.transferCharacter({mode:'move',sourceInstanceId:a,destinationInstanceId:b,portableId:record.portableId,benchId:'hero_tarin',id:id(10)});
 const oldLedger=source.getItem(TRANSFER_LEDGER_KEY),old=[...source.data];
 const pre=await upgrade.preview();assert.equal(pre.transferReceipts,1);await upgrade.adopt(pre.token);
 assert.equal(target.getItem(TRANSFER_LEDGER_KEY),oldLedger);assert.deepEqual([...source.data],old);
 const newStore=new CampaignInstanceStore(target,registry,to);newStore.activate(b);const snapshot=newStore.load('auto');assert.ok(snapshot.party.order.length===6);
});
test('MP10 v1 campaign envelope is explicitly promoted to roster-enabled v2 at adoption',async()=>{
 const {source,target,a,upgrade}=setup();const original=s(source,a);delete original.roster;original.version=1;source.setItem(INSTANCE_PREFIX+a+':auto',JSON.stringify(original));
 const preview=await upgrade.preview();assert.equal(preview.status,'ready');await upgrade.adopt(preview.token);
 assert.equal(s(target,a).version,2);assert.equal(s(target,a).roster.records.length,6);
});


test('MP10 pending journal blocks ordinary campaign loading until recovery finishes',async()=>{
 const {target,source,a,upgrade}=setup(),pre=await upgrade.preview(),put=target.setItem;let blocked=true;
 target.setItem=(k,v)=>{if(blocked&&k===INSTANCE_PREFIX+a+':auto'){blocked=false;throw Error('interrupted');}put(k,v);};
 await assert.rejects(upgrade.adopt(pre.token),/interrupted/);target.setItem=put;
 assert.throws(()=>new CampaignInstanceStore(target,registry,to),/pending recovery/i);
 await upgrade.recover();assert.doesNotThrow(()=>new CampaignInstanceStore(target,registry,to));
});
test('MP10 external hero with old catalogue hash stays opaque in staging and is exported unchanged',()=>{
 const {source,store,a}=setup();const record=store.getRosterSnapshot().records[0],file=JSON.stringify(record);const vault=new PortableRosterVault(source);
 const checked=inspectPortableCharacter(file,to);assert.equal(checked.providers.available,false);
 assert.match(checked.providers.missingProviders.join(' '),/core@1\.0\.1/);
 const sameVersion={...to,providers:from.providers};assert.match(inspectPortableCharacter(file,sameVersion).providers.missingProviders.join(' '),/original catalogue required/);
 const inspection=vault.importText(file,to);assert.equal(inspection.available,false);
 assert.deepEqual(JSON.parse(vault.exportText(record.portableId)),record);
});
test('MP10 quest items stay campaign-bound; ordinary inventory follows explicit portability policy',()=>{
 assert.ok(campaignQuestItemIds().includes('item_quest_regulator'));
 assert.equal(itemPortability('item_quest_regulator'),'campaign-bound');
 const first=Object.keys(ITEMS)[0],def=ITEMS[first],prior=def.portability;
 try{assert.equal(itemPortability(first),'exportable');def.portability='campaign-bound';assert.equal(itemPortability(first),'campaign-bound');}
 finally{if(prior===undefined)delete def.portability;else def.portability=prior;}
 assert.throws(()=>itemPortability('not_registered_here'),/missing item/i);
});
test('MP10 transfer refuses a definition explicitly declared campaign-bound',()=>{
 const {source,store,a,b}=setup();store.activate(a);const record=store.getRosterSnapshot().records[0];
 const entry=record.items[0];assert.ok(entry,'source hero should have starting inventory');
 const def=ITEMS[entry.instance.definitionId],old=def.portability;
 try{
  def.portability='campaign-bound';
  assert.throws(()=>store.transferCharacter({mode:'move',sourceInstanceId:a,destinationInstanceId:b,portableId:record.portableId,benchId:'hero_tarin'}),/campaign-bound item/i);
  assert.equal(readTransferLedger(source).receipts.length,0);
 }finally{if(old===undefined)delete def.portability;else def.portability=old;}
});
