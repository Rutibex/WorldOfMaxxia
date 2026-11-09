import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAmountExpression,evaluateAmountExpression,ExpressionError} from '../src/shared/rules/expressions.ts';
import {installSpellDatabase,resetSpellDatabase,readSpellDatabase,SpellDatabaseError} from '../src/shared/content/spells.ts';
import {newCampaign,validateMapRegistry,serializeCampaign,parseCampaign} from '../src/shared/rules/campaign.ts';
import {castExploration} from '../src/shared/rules/magic.ts';
import {beginEncounter,activeActor,combatAction,castCombatSpell,combatTargets} from '../src/shared/rules/combat.ts';
import {SeededRng} from '../src/shared/rules/rng.ts';
const root=new URL('../public/',import.meta.url);
const baseline=JSON.parse(readFileSync(new URL('projects/WorldOfMaxxia/database/spells.json',root)));
const registry=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL(`content/${n}.json`,root)))));
const withDb=(mutate,execute)=>{const db=structuredClone(baseline);mutate(db);try{installSpellDatabase(db);return execute();}finally{resetSpellDatabase();}};
function add(db,{id='spell_custom_mm11',target='ally',context='both',effects,sp=2,cls='priest'}){
 db.spells.push({id,name:'Custom Aura',description:'MM11 fixture',classId:cls,level:1,sp,target,context,effect:'composed',behaviorKey:'composed',effects});
 db.classAccess[cls].spellIds.push(id);db.classAccess[cls].starterSpellIds.push(id);
}
const untilWizard=(start)=>{let s=start;for(let i=0;i<80&&activeActor(s)!=='hero_orrin';i++){const r=combatAction(s,registry,'block');assert.equal(r.changed,true);s=r.state;}assert.equal(activeActor(s),'hero_orrin');return s;};
test('MM11 parses bounded arithmetic and dice without consuming random numbers',()=>{
 const ast=parseAmountExpression('2d6 + INT_MOD * (LEVEL - 1)');assert.equal(ast.diceRolls,2);
 const variables={LEVEL:4,PROFICIENCY:2,STR_MOD:0,DEX_MOD:0,CON_MOD:0,INT_MOD:3,WIS_MOD:0,CHA_MOD:0};
 const first=new SeededRng('mm11-expression'),second=new SeededRng('mm11-expression');let count=0;
 const result=evaluateAmountExpression(ast,variables,(lo,hi)=>{count++;return first.integer(lo,hi);});
 assert.equal(count,2);assert.equal(result,second.integer(1,6)+second.integer(1,6)+9);
 assert.equal(evaluateAmountExpression(parseAmountExpression('-(5-LEVEL)'),variables,()=>{throw Error('unexpected roll');}),-1);
});
test('MM11 expression parser rejects unbounded or executable expressions',()=>{
 for(const bad of ['','2d1000','99d6','evil()','Math.random()','2**4','1/0','1e8','1+','(2+3','1000*1000','(1+'.repeat(20),'2d6; process.exit(1)'])assert.throws(()=>parseAmountExpression(bad),ExpressionError,bad);
});
test('MM11 heal + SP resource + condition primitives preserve save state and seeded dice',()=>withDb(db=>add(db,{effects:[{operation:'heal',target:'selected',amount:'1d6+WIS_MOD'},{operation:'resource',target:'caster',resource:'sp',amount:'2'},{operation:'condition',target:'selected',conditionId:'frightened',unit:'minutes',remaining:3}]}),()=>{
 const s=newCampaign(registry);s.party.characters.hero_orrin.hp=1;
 const first=castExploration(s,{casterId:'hero_sera',spellId:'spell_custom_mm11',targetId:'hero_orrin'});
 const second=castExploration(s,{casterId:'hero_sera',spellId:'spell_custom_mm11',targetId:'hero_orrin'});
 assert.deepEqual(first,second);assert.equal(first.changed,true);assert.equal(first.state.rollCount,1);
 assert.ok(first.state.party.characters.hero_orrin.hp>1);
 assert.deepEqual(first.state.party.characters.hero_orrin.conditions,[{id:'frightened',unit:'minutes',remaining:3}]);
 assert.equal(first.state.party.characters.hero_sera.sp,s.party.characters.hero_sera.sp); // 2 spent, then 2 restored
 assert.deepEqual(parseCampaign(serializeCampaign(first.state,registry),registry),first.state);
}));
test('MM11 damage primitive handles a chosen enemy using one seeded roll, no hardcoded spell ID',()=>withDb(db=>add(db,{id:'spell_custom_bolt',cls:'wizard',target:'enemy',context:'combat',effects:[{operation:'damage',target:'selected',amount:'1d6+INT_MOD',damageType:'fire'}]}),()=>{
 const s=untilWizard(beginEncounter((()=>{const game=newCampaign(registry);game.currentMapId='map_diagnostic_galleries';return game;})(),registry).state);
 const foe=combatTargets(s)[0];const initial=foe.hp;
 const first=castCombatSpell(s,registry,{casterId:'hero_orrin',spellId:'spell_custom_bolt',targetId:foe.id});
 const second=castCombatSpell(s,registry,{casterId:'hero_orrin',spellId:'spell_custom_bolt',targetId:foe.id});
 assert.deepEqual(first,second);assert.ok(first.changed);assert.ok(first.state.rollCount>s.rollCount);
 assert.ok(first.state.combat.encounters.enc_gallery_entry.enemies.find(e=>e.id===foe.id).hp<initial);
 assert.deepEqual(parseCampaign(serializeCampaign(first.state,registry),registry),first.state);
}));
test('MM11 validates target compatibility, condition duration, expression bounds and dice budgets',()=>{
 const invalid=[
 [{operation:'damage',target:'selected',amount:'2d6'}], // damage cannot target friendly ally
 [{operation:'heal',target:'selected',amount:'evil()'}],
 [{operation:'heal',target:'selected',amount:'60d20'}],
 [{operation:'condition',target:'selected',conditionId:'poisoned',unit:'minutes',remaining:0}],
 [{operation:'condition',target:'selected',conditionId:'poisoned',unit:'persistent',remaining:4}],
 [{operation:'resource',target:'selected',resource:'mana',amount:'1'}],
 [{operation:'heal',target:'enemies',amount:'1d6'}],
 Array.from({length:5},()=>({operation:'heal',target:'selected',amount:'12d6'})),
 ];
 for(const effects of invalid){const db=structuredClone(baseline);add(db,{effects});assert.throws(()=>readSpellDatabase(db),SpellDatabaseError,JSON.stringify(effects));}
 const db=structuredClone(baseline);add(db,{effects:[{operation:'heal',target:'selected',amount:'2d6'}]});
 assert.doesNotThrow(()=>readSpellDatabase(db));
});
test('MM11 legacy handlers remain intact and composed primitive arrays cannot be injected into them',()=>{
 const db=structuredClone(baseline);db.spells[0].effects=[{operation:'damage',target:'selected',amount:'1'}];assert.throws(()=>readSpellDatabase(db),SpellDatabaseError);
 assert.equal(readSpellDatabase(baseline).spells.length,36);
});
