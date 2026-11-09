import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {progression,readProgression,installProgression,resetProgression,ProgressionError} from '../src/shared/content/progression.ts';
import {createDefaultParty,derived,training,validateParty,preparedInfo} from '../src/shared/rules/party.ts';
import {strikeProfile,setPrepared} from '../src/shared/rules/noncaster.ts';
import {installClassDatabase,resetClassDatabase} from '../src/shared/content/classes.ts';
import {loadProjectProgression} from '../src/client/project-boot.ts';
const root=join(dirname(fileURLToPath(import.meta.url)),'../public/projects/WorldOfMaxxia/database');
const initial=JSON.parse(readFileSync(join(root,'progression.json'),'utf8'));
function withSettings(mutator,run){const altered=structuredClone(initial);mutator(altered);try{installProgression(altered);run();}finally{resetProgression();resetClassDatabase();}}

test('MM09 project progression ships with exact legacy XP, level cap, training prices and milestones',()=>{
 resetProgression();const c=createDefaultParty().characters.hero_tarin;
 assert.equal(progression().maxLevel,5);assert.deepEqual(progression().xpThresholds,[0,0,250,750,1600,2800]);
 assert.deepEqual(progression().attributeMilestoneLevels,[3,5]);
 assert.deepEqual(training({...c,level:1,xp:0}),{capped:false,nextLevel:2,nextXP:250,remainingXP:250,eligible:false,cost:50});
 assert.equal(training({...c,level:5,xp:9999}).capped,true);
});
test('MM09 prepared routines preserve level 1 / 3 / 5 baseline strike values and armor',()=>{
 const p=createDefaultParty();const fighter=p.characters.hero_tarin,art=p.characters.hero_vexa,mutant=p.characters.hero_brindle;
 for(const level of [1,3,5]){
  const f={...fighter,level},a={...art,level},m={...mutant,level};
  const base=strikeProfile(f,'melee');assert.equal(base.label,'Measured Steel');
  assert.equal(strikeProfile(setPrepared(f,'power'),'melee').damageBonus,base.damageBonus+2);
  assert.equal(strikeProfile(setPrepared(a,'needle'),'melee').ignoreDefense,2);
  assert.equal(strikeProfile(setPrepared(a,'spark'),'melee').damageType,'lightning');
  const claws=strikeProfile(setPrepared(m,'claws'),'melee');assert.equal(claws.dice,level===5?'1d10':level===3?'1d8':'1d6');
  assert.equal(derived(setPrepared(m,'carapace')).preparedDefense,level===5?3:2);
 }
});
test('MM09 independent extended progression accepts beyond old level 5 and changed XP/cost/proficiency',()=>withSettings(s=>{
 s.maxLevel=7;s.xpThresholds.push(4200,6200);s.trainingGoldPerLevel=12;
 s.proficiency.veteranLevel=6;s.proficiency.veteranBonus=4;s.attributeMilestoneLevels=[2,4,6];
 },()=>{
 const p=createDefaultParty(),hero=p.characters.hero_tarin;
 const leveled={...hero,level:6,xp:5000};p.characters.hero_tarin={...leveled,hp:Math.min(leveled.hp,derived(leveled).maxHP)};
 assert.equal(validateParty(p).characters.hero_tarin.level,6);
 assert.equal(training(leveled).nextXP,6200);assert.equal(training(leveled).cost,84);assert.equal(derived(leveled).proficiency,4);
}));
test('MM09 tunable attack effects apply to any class that owns the required trait',()=>withSettings(s=>{
 s.prepared.find(x=>x.id==='measured').damageBonusAtMilestone=5;
 s.prepared.find(x=>x.id==='measured').name='Careful Slash';
 s.traitBonuses.device_training.rangedAccuracy=4;
},()=>{
 const original=createDefaultParty().characters.hero_tarin;
 const baselineL3=strikeProfile({...original,level:3},'melee').damageBonus;
 assert.equal(preparedInfo('measured').name,'Careful Slash');
 assert.ok(baselineL3>=4);
 const renamed={...original,classId:'heroic_martial'};
 // Class clone keeps trait instead of requiring named source registration.
 const base=JSON.parse(readFileSync(join(root,'classes.json'),'utf8'));
 const clone=structuredClone(base.classes.find(x=>x.id==='myrmidon'));clone.id='heroic_martial';base.classes.push(clone);installClassDatabase(base);
 assert.equal(strikeProfile({...renamed,level:3},'melee').damageBonus,baselineL3);
}));
test('MM09 rejects invalid descending XP, duplicate milestones, malformed and unsafe styles',()=>{
 for(const change of [
  s=>{s.xpThresholds[3]=100;},
  s=>{s.attributeMilestoneLevels=[3,3];},
  s=>{s.prepared[0].dice='1d999;process.exit()';},
  s=>{s.prepared[0].id=s.prepared[1].id;},
  s=>{s.prepared[0].operation='eval';},
 ]){const bad=structuredClone(initial);change(bad);assert.throws(()=>readProgression(bad),ProgressionError);}
});
test('MM09 browser boot installs project progression and older manifests reset defaults',async()=>{
 const boot={progressionUrl:'https://example.invalid/progression.json'};
 const custom=structuredClone(initial);custom.trainingGoldPerLevel=12;
 await loadProjectProgression(boot,async()=>new Response(JSON.stringify(custom),{status:200}));
 try {assert.equal(progression().trainingGoldPerLevel,12);}finally{await loadProjectProgression({progressionUrl:null});}
 assert.equal(progression().trainingGoldPerLevel,25);
});
