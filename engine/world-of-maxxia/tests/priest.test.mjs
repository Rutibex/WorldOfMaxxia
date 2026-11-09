import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry} from '../src/shared/rules/campaign.ts';
import {SPELLS,learnClassSpell,checkCast,castExploration,hasPartyWard,partyAttackBonus,partyDefenseBonus,partyFearImmune,inflictFear,finishCombatRound,enemyAttackPenalty,enemyFinishedTurn} from '../src/shared/rules/magic.ts';
import {beginEncounter,activeActor,combatAction,castCombatSpell,quickFight} from '../src/shared/rules/combat.ts';
import {derived,withCondition} from '../src/shared/rules/party.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(x=>JSON.parse(readFileSync(new URL(`../public/content/${x}.json`,import.meta.url)))));
const fresh=()=>newCampaign(registry);
const findPriest=s=>s.party.order.find(id=>s.party.characters[id].classId==='priest');
function level(s,n){const id=findPriest(s),c=s.party.characters[id];c.level=n;c.hp=derived(c).maxHP;c.sp=derived(c).maxSP;return s;}
function learned(s,slug){const id=findPriest(s),r=learnClassSpell(s,id,`spell_priest_${slug}`);assert.equal(r.changed,true,r.message);return r.state;}
const persist=s=>parseCampaign(serializeCampaign(s,registry),registry);
function priestTurn(s,mapId='map_diagnostic_galleries'){
 const id=findPriest(s);s.currentMapId=mapId;
 let started=beginEncounter(s,registry);assert.ok(started.state.combat.active,'Encounter should be in range');s=started.state;
 for(let i=0;i<30&&s.combat.active&&activeActor(s)!==id;i++){
  assert.ok(activeActor(s)?.startsWith('hero_'));s=combatAction(s,registry,'block').state;
 }
 assert.equal(activeActor(s),id);return s;
}
function watcher(){let s=fresh();s.currentMapId='map_diagnostic_galleries';const w=s.maps.map_diagnostic_galleries;w.x=7;w.y=8;if(!w.visited.includes('7,8'))w.visited.push('7,8');return s;}

