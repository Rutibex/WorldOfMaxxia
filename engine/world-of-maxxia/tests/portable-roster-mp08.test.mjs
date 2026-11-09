import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMapRegistry,newCampaign,serializeCampaign} from '../src/shared/rules/campaign.ts';
import {CampaignStore,SAVE_PREFIX} from '../src/shared/saves/campaign-store.ts';
import {CampaignInstanceStore,INSTANCE_PREFIX,validateInstanceSnapshot} from '../src/shared/saves/campaign-instances.ts';
import {captureRoster,validateRoster,exportPortableCharacter,inspectPortableCharacter,PortableRosterVault,ROSTER_PREFIX} from '../src/shared/saves/portable-roster.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL('../public/content/'+n+'.json',import.meta.url)))));
const identity={projectId:'project_world_of_maxxia',adventureId:'firstlight',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:'a'.repeat(64),providers:[{id:'core',version:'1.0.1'}]};
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const mem=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const setup=(n=1)=>{const db=mem(),store=new CampaignInstanceStore(db,registry,identity),game=newCampaign(registry);store.create('Test campaign',game,undefined,id(n));return {db,store,game};};
const hero=(roster,id)=>roster.records.find(r=>r.character.id===id);

test('MP08 new instance creates a version-2 roster snapshot without modifying format-18 gameplay payload',()=>{
 const {db,store,game}=setup();const raw=JSON.parse(db.getItem(INSTANCE_PREFIX+id(1)+':auto'));
 assert.equal(raw.version,2);assert.equal(raw.roster.format,'maxxia-portable-roster');assert.deepEqual(raw.campaign,game);
 assert.equal(raw.roster.records.length,6);assert.deepEqual(raw.roster.characterIds,game.party.order);
 assert.equal(validateRoster(raw.roster,game,identity,id(1)).records.length,6);
 assert.equal(hero(store.getRosterSnapshot(),'hero_tarin').items[0].source.packId,'core');
});
test('MP08 stable character and equipment identities remain unchanged across no-op saves and restart',()=>{
 const {db,store,game}=setup();const initial=store.getRosterSnapshot();store.save('slot1',game);const second=store.getRosterSnapshot();
 assert.deepEqual(second,initial);const reopened=new CampaignInstanceStore(db,registry,identity);reopened.activate(id(1));reopened.load('slot1');
 assert.deepEqual(reopened.getRosterSnapshot(),initial);assert.equal(hero(initial,'hero_tarin').revision,1);
 assert.equal(db.getItem(ROSTER_PREFIX+id(1)+':'+hero(initial,'hero_tarin').portableId)!==null,true);
});
test('MP08 character progression, conditions and item wear advance revisions without changing IDs',()=>{
 const {store,game}=setup();const before=store.getRosterSnapshot(),c=game.party.characters.hero_tarin;
 c.xp+=200;c.conditions.push({id:'poisoned',remaining:3,unit:'ticks'});
 const item=game.inventory.items.find(i=>i.ownerId===c.id&&i.equipped==='melee');item.durability-=2;
 store.save('auto',game);const after=store.getRosterSnapshot();
 assert.equal(hero(after,c.id).portableId,hero(before,c.id).portableId);
 assert.equal(hero(after,c.id).revision,2);assert.equal(hero(after,c.id).character.xp,200);
 assert.deepEqual(hero(after,c.id).character.conditions,c.conditions);
 const old=hero(before,c.id).items.find(i=>i.instance.id===item.id),next=hero(after,c.id).items.find(i=>i.instance.id===item.id);
 assert.equal(next.portableId,old.portableId);assert.equal(next.revision,2);assert.equal(next.instance.durability,item.durability);
 assert.equal(hero(after,'hero_vexa').revision,1);
});
test('MP08 item count, charges and identified flag round-trip exactly with stable instance identity',()=>{
 const {store,game}=setup();const it=game.inventory.items.find(i=>i.ownerId==='hero_vexa'&&!i.equipped);
 assert.ok(it);const before=hero(store.getRosterSnapshot(),'hero_vexa').items.find(i=>i.instance.id===it.id);
 it.count=1;it.identified=!it.identified;it.charges=0;
 store.save('slot1',game);const after=hero(store.getRosterSnapshot(),'hero_vexa').items.find(i=>i.instance.id===it.id);
 assert.equal(after.portableId,before.portableId);assert.equal(after.instance.identified,it.identified);
 store.load('slot1');assert.deepEqual(hero(store.getRosterSnapshot(),'hero_vexa').items.find(i=>i.instance.id===it.id),after);
});
test('MP08 historical manual slot restores character and unique item snapshot and revisions',()=>{
 const {store,game}=setup();store.save('slot1',game);const first=store.getRosterSnapshot();
 game.party.characters.hero_tarin.xp+=125;store.save('auto',game);const changed=store.getRosterSnapshot();
 assert.equal(hero(changed,'hero_tarin').revision,2);
 const old=store.load('slot1');assert.equal(old.party.characters.hero_tarin.xp,0);
 assert.deepEqual(store.getRosterSnapshot(),first);assert.equal(hero(store.getRosterSnapshot(),'hero_tarin').revision,1);
});
test('MP08 separate instances do not accidentally share permanent IDs',()=>{
 const {store,game}=setup();const a=store.getRosterSnapshot();store.create('Other',newCampaign(registry),undefined,id(2));const b=store.getRosterSnapshot();
 assert.notEqual(a.originInstanceId,b.originInstanceId);
 assert.equal(new Set([...a.records,...b.records].map(r=>r.portableId)).size,12);
 assert.equal(a.records.some(c=>b.records.some(d=>c.items.some(i=>d.items.some(j=>i.portableId===j.portableId)))),false);
});
test('MP08 legacy v1 instance is still readable and only upgraded on explicit save',()=>{
 const {db,store,game}=setup();const key=INSTANCE_PREFIX+id(1)+':auto',raw=JSON.parse(db.getItem(key));delete raw.roster;raw.version=1;db.setItem(key,JSON.stringify(raw));
 const before=db.getItem(key),again=new CampaignInstanceStore(db,registry,identity);again.activate(id(1));again.load('auto');
 assert.equal(db.getItem(key),before);assert.equal(again.getRosterSnapshot().records.length,6);
 again.save('auto',game);assert.equal(JSON.parse(db.getItem(key)).version,2);assert.equal(db.getItem(key+':backup'),before);
});
test('MP08 roster snapshots reject contradictory inventory and duplicated UUIDs and preserve damaged saves',()=>{
 const {db,store}=setup(),key=INSTANCE_PREFIX+id(1)+':auto',saved=db.getItem(key);const raw=JSON.parse(saved);
 raw.roster.records[0].character.xp+=100;
 assert.throws(()=>validateInstanceSnapshot(raw,registry,identity),/portable character|stale/i);
 raw.roster.records[0].character.xp-=100;
 raw.roster.records[1].portableId=raw.roster.records[0].portableId;
 assert.throws(()=>validateInstanceSnapshot(raw,registry,identity),/portable character|duplicate/i);
 assert.equal(db.getItem(key),saved);
});
test('MP08 character file export/import inspection retains XP, spells, equipment and provenance exactly',()=>{
 const {store}=setup(),roster=store.getRosterSnapshot(),r=hero(roster,'hero_orrin');const text=exportPortableCharacter(r);
 const checked=inspectPortableCharacter(text,identity);assert.deepEqual(checked.record,r);
 assert.deepEqual(checked.providers,{available:true,missingProviders:[]});
 assert.deepEqual(JSON.parse(store.exportCharacter(r.portableId)),r);
});
test('MP08 missing provider in staged file produces diagnostics and never deletes character data',()=>{
 const {store}=setup(),source=hero(store.getRosterSnapshot(),'hero_tarin');const clone=structuredClone(source),file=exportPortableCharacter(clone);
 const otherLock={...identity,providers:[{id:'other',version:'1.0.0'}]};
 const result=inspectPortableCharacter(file,otherLock);
 assert.equal(result.providers.available,false);assert.deepEqual(result.providers.missingProviders,['core@1.0.1']);
 const db=mem(),vault=new PortableRosterVault(db),msg=vault.importText(file,otherLock);
 assert.deepEqual(msg,result.providers);assert.equal(vault.exportText(source.portableId).trim(),JSON.stringify(clone));
 assert.deepEqual(vault.importText(file,otherLock),msg);
});
test('MP08 staged record refuses same UUID with changed data, no overwrites',()=>{
 const {store}=setup(),record=hero(store.getRosterSnapshot(),'hero_tarin'),db=mem(),vault=new PortableRosterVault(db);
 const original=exportPortableCharacter(record);vault.importText(original,identity);
 const different=structuredClone(record);different.character.xp=300;
 assert.throws(()=>vault.importText(exportPortableCharacter(different),identity),/already staged/);
 assert.deepEqual(JSON.parse(vault.exportText(record.portableId)),record);
});
test('MP08 legacy v18 saves and original bytes survive new instance and roster operations',()=>{
 const db=mem(),legacy=new CampaignStore(db,registry),game=newCampaign(registry);legacy.save('auto',game);
 const stored=db.getItem(SAVE_PREFIX+'auto');const store=new CampaignInstanceStore(db,registry,identity);
 store.create('New',game,undefined,id(3));store.save('slot1',game);
 assert.equal(db.getItem(SAVE_PREFIX+'auto'),stored);assert.deepEqual(legacy.load('auto'),game);
 assert.deepEqual(store.importText(serializeCampaign(game,registry)).campaign,game);
});
test('MP08 legacy items from the original project retain Firstlight rather than core provenance even in fixture projects',()=>{
 const lock={...identity,projectId:'project_mp04_catalogue_proof',adventureId:'catalogue-proof',providers:[...identity.providers,{id:'brass',version:'1.0.0'},{id:'glass',version:'1.0.0'}]};
 const game=newCampaign(registry),existing=game.inventory.items.find(i=>i.ownerId==='hero_tarin'&&i.equipped==='melee');
 // Genuine Firstlight-only item record installed by the legacy overlay.
 existing.definitionId='item_bellkeeper_blade';game.party.characters.hero_tarin.equipment.melee='item_bellkeeper_blade';
 const roster=captureRoster(game,lock,id(9));
 assert.equal(hero(roster,'hero_tarin').items.find(i=>i.instance.id===existing.id).source.packId,'firstlight');
 assert.deepEqual(validateRoster(roster,game,lock,id(9)),roster);
});
test('MP08 charge-bearing items keep exact charges and identity while consumed charges advance revisions',()=>{
 const {store,game}=setup();const first=game.inventory.items.find(i=>i.ownerId==='hero_vexa'&&!i.equipped);
 first.definitionId='item_glass_lens';first.charges=3;first.identified=true;first.durability=0;
 store.save('auto',game);const before=store.getRosterSnapshot(),old=hero(before,'hero_vexa').items.find(i=>i.instance.id===first.id);
 first.charges=2;store.save('auto',game);const after=hero(store.getRosterSnapshot(),'hero_vexa').items.find(i=>i.instance.id===first.id);
 assert.equal(after.portableId,old.portableId);assert.equal(after.revision,old.revision+1);assert.equal(after.instance.charges,2);
 store.load('auto');assert.equal(hero(store.getRosterSnapshot(),'hero_vexa').items.find(i=>i.instance.id===first.id).instance.charges,2);
});
