/** MP21 proof: same deterministic forging/attunement/use/portability under source and built browser. */
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const engine=new URL('../engine/world-of-maxxia/',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,engine),'utf8'));
async function scenario(production){
 const runtime=production?readdirSync(new URL('dist/assets/',engine)).find(n=>n.startsWith('runtime-')):null;
 const mod=p=>import(new URL(production?'dist/assets/'+runtime+'/wom-'+p.replaceAll('/','-')+'.js':'src/'+p+'.ts',engine));
 const [catalogue,build,campaign,resources,creation,simulation,items,party,portable,instances,scope]=await Promise.all(['shared/content/catalogue','shared/content/catalogue-build','shared/rules/campaign','shared/project/resources','shared/rules/creation','shared/rules/simulation','shared/rules/inventory','shared/rules/party','shared/saves/portable-roster','shared/saves/campaign-instances','shared/rules/scoped-state'].map(mod));
 const version='0.66.0',bellProof=await build.verifyCatalogueBuild(read('public/mp21-proof/brass-bell.maxxia-build.json'),version),receiveProof=await build.verifyCatalogueBuild(read('public/mp21-proof/receiving.maxxia-build.json'),version),resolver=resources.locateResources(resources.readResourceCatalog(JSON.stringify(read('public/assets/catalog.json'))),'http://localhost/assets/catalog.json');
 const base=catalogue.captureCatalogueBase(),bell=catalogue.composePackCatalogue(bellProof.packs,'bell',base,resolver,version),receive=catalogue.composePackCatalogue(receiveProof.packs,'receiving',base,resolver,version);
 catalogue.installComposedCatalogue(bell);
 const legacy=campaign.validateMapRegistry(['town','galleries','vault'].map(n=>read('public/content/'+n+'.json'))),maps=catalogue.withCatalogueMaps(legacy),choice='bell:class:bellwarden';
 let state=catalogue.startCatalogueCampaign(campaign.newCampaign(maps,'map_town',creation.createCustomParty(Array.from({length:6},(_,i)=>creation.proposedHero(i,i===0?choice:undefined)))),maps);
 const id=state.party.order[0];state.party.characters[id].level=2;state.party.characters[id].xp=1000;state.party.characters[id].hp=party.derived(state.party.characters[id]).maxHP;
 const ing=['bell:item:brass_filament','bell:item:silt_crystal'],out='bell:item:regulator_aegis',recipe='bell:recipe:forge_aegis',trace=[];
 assert.ok(items.giveItem(state.inventory,id,ing[0],2));assert.ok(items.giveItem(state.inventory,id,ing[1],1));
 const perform=(command,expect='applied')=>{const outcome=simulation.dispatchSimulation(state,maps,command);assert.equal(outcome.status,expect,outcome.messages.join('; '));state=outcome.state;trace.push([command.type,command.request?.action??'',outcome.status,outcome.messages.join('; ')]);};
 perform({type:'craft',request:{recipeId:recipe,crafterId:id}});
 const instance=state.inventory.items.find(i=>i.definitionId===out);assert.ok(instance);assert.ok(!state.inventory.items.some(i=>ing.includes(i.definitionId)));
 perform({type:'item',request:{action:'identify',itemId:instance.id}});
 perform({type:'item',request:{action:'attune',itemId:instance.id}});
 perform({type:'item',request:{action:'equip',itemId:instance.id}});
 const defense=party.derived(state.party.characters[id]).defense;
 perform({type:'item',request:{action:'use',itemId:instance.id}});
 assert.equal(state.inventory.items.find(i=>i.id===instance.id).charges,1);
 perform({type:'item',request:{action:'use',itemId:instance.id}},'blocked');
 const serial=campaign.serializeCampaign(state,maps),restore=campaign.parseCampaign(serial,maps);assert.equal(JSON.stringify(state),JSON.stringify(restore));
 state.combat.active=null;
 const lock={projectId:'project_mp21',adventureId:'bell',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:bellProof.catalogueHash,providers:bell.adventure.providers},mem={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}};
 const store=new instances.CampaignInstanceStore(mem,maps,lock);store.create('MP21',state,scope.newScopedState(),'21111111-1111-4111-8111-111111111119');
 const record=store.getRosterSnapshot().records.find(r=>r.character.id===id),text=store.exportCharacter(record.portableId,true);
 catalogue.installComposedCatalogue(receive);
 const receiveMaps=catalogue.withCatalogueMaps(legacy),destination=catalogue.startCatalogueCampaign(campaign.newCampaign(receiveMaps),receiveMaps),destLock={...lock,adventureId:'receiving',catalogueHash:receiveProof.catalogueHash,providers:receive.adventure.providers};
 const after=portable.copyPortableIntoReserve(destination,text,destLock,receiveMaps),copied=after.inventory.items.find(i=>i.definitionId===out);assert.ok(copied);
 assert.equal(copied.charges,1);assert.equal(copied.attuned,true);assert.equal(copied.equipped,'offhand');
 return {recipe,trace,defense,artifact:{charges:copied.charges,attuned:copied.attuned,identified:copied.identified,equipped:copied.equipped},save:'pass',copy:'pass'};
}
try{const source=await scenario(false),built=process.argv.includes('--production')?await scenario(true):null;if(built)assert.deepEqual(built,source);console.log(JSON.stringify({ok:true,productionParity:built?'pass':'not-requested',actions:source.trace.length,scenarioHash:createHash('sha256').update(JSON.stringify(source)).digest('hex'),save:source.save,copy:source.copy,artifact:source.artifact},null,2));}catch(e){console.error(e.stack);process.exitCode=1;}
