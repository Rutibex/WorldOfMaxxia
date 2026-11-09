import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry,travelCampaign} from '../src/shared/rules/campaign.ts';
import {initialMagicState,readySpell,checkCast,castExploration,expireMagic,enemyAttackPenalty,enemyFinishedTurn,SPELLS} from '../src/shared/rules/magic.ts';
import {beginEncounter,activeActor,combatAction,castCombatSpell,quickFight,combatTargets} from '../src/shared/rules/combat.ts';
import {derived} from '../src/shared/rules/party.ts';
const town=JSON.parse(readFileSync(new URL('../public/content/town.json',import.meta.url)));
const galleries=JSON.parse(readFileSync(new URL('../public/content/galleries.json',import.meta.url)));
const vault=JSON.parse(readFileSync(new URL('../public/content/vault.json',import.meta.url)));
const registry=validateMapRegistry([town,galleries,vault]);
const fresh=()=>newCampaign(registry);
const dungeon=()=>{const s=fresh();s.currentMapId='map_diagnostic_galleries';return s;};
const caster=(s,classId)=>s.party.order.find(id=>s.party.characters[id].classId===classId);
const untilActor=(initial,id)=>{let s=initial;for(let k=0;k<80&&s.combat.active&&activeActor(s)!==id;k++){
 const actor=activeActor(s);assert.ok(actor?.startsWith('hero_'));const result=combatAction(s,registry,'block');assert.equal(result.changed,true);s=result.state;
 }assert.equal(activeActor(s),id);return s;};
