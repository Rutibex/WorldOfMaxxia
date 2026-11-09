import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCustomParty,makeHero,proposedHero,validateBlueprint,nextHeroId,ROSTER_LIMIT} from '../src/shared/rules/creation.ts';
import {newCampaign,parseCampaign,serializeCampaign,validateMapRegistry,validateCampaign} from '../src/shared/rules/campaign.ts';
import {serviceAction,TOWN_SERVICES} from '../src/shared/rules/services.ts';
import {derived,training,validateParty} from '../src/shared/rules/party.ts';
import {validateMagic} from '../src/shared/rules/magic.ts';
import {validateInventory} from '../src/shared/rules/inventory.ts';
import {beginEncounter,quickFight} from '../src/shared/rules/combat.ts';
const registry=validateMapRegistry(['town','galleries','vault'].map(name=>JSON.parse(readFileSync(new URL(`../public/content/${name}.json`,import.meta.url)))));
const blueprints=()=>Array.from({length:6},(_,i)=>({...proposedHero(i),name:`Explorer ${i+1}`}));
const position=s=>{const n=TOWN_SERVICES.find(n=>n.kind==='tavern');s.maps.map_town.x=n.x;s.maps.map_town.y=n.y;s.maps.map_town.facing=1;s.maps.map_town.visited.push(`${n.x},${n.y}`);return s;};
const act=(s,action,r={})=>serviceAction(s,registry,{serviceId:'npc_tessa_bell',action,...r});
const roundTrip=s=>assert.deepEqual(parseCampaign(serializeCampaign(s,registry),registry),s);

