import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {readClassDatabase,installClassDatabase,CLASSES,CLASS_IDS,PREPARED_STYLES,hasTrait,ClassDatabaseError} from '../src/shared/content/classes.ts';
import {readItemDatabase,installItemDatabase,ITEMS} from '../src/shared/content/items.ts';
import {createDefaultParty,derived,canUseStartingGear,validateParty,defaultPrepared} from '../src/shared/rules/party.ts';
import {strikeProfile,setPrepared} from '../src/shared/rules/noncaster.ts';
import {loadProjectClasses} from '../src/client/project-boot.ts';
const baseline = JSON.parse(readFileSync(new URL('../public/projects/WorldOfMaxxia/database/classes.json',import.meta.url),'utf8'));
const items = JSON.parse(readFileSync(new URL('../public/projects/WorldOfMaxxia/database/items.json',import.meta.url),'utf8'));
function withClass(def,fn){const current=structuredClone(baseline);current.classes.push(def);try{installClassDatabase(current);return fn();}finally{installClassDatabase(baseline);}}
test('MM07: six canonical classes round-trip and preserve original HP, SP and class permissions',()=>{
 assert.equal(readClassDatabase(JSON.stringify(baseline)).classes.length,6);
 assert.deepEqual(CLASS_IDS,['myrmidon','artificer','mutant','wizard','priest','witch']);
 const p=createDefaultParty();
 assert.deepEqual(p.order.map(id=>{const c=p.characters[id],d=derived(c);return [d.maxHP,d.maxSP,d.defense];}),[[16,0,16],[12,0,15],[19,0,13],[9,14,11],[13,14,15],[11,14,12]]);
 assert.equal(canUseStartingGear('wizard','item_plate_harness'),false);
 assert.equal(canUseStartingGear('wizard','item_glass_thorn'),true);
 assert.equal(canUseStartingGear('priest','item_sword'),false);
 assert.equal(canUseStartingGear('artificer','item_greatsword'),false);
 assert.equal(canUseStartingGear('mutant','item_shortbow'),true);
 assert.equal(canUseStartingGear('myrmidon','item_plate_harness'),true);
});
test('MM07: duplicate class ID inherits prepared routine, equipment tags and data-driven HP growth',()=>{
 const source=baseline.classes[0],variant={...structuredClone(source),id:'class_guardian',name:'Guardian',hpBase:20,hpGain:9,equipmentTags:['melee:staff','armor:light','accessory']};
 withClass(variant,()=>{
  assert.equal(CLASS_IDS.includes('class_guardian'),true);
  assert.equal(PREPARED_STYLES.class_guardian[0],'measured');
  assert.equal(hasTrait('class_guardian','martial_mastery'),true);
  assert.equal(canUseStartingGear('class_guardian','item_staff'),true);
  assert.equal(canUseStartingGear('class_guardian','item_sword'),false);
  assert.equal(canUseStartingGear('class_guardian','item_round_shield'),false);
  const original=createDefaultParty(),base=original.characters.hero_tarin;
  const champion={...base,classId:'class_guardian',equipment:{...base.equipment,melee:'item_staff',body:'item_cloth_robe',offhand:null}};
  const d=derived(champion);
  assert.equal(d.maxHP,22);
  assert.equal(defaultPrepared('class_guardian'),'measured');
  assert.equal(strikeProfile(champion,'melee').label,'Measured Steel');
  assert.equal(strikeProfile(setPrepared(champion,'power'),'melee').label,'Power Stroke');
  assert.equal(derived({...champion,level:3}).maxHP,44);
  const copy=structuredClone(original);copy.characters.hero_tarin={...champion,hp:22};
  assert.equal(validateParty(copy).characters.hero_tarin.classId,'class_guardian');
 });
});
test('MM07: new item tags and newly named caster class configure equipment and SP without code edits',()=>{
 const clone={...structuredClone(baseline.classes[3]),id:'class_sage',name:'Sage',spBase:12,spGain:6,equipmentTags:['melee:staff','armor:light','accessory']};
 const temp=structuredClone(items),weapon={...structuredClone(temp.items.find(i=>i.id==='item_staff')),id:'item_sage_wand',name:'Sage Wand',equipmentTags:['melee:staff']};
 temp.items.push(weapon);
 try{installItemDatabase(temp);withClass(clone,()=>{
  assert.equal(canUseStartingGear('class_sage','item_sage_wand'),true);
  assert.equal(canUseStartingGear('class_sage','item_sword'),false);
  const c={...createDefaultParty().characters.hero_orrin,classId:'class_sage'};
  assert.equal(derived(c).maxSP,18);
  assert.equal(derived({...c,level:3}).maxSP,30);
 });}finally{installItemDatabase(items);}
});
test('MM07: invalid tags, traits, class IDs and mixed noncaster SP are rejected transactionally',()=>{
 const before=JSON.stringify(CLASSES);
 for (const mutate of [
  d=>d.classes.push({...d.classes[0]}),
  d=>d.classes[0].equipmentTags.push('armor:mythic'),
  d=>d.classes[0].traits=[],
  d=>d.classes[0].preparedStyles.push('claws'),
  d=>d.classes[0].spGain=4,
  d=>d.classes[0].hpBase=-5,
  d=>d.classes[0].id='../../evil'
 ]){
  const bad=structuredClone(baseline);mutate(bad);assert.throws(()=>installClassDatabase(bad),ClassDatabaseError);
  assert.equal(JSON.stringify(CLASSES),before);
 }
});
test('MM07: project boot loads class definitions through content.classes path before runtime party creation',async()=>{
 const variant=structuredClone(baseline);variant.classes[0].name='Renamed Warrior';
 const boot={classesUrl:'https://test.invalid/classes.json'};
 try{
  await loadProjectClasses(boot,async url=>{assert.equal(url,boot.classesUrl);return new Response(JSON.stringify(variant),{status:200});});
  assert.equal(CLASSES.myrmidon.name,'Renamed Warrior');
  const original=structuredClone(baseline);original.classes[0].name='Should not load';
  await loadProjectClasses({classesUrl:null},async()=>{throw Error('No request should be issued');});
  assert.equal(CLASSES.myrmidon.name,'Myrmidon');
 }finally{installClassDatabase(baseline);}
});

test('MM07: real runtime preview returns canonical derived HP/SP for authored class',()=>{
 const input=JSON.stringify(baseline.classes[4]);
 const output=JSON.parse(execFileSync(process.execPath,['--experimental-strip-types',new URL('../scripts/preview-class.mjs',import.meta.url).pathname],{input,encoding:'utf8'}));
 assert.equal(output.source,'canonical-typescript');
 assert.equal(output.classId,'priest');
 assert.equal(output.rows[0].maxHP,13);
 assert.equal(output.rows[0].maxSP,14);
 assert.equal(output.rows[2].maxSP,30);
});
