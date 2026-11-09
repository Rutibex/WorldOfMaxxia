import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTERS,readMonsterDatabase,installMonsterDatabase,resetMonsterDatabase,pickMonsterAbility,monsterSaveAttribute,monsterUndead,monsterDamageAfterResistance} from '../src/shared/content/monsters.ts';
import {ENCOUNTER_SEEDS,initialCombatState,beginEncounter,activeActor,combatAction,validateCombat,ENEMY_KINDS} from '../src/shared/rules/combat.ts';
import {newCampaign,validateMapRegistry,validateCampaign,serializeCampaign,parseCampaign} from '../src/shared/rules/campaign.ts';
import {loadProjectMonsters,loadProjectBoot} from '../src/client/project-boot.ts';
const text=readFileSync(new URL('../public/projects/WorldOfMaxxia/database/monsters.json',import.meta.url),'utf8');
const original=readMonsterDatabase(text);
const registry=validateMapRegistry(['town','galleries','vault'].map(id=>JSON.parse(readFileSync(new URL(`../public/content/${id}.json`,import.meta.url),'utf8'))));
const make=()=>structuredClone(original);

test('MM13 original nine monster statistics and art registrations retain baseline identity',()=>{
 assert.equal(original.monsters.length,9);
 assert.deepEqual(Object.keys(MONSTERS).sort(),original.monsters.map(m=>m.id).sort());
 assert.equal(MONSTERS.bell_heart.hp,65);assert.equal(MONSTERS.gallery_watcher.attributes.WIS,10);
 assert.equal(MONSTERS.bell_wraith.undead,true);assert.equal(MONSTERS.dust_imp.visualId,'dust_imp');
 assert.deepEqual(readMonsterDatabase(text),original);
});
test('MM13 newly named monster can be registered with its own stats, reused animation and encounter fixture without code dispatch',()=>{
 const copy=make(),newMonster=structuredClone(copy.monsters[0]);newMonster.id='monster_prismatic_imp';newMonster.name='Prismatic Imp';newMonster.hp=24;newMonster.visualId='dust_imp';newMonster.attack=5;copy.monsters.push(newMonster);
 const seed=ENCOUNTER_SEEDS[0].enemies[0],old=seed.kindId;
 try{
  installMonsterDatabase(copy);seed.kindId=newMonster.id;
  const state=newCampaign(registry);state.currentMapId='map_diagnostic_galleries';assert.equal(state.combat.encounters.enc_gallery_entry.enemies[0].hp,24);
  assert.equal(validateCampaign(state,registry),state);
  const result=beginEncounter(state,registry);assert.ok(result.state.combat.active);assert.match(result.messages.join(' '),/Prismatic Imp/);
  assert.equal(parseCampaign(serializeCampaign(result.state,registry),registry).combat.encounters.enc_gallery_entry.enemies[0].kindId,newMonster.id);
 }finally{seed.kindId=old;resetMonsterDatabase();}
});
test('MM13 weighted AI is deterministic and eligible conditions do not waste RNG draws',()=>{
 let called=0;const roll=(min,max)=>{called++;assert.equal(min,1);return max;};
 const single=MONSTERS.gallery_watcher;
 assert.equal(pickMonsterAbility(single,1,single.hp,roll).id,'normal');
 assert.equal(pickMonsterAbility(single,2,single.hp,roll).id,'spectral');assert.equal(called,0);
 const multi=structuredClone(MONSTERS.dust_imp);multi.abilities=[{id:'jab',kind:'strike',weight:2,when:'always',bonusDamage:0},{id:'surge',kind:'spectral',weight:3,when:'always',bonusDamage:2}];
 assert.equal(pickMonsterAbility(multi,3,9,roll).id,'surge');assert.equal(called,1);
});
test('MM13 saves, undead interactions and saving throws use definition attributes, not monster names',()=>{
 const copy=make(),newMonster=structuredClone(copy.monsters[0]);newMonster.id='monster_undead_ore';newMonster.name='Undead Ore';newMonster.undead=true;newMonster.attributes={DEX:3,WIS:17,CON:8};newMonster.resistances={fire:50};copy.monsters.push(newMonster);
 try{installMonsterDatabase(copy);assert.equal(monsterSaveAttribute(newMonster.id,'WIS'),17);assert.equal(monsterUndead(newMonster.id),true);assert.equal(monsterDamageAfterResistance(newMonster.id,'fire',7),3);assert.equal(monsterDamageAfterResistance(newMonster.id,'holy',7),7);}
 finally{resetMonsterDatabase();}
});
test('MM13 validation rejects duplicate IDs, unsupported atlas, unsafe dice, impossible conditions and invalid resistance',()=>{
 const mutations=[
  db=>db.monsters.push(structuredClone(db.monsters[0])),
  db=>db.monsters[0].visualId='../escape',
  db=>db.monsters[0].damage='1000d999',
  db=>db.monsters[0].resistances={fire:101},
  db=>db.monsters[0].abilities=[{id:'only_rare',kind:'strike',weight:1,when:'hurt',bonusDamage:0}],
  db=>db.monsters[0].abilities[0].weight=0,
 ];
 for(const alter of mutations){const d=make();alter(d);assert.throws(()=>readMonsterDatabase(d),/E_(ID|VISUAL|DAMAGE|RESIST|AI)/);}
});
test('MM13 project loader installs monster database, rejects missing seed references, and legacy manifests reset baseline',async()=>{
 const copy=make();copy.monsters[0].name='Renamed Imp';
 await loadProjectMonsters({monstersUrl:'https://example.test/monsters.json'},async()=>new Response(JSON.stringify(copy)));
 assert.equal(ENEMY_KINDS.dust_imp.name,'Renamed Imp');
 const broken=make();broken.monsters=broken.monsters.filter(m=>m.id!=='dust_imp');
 await assert.rejects(()=>loadProjectMonsters({monstersUrl:'https://example.test/monsters.json'},async()=>new Response(JSON.stringify(broken))),/E_MONSTER_REFERENCE/);
 await loadProjectMonsters({monstersUrl:null},async()=>{throw Error('No fetch expected');});
 assert.equal(ENEMY_KINDS.dust_imp.name,'Dust Imp');
 const manifest=JSON.parse(readFileSync(new URL('../public/WorldOfMaxxia.maxxia',import.meta.url),'utf8'));
 assert.match(manifest.content.monsters,/monsters\.json$/);
});
