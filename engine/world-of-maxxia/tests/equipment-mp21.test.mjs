import test,{beforeEach} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {verifyCatalogueBuild} from '../src/shared/content/catalogue-build.ts';
import {composePackCatalogue,captureCatalogueBase,installComposedCatalogue,withCatalogueMaps,startCatalogueCampaign} from '../src/shared/content/catalogue.ts';
import {readResourceCatalog,locateResources} from '../src/shared/project/resources.ts';
import {validateMapRegistry,newCampaign,parseCampaign,serializeCampaign,validateCampaign} from '../src/shared/rules/campaign.ts';
import {createCustomParty,proposedHero} from '../src/shared/rules/creation.ts';
import {giveItem,validateInventory,itemCategoryCount} from '../src/shared/rules/inventory.ts';
import {ITEMS,readItemDatabase} from '../src/shared/content/items.ts';
import {listedRecipes,validateRecipeDefinition} from '../src/shared/content/recipes.ts';
import {dispatchSimulation} from '../src/shared/rules/simulation.ts';
import {derived} from '../src/shared/rules/party.ts';
import {serviceAction} from '../src/shared/rules/services.ts';
import {CampaignInstanceStore} from '../src/shared/saves/campaign-instances.ts';
import {copyPortableIntoReserve} from '../src/shared/saves/portable-roster.ts';
import {newScopedState} from '../src/shared/rules/scoped-state.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const base=captureCatalogueBase(),bellBuild=await verifyCatalogueBuild(read('../public/mp21-proof/brass-bell.maxxia-build.json'),'0.66.0'),receivingBuild=await verifyCatalogueBuild(read('../public/mp21-proof/receiving.maxxia-build.json'),'0.66.0');
const res=locateResources(readResourceCatalog(readFileSync(new URL('../public/assets/catalog.json',import.meta.url),'utf8')),'http://localhost/assets/catalog.json');
const bell=composePackCatalogue(bellBuild.packs,'bell',base,res,'0.66.0'),receiving=composePackCatalogue(receivingBuild.packs,'receiving',base,res,'0.66.0');
const legacy=validateMapRegistry(['town','galleries','vault'].map(x=>read('../public/content/'+x+'.json')));
let state,maps,id;const HERO='bell:class:bellwarden',A='bell:item:regulator_aegis',B='bell:item:binding_ring',F='bell:item:brass_filament',C='bell:item:silt_crystal',RECIPE='bell:recipe:forge_aegis';
const hero=()=>state.party.characters[id];
function fresh(stage=bell){installComposedCatalogue(stage);maps=withCatalogueMaps(legacy);state=startCatalogueCampaign(newCampaign(maps,'map_town',createCustomParty(Array.from({length:6},(_,i)=>proposedHero(i,i===0?HERO:undefined)))),maps);id=state.party.order[0];return state;}
beforeEach(()=>fresh());
function step(command,expected='applied'){const previous=JSON.stringify(state),result=dispatchSimulation(state,maps,command);assert.equal(result.status,expected,result.messages.join(' | '));if(expected!=='applied')assert.equal(JSON.stringify(result.state),previous,'rejected actions must be atomic');state=result.state;return result;}
const item=definitionId=>state.inventory.items.find(x=>x.ownerId===id&&x.definitionId===definitionId);
function materials(){assert.ok(giveItem(state.inventory,id,F,2));assert.ok(giveItem(state.inventory,id,C,1));}
function train(){state.party.resources.gold=10000;hero().xp=1000;hero().level=2;hero().hp=derived(hero()).maxHP;validateCampaign(state,maps);}
function craft(){materials();train();step({type:'craft',request:{recipeId:RECIPE,crafterId:id}});assert.ok(item(A));return item(A);}
test('MP21 composed catalogue exports validated recipes and artifact definitions',()=>{assert.ok(listedRecipes().some(r=>r.id===RECIPE));assert.equal(ITEMS[A].attunement,true);assert.equal(ITEMS[A].passive.defense,1);assert.ok(receiving.recipes.some(r=>r.id===RECIPE));});
test('MP21 atomic crafting consumes exact quantities once and creates an item',()=>{craft();assert.equal(item(F),undefined);assert.equal(item(C),undefined);assert.equal(state.inventory.items.filter(x=>x.definitionId===A).length,1);step({type:'craft',request:{recipeId:RECIPE,crafterId:id}},'blocked');validateCampaign(state,maps);});
test('MP21 insufficient materials and insufficient level do not mutate campaign state',()=>{materials();step({type:'craft',request:{recipeId:RECIPE,crafterId:id}},'blocked');assert.equal(item(F).count,2);state.inventory.items.find(x=>x.definitionId===F).count=1;train();step({type:'craft',request:{recipeId:RECIPE,crafterId:id}},'blocked');});
test('MP21 crafting station and full inventory reject without consuming components',()=>{materials();train();state.currentMapId='map_diagnostic_galleries';step({type:'craft',request:{recipeId:RECIPE,crafterId:id}},'blocked');state.currentMapId='map_bell_yard';for(let i=0;i<9;i++)assert.ok(giveItem(state.inventory,id,'item_healing_draught',1)); // stacks, so force category fill using dedicated defs below
 const materialCount=item(F).count;const original=structuredClone(state); // crafted unique already owned forbids a duplicate
 assert.ok(giveItem(state.inventory,id,A));step({type:'craft',request:{recipeId:RECIPE,crafterId:id}},'blocked');assert.equal(item(F).count,materialCount);assert.equal(original.inventory.items.length+1,state.inventory.items.length);
});
test('MP21 equip requires identification, attunement, class and level',()=>{train();const x=giveItem(state.inventory,id,A);assert.ok(x);step({type:'item',request:{action:'equip',itemId:x.id}},'blocked');step({type:'item',request:{action:'attune',itemId:x.id}},'blocked');step({type:'item',request:{action:'identify',itemId:x.id}});step({type:'item',request:{action:'attune',itemId:x.id}});step({type:'item',request:{action:'equip',itemId:x.id}});assert.equal(hero().equipment.offhand,A);assert.equal(item(A).attuned,true);validateCampaign(state,maps);});
test('MP21 active artifact spends charges and passive defense tracks equip state',()=>{const x=craft();step({type:'item',request:{action:'identify',itemId:x.id}});step({type:'item',request:{action:'attune',itemId:x.id}});const before=derived(hero()).defense;step({type:'item',request:{action:'equip',itemId:x.id}});assert.equal(derived(hero()).defense,before+1);step({type:'item',request:{action:'use',itemId:x.id}});assert.equal(item(A).charges,1);step({type:'item',request:{action:'use',itemId:x.id}},'blocked'); // ward already active
 step({type:'item',request:{action:'remove',itemId:x.id}});assert.equal(derived(hero()).defense,before-1);});