test('Priest has exactly twelve Phase 1 catalogue spells; other traditions unchanged',()=>{
 const expected=['mend_flesh','sacred_ember','pilgrim_light','cleanse_venom','steadfast','blessing','healing_chorus','turn_the_hollow','sheltering_hand','break_malison','return_breath','dawn_judgment'];
 assert.deepEqual(Object.values(SPELLS).filter(s=>s.classId==='priest').map(s=>s.id).sort(),expected.map(s=>`spell_priest_${s}`).sort());
 assert.equal(Object.values(SPELLS).filter(s=>s.classId==='wizard').length,12);
 assert.equal(Object.values(SPELLS).filter(s=>s.classId==='witch').length,12);
 assert.equal(fresh().magic.known[findPriest(fresh())].length,2);
});
test('Priest learning respects class, level, identity and is free',()=>{
 const s=fresh(),id=findPriest(s);
 assert.equal(learnClassSpell(s,id,'spell_priest_dawn_judgment').changed,false);
 assert.equal(learnClassSpell(s,id,'spell_wizard_starfall').changed,false);
 const next=learned(level(s,5),'dawn_judgment');assert.equal(next.magic.known[id].length,3);
 assert.equal(next.party.characters[id].sp,s.party.characters[id].sp);
 assert.deepEqual(persist(next),next);
});
test('Pilgrim Light uses common light effect with no stacking, and cannot cast in combat',()=>{
 let s=learned(fresh(),'pilgrim_light');const id=findPriest(s);
 const r=castExploration(s,{casterId:id,spellId:'spell_priest_pilgrim_light'},registry);
 assert.equal(r.changed,true);assert.ok(hasPartyWard(r.state,'light'));
 assert.equal(r.state.party.characters[id].sp,s.party.characters[id].sp-1);
 assert.equal(checkCast(r.state,{casterId:id,spellId:'spell_priest_pilgrim_light'},registry),'The party already has a Lantern Globe.');
 assert.deepEqual(persist(r.state),r.state);
});
test('Cleanse Venom removes just poison and refuses invalid/full/dead targets without cost',()=>{
 let s=learned(level(fresh(),2),'cleanse_venom');const id=findPriest(s),patient=s.party.order[0],c=s.party.characters[patient];
 assert.equal(checkCast(s,{casterId:id,spellId:'spell_priest_cleanse_venom',targetId:patient},registry),'That ally is not poisoned.');
 const before=serializeCampaign(s,registry);
 assert.equal(castExploration(s,{casterId:id,spellId:'spell_priest_cleanse_venom',targetId:patient},registry).changed,false);
 assert.equal(serializeCampaign(s,registry),before);
 s.party.characters[patient]=withCondition(withCondition(c,{id:'poisoned',unit:'ticks',remaining:3}),{id:'cursed',unit:'persistent',remaining:null});
 const r=castExploration(s,{casterId:id,spellId:'spell_priest_cleanse_venom',targetId:patient},registry);
 assert.equal(r.changed,true);assert.deepEqual(r.state.party.characters[patient].conditions.map(x=>x.id),['cursed']);
 assert.deepEqual(persist(r.state),r.state);
});
test('Steadfast removes all fear and protects against new fear for three exploration minutes',()=>{
 let s=learned(level(fresh(),2),'steadfast');const id=findPriest(s),a=s.party.order[0],b=s.party.order[1];
 for(const target of [a,b])s.party.characters[target]=withCondition(s.party.characters[target],{id:'frightened',unit:'turns',remaining:3});
 const r=castExploration(s,{casterId:id,spellId:'spell_priest_steadfast'},registry);assert.equal(r.changed,true);
 for(const target of [a,b])assert.equal(r.state.party.characters[target].conditions.some(v=>v.id==='frightened'),false);
 assert.equal(partyFearImmune(r.state),true);assert.equal(inflictFear(r.state,a),false);
 const copied=structuredClone(r.state);copied.elapsedMinutes=4;
 assert.equal(partyFearImmune(copied),false);assert.equal(inflictFear(copied,a),true);
 assert.deepEqual(persist(r.state),r.state);
});
test('Steadfast combat version expires in three rounds, not on an arbitrary action count',()=>{
 let s=fresh();s.magic.effects.push({kind:'steadfast',targetId:'party',remainingTurns:3});
 s=priestTurn(s);
 assert.equal(partyFearImmune(s),true);
 finishCombatRound(s);assert.equal(s.magic.effects.find(v=>v.kind==='steadfast')?.remainingTurns,2);
 finishCombatRound(s);assert.equal(partyFearImmune(s),true);
 finishCombatRound(s);assert.equal(partyFearImmune(s),false);
 assert.deepEqual(persist(s),s);
});
test('Blessing and Sheltering Hand stack with existing Wizard Stone Skin',()=>{
 let s=learned(learned(level(fresh(),3),'blessing'),'sheltering_hand');const id=findPriest(s);
 const plus=castExploration(s,{casterId:id,spellId:'spell_priest_blessing'},registry);assert.equal(partyAttackBonus(plus.state),1);
 const shield=castExploration(plus.state,{casterId:id,spellId:'spell_priest_sheltering_hand'},registry);assert.equal(partyDefenseBonus(shield.state),2);
 shield.state.magic.effects.push({kind:'stone_skin',targetId:'party',expiresAtMinute:shield.state.elapsedMinutes+30});
 assert.equal(partyDefenseBonus(shield.state),4);assert.deepEqual(persist(shield.state),shield.state);
 assert.match(checkCast(shield.state,{casterId:id,spellId:'spell_priest_blessing'},registry),/already active/);
});
test('Healing Chorus heals every living injured hero without reviving dead or exceeding max',()=>{
 let s=learned(level(fresh(),3),'healing_chorus');const id=findPriest(s),dead=s.party.order[0],injured=s.party.order[1];
 s.party.characters[dead].hp=0;s.party.characters[injured].hp=1;
 const before=s.party.characters[id].sp,r=castExploration(s,{casterId:id,spellId:'spell_priest_healing_chorus'},registry);
 assert.equal(r.changed,true);assert.equal(r.state.party.characters[dead].hp,0);assert.ok(r.state.party.characters[injured].hp>1);
 assert.equal(r.state.party.characters[id].sp,before-6);
 assert.ok(r.state.rollCount>0);assert.deepEqual(persist(r.state),r.state);
 const full=learned(level(fresh(),3),'healing_chorus');assert.match(checkCast(full,{casterId:findPriest(full),spellId:'spell_priest_healing_chorus'},registry),/needs healing/);
});
test('Turn the Hollow only affects undead, WIS save halves and prevents fear',()=>{
 let s=learned(level(watcher(),3),'turn_the_hollow');s=priestTurn(s);const id=findPriest(s),h=s.combat.encounters.enc_gallery_east.enemies[0].hp,sp=s.party.characters[id].sp;
 const r=castCombatSpell(s,registry,{casterId:id,spellId:'spell_priest_turn_the_hollow'});
 assert.equal(r.changed,true);assert.equal(r.state.party.characters[id].sp,sp-5);
 assert.ok(r.state.combat.encounters.enc_gallery_east.enemies[0].hp<h);
 assert.ok(r.messages.some(x=>x.includes('holy damage')));assert.deepEqual(persist(r.state),r.state);
 let normal=learned(level(fresh(),3),'turn_the_hollow');normal.currentMapId='map_diagnostic_galleries';normal=priestTurn(normal);
 assert.match(checkCast(normal,{casterId:findPriest(normal),spellId:'spell_priest_turn_the_hollow'},registry),/undead/);
});
test('Break Malison removes cursed status and per-character equipped-item curses only',()=>{
 let s=learned(level(fresh(),4),'break_malison');const id=findPriest(s),ally=s.party.order[0],other=s.party.order[1];
 const gear=s.party.characters[ally].equipment.melee??s.party.characters[ally].equipment.body;
 const otherGear=s.party.characters[other].equipment.melee??s.party.characters[other].equipment.body;
 s.magic.itemCurses[ally]=[gear];s.magic.itemCurses[other]=[otherGear];
 s.party.characters[ally]=withCondition(s.party.characters[ally],{id:'cursed',unit:'persistent',remaining:null});
 const r=castExploration(s,{casterId:id,spellId:'spell_priest_break_malison',targetId:ally},registry);
 assert.equal(r.changed,true);assert.deepEqual(r.state.magic.itemCurses[ally],[]);assert.deepEqual(r.state.magic.itemCurses[other],[otherGear]);
 assert.equal(r.state.party.characters[ally].conditions.some(c=>c.id==='cursed'),false);
 assert.match(checkCast(r.state,{casterId:id,spellId:'spell_priest_break_malison',targetId:ally},registry),/no curse/);
 assert.deepEqual(persist(r.state),r.state);
});
test('Return Breath revives with 1 HP, zero SP; dead-target and exploration restrictions apply',()=>{
 let s=learned(level(fresh(),4),'return_breath');const id=findPriest(s),patient=s.party.order.find(x=>x!==id);
 assert.match(checkCast(s,{casterId:id,spellId:'spell_priest_return_breath',targetId:patient},registry),/fallen/);
 s.party.characters[patient].hp=0;s.party.characters[patient].sp=3;
 const r=castExploration(s,{casterId:id,spellId:'spell_priest_return_breath',targetId:patient},registry);
 assert.equal(r.changed,true);assert.equal(r.state.party.characters[patient].hp,1);assert.equal(r.state.party.characters[patient].sp,0);
 assert.deepEqual(persist(r.state),r.state);
 let combat=s;combat=priestTurn(combat);assert.match(checkCast(combat,{casterId:id,spellId:'spell_priest_return_breath',targetId:patient},registry),/cannot be cast in combat/);
});
test('Dawn Judgment uses CON saving throws and is deterministic with area damage',()=>{
 let s=learned(level(fresh(),5),'dawn_judgment');s=priestTurn(s);const id=findPriest(s);
 const result=castCombatSpell(s,registry,{casterId:id,spellId:'spell_priest_dawn_judgment'});
 assert.equal(result.changed,true);assert.deepEqual(result,castCombatSpell(s,registry,{casterId:id,spellId:'spell_priest_dawn_judgment'}));
 assert.ok(result.messages.filter(x=>x.includes('holy damage')).length>=1);
 assert.deepEqual(persist(result.state),result.state);
});
test('Phase 10 v5 save migration adds empty item curse registry without altering established state',()=>{
 const s=fresh(),old=structuredClone(s);old.inventory={items:[]};old.party.resources.supplies={item_healing_draught:2,item_antidote:2};old.version=5;delete old.magic.itemCurses;
 const result=parseCampaign(JSON.stringify(old),registry);assert.equal(result.version,18);
 assert.deepEqual(result.magic.itemCurses,s.magic.itemCurses);assert.deepEqual(result.party,s.party);assert.deepEqual(result.combat,s.combat);
 const broken=structuredClone(s);broken.magic.itemCurses[findPriest(s)]=['item_bad'];assert.throws(()=>serializeCampaign(broken,registry),/equipment curse/);
 const tampered=structuredClone(old);tampered.magic.itemCurses={evil:['item_staff']};assert.throws(()=>parseCampaign(JSON.stringify(tampered),registry),/curse registry/);
});
