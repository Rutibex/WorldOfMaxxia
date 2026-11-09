import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDefaultParty,derived,defaultCombatSetup,validateParty,PREPARED_STYLES} from '../src/shared/rules/party.ts';
import {strikeProfile,setPrepared,setQuickAction} from '../src/shared/rules/noncaster.ts';
import {newCampaign,validateMapRegistry,serializeCampaign,parseCampaign} from '../src/shared/rules/campaign.ts';
import {beginEncounter,activeActor,combatAction,quickFight,combatTargets,chooseTarget} from '../src/shared/rules/combat.ts';
const town=JSON.parse(readFileSync(new URL('../public/content/town.json',import.meta.url)));
const galleries=JSON.parse(readFileSync(new URL('../public/content/galleries.json',import.meta.url)));
const vault=JSON.parse(readFileSync(new URL('../public/content/vault.json',import.meta.url)));
const registry=validateMapRegistry([town,galleries,vault]);
const fresh=()=>newCampaign(registry);
const dungeon=()=>{const s=fresh();s.currentMapId='map_diagnostic_galleries';return s;};
const party=()=>createDefaultParty();
test('each class has valid level-1 style and quick default, with strict class-specific styles',()=>{
 const p=party();for(const id of p.order){const c=p.characters[id];assert.ok(PREPARED_STYLES[c.classId].includes(c.combatSetup.prepared));assert.equal(c.combatSetup.quickAction,'attack');}
 assert.throws(()=>setPrepared(p.characters.hero_tarin,'claws'),/not available/);
 assert.throws(()=>setQuickAction(p.characters.hero_tarin,'cast'),/Unknown/);assert.equal(setQuickAction(p.characters.hero_sera,'cast').combatSetup.quickAction,'cast');
 assert.deepEqual(defaultCombatSetup('mutant'),{prepared:'claws',quickAction:'attack'});
});
test('myrmidon prepared style changes hit chance, damage and Defense and scales levels',()=>{
 const c=party().characters.hero_tarin,base=strikeProfile(c,'melee');
 const power=setPrepared(c,'power'),guard=setPrepared(c,'bastion');
 assert.equal(strikeProfile(power,'melee').damageBonus,base.damageBonus+2);
 assert.equal(strikeProfile(power,'melee').attackBonus,base.attackBonus-2);
 assert.equal(derived(guard).defense,derived(c).defense+2);
 assert.equal(strikeProfile(guard,'melee').attackBonus,base.attackBonus-2);
 assert.equal(strikeProfile({...c,level:5},'melee').attackBonus,base.attackBonus+2); // level 5 proficiency also grows +1
 assert.equal(strikeProfile({...c,level:3},'melee').damageBonus,base.damageBonus+1);
});
test('artificer devices are free melee attacks based on DEX, not inventory charges; ranged keeps crossbow',()=>{
 const c=party().characters.hero_vexa,needle=strikeProfile(c,'melee'),spark=strikeProfile(setPrepared(c,'spark'),'melee'),ranged=strikeProfile(c,'ranged');
 assert.equal(needle.label,'Needle Device');assert.equal(needle.ignoreDefense,2);assert.equal(needle.dice,'1d4');
 assert.equal(spark.damageType,'lightning');assert.equal(spark.ignoreDefense,0);
 assert.ok(spark.damageBonus>0);assert.match(ranged.label,/Crossbow/);
 assert.ok(strikeProfile({...c,level:3},'ranged').damageBonus>ranged.damageBonus);
});
test('mutant claws use CON and grow 1d6 → 1d8 → 1d10; carapace defense improves',()=>{
 const c=party().characters.hero_brindle;
 assert.equal(strikeProfile(c,'melee').dice,'1d6');assert.equal(strikeProfile({...c,level:3},'melee').dice,'1d8');assert.equal(strikeProfile({...c,level:5},'melee').dice,'1d10');
 const car=setPrepared(c,'carapace');assert.equal(derived(car).defense,derived(c).defense+2);
 assert.equal(derived({...car,level:5}).defense,derived({...c,level:5}).defense+3);
 assert.match(strikeProfile(car,'melee').label,/Spear/);
});
test('Quick Fight runs bounded player actions with no SP spending or infinite retry when target is distant',()=>{
 let s=beginEncounter(dungeon(),registry).state;const beforeSP=s.party.order.map(id=>s.party.characters[id].sp);
 for(const id of s.party.order)s.party.characters[id].combatSetup.quickAction='attack';
 const r=quickFight(s,registry);assert.equal(r.changed,true);assert.ok(r.messages.length>0);assert.ok(r.state.elapsedMinutes>s.elapsedMinutes);
 assert.deepEqual(r.state.party.order.map(id=>r.state.party.characters[id].sp),beforeSP);
 assert.ok(r.state.elapsedMinutes-s.elapsedMinutes<=6);
 assert.equal(serializeCampaign(r.state,registry)!==undefined,true);
});
test('Quick Fight Block preset always advances and Run either advances or ends combat safely',()=>{
 let s=beginEncounter(dungeon(),registry).state;
 for(const id of s.party.order)s.party.characters[id].combatSetup.quickAction='block';
 const r=quickFight(s,registry);assert.ok(r.changed);assert.ok(r.messages.some(v=>/blocks|misses|approaches|hits/i.test(v)));
 s=beginEncounter(dungeon(),registry).state;
 for(const id of s.party.order)s.party.characters[id].combatSetup.quickAction='run';
 const r2=quickFight(s,registry);assert.ok(r2.changed);assert.ok(r2.state.elapsedMinutes>=s.elapsedMinutes);
});
test('Phase 7 v2 save migrates its complete party and current battle to v3 defaults',()=>{
 const s=beginEncounter(dungeon(),registry).state;const old=structuredClone(s);delete old.magic;old.inventory={items:[]};old.party.resources.supplies={item_healing_draught:2,item_antidote:2};old.version=2;
 for(const id of old.party.order)delete old.party.characters[id].combatSetup;
 const parsed=parseCampaign(JSON.stringify(old),registry);
 assert.equal(parsed.version,18);assert.equal(parsed.combat.active.encounterId,s.combat.active.encounterId);
 assert.deepEqual(parsed.rng,s.rng);assert.deepEqual(parsed.maps,s.maps);
 assert.deepEqual(parsed.party.characters.hero_vexa.combatSetup,{prepared:'needle',quickAction:'attack'});
 assert.deepEqual(parseCampaign(serializeCampaign(parsed,registry),registry),parsed);
});
test('Phase 8 save setup persists and rejects invalid modes or partially migrated state',()=>{
 const s=fresh();s.party.characters.hero_brindle.combatSetup={prepared:'carapace',quickAction:'block'};
 const json=serializeCampaign(s,registry);assert.equal(parseCampaign(json,registry).party.characters.hero_brindle.combatSetup.prepared,'carapace');
 const bad=JSON.parse(json);bad.party.characters.hero_brindle.combatSetup.prepared='unlimited';assert.throws(()=>parseCampaign(JSON.stringify(bad),registry),/class combat setup/);
 const partial=JSON.parse(json);delete partial.magic;partial.inventory={items:[]};partial.party.resources.supplies={item_healing_draught:2,item_antidote:2};partial.version=2;delete partial.party.characters.hero_tarin.combatSetup;assert.throws(()=>parseCampaign(JSON.stringify(partial),registry),/version/);
});
