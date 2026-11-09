import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CAMPAIGN_VERSION,newCampaign,validateMapRegistry,serializeCampaign,parseCampaign,travelCampaign} from '../src/shared/rules/campaign.ts';
import {SPELLS,checkCast,learnClassSpell,castExploration,readySpell,nearestWitchClue,borrowedFaceHints,hasPartyWard,enemyDefensePenalty,specialAttackSuppressed,thornMantleActive,finishCombatRound,enemyFinishedTurn,consumeBinding,breakBinding,expireMagic} from '../src/shared/rules/magic.ts';
import {beginEncounter,castCombatSpell,activeActor,combatAction,combatTargets,quickFight} from '../src/shared/rules/combat.ts';
import {derived} from '../src/shared/rules/party.ts';
const files=['town','galleries','vault'].map(x=>JSON.parse(readFileSync(new URL(`../public/content/${x}.json`,import.meta.url))));
const registry=validateMapRegistry(files),witch='hero_mora';
const fresh=()=>newCampaign(registry);
const level=(n=5)=>{const s=fresh(),c=s.party.characters[witch];c.level=n;c.sp=derived(c).maxSP;return s;};
const learned=(s,name)=>{const x=learnClassSpell(s,witch,'spell_witch_'+name);assert.equal(x.changed,true,x.message);return x.state;};
const persist=s=>parseCampaign(serializeCampaign(s,registry),registry);
const gallery=s=>{s.currentMapId='map_diagnostic_galleries';return s;};
const turn=s=>{s=beginEncounter(gallery(s),registry).state;assert.ok(s.combat.active);for(let n=0;n<50&&s.combat.active&&activeActor(s)!==witch;n++){assert.ok(activeActor(s)?.startsWith('hero_'));s=combatAction(s,registry,'block').state;}assert.equal(activeActor(s),witch);return s;};
const cast=(s,name,targetId)=>castCombatSpell(s,registry,{casterId:witch,spellId:'spell_witch_'+name,targetId});

