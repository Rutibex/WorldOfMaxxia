import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readSpellDatabase,installSpellDatabase,resetSpellDatabase,spellAllowed,spellsForClass,starterSpellsForClass,SpellDatabaseError,SPELLS} from '../src/shared/content/spells.ts';
import {installClassDatabase,resetClassDatabase} from '../src/shared/content/classes.ts';
import {newCampaign,validateMapRegistry,parseCampaign,serializeCampaign} from '../src/shared/rules/campaign.ts';
import {learnClassSpell,castExploration,checkCast} from '../src/shared/rules/magic.ts';
import {loadProjectSpells} from '../src/client/project-boot.ts';
import {spellbookEntries} from '../src/client/spellbook-model.ts';
const database=join(dirname(fileURLToPath(import.meta.url)),'../public/projects/WorldOfMaxxia/database');
const baseline=JSON.parse(readFileSync(join(database,'spells.json'),'utf8'));
const classes=JSON.parse(readFileSync(join(database,'classes.json'),'utf8'));
const registry=validateMapRegistry(['town','galleries','vault'].map(s=>JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),`../public/content/${s}.json`),'utf8'))));
const withDb=(alter,run)=>{const db=structuredClone(baseline);alter(db);try{installSpellDatabase(db);return run(db);}finally{resetSpellDatabase();resetClassDatabase();}};
test('MM10 ships all 36 original spell IDs and stable starter lists',()=>{
 assert.equal(baseline.spells.length,36);readSpellDatabase(baseline);assert.equal(Object.keys(SPELLS).length,36);
 for(const id of ['wizard','priest','witch']){assert.equal(baseline.classAccess[id].spellIds.length,12);assert.equal(starterSpellsForClass(id).length,2);}
 assert.deepEqual(Object.keys(baseline.classAccess).sort(),['priest','witch','wizard']);
});
test('MM10 duplicate spell uses inherited behavior instead of original spell ID and edited cost/name',()=>withDb(db=>{
 const src=db.spells.find(s=>s.id==='spell_wizard_stone_skin');db.spells.push({...src,id:'spell_custom_glass_shield',name:'Glass Shield',sp:2});
 db.classAccess.wizard.spellIds.push('spell_custom_glass_shield');
},()=>{
 let s=newCampaign(registry);s.party.characters.hero_orrin.level=3;s.party.characters.hero_orrin.hp=18;s.party.characters.hero_orrin.sp=14;
 const learned=learnClassSpell(s,'hero_orrin','spell_custom_glass_shield');assert.equal(learned.changed,true,learned.message);
 const out=castExploration(learned.state,{casterId:'hero_orrin',spellId:'spell_custom_glass_shield'},registry);
 assert.equal(out.changed,true);assert.equal(out.state.party.characters.hero_orrin.sp,12);
 assert.ok(out.state.magic.effects.some(x=>x.kind==='stone_skin'));
 assert.equal(checkCast(out.state,{casterId:'hero_orrin',spellId:'spell_custom_glass_shield'},registry),'Stone Skin is already active.');
 assert.deepEqual(parseCampaign(serializeCampaign(out.state,registry),registry),out.state);
}));
test('MM10 project-defined names/costs are reflected in spellbook and runtime without rebuild',()=>withDb(db=>{
 const x=db.spells.find(s=>s.id==='spell_wizard_spark_lance');x.name='Aether Lance';x.sp=5;
},()=>{
 const s=newCampaign(registry),hero=s.party.characters.hero_orrin;
 assert.equal(spellbookEntries(hero,s.magic).find(x=>x.spell.id==='spell_wizard_spark_lance').spell.name,'Aether Lance');
 assert.equal(SPELLS.spell_wizard_spark_lance.sp,5);
 assert.equal(checkCast(s,{casterId:'hero_orrin',spellId:'spell_wizard_spark_lance'},registry), 'Aether Lance cannot be cast while exploring.');
}));
test('MM10 class-specific access supports a newly named caster with valid inherited spells',()=>withDb(db=>{
 db.classAccess.class_sage={spellIds:['spell_wizard_spark_lance','spell_wizard_lantern_globe'],starterSpellIds:['spell_wizard_lantern_globe']};
},()=>{
 const source=structuredClone(classes);source.classes.push({...source.classes.find(c=>c.id==='wizard'),id:'class_sage',name:'Sage'});
 try{installClassDatabase(source);assert.equal(spellAllowed('class_sage','spell_wizard_spark_lance'),true);assert.equal(spellAllowed('class_sage','spell_priest_mend_flesh'),false);
 const s=newCampaign(registry);s.party.characters.hero_orrin.classId='class_sage';s.magic.known.hero_orrin=[...starterSpellsForClass('class_sage')];s.magic.readied.hero_orrin=s.magic.known.hero_orrin[0];
 assert.equal(spellbookEntries(s.party.characters.hero_orrin,s.magic).length,2);assert.equal(learnClassSpell(s,'hero_orrin','spell_wizard_spark_lance').changed,true);
 }finally{resetClassDatabase();}
}));
test('MM10 rejects invalid spell IDs, unknown operations, malformed casts, dangling class references and starter access',()=>{
 for(const mutate of [
  db=>db.spells.push({...db.spells[0]}),
  db=>db.spells[0].behaviorKey='run_arbitrary_code',
  db=>db.spells[0].effect='teleport_filesystem',
  db=>db.spells[0].target='party',
  db=>db.spells[0].dice='9999d9999',
  db=>db.spells[0].sp=-1,
  db=>db.classAccess.wizard.spellIds.push('spell_does_not_exist'),
  db=>db.classAccess.wizard.starterSpellIds.push('spell_priest_mend_flesh'),
 ]){
  const mutated=structuredClone(baseline);mutate(mutated);
  assert.throws(()=>readSpellDatabase(mutated),SpellDatabaseError);
 }
 assert.equal(SPELLS.spell_wizard_spark_lance.name,'Spark Lance');
});
test('MM10 project boot loads declared spells and cleanly resets legacy project without network request',async()=>{
 const changed=structuredClone(baseline);delete changed.conditionsFile;changed.spells[0].name='Project Lance';
 try{
  await loadProjectSpells({spellsUrl:'https://example.invalid/spells.json'},async url=>{assert.match(url,/spells.json$/);return new Response(JSON.stringify(changed));});
  assert.equal(SPELLS.spell_wizard_spark_lance.name,'Project Lance');
  await loadProjectSpells({spellsUrl:null},async()=>{throw new Error('no fetch expected');});
  assert.equal(SPELLS.spell_wizard_spark_lance.name,'Spark Lance');
  const badDb=structuredClone(baseline);delete badDb.conditionsFile;badDb.classAccess.class_missing={spellIds:['spell_wizard_spark_lance'],starterSpellIds:[]};
  await assert.rejects(()=>loadProjectSpells({spellsUrl:'https://example.invalid/spells.json'},async()=>new Response(JSON.stringify(badDb))),/Caster class class_missing/);
 }finally{resetSpellDatabase();}
});