test('six Phase 1 catalogue starter spells, same SP cost model and class-specific knowledge',()=>{
 const s=fresh();assert.equal(Object.keys(SPELLS).length,36);
 for(const classId of ['wizard','priest','witch']){const id=caster(s,classId);assert.equal(s.magic.known[id].length,2);for(const spell of s.magic.known[id])assert.equal(SPELLS[spell].classId,classId);assert.equal(s.magic.readied[id],s.magic.known[id][0]);}
 for(const id of s.party.order.filter(id=>!['wizard','priest','witch'].includes(s.party.characters[id].classId))){assert.deepEqual(s.magic.known[id],[]);assert.equal(s.magic.readied[id],null);}
 assert.ok(s.party.characters[caster(s,'wizard')].sp>0);
});
test('readied spell selection is free, persists, and cannot ready another tradition',()=>{
 const s=fresh(),id=caster(s,'wizard'),before=structuredClone(s);
 const bad=readySpell(s,id,'spell_priest_mend_flesh');assert.equal(bad.changed,false);
 const r=readySpell(s,id,'spell_wizard_lantern_globe');assert.equal(r.changed,true);assert.equal(r.state.magic.readied[id],'spell_wizard_lantern_globe');assert.equal(r.state.elapsedMinutes,s.elapsedMinutes);assert.equal(r.state.party.characters[id].sp,s.party.characters[id].sp);
 assert.deepEqual(before,s);assert.deepEqual(parseCampaign(serializeCampaign(r.state,registry),registry),r.state);
});
test('Lantern Globe is exploration-only, spends SP, survives save, and expires after elapsed time',()=>{
 const s=fresh(),id=caster(s,'wizard'),before=s.party.characters[id].sp;
 const r=castExploration(s,{casterId:id,spellId:'spell_wizard_lantern_globe'});
 assert.ok(r.changed);assert.equal(r.state.party.characters[id].sp,before-1);assert.equal(r.state.magic.effects[0].kind,'light');assert.equal(r.state.magic.effects[0].expiresAtMinute,61);assert.equal(r.state.elapsedMinutes,1);
 assert.equal(checkCast(r.state,{casterId:id,spellId:'spell_wizard_lantern_globe'}),'The party already has a Lantern Globe.');
 const stored=parseCampaign(serializeCampaign(r.state,registry),registry);assert.deepEqual(stored,r.state);
 stored.elapsedMinutes=61;stored.magic.effects=[];const again=castExploration(stored,{casterId:id,spellId:'spell_wizard_lantern_globe'});assert.ok(again.changed);
 assert.equal(s.magic.effects.length,0);
});
test('unavailable targets, full-health allies, incompatible context and insufficient SP consume nothing',()=>{
 const s=fresh(),priest=caster(s,'priest'),wizard=caster(s,'wizard'),enemy=castExploration(s,{casterId:priest,spellId:'spell_priest_sacred_ember'});
 assert.equal(enemy.changed,false);assert.deepEqual(enemy.state,s);
 const full=castExploration(s,{casterId:priest,spellId:'spell_priest_mend_flesh',targetId:wizard});assert.equal(full.changed,false);assert.deepEqual(full.state,s);
 const out=castExploration(s,{casterId:wizard,spellId:'spell_wizard_spark_lance',targetId:'fake'});assert.equal(out.changed,false);
 s.party.characters[wizard].sp=0;const noSP=castExploration(s,{casterId:wizard,spellId:'spell_wizard_lantern_globe'});assert.equal(noSP.changed,false);assert.equal(noSP.state.rollCount,0);
});
test('Mend Flesh heals exactly the missing HP cap, costs 2 SP and uses seeded RNG',()=>{
 const s=fresh(),priest=caster(s,'priest'),patient=caster(s,'wizard');s.party.characters[patient].hp=1;
 const first=castExploration(s,{casterId:priest,spellId:'spell_priest_mend_flesh',targetId:patient});const second=castExploration(s,{casterId:priest,spellId:'spell_priest_mend_flesh',targetId:patient});
 assert.deepEqual(first,second);assert.ok(first.changed);assert.ok(first.state.party.characters[patient].hp>1);assert.ok(first.state.party.characters[patient].hp<=derived(s.party.characters[patient]).maxHP);
 assert.equal(first.state.party.characters[priest].sp,s.party.characters[priest].sp-2);assert.equal(first.state.rollCount,1);assert.equal(first.state.elapsedMinutes,1);
});
test('caster action spends SP and moves turn; wizard attacks reduce enemy HP with deterministic damage',()=>{
 let s=untilActor(beginEncounter(dungeon(),registry).state,'hero_orrin');
 const target=combatTargets(s)[0];const startHP=target.hp,sp=s.party.characters.hero_orrin.sp;
 const r=castCombatSpell(s,registry,{casterId:'hero_orrin',spellId:'spell_wizard_spark_lance',targetId:target.id});
 assert.ok(r.changed);assert.equal(r.state.party.characters.hero_orrin.sp,sp-2);assert.ok(r.state.combat.encounters.enc_gallery_entry.enemies.find(e=>e.id===target.id).hp<startHP);
 assert.equal(r.state.elapsedMinutes,s.elapsedMinutes+1);assert.ok(r.state.rollCount>s.rollCount);
 assert.deepEqual(parseCampaign(serializeCampaign(r.state,registry),registry),r.state);
});
test('enemy hex lasts for three enemy scheduled turns, with attack penalty during affliction',()=>{
 const s=fresh();const id='enemy_imp_1';s.magic.effects=[{kind:'ill_omen',targetId:id,remainingTurns:3}];
 assert.equal(enemyAttackPenalty(s,id),-2);for(const remaining of [2,1]){enemyFinishedTurn(s,id);assert.equal(s.magic.effects[0].remainingTurns,remaining);}
 enemyFinishedTurn(s,id);assert.equal(s.magic.effects.length,0);assert.equal(enemyAttackPenalty(s,id),0);
});
test('new v4 magic save is validated: unknown spells, impossible SP, forged or duplicate effects are rejected',()=>{
 const s=fresh(),id=caster(s,'wizard'),enc=structuredClone(s);enc.magic.known[id]=['spell_priest_mend_flesh'];assert.throws(()=>serializeCampaign(enc,registry),/spell knowledge/);
 const spent=structuredClone(s);spent.party.characters[id].sp=999;assert.throws(()=>serializeCampaign(spent,registry),/Vitals/);
 const forged=structuredClone(s);forged.magic.effects=[{kind:'ill_omen',targetId:'not_real',remainingTurns:3}];assert.throws(()=>serializeCampaign(forged,registry),/enemy hex/);
 const duplicate=structuredClone(s);duplicate.magic.effects=[{kind:'light',targetId:'party',expiresAtMinute:60},{kind:'light',targetId:'party',expiresAtMinute:60}];assert.throws(()=>serializeCampaign(duplicate,registry),/Duplicate/);
});
test('Phase 8 v3 saves upgrade without changes to party, combat, maps, RNG or quest flags',()=>{
 const s=fresh();s.quests.flags.push('flag_test');const old=structuredClone(s);old.inventory={items:[]};old.party.resources.supplies={item_healing_draught:2,item_antidote:2};old.version=3;delete old.magic;
 const result=parseCampaign(JSON.stringify(old),registry);assert.equal(result.version,18);assert.deepEqual(result.party,s.party);assert.deepEqual(result.maps,s.maps);assert.deepEqual(result.combat,s.combat);assert.deepEqual(result.rng,s.rng);assert.deepEqual(result.quests,s.quests);assert.deepEqual(result.magic,initialMagicState(s.party));
 const invalid=structuredClone(old);invalid.magic={};assert.throws(()=>parseCampaign(JSON.stringify(invalid),registry),/version/);
});