test('Phase 12 adds exactly the ten remaining Witch catalogue spells (36 total across classes)',()=>{
 const expected=['withering_word','ill_omen','borrowed_face','leech_kiss','sleep_of_thorns','rat_whisper','crooked_bones','briar_mantle','malice_rain','bottle_the_echo','hearth_thread','black_moon'];
 assert.deepEqual(Object.values(SPELLS).filter(x=>x.classId==='witch').map(x=>x.id).sort(),expected.map(x=>'spell_witch_'+x).sort());
 assert.equal(Object.keys(SPELLS).length,36);assert.equal(fresh().magic.known[witch].length,2);
 for(const name of expected)assert.ok(SPELLS['spell_witch_'+name].sp>0);
});
test('Witch level gate and knowledge are opt-in; wrong traditions are rejected',()=>{
 const s=fresh(),old=structuredClone(s);assert.equal(learnClassSpell(s,witch,'spell_witch_black_moon').changed,false);
 assert.equal(learnClassSpell(s,witch,'spell_priest_return_breath').changed,false);
 const allowed=learned(level(5),'black_moon');assert.equal(allowed.magic.known[witch].length,3);assert.deepEqual(persist(allowed),allowed);assert.deepEqual(s,old);
});
test('Borrowed Face reports nearby real landmarks, persists, expires, and cannot double-charge',()=>{
 const s=learned(fresh(),'borrowed_face'),sp=s.party.characters[witch].sp; s.maps.map_town.x=7;s.maps.map_town.y=7;s.maps.map_town.visited.push('7,7');
 const r=castExploration(s,{casterId:witch,spellId:'spell_witch_borrowed_face'},registry);
 assert.equal(r.changed,true);assert.equal(r.state.party.characters[witch].sp,sp-1);
 assert.ok(r.messages.some(x=>x.includes('Firstlight Well')));assert.ok(hasPartyWard(r.state,'borrowed_face'));assert.ok(borrowedFaceHints(r.state,registry).length);
 assert.match(checkCast(r.state,{casterId:witch,spellId:'spell_witch_borrowed_face'},registry),/already active/);
 assert.deepEqual(persist(r.state),r.state);r.state.elapsedMinutes=31;expireMagic(r.state);assert.equal(hasPartyWard(r.state,'borrowed_face'),false);
});
test('Rat Whisper records nearest unique authored clue, does not explore cells and rejects depleted locations without spending SP',()=>{
 let s=learned(level(2),'rat_whisper');const originalVisited=[...s.maps.map_town.visited];
 const before=s.party.characters[witch].sp,first=castExploration(s,{casterId:witch,spellId:'spell_witch_rat_whisper'},registry);
 assert.ok(first.changed);assert.equal(first.state.quests.notes.length,1);assert.match(first.state.quests.notes[0],/well/);assert.deepEqual(first.state.maps.map_town.visited,originalVisited);
 assert.equal(first.state.party.characters[witch].sp,before-3);assert.equal(nearestWitchClue(first.state),null);
 const attempt=castExploration(first.state,{casterId:witch,spellId:'spell_witch_rat_whisper'},registry);assert.equal(attempt.changed,false);assert.deepEqual(attempt.state,first.state);
 s=gallery(first.state);for(let i=0;i<3;i++){const found=castExploration(s,{casterId:witch,spellId:'spell_witch_rat_whisper'},registry);assert.ok(found.changed);s=found.state;}
 assert.equal(new Set(s.quests.notes).size,4);assert.deepEqual(persist(s),s);
});
test('Hearth Thread returns from dungeon to known town entrance, exactly ten minutes, no healing or battle bypass',()=>{
 let s=learned(level(4),'hearth_thread');assert.match(checkCast(s,{casterId:witch,spellId:'spell_witch_hearth_thread'},registry),/requires a dungeon/);
 s=gallery(s);s.party.characters[witch].hp=3;const started=s.elapsedMinutes,sp=s.party.characters[witch].sp;
 const r=castExploration(s,{casterId:witch,spellId:'spell_witch_hearth_thread'},registry);
 assert.ok(r.changed);assert.equal(r.state.currentMapId,'map_town');assert.equal(r.state.elapsedMinutes-started,10);assert.equal(r.state.party.characters[witch].hp,3);assert.equal(r.state.party.characters[witch].sp,sp-7);
 assert.deepEqual([r.state.maps.map_town.x,r.state.maps.map_town.y],[registry.map_town.spawn.x,registry.map_town.spawn.y]);assert.deepEqual(persist(r.state),r.state);
 const inBattle=turn(learned(level(4),'hearth_thread'));assert.match(checkCast(inBattle,{casterId:witch,spellId:'spell_witch_hearth_thread'},registry),/cannot be cast in combat/);
});
test('Leech Kiss heals based on actual enemy HP removed, never over-heals or goes negative',()=>{
 let s=learned(level(2),'leech_kiss');s.party.characters[witch].hp=1;s=turn(s);const enemy=combatTargets(s)[0];const original=enemy.hp,oldsp=s.party.characters[witch].sp;
 const r=cast(s,'leech_kiss',enemy.id);assert.ok(r.changed);const current=r.state.combat.encounters.enc_gallery_entry.enemies.find(x=>x.id===enemy.id);
 const stolen=original-current.hp;assert.ok(stolen>0);assert.equal(r.state.party.characters[witch].hp,Math.min(derived(r.state.party.characters[witch]).maxHP,1+Math.floor(stolen/2)));
 assert.equal(r.state.party.characters[witch].sp,oldsp-4);assert.deepEqual(persist(r.state),r.state);
 assert.deepEqual(cast(s,'leech_kiss',enemy.id),r);
});
test('Sleep of Thorns prevents one action and damage wakes the target',()=>{
 let s=turn(learned(level(2),'sleep_of_thorns'));const enemy=combatTargets(s)[0];
 const r=cast(s,'sleep_of_thorns',enemy.id);assert.equal(r.changed,true);assert.ok(r.messages.some(x=>/resists|Sleep of Thorns/.test(x)));
 s=r.state;s.magic.effects=s.magic.effects.filter(x=>x.kind!=='sleep_thorns');s.magic.effects.push({kind:'sleep_thorns',targetId:enemy.id,remainingTurns:1});
 assert.equal(consumeBinding(s,enemy.id),true);assert.equal(consumeBinding(s,enemy.id),false);
 s.magic.effects.push({kind:'sleep_thorns',targetId:enemy.id,remainingTurns:1});breakBinding(s,enemy.id);assert.equal(consumeBinding(s,enemy.id),false);assert.deepEqual(persist(s),s);
});
test('Crooked Bones reduces enemy defense for exactly three enemy turns; rejected duplicates are free',()=>{
 let s=turn(learned(level(3),'crooked_bones')),enemy=combatTargets(s)[0];
 const r=cast(s,'crooked_bones',enemy.id);assert.ok(r.changed);
 s=r.state;s.magic.effects=s.magic.effects.filter(e=>e.kind!=='crooked_bones');s.magic.effects.push({kind:'crooked_bones',targetId:enemy.id,remainingTurns:3});
 assert.equal(enemyDefensePenalty(s,enemy.id),-3);s.combat.active.turnIndex=s.combat.active.turnOrder.indexOf(witch);assert.match(checkCast(s,{casterId:witch,spellId:'spell_witch_crooked_bones',targetId:enemy.id},registry),/already bears/);
 for(let i=0;i<3;i++)enemyFinishedTurn(s,enemy.id);assert.equal(enemyDefensePenalty(s,enemy.id),0);assert.deepEqual(persist(s),s);
});
test('Briar Mantle wards the party in exploration or combat and expires by the appropriate clock',()=>{
 let s=learned(level(3),'briar_mantle');const r=castExploration(s,{casterId:witch,spellId:'spell_witch_briar_mantle'},registry);
 assert.ok(r.changed);assert.equal(thornMantleActive(r.state),true);assert.deepEqual(persist(r.state),r.state);
 r.state.elapsedMinutes=6;expireMagic(r.state);assert.equal(thornMantleActive(r.state),false);
 s=turn(learned(level(3),'briar_mantle'));const b=cast(s,'briar_mantle');assert.ok(b.changed);s=b.state;
 // Effect remains for five whole combat rounds, not five separate hero actions.
 s.magic.effects=s.magic.effects.filter(e=>e.kind!=='briar_mantle');s.magic.effects.push({kind:'briar_mantle',targetId:'party',remainingTurns:5});
 for(let i=0;i<4;i++){finishCombatRound(s);assert.equal(thornMantleActive(s),true);}finishCombatRound(s);assert.equal(thornMantleActive(s),false);assert.deepEqual(persist(s),s);
});
test('Malice Rain and Black Moon use saving throws against each visible enemy deterministically',()=>{
 for(const [name,levelRequired,damageType] of [['malice_rain',3,'poison'],['black_moon',5,'necrotic']]){
  const s=turn(learned(level(levelRequired),name)),old=structuredClone(s);
  const r=cast(s,name);assert.ok(r.changed);assert.ok(r.messages.some(x=>x.includes(damageType+' damage')));assert.ok(r.state.rollCount>s.rollCount);
  assert.deepEqual(cast(old,name),r);assert.deepEqual(persist(r.state),r.state);
 }
});
test('Bottle the Echo suppresses only enemy special attacks for two enemy turns',()=>{
 let s=turn(learned(level(4),'bottle_the_echo'));const enemy=combatTargets(s)[0];
 const r=cast(s,'bottle_the_echo',enemy.id);assert.ok(r.changed);assert.ok(r.messages.some(x=>/resists|suppresses/.test(x)));
 s=r.state;s.magic.effects=s.magic.effects.filter(e=>e.kind!=='bottle_echo');s.magic.effects.push({kind:'bottle_echo',targetId:enemy.id,remainingTurns:2});
 assert.equal(specialAttackSuppressed(s,enemy.id),true);enemyFinishedTurn(s,enemy.id);assert.equal(specialAttackSuppressed(s,enemy.id),true);
 enemyFinishedTurn(s,enemy.id);assert.equal(specialAttackSuppressed(s,enemy.id),false);assert.deepEqual(persist(s),s);
});
test('Quick Fight with invalid expensive Witch readied spell safely guards without spending SP',()=>{
 let s=turn(learned(level(5),'black_moon'));s.magic.readied[witch]='spell_witch_black_moon';s.party.characters[witch].combatSetup.quickAction='cast';s.party.characters[witch].sp=0;
 const r=quickFight(s,registry);assert.ok(r.changed);assert.equal(r.state.party.characters[witch].sp,0);assert.ok(r.messages.some(x=>/cannot quick-cast|blocks|guards/.test(x)));
});
test('Phase 11 v6 saves migrate to v7 preserving knowledge, notes, persistent statuses and RNG',()=>{
 let s=learned(level(2),'rat_whisper');s=castExploration(s,{casterId:witch,spellId:'spell_witch_rat_whisper'},registry).state;
 const old=structuredClone(s);old.inventory={items:[]};old.party.resources.supplies={item_healing_draught:2,item_antidote:2};old.version=6;const result=parseCampaign(JSON.stringify(old),registry);
 assert.equal(result.version,18);assert.equal(CAMPAIGN_VERSION,18);assert.deepEqual(result.magic,s.magic);assert.deepEqual(result.quests,s.quests);assert.deepEqual(result.rng,s.rng);assert.deepEqual(result.maps,s.maps);
});
test('Forged Witch effects and unknown target IDs are rejected by save validation',()=>{
 const s=fresh();s.magic.effects=[{kind:'crooked_bones',targetId:'fake_enemy',remainingTurns:3}];assert.throws(()=>serializeCampaign(s,registry),/enemy hex/);
 s.magic.effects=[{kind:'briar_mantle',targetId:'party',remainingTurns:6}];assert.throws(()=>serializeCampaign(s,registry),/timed party spell/);
 s.magic.effects=[{kind:'borrowed_face',targetId:'party',expiresAtMinute:500}];assert.throws(()=>serializeCampaign(s,registry),/timed party spell/);
});
