import test from 'node:test';
import assert from 'node:assert/strict';
import {createDefaultParty,validateParty,derived,modifier,training,exchangeMembers,selectMember,updateMember,damage,heal,spendSP,withCondition,withAttributeBonus,portraitState,healthColor,CLASSES} from '../src/shared/rules/party.ts';

test('default six-member party has distinct stable identities, legal presets and shared starting resources',()=>{
 const p=validateParty(createDefaultParty());assert.equal(p.order.length,6);assert.equal(new Set(p.order).size,6);assert.equal(new Set(p.order.map(id=>p.characters[id].classId)).size,6);
 for(const id of p.order){const c=p.characters[id];assert.equal(c.attributes[CLASSES[c.classId].primary],16);assert.deepEqual(Object.values(c.attributes).sort((a,b)=>a-b),[8,10,12,13,14,16]);}
 assert.deepEqual(p.resources,{gold:300,food:48,bankGold:0,supplies:{item_healing_draught:2,item_antidote:2}});
});
test('all six starting stat blocks match the agreed HP, SP and defense formulas',()=>{
 const p=createDefaultParty(),expected=[[16,0,16],[12,0,15],[19,0,13],[9,14,11],[13,14,15],[11,14,12]];
 p.order.forEach((id,i)=>{const c=p.characters[id],d=derived(c);assert.deepEqual([d.maxHP,d.maxSP,d.defense],expected[i],c.name);assert.equal(c.hp,d.maxHP);assert.equal(c.sp,d.maxSP);});
 assert.equal(derived(p.characters.hero_vexa).attackBonus,5);assert.equal(derived(p.characters.hero_vexa).attackAbility,'DEX');assert.equal(derived(p.characters.hero_orrin).spellDC,15);
});
test('modifier flooring and armor dexterity caps keep negative modifiers',()=>{
 assert.equal(modifier(9),-1);assert.equal(modifier(13),1);
 const c=createDefaultParty().characters.hero_tarin;
 const medium={...c,attributes:{...c.attributes,DEX:18}};assert.equal(derived(medium).defense,17);
 const heavy={...medium,equipment:{...medium.equipment,body:'item_plate_harness'}};assert.equal(derived(heavy).defense,18);
 const clumsy={...heavy,attributes:{...heavy.attributes,DEX:4}};assert.equal(derived(clumsy).defense,15);
});
test('XP eligibility never auto-levels and the demo cap remains level five',()=>{
 const c={...createDefaultParty().characters.hero_tarin,xp:250};assert.equal(c.level,1);assert.deepEqual(training(c),{capped:false,nextLevel:2,nextXP:250,remainingXP:0,eligible:true,cost:50});
 const wiz={...createDefaultParty().characters.hero_orrin,level:5};const d=derived(wiz);assert.equal(d.maxHP,29);assert.equal(d.maxSP,30);assert.equal(d.proficiency,3);assert.equal(training(wiz).capped,true);assert.equal(training(wiz).nextLevel,null);
});
test('exchange preserves selection and every character record by identity',()=>{
 const p=selectMember(createDefaultParty(),'hero_orrin'),before=JSON.stringify(p);
 const swapped=exchangeMembers(p,'hero_orrin','hero_tarin');assert.equal(swapped.order[0],'hero_orrin');assert.equal(swapped.order[3],'hero_tarin');assert.equal(swapped.selectedId,'hero_orrin');assert.strictEqual(swapped.characters,p.characters);assert.equal(JSON.stringify(p),before);
 assert.strictEqual(exchangeMembers(p,'hero_tarin','hero_tarin'),p);assert.throws(()=>exchangeMembers(p,'missing','hero_tarin'));assert.throws(()=>selectMember(p,'missing'));
});
test('damage, normal healing, SP spending and death cannot exceed pools or revive implicitly',()=>{
 const c=createDefaultParty().characters.hero_orrin,injured=damage(c,3);assert.equal(injured.hp,6);assert.equal(c.hp,9);assert.equal(heal(injured,999).hp,9);
 const dead=damage(c,999);assert.equal(dead.hp,0);assert.strictEqual(heal(dead,99),dead);assert.throws(()=>spendSP(dead,1));assert.equal(spendSP(c,14).sp,0);assert.throws(()=>spendSP(c,15));assert.throws(()=>damage(c,-1));assert.throws(()=>heal(c,NaN));
});
test('portrait and health marker priorities distinguish wounded, afflicted and dead states',()=>{
 const c=createDefaultParty().characters.hero_tarin;
 for(const [hp,color] of [[16,'green'],[12,'green'],[11,'yellow'],[4,'yellow'],[3,'red'],[0,'blue']])assert.equal(healthColor({...c,hp}),color);
 const hurt={...c,hp:6};assert.equal(portraitState(hurt),'hurt');const poison=withCondition(hurt,{id:'poisoned',remaining:3,unit:'ticks'});assert.equal(portraitState(poison),'afflicted');assert.equal(portraitState({...poison,hp:0}),'dead');
});
test('condition refresh does not stack copies and derived penalties apply without ticking time',()=>{
 let c=createDefaultParty().characters.hero_tarin;const originalDefense=derived(c).defense,originalAttack=derived(c).attackBonus;
 c=withCondition(c,{id:'cursed',remaining:null,unit:'persistent'});assert.equal(derived(c).defense,originalDefense-2);
 c=withCondition(c,{id:'frightened',remaining:3,unit:'turns'});assert.equal(derived(c).attackBonus,originalAttack-2);
 c=withCondition(c,{id:'frightened',remaining:2,unit:'turns'});assert.equal(c.conditions.filter(v=>v.id==='frightened').length,1);assert.equal(c.conditions.find(v=>v.id==='frightened').remaining,2);
 const asleep=withCondition(c,{id:'asleep',remaining:1,unit:'turns'});assert.ok(!damage(asleep,1).conditions.some(v=>v.id==='asleep'));assert.throws(()=>withCondition(c,{id:'poisoned',remaining:-1,unit:'ticks'}));
});
test('attribute recalculation grants only gained HP capacity and never revives the dead',()=>{
 const c={...createDefaultParty().characters.hero_tarin,hp:10};const better=withAttributeBonus(c,'CON',2);assert.equal(derived(better).maxHP,17);assert.equal(better.hp,11);assert.equal(c.hp,10);
 const dead=withAttributeBonus({...c,hp:0},'CON',2);assert.equal(dead.hp,0);
 const wiz=createDefaultParty().characters.hero_orrin,smart=withAttributeBonus(wiz,'INT',2);assert.equal(derived(smart).maxSP,16);assert.equal(smart.sp,14);
});
test('party snapshots round-trip through JSON and reject malformed identities, gear and vitals',()=>{
 const p=createDefaultParty();assert.deepEqual(validateParty(JSON.parse(JSON.stringify(p))),p);
 const invalid=mutate=>{const copy=structuredClone(p);mutate(copy);assert.throws(()=>validateParty(copy));};
 invalid(p=>p.order.push(p.order[0]));invalid(p=>p.selectedId='missing');invalid(p=>p.characters.hero_tarin.hp=999);invalid(p=>p.characters.hero_orrin.sp=999);invalid(p=>p.characters.hero_tarin.equipment.body='item_sword');invalid(p=>p.characters.hero_tarin.classId='paladin');invalid(p=>p.resources.gold=-1);invalid(p=>p.characters.hero_orrin.equipment.body='item_plate_harness');invalid(p=>p.characters.hero_tarin.conditions=[{id:'poisoned',remaining:-1,unit:'ticks'}]);
 const p2=createDefaultParty();p2.characters.hero_tarin.attributes.STR=8;assert.equal(createDefaultParty().characters.hero_tarin.attributes.STR,16);
 const c={...p.characters.hero_tarin,xp:99};const next=updateMember(p,c);assert.equal(next.characters.hero_tarin.xp,99);assert.equal(p.characters.hero_tarin.xp,0);
});