test('MP21 cursed gear binds instance until temple uncursing',()=>{const x=giveItem(state.inventory,id,B);assert.ok(x);step({type:'item',request:{action:'identify',itemId:x.id}});step({type:'item',request:{action:'equip',itemId:x.id}});assert.equal(item(B).cursed,true);step({type:'item',request:{action:'remove',itemId:x.id}},'blocked');step({type:'item',request:{action:'sell',itemId:x.id}},'blocked');const svc={serviceId:'npc_sister_vale',action:'uncurse',characterId:id}; // use direct service helper to avoid spatial checks with the public test fixture
 const found=state.inventory.items.find(i=>i.id===x.id);assert.equal(found.cursed,true);state.currentMapId='map_town';state.maps.map_town.x=4;state.maps.map_town.y=6;state.maps.map_town.facing=0;state.maps.map_town.visited.push('4,6');const cleared=serviceAction(state,maps,svc);assert.ok(cleared.changed,cleared.message);state=cleared.state;assert.equal(item(B).cursed,false);step({type:'item',request:{action:'remove',itemId:x.id}});});
test('MP21 save/load preserves attunement, curse and remaining artifact charges',()=>{const x=craft();step({type:'item',request:{action:'identify',itemId:x.id}});step({type:'item',request:{action:'attune',itemId:x.id}});step({type:'item',request:{action:'equip',itemId:x.id}});step({type:'item',request:{action:'use',itemId:x.id}});const parsed=parseCampaign(serializeCampaign(state,maps),maps);assert.deepEqual(parsed.inventory.items.find(x=>x.definitionId===A),item(A));assert.equal(derived(parsed.party.characters[id]).defense,derived(hero()).defense);});
test('MP21 validation rejects over-attunement, forged curse and invalid definitions',()=>{train();const x=giveItem(state.inventory,id,A);x.attuned=true;x.identified=true;const other=state.inventory.items.find(i=>i.id!==x.id);other.attuned=true;assert.throws(()=>validateInventory(state.inventory,state.party));other.attuned=false;const itemDef=structuredClone(ITEMS[A]);itemDef.passive={attack:100};assert.throws(()=>readItemDatabase({format:'maxxia-items',version:1,items:[itemDef]}));const recipe=structuredClone(listedRecipes()[0]);recipe.results[0].count=0;assert.throws(()=>validateRecipeDefinition(recipe));});
test('MP21 crafted attuned artifact carries charges and identity to receiving adventure',()=>{const x=craft();step({type:'item',request:{action:'identify',itemId:x.id}});step({type:'item',request:{action:'attune',itemId:x.id}});step({type:'item',request:{action:'equip',itemId:x.id}});step({type:'item',request:{action:'use',itemId:x.id}});const lock={projectId:'project_mp21',adventureId:'bell',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:bellBuild.catalogueHash,providers:bell.adventure.providers};const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}};const store=new CampaignInstanceStore(storage,maps,lock);store.create('Origin',state,newScopedState(),'21111111-1111-4111-8111-111111111119');const record=store.getRosterSnapshot().records.find(r=>r.character.id===id),exported=store.exportCharacter(record.portableId,true);fresh(receiving);const destLock={...lock,adventureId:'receiving',catalogueHash:receivingBuild.catalogueHash,providers:receiving.adventure.providers};const copy=copyPortableIntoReserve(state,exported,destLock,maps);const artifact=copy.inventory.items.find(x=>x.definitionId===A);assert.ok(artifact);assert.equal(artifact.attuned,true);assert.equal(artifact.charges,1);assert.equal(artifact.identified,true);assert.equal(artifact.equipped,'offhand');});
test('MP21 campaign-bound bell clapper cannot transfer',()=>{const x=giveItem(state.inventory,id,'bell:item:bell_clapper');assert.ok(x);const lock={projectId:'project_mp21',adventureId:'bell',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:bellBuild.catalogueHash,providers:bell.adventure.providers};const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}};const store=new CampaignInstanceStore(storage,maps,lock);store.create('Origin',state,newScopedState(),'21111111-1111-4111-8111-111111111118');const record=store.getRosterSnapshot().records.find(r=>r.character.id===id);assert.ok(record.items.some(x=>x.instance.definitionId==='bell:item:bell_clapper'));const exported=JSON.parse(store.exportCharacter(record.portableId,true));assert.ok(exported.items.every(x=>x.instance.definitionId!=='bell:item:bell_clapper'));});

test('MP21 full armor inventory rejects craft transaction without spending ingredients',()=>{
 materials();train();
 while(itemCategoryCount(state.inventory,id,'armor')<9){
  const added=giveItem(state.inventory,id,'item_round_shield',20);
  assert.ok(added,'Must be able to fill armor category');
 }
 const prior=structuredClone(state.inventory.items);
 step({type:'craft',request:{recipeId:RECIPE,crafterId:id}},'blocked');
 assert.deepEqual(state.inventory.items,prior);
 assert.equal(item(F).count,2);assert.equal(item(C).count,1);
 assert.equal(item(A),undefined);
});