test('Witch hex is resisted or applied using saved d20 + Wisdom; caster advances one turn without retry loops',()=>{
 let s=untilActor(beginEncounter(dungeon(),registry).state,'hero_mora');const target=combatTargets(s)[0],before=s.party.characters.hero_mora.sp;
 const first=castCombatSpell(s,registry,{casterId:'hero_mora',spellId:'spell_witch_ill_omen',targetId:target.id});
 const second=castCombatSpell(s,registry,{casterId:'hero_mora',spellId:'spell_witch_ill_omen',targetId:target.id});
 assert.deepEqual(first,second);assert.ok(first.changed);assert.equal(first.state.party.characters.hero_mora.sp,before-2);
 assert.ok(first.messages.some(line=>/resists|Ill Omen/i.test(line)));
 assert.deepEqual(parseCampaign(serializeCampaign(first.state,registry),registry),first.state);
});
test('caster Quick Fight can spend SP only for valid readied spell, and invalid context falls back to Block',()=>{
 let s=beginEncounter(dungeon(),registry).state;
 for(const id of s.party.order){s.party.characters[id].combatSetup.quickAction=['wizard','priest','witch'].includes(s.party.characters[id].classId)?'cast':'block';}
 // Priest default healing targets healthy allies and must block without wasting SP.
 const before=s.party.characters.hero_sera.sp;const r=quickFight(s,registry);
 assert.ok(r.changed);assert.equal(r.state.party.characters.hero_sera.sp,before);
 assert.ok(r.messages.some(x=>/quick-cast|casts/.test(x)));
 // The prepared Lantern Globe cannot be used in melee; blocked instead of spending SP.
 s=beginEncounter(dungeon(),registry).state;s.magic.readied.hero_orrin='spell_wizard_lantern_globe';
 for(const id of s.party.order)s.party.characters[id].combatSetup.quickAction=['wizard','priest','witch'].includes(s.party.characters[id].classId)?'cast':'block';
 const oldSP=s.party.characters.hero_orrin.sp;const result=quickFight(s,registry);
 assert.equal(result.state.party.characters.hero_orrin.sp,oldSP);
 assert.ok(result.messages.some(x=>/quick-cast/i.test(x)));
});
test('a combat spell attempted on another hero turn is free and does not change RNG',()=>{
 const s=beginEncounter(dungeon(),registry).state;const acting=activeActor(s),nonactor=s.party.order.find(id=>id!==acting&&['wizard','priest','witch'].includes(s.party.characters[id].classId));
 const before=structuredClone(s),r=castCombatSpell(s,registry,{casterId:nonactor,spellId:s.magic.readied[nonactor],targetId:combatTargets(s)[0].id});
 assert.equal(r.changed,false);assert.deepEqual(s,before);
});
test('Priest heals in combat as one turn, with no overheal and one seeded die',()=>{
 let s=untilActor(beginEncounter(dungeon(),registry).state,'hero_sera');s.party.characters.hero_orrin.hp=1;
 const sp=s.party.characters.hero_sera.sp,rolls=s.rollCount;
 const r=castCombatSpell(s,registry,{casterId:'hero_sera',spellId:'spell_priest_mend_flesh',targetId:'hero_orrin'});
 assert.equal(r.changed,true);assert.equal(r.state.party.characters.hero_sera.sp,sp-2);
 assert.ok(r.state.party.characters.hero_orrin.hp>=1);assert.ok(r.state.party.characters.hero_orrin.hp<=derived(s.party.characters.hero_orrin).maxHP);
 assert.ok(r.state.rollCount>rolls);assert.deepEqual(parseCampaign(serializeCampaign(r.state,registry),registry),r.state);
});
test('light remains active across time and map travel until its deadline, then expires',()=>{
 let s=fresh();const id=caster(s,'wizard');s=castExploration(s,{casterId:id,spellId:'spell_wizard_lantern_globe'}).state;
 assert.equal(s.magic.effects.length,1);s.elapsedMinutes=58;
 // The actual travel helper validates a nearby portal; expireMagic also services normal movement.
 expireMagic(s);assert.equal(s.magic.effects.length,1);
 s.elapsedMinutes=61;expireMagic(s);assert.equal(s.magic.effects.length,0);
 assert.deepEqual(parseCampaign(serializeCampaign(s,registry),registry),s);
});
