import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readConditionDatabase,installConditionDatabase,resetConditionDatabase,conditionDefinition,applyConditionPolicy} from '../src/shared/content/conditions.ts';
import {installSpellDatabase,resetSpellDatabase,readSpellDatabase,SpellDatabaseError} from '../src/shared/content/spells.ts';
import {newCampaign,validateMapRegistry,parseCampaign,serializeCampaign} from '../src/shared/rules/campaign.ts';
import {castExploration,checkCast} from '../src/shared/rules/magic.ts';
import {beginEncounter,activeActor,combatAction,castCombatSpell,combatTargets} from '../src/shared/rules/combat.ts';
import {loadProjectSpells} from '../src/client/project-boot.ts';
const root=new URL('../public/',import.meta.url);
const baseline=JSON.parse(readFileSync(new URL('projects/WorldOfMaxxia/database/spells.json',root)));
const conditions=JSON.parse(readFileSync(new URL('projects/WorldOfMaxxia/database/conditions.json',root)));
const registry=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL(`content/${n}.json`,root)))));
function add(db,id,target,context,effects,cls='priest'){
 db.spells.push({id,name:id,description:'Custom MM12 effect',classId:cls,level:1,sp:1,target,context,effect:'composed',behaviorKey:'composed',effects});
 db.classAccess[cls].spellIds.push(id);db.classAccess[cls].starterSpellIds.push(id);
}
function withSpell(mutate,run){const db=structuredClone(baseline);mutate(db);try{installSpellDatabase(db);return run();}finally{resetSpellDatabase();resetConditionDatabase();}}
function untilWizard(state){let s=state;for(let i=0;i<80&&activeActor(s)!=='hero_orrin';i++){const x=combatAction(s,registry,'block');assert.equal(x.changed,true);s=x.state;}assert.equal(activeActor(s),'hero_orrin');return s;}
test('MM12 condition definitions validate IDs and prevent silent save reinterpretation',()=>{
 assert.equal(readConditionDatabase(conditions).conditions.length,6);
 const bad=structuredClone(conditions);bad.conditions[0].id='new_status';assert.throws(()=>readConditionDatabase(bad),/condition/);
 bad.conditions[0].id='poisoned';bad.conditions[1].id='poisoned';assert.throws(()=>readConditionDatabase(bad),/condition/);
 assert.throws(()=>readConditionDatabase({...conditions,version:99}),/version/);
});
test('MM12 condition repeat policy extends matching durations and clamps to 999',()=>{
 const data=structuredClone(conditions);data.conditions[0].reapply='extend';data.conditions[0].name='Toxic';installConditionDatabase(data);
 try{assert.equal(conditionDefinition('poisoned').name,'Toxic');
  assert.deepEqual(applyConditionPolicy([{id:'poisoned',unit:'turns',remaining:998}],{id:'poisoned',unit:'turns',remaining:8}),[{id:'poisoned',unit:'turns',remaining:999}]);
  assert.deepEqual(applyConditionPolicy([{id:'poisoned',unit:'turns',remaining:5}],{id:'poisoned',unit:'minutes',remaining:3}),[{id:'poisoned',unit:'minutes',remaining:3}]);
 }finally{resetConditionDatabase();}
});
test('MM12 composed cure and revival preserve party state and save round-trip',()=>withSpell(db=>{
 add(db,'spell_mm12_cure','ally','both',[{operation:'cure',target:'selected',conditionId:'poisoned'}]);
 add(db,'spell_mm12_revive','dead_ally','exploration',[{operation:'revive',target:'selected'}]);
},()=>{
 const s=newCampaign(registry);s.party.characters.hero_orrin.conditions=[{id:'poisoned',unit:'ticks',remaining:5}];
 s.party.characters.hero_sera.hp=12;s.party.characters.hero_sera.sp=12;
 const cured=castExploration(s,{casterId:'hero_sera',spellId:'spell_mm12_cure',targetId:'hero_orrin'},registry);
 assert.equal(cured.changed,true);assert.equal(cured.state.party.characters.hero_orrin.conditions.length,0);
 cured.state.party.characters.hero_orrin.hp=0;
 const revived=castExploration(cured.state,{casterId:'hero_sera',spellId:'spell_mm12_revive',targetId:'hero_orrin'},registry);
 assert.equal(revived.changed,true);assert.equal(revived.state.party.characters.hero_orrin.hp,1);
 assert.deepEqual(parseCampaign(serializeCampaign(revived.state,registry),registry),revived.state);
}));
test('MM12 composed party wards are applied once with compatible save validation',()=>withSpell(db=>add(db,'spell_mm12_ward','party','both',[{operation:'ward',target:'party',wardKind:'stone_skin',unit:'minutes',remaining:12}]),()=>{
 const s=newCampaign(registry),out=castExploration(s,{casterId:'hero_sera',spellId:'spell_mm12_ward'},registry);
 assert.equal(out.changed,true);assert.equal(out.state.magic.effects.filter(x=>x.kind==='stone_skin').length,1);
 assert.deepEqual(parseCampaign(serializeCampaign(out.state,registry),registry),out.state);
}));
test('MM12 custom enemy hexes use seeded saving throws and persist across saves',()=>withSpell(db=>add(db,'spell_mm12_hex','enemy','combat',[{operation:'hex',target:'selected',hexKind:'ill_omen',unit:'turns',remaining:3}],'wizard'),()=>{
 let state=newCampaign(registry);state.currentMapId='map_diagnostic_galleries';state=untilWizard(beginEncounter(state,registry).state);
 const foe=combatTargets(state)[0],cast={casterId:'hero_orrin',spellId:'spell_mm12_hex',targetId:foe.id};
 const a=castCombatSpell(state,registry,cast),b=castCombatSpell(state,registry,cast);
 assert.deepEqual(a,b);assert.equal(a.state.magic.effects.find(x=>x.kind==='ill_omen')?.remainingTurns,2);
 assert.deepEqual(parseCampaign(serializeCampaign(a.state,registry),registry),a.state);
}));
test('MM12 rejects invalid ward, hex, revive, cure and world operations before consuming SP',()=>{
 for(const [target,context,primitive] of [
  ['party','both',{operation:'ward',target:'party',wardKind:'stone_skin',unit:'minutes',remaining:31}],
  ['party','both',{operation:'ward',target:'party',wardKind:'unknown',unit:'minutes',remaining:1}],
  ['enemy','combat',{operation:'hex',target:'selected',hexKind:'ill_omen',unit:'turns',remaining:4}],
  ['ally','both',{operation:'revive',target:'selected'}],
  ['enemy','combat',{operation:'cure',target:'selected',conditionId:'poisoned'}],
  ['party','both',{operation:'unseal',target:'caster'}],
  ['world','exploration',{operation:'fold',target:'party'}]
 ]){const db=structuredClone(baseline);add(db,'spell_mm12_invalid',target,context,[primitive]);assert.throws(()=>readSpellDatabase(db),SpellDatabaseError,JSON.stringify(primitive));}
});
test('MM12 project loader installs declared conditions, then restores defaults for a legacy project',async()=>{
 const data=structuredClone(conditions);data.conditions[0].name='Plague';
 try{
  await loadProjectSpells({spellsUrl:'https://example.invalid/database/spells.json'},async url=>{
   if(url.endsWith('/spells.json'))return new Response(JSON.stringify(baseline),{status:200});
   if(url.endsWith('/conditions.json'))return new Response(JSON.stringify(data),{status:200});
   throw Error('Unexpected URL '+url);
  });
  assert.equal(conditionDefinition('poisoned').name,'Plague');
  await loadProjectSpells({spellsUrl:null},async()=>{throw Error('No fetch expected');});
  assert.equal(conditionDefinition('poisoned').name,'Poisoned');
 }finally{resetSpellDatabase();resetConditionDatabase();}
});
test('MM12 original project geometry guards apply to composed Unseal before SP is spent',()=>withSpell(db=>add(db,'spell_mm12_unseal','object','exploration',[{operation:'unseal',target:'caster'}],'wizard'),()=>{
 const s=newCampaign(registry);s.currentMapId='map_diagnostic_galleries';s.party.characters.hero_orrin.sp=20;
 const p=s.maps.map_diagnostic_galleries;p.x=3;p.y=2;p.facing=1;
 const success=castExploration(s,{casterId:'hero_orrin',spellId:'spell_mm12_unseal'},registry);
 assert.equal(success.changed,true);assert.equal(success.state.maps.map_diagnostic_galleries.doors.door_north,true);
 const failed=structuredClone(s);failed.maps.map_diagnostic_galleries.facing=0;
 const no=castExploration(failed,{casterId:'hero_orrin',spellId:'spell_mm12_unseal'},registry);
 assert.equal(no.changed,false);assert.equal(no.state.party.characters.hero_orrin.sp,20);
}));
test('MM12 Fold movement uses the original explored/blocked checks and save-safe state',()=>withSpell(db=>add(db,'spell_mm12_fold','world','exploration',[{operation:'fold',target:'caster'}],'wizard'),()=>{
 const s=newCampaign(registry);
 const no=castExploration(s,{casterId:'hero_orrin',spellId:'spell_mm12_fold',steps:1},registry);
 assert.equal(no.changed,false);
 s.maps.map_town.visited.push('7,11');
 const yes=castExploration(s,{casterId:'hero_orrin',spellId:'spell_mm12_fold',steps:1},registry);
 assert.equal(yes.changed,true);assert.deepEqual([yes.state.maps.map_town.x,yes.state.maps.map_town.y],[7,11]);
 assert.deepEqual(parseCampaign(serializeCampaign(yes.state,registry),registry),yes.state);
}));
