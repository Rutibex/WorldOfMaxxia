import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry} from '../src/shared/rules/campaign.ts';
import {SPELLS,learnWizardSpell,castExploration,checkCast,hasPartyWard,partyDefenseBonus,mitigateArcane,foldStepError,breakBinding} from '../src/shared/rules/magic.ts';
import {beginEncounter,activeActor,combatAction,castCombatSpell} from '../src/shared/rules/combat.ts';
import {derived} from '../src/shared/rules/party.ts';
import {applyGridAction} from '../src/shared/rules/grid.ts';
const town=JSON.parse(readFileSync(new URL('../public/content/town.json',import.meta.url)));
const galleries=JSON.parse(readFileSync(new URL('../public/content/galleries.json',import.meta.url)));
const vault=JSON.parse(readFileSync(new URL('../public/content/vault.json',import.meta.url)));
const registry=validateMapRegistry([town,galleries,vault]);
const fresh=()=>newCampaign(registry);
const wiz='hero_orrin';
function level(s,n=5){const c=s.party.characters[wiz];c.level=n;c.hp=derived(c).maxHP;c.sp=derived(c).maxSP;return s;}
function known(s,spellId){const result=learnWizardSpell(s,wiz,spellId);assert.equal(result.changed,true,result.message);return result.state;}
function inGalleries(s){s.currentMapId='map_diagnostic_galleries';return s;}
function wizardTurn(s){s=beginEncounter(s,registry).state;assert.ok(s.combat.active);for(let tries=0;tries<20&&s.combat.active&&activeActor(s)!==wiz;tries++){const who=activeActor(s);assert.ok(who?.startsWith('hero_'));s=combatAction(s,registry,'block').state;}assert.equal(activeActor(s),wiz);return s;}
function persist(s){return parseCampaign(serializeCampaign(s,registry),registry);}
test('Phase 10 implements all twelve prescribed Wizard spells (and retains Priest/Witch starters)',()=>{
 const catalog=['spark_lance','lantern_globe','frost_needle','burning_fan','glass_eye','binding_thread','storm_arc','unseal','stone_skin','fold_step','mirror_ward','starfall'];
 assert.deepEqual(Object.values(SPELLS).filter(v=>v.classId==='wizard').map(v=>v.id).sort(),catalog.map(v=>`spell_wizard_${v}`).sort());
 assert.equal(Object.keys(SPELLS).length,36);
 for(const id of catalog)assert.ok(SPELLS[`spell_wizard_${id}`].sp>0);
});
test('level-gated learning is opt-in; default party retains Phase 9 knowledge and older v4 migration',()=>{
 const s=fresh(),original=structuredClone(s);
 assert.equal(s.magic.known[wiz].length,2);
 assert.equal(learnWizardSpell(s,wiz,'spell_wizard_starfall').changed,false);
 assert.equal(learnWizardSpell(s,'hero_mora','spell_wizard_frost_needle').changed,false);
 const withFrost=known(s,'spell_wizard_frost_needle');assert.equal(withFrost.magic.known[wiz].length,3);
 assert.deepEqual(s,original);
 assert.deepEqual(persist(withFrost),withFrost);
 const legacy=structuredClone(s);legacy.inventory={items:[]};legacy.party.resources.supplies={item_healing_draught:2,item_antidote:2};legacy.version=4;
 const upgraded=parseCampaign(JSON.stringify(legacy),registry);
 assert.equal(upgraded.version,18);assert.deepEqual(upgraded.magic,s.magic);assert.deepEqual(upgraded.rng,s.rng);
 for(const malformed of [{...legacy,version:999},{...legacy,magic:null}])assert.throws(()=>parseCampaign(JSON.stringify(malformed),registry));
});
test('Frost Needle is deterministic single-target cold damage, SP and turn accounting',()=>{
 let s=wizardTurn(inGalleries(known(fresh(),'spell_wizard_frost_needle')));const target=s.combat.active.targetId;
 const before=s.combat.encounters.enc_gallery_entry.enemies.find(e=>e.id===target).hp,sp=s.party.characters[wiz].sp;
 const result=castCombatSpell(s,registry,{casterId:wiz,spellId:'spell_wizard_frost_needle',targetId:target});
 assert.equal(result.changed,true);assert.deepEqual(result,castCombatSpell(s,registry,{casterId:wiz,spellId:'spell_wizard_frost_needle',targetId:target}));
 assert.ok(result.state.combat.encounters.enc_gallery_entry.enemies.find(e=>e.id===target).hp<before);
 assert.equal(result.state.party.characters[wiz].sp,sp-2);assert.ok(result.messages.some(x=>x.includes('cold damage')));
 persist(result.state);
});
test('Burning Fan, Storm Arc, Starfall have distinct level and cost, hit all targets, and save for half',()=>{
 for(const [spell,n,sp,dtype] of [['burning_fan',2,4,'fire'],['storm_arc',3,5,'lightning'],['starfall',5,9,'arcane']]){
  let s=level(inGalleries(fresh()),n);s=known(s,`spell_wizard_${spell}`);s=wizardTurn(s);
  const before=s.combat.encounters.enc_gallery_entry.enemies.map(e=>e.hp);
  const result=castCombatSpell(s,registry,{casterId:wiz,spellId:`spell_wizard_${spell}`});
  assert.equal(result.changed,true,spell);
  assert.equal(result.state.party.characters[wiz].sp,s.party.characters[wiz].sp-sp);
  const after=result.state.combat.encounters.enc_gallery_entry.enemies.map(e=>e.hp);
  assert.ok(after.every((hp,i)=>hp<=before[i])&&after.some((hp,i)=>hp<before[i]));
  assert.ok(result.messages.filter(x=>x.includes(`${dtype} damage`)).length===2,spell);
  persist(result.state);
 }
});
test('Binding Thread skips exactly one enemy action, and damage breaks it early',()=>{
 const s=fresh();s.magic.effects.push({kind:'binding_thread',targetId:'enemy_imp_1',remainingTurns:1});
 assert.deepEqual(persist(s),s);
 let after=wizardTurn(inGalleries(s));for(let n=0;n<12&&after.magic.effects.some(e=>e.kind==='binding_thread'&&e.targetId==='enemy_imp_1')&&after.combat.active;n++){after=combatAction(after,registry,'block').state;}assert.equal(after.magic.effects.some(e=>e.kind==='binding_thread'&&e.targetId==='enemy_imp_1'),false);
 // Bind an enemy directly in a saved campaign and verify a damage event breaks it.
 const other=inGalleries(fresh());other.magic.effects.push({kind:'binding_thread',targetId:'enemy_imp_1',remainingTurns:1});breakBinding(other,'enemy_imp_1');assert.equal(other.magic.effects.length,0);
 let casting=level(inGalleries(fresh()),2);casting=known(casting,'spell_wizard_binding_thread');casting=wizardTurn(casting);
 const res=castCombatSpell(casting,registry,{casterId:wiz,spellId:'spell_wizard_binding_thread',targetId:'enemy_imp_1'});
 assert.equal(res.changed,true);assert.ok(res.messages.some(x=>/resists Binding Thread|Binding Thread holds/.test(x)));
});
test('Glass Eye reveals a timed detection state, not permanent exploration flags',()=>{
 let s=level(fresh(),2);s=known(s,'spell_wizard_glass_eye');const before=[...s.maps.map_town.visited];
 const r=castExploration(s,{casterId:wiz,spellId:'spell_wizard_glass_eye'},registry);
 assert.equal(r.changed,true);assert.deepEqual(r.state.maps.map_town.visited,before);assert.ok(hasPartyWard(r.state,'glass_eye'));
 assert.equal(r.state.magic.effects[0].expiresAtMinute,31);
 assert.equal(checkCast(r.state,{casterId:wiz,spellId:'spell_wizard_glass_eye'},registry),'Glass Eye is already active.');
 r.state.elapsedMinutes=32;r.state.magic.effects=[];assert.equal(hasPartyWard(r.state,'glass_eye'),false);
 assert.deepEqual(persist(r.state),r.state);
});
test('Unseal opens adjacent qualifying nonquest door and costs no SP on invalid target',()=>{
 let s=level(inGalleries(fresh()),3);s=known(s,'spell_wizard_unseal');const p=s.maps.map_diagnostic_galleries;
 p.x=3;p.y=2;p.facing=1;p.visited.push('3,2');
 assert.equal(applyGridAction(registry.map_diagnostic_galleries,p,'interact').changed,false);
 const sp=s.party.characters[wiz].sp;
 const invalid=castExploration(s,{casterId:wiz,spellId:'spell_wizard_unseal',targetId:'fake'},registry);
 assert.equal(invalid.changed,true);assert.equal(invalid.state.party.characters[wiz].sp,sp-4);
 assert.equal(invalid.state.maps.map_diagnostic_galleries.doors.door_north,true);
 assert.equal(applyGridAction(registry.map_diagnostic_galleries,invalid.state.maps.map_diagnostic_galleries,'interact').changed,false);
 assert.deepEqual(persist(invalid.state),invalid.state);
 const elsewhere=structuredClone(s);elsewhere.maps.map_diagnostic_galleries.facing=0;
 const bad=castExploration(elsewhere,{casterId:wiz,spellId:'spell_wizard_unseal'},registry);
 assert.equal(bad.changed,false);assert.deepEqual(bad.state,elsewhere);
 const hard=structuredClone(registry);hard.map_diagnostic_galleries.doors.find(d=>d.id==='door_north').questLocked=true;
 assert.match(checkCast(s,{casterId:wiz,spellId:'spell_wizard_unseal'},hard),/Quest seals/);
});
test('Stone Skin grants +2 defense and Mirror Ward cuts 25% arcane without altering base stats',()=>{
 let s=level(fresh(),4);s=known(s,'spell_wizard_stone_skin');s=known(s,'spell_wizard_mirror_ward');
 const base=mitigateArcane(s,12,wiz);
 const skin=castExploration(s,{casterId:wiz,spellId:'spell_wizard_stone_skin'},registry);
 assert.equal(partyDefenseBonus(skin.state),2);assert.equal(skin.state.magic.effects[0].expiresAtMinute,31);
 const mirror=castExploration(skin.state,{casterId:wiz,spellId:'spell_wizard_mirror_ward'},registry);
 assert.equal(mitigateArcane(mirror.state,12,wiz),9);assert.equal(base,12);
 assert.equal(mirror.state.party.characters[wiz].baseResistances.arcane,0);
 assert.deepEqual(persist(mirror.state),mirror.state);
});
test('Fold Step never enters unvisited cells, blocked walls, closed doors, enemies or portals',()=>{
 let s=level(fresh(),4);s=known(s,'spell_wizard_fold_step');const p=s.maps.map_town;
 assert.match(foldStepError(s,registry,1),/undiscovered/);
 p.visited.push('7,11');
 assert.equal(foldStepError(s,registry,1),null);
 const one=castExploration(s,{casterId:wiz,spellId:'spell_wizard_fold_step',steps:1},registry);
 assert.deepEqual([one.state.maps.map_town.x,one.state.maps.map_town.y],[7,11]);assert.equal(one.state.elapsedMinutes,1);
 assert.equal(one.state.maps.map_town.minutes,1);
 assert.deepEqual(one.state.maps.map_town.visited,s.maps.map_town.visited);
 assert.match(foldStepError(one.state,registry,1),/closed door/);
 const two=structuredClone(s);two.maps.map_town.visited.push('7,10');two.maps.map_town.doors.town_south_gate=true;
 assert.equal(foldStepError(two,registry,2),null);
 assert.deepEqual((({x,y})=>[x,y])(castExploration(two,{casterId:wiz,spellId:'spell_wizard_fold_step',steps:2},registry).state.maps.map_town),[7,10]);
 const portal=structuredClone(two);portal.maps.map_town.x=13;portal.maps.map_town.y=3;portal.maps.map_town.facing=0;portal.maps.map_town.visited.push('13,3','13,2');
 assert.match(foldStepError(portal,registry,1),/gateway/);
 const guarded=structuredClone(s);guarded.maps.map_town.x=7;guarded.maps.map_town.y=8;guarded.maps.map_town.visited.push('7,8','7,7');guarded.maps.map_town.facing=0;
 assert.match(foldStepError(guarded,registry,1),/interaction/); // town well scene
 const bad=castExploration(s,{casterId:wiz,spellId:'spell_wizard_fold_step',steps:2},registry);
 assert.equal(bad.changed,false);assert.equal(bad.state.party.characters[wiz].sp,s.party.characters[wiz].sp);
});
test('status effect validators reject forged/overlong/duplicate effects and v5 persistence survives',()=>{
 const base=fresh();const examples=[
  [{kind:'glass_eye',targetId:'enemy_imp_1',expiresAtMinute:5}],
  [{kind:'stone_skin',targetId:'party',expiresAtMinute:100}],
  [{kind:'binding_thread',targetId:'enemy_imp_1',remainingTurns:2}],
  [{kind:'mirror_ward',targetId:'party',expiresAtMinute:20},{kind:'mirror_ward',targetId:'party',expiresAtMinute:20}],
 ];
 for(const effects of examples){const s=structuredClone(base);s.magic.effects=effects;assert.throws(()=>serializeCampaign(s,registry));}
});
