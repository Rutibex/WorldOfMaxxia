import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readActorDatabase,installActorDatabase,resetActorDatabase,ACTORS,PORTRAITS,DEFAULT_PARTY,PORTRAIT_ORDER,ActorDatabaseError} from '../src/shared/content/actors.ts';
import {syncStarterHeroes} from '../src/shared/content/party.ts';
import {installClassDatabase} from '../src/shared/content/classes.ts';
import {createDefaultParty,derived,validateParty} from '../src/shared/rules/party.ts';
import {loadProjectActors,loadProjectBoot,createProjectCampaign} from '../src/client/project-boot.ts';
import {portraitSetAsset,configurePortraitArt} from '../src/client/art-production.ts';
const root = new URL('../public/',import.meta.url);
const baseline=JSON.parse(readFileSync(new URL('projects/WorldOfMaxxia/database/actors.json',root),'utf8'));
const file=(path)=>readFileSync(new URL(path,root),'utf8');
const restore=()=>{resetActorDatabase();syncStarterHeroes();configurePortraitArt(null);};

test('MM08: original six actor records, portraits and stat totals preserve campaign defaults',()=>{
 restore();const parsed=readActorDatabase(JSON.stringify(baseline));
 assert.equal(parsed.actors.length,6);assert.equal(parsed.portraits.length,12);
 assert.deepEqual(DEFAULT_PARTY,['hero_tarin','hero_vexa','hero_brindle','hero_orrin','hero_sera','hero_mora']);
 const party=createDefaultParty();assert.equal(party.characters.hero_tarin.name,'Tarin');
 assert.deepEqual(party.order.map(id=>[derived(party.characters[id]).maxHP,derived(party.characters[id]).maxSP]),[[16,0],[12,0],[19,0],[9,14],[13,14],[11,14]]);
 assert.equal(party.characters.hero_mora.portraitId,'portrait_05');
 assert.equal(validateParty(party).characters.hero_mora.portrait,5);
});

test('MM08: new actor can use a copied class, catalogued portrait, gear and independent starter order',()=>{
 const doc=structuredClone(baseline),newHero=structuredClone(doc.actors[0]);
 newHero.id='hero_new_guard';newHero.name='New Guard';newHero.portraitId='portrait_07';newHero.portrait=7;
 newHero.attributes.STR=18;doc.actors.push(newHero);doc.startingParty=['hero_new_guard','hero_mora'];
 try{
  installActorDatabase(doc);syncStarterHeroes();
  assert.equal(ACTORS.hero_new_guard.name,'New Guard');
  assert.deepEqual(DEFAULT_PARTY,doc.startingParty);
  const state=createDefaultParty();assert.deepEqual(state.order,doc.startingParty);
  assert.equal(state.characters.hero_new_guard.attributes.STR,18);
  assert.equal(state.characters.hero_new_guard.portraitId,'portrait_07');
  assert.equal(validateParty(state).characters.hero_mora.name,'Mora');
 }finally{restore();}
});

test('MM08: a newly named class and actor can be paired without runtime registration',()=>{
 const classes=JSON.parse(file('projects/WorldOfMaxxia/database/classes.json'));
 const copy=structuredClone(classes.classes[0]);copy.id='class_new_knight';copy.name='New Knight';classes.classes.push(copy);
 const db=structuredClone(baseline),actor=structuredClone(db.actors[0]);actor.id='hero_new_knight';actor.name='New Knight';actor.classId='class_new_knight';db.actors.push(actor);db.startingParty=[actor.id];
 try{installClassDatabase(classes);installActorDatabase(db);syncStarterHeroes();
   const player=createDefaultParty();assert.deepEqual(player.order,['hero_new_knight']);
   assert.equal(player.characters.hero_new_knight.classId,'class_new_knight');
   assert.equal(validateParty(player).characters.hero_new_knight.classId,'class_new_knight');
 }finally{installClassDatabase(JSON.parse(file('projects/WorldOfMaxxia/database/classes.json')));restore();}
});

test('MM08: invalid actor references and portrait states fail transactionally',()=>{
 const before=JSON.stringify(ACTORS);
 for(const mutation of [
  d=>d.actors.push({...d.actors[0]}),
  d=>d.actors[0].classId='class_missing',
  d=>d.actors[0].portraitId='portrait_absent',
  d=>d.actors[0].equipment.body='item_sword',
  d=>d.actors[3].equipment.body='item_plate_harness',
  d=>d.actors[0].attributes.DEX=21,
  d=>d.portraits[0].states.dead='asset_missing space',
  d=>d.portraits.push({...d.portraits[0]}),
  d=>d.startingParty.push(d.startingParty[0]),
 ]){
  const v=structuredClone(baseline);mutation(v);
  assert.throws(()=>installActorDatabase(v),ActorDatabaseError);
  assert.equal(JSON.stringify(ACTORS),before,'failed install must not modify current actors');
 }
});

test('MM08: resources resolve all four condition variants by permanent catalogue IDs, not numeric filenames',()=>{
 restore();const catalog=JSON.parse(file('assets/catalog.json'));
 const byId=new Map(catalog.resources.map(r=>[r.id,{...r,url:new URL(r.path,'https://game.test/assets/catalog.json').href}]));
 configurePortraitArt({byId,byLegacyPath:new Map(),catalogUrl:'https://game.test/assets/catalog.json'});
 assert.match(portraitSetAsset('portrait_05',5,'afflicted'),/witch-afflicted\.png$/);
 assert.match(portraitSetAsset('portrait_02',2,'dead'),/02-dead\.png$/);
 assert.equal(PORTRAITS.portrait_00.states.normal,'asset_art_portraits_00_normal_png');
 assert.equal(PORTRAIT_ORDER.length,12);restore();
});

test('MM08: browser actor boot validates portrait references and creates configured party',async()=>{
 const catalog=JSON.parse(file('assets/catalog.json'));
 const entries=new Map(catalog.resources.map(r=>[r.id,{...r,url:'https://game.test/assets/'+r.path}]));
 const good=structuredClone(baseline);good.actors[0].name='Newly Authored Name';good.startingParty=['hero_vexa','hero_tarin'];
 const boot={actorsUrl:'https://game.test/actors.json',resourceResolver:{byId:entries},manifest:{startingParty:baseline.startingParty.map(id=>({id}))}};
 try{
  await loadProjectActors(boot,async()=>new Response(JSON.stringify(good)));
  assert.equal(ACTORS.hero_tarin.name,'Newly Authored Name');
  assert.deepEqual(createDefaultParty().order,['hero_vexa','hero_tarin']);
  const missing=structuredClone(good);missing.portraits[0].states.normal='asset_unlisted';
  await assert.rejects(()=>loadProjectActors(boot,async()=>new Response(JSON.stringify(missing))),e=>e.code==='E_ACTOR_PORTRAIT');
  assert.equal(ACTORS.hero_tarin.name,'Newly Authored Name','bad catalogue cannot replace installed actors');
 }finally{restore();}
});

test('MM08: older saved parties with numeric portraits still validate without portraitId',()=>{
 restore();const original=createDefaultParty(),old=structuredClone(original);
 for(const character of Object.values(old.characters))delete character.portraitId;
 assert.doesNotThrow(()=>validateParty(JSON.parse(JSON.stringify(old))));
 const mixed=structuredClone(old);mixed.characters.hero_tarin.portraitId='portrait_00';
 assert.equal(validateParty(mixed).characters.hero_tarin.portraitId,'portrait_00');
});