test('custom six can have duplicate classes, independent SP books, portraits and starter equipment',()=>{
 const heroes=blueprints();heroes.forEach((h,i)=>{h.classId='witch';h.attributes=proposedHero(0,'witch').attributes;h.portrait=i+6;});
 const party=createCustomParty(heroes);const s=newCampaign(registry,'map_town',party);
 assert.equal(s.party.order.length,6);assert.equal(new Set(s.party.order).size,6);assert.equal(s.inventory.items.filter(x=>!!x.equipped).length,12);
 for(let i=0;i<6;i++){const id=s.party.order[i],char=s.party.characters[id];assert.equal(char.classId,'witch');assert.equal(char.portrait,i+6);assert.equal(char.hp,derived(char).maxHP);assert.equal(char.sp,derived(char).maxSP);assert.equal(s.magic.known[id].length,2);assert.equal(s.magic.readied[id],'spell_witch_withering_word');}
 validateCampaign(s,registry);roundTrip(s);
});
test('creation rejects invalid names, invalid point budgets, duplicate names and too many characters',()=>{
 const items=blueprints();assert.throws(()=>validateBlueprint({...items[0],name:'  name'}));assert.throws(()=>validateBlueprint({...items[0],portrait:12}));assert.throws(()=>validateBlueprint({...items[0],attributes:{...items[0].attributes,STR:17}}));assert.throws(()=>createCustomParty(items.slice(0,5)));
 items[1].name=items[0].name.toUpperCase();assert.throws(()=>createCustomParty(items));
 assert.equal(createCustomParty(blueprints()).order.length,6);
});
test('attribute score edits change derived HP SP and class feature setup but not other party members',()=>{
 const base=proposedHero(0,'wizard'),changed={...base,attributes:{...base.attributes,INT:14,CON:14}};
 const a=makeHero(base,'hero_custom_010'),b=makeHero(changed,'hero_custom_011');
 assert.equal(derived(a).maxSP>derived(b).maxSP,true);assert.equal(derived(b).maxHP>derived(a).maxHP,true);
 assert.equal(b.combatSetup.prepared,'standard');assert.equal(b.level,1);
});
test('existing v13 saves migrate to v14 without changing party, maps, inventory, magic, quests or rng',()=>{
 const original=newCampaign(registry);const old={...structuredClone(original),version:13};const loaded=parseCampaign(JSON.stringify(old),registry);
 assert.equal(loaded.version,18);
 for(const key of ['party','maps','inventory','magic','quests','rng','combat'])assert.deepEqual(loaded[key],original[key]);roundTrip(loaded);
});
test('tavern registration costs gold, stores the new hero, prepares starter items and spells, and survives save/load',()=>{
 let s=position(newCampaign(registry)),b={...proposedHero(3,'priest'),name:'Novella',portrait:11};
 let result=act(s,'register',{blueprint:b});assert.equal(result.changed,true);s=result.state;
 const id=nextHeroId(s.party);assert.equal(id,'hero_custom_002');const hero=s.party.characters.hero_custom_001;
 assert.equal(hero.name,'Novella');assert.equal(s.party.resources.gold,260);assert.equal(s.party.order.length,6);
 assert.ok(s.inventory.items.filter(i=>i.ownerId===hero.id&&i.equipped).length>=2);assert.equal(s.magic.known[hero.id].length,2);
 validateParty(s.party);validateMagic(s.magic,s);validateInventory(s.inventory,s.party);roundTrip(s);
 assert.equal(act(s,'register',{blueprint:b}).changed,false);
 s=act(s,'dismiss',{characterId:s.party.order[0]}).state;s=act(s,'recruit',{characterId:hero.id}).state;
 assert.ok(s.party.order.includes(hero.id));assert.equal(s.party.order.length,6);roundTrip(s);
});
test('registration failures are atomic; roster limit and full party limits are enforced',()=>{
 let s=position(newCampaign(registry)),original=JSON.stringify(s),b={...proposedHero(1),name:'Newcomer'};
 assert.equal(act(s,'register',{blueprint:{...b,attributes:{...b.attributes,DEX:22}}}).changed,false);assert.equal(JSON.stringify(s),original);
 s.party.resources.gold=0;assert.equal(act(s,'register',{blueprint:b}).changed,false);s.party.resources.gold=10000;
 for(let i=0;i<ROSTER_LIMIT-6;i++){const res=act(s,'register',{blueprint:{...b,name:`Newcomer ${i}`}});assert.equal(res.changed,true);s=res.state;}
 assert.equal(Object.keys(s.party.characters).length,ROSTER_LIMIT);
 assert.equal(act(s,'register',{blueprint:{...b,name:'Overflow'}}).changed,false);roundTrip(s);
});
test('level 3 and 5 training upgrades custom parties and preserves quest flags and roster',()=>{
 let s=position(newCampaign(registry,'map_town',createCustomParty(blueprints())));const id=s.party.order[0];const originalFlags=[...s.quests.flags];
 s.party.characters[id].xp=3000;s.party.resources.gold=500;let r=serviceAction(s,registry,{serviceId:'npc_captain_brann',action:'train',characterId:id});assert.equal(r.changed,false);
 // move to training yard and record discovery
 const npc=TOWN_SERVICES.find(n=>n.kind==='trainer');s.maps.map_town.x=npc.x;s.maps.map_town.y=npc.y;s.maps.map_town.visited.push(`${npc.x},${npc.y}`);
 for(let level=2;level<=5;level++){const t=training(s.party.characters[id]);assert.equal(t.eligible,true);r=serviceAction(s,registry,{serviceId:npc.id,action:'train',characterId:id,...([3,5].includes(level)?{ability:'WIS'}:{})});assert.equal(r.changed,true);s=r.state;}
 assert.equal(s.party.characters[id].level,5);assert.equal(training(s.party.characters[id]).capped,true);assert.deepEqual(s.quests.flags,originalFlags);roundTrip(s);
});
test('alternate single-class party can enter a real encounter with independent combat actors',()=>{
 const party=createCustomParty(blueprints().map((h,i)=>({...h,classId:'myrmidon',attributes:proposedHero(0,'myrmidon').attributes,portrait:i+6})));
 const s=newCampaign(registry,'map_town',party);
 // The custom IDs must be accepted by the shared combat engine, rather than looking for original names.
 s.currentMapId='map_diagnostic_galleries';s.maps.map_diagnostic_galleries.x=2;s.maps.map_diagnostic_galleries.y=8;
 const result=beginEncounter(s,registry);assert.equal(result.changed,true);assert.ok(result.state.combat.active);
 assert.ok(result.state.combat.active.turnOrder.some(id=>id==='hero_custom_001'));
 const output=quickFight(result.state,registry);assert.equal(typeof output.changed,'boolean');roundTrip(output.state);
});
