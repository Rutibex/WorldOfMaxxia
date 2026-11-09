/** MP24 source vs compiled-browser deterministic proof of the complete exploration capability path. */
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const engine=new URL('../engine/world-of-maxxia/',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,engine),'utf8'));
async function scenario(production){
 const runtime=production?readdirSync(new URL('dist/assets/',engine)).find(n=>n.startsWith('runtime-')):null;
 assert.ok(!production||runtime,'Compiled runtime missing');
 const mod=p=>import(new URL(production?`dist/assets/${runtime}/wom-${p.replaceAll('/','-')}.js`:`src/${p}.ts`,engine));
 const [cat,bld,campaign,resource,creation,sim,abilities,inv,instances,portable,scopes]=await Promise.all([
  'shared/content/catalogue','shared/content/catalogue-build','shared/rules/campaign','shared/project/resources','shared/rules/creation','shared/rules/simulation','shared/rules/abilities','shared/rules/inventory','shared/saves/campaign-instances','shared/saves/portable-roster','shared/rules/scoped-state'].map(mod));
 const v=await bld.verifyCatalogueBuild(read('public/mp24-proof/brass-bell.maxxia-build.json'),'0.69.0');
 const rv=await bld.verifyCatalogueBuild(read('public/mp24-proof/receiving.maxxia-build.json'),'0.69.0');
 const resources=resource.locateResources(resource.readResourceCatalog(JSON.stringify(read('public/assets/catalog.json'))),'http://localhost/assets/catalog.json');
 const base=cat.captureCatalogueBase(),bell=cat.composePackCatalogue(v.packs,'bell',base,resources,'0.69.0'),receiving=cat.composePackCatalogue(rv.packs,'receiving',base,resources,'0.69.0');
 cat.installComposedCatalogue(bell);
 assert.equal(cat.currentCatalogueEnvironments().length,2);assert.equal(bell.maps.find(m=>m.id==='map_bell_cistern').environmentId,'bell:environment:brass');assert.match(bell.resources.byId.get('bell:resource:scene_wall').url,/pipe-wall.png$/);
 const legacy=campaign.validateMapRegistry(['town','galleries','vault'].map(n=>read(`public/content/${n}.json`)));
 let maps=cat.withCatalogueMaps(legacy),s=cat.startCatalogueCampaign(campaign.newCampaign(maps,'map_town',creation.createCustomParty(Array.from({length:6},(_,i)=>creation.proposedHero(i,i===0?'bell:class:echo_sentinel':undefined)))),maps);
 const heroId=s.party.order[0];let scope=scopes.newScopedState();const trace=[];
 const position=(map,x,y)=>{s.currentMapId=map;const w=s.maps[map];w.x=x;w.y=y;w.facing=1;if(!w.visited.includes(`${x},${y}`))w.visited.push(`${x},${y}`);};
 const forward=(minutes)=>{s.elapsedMinutes+=minutes;s.maps[s.currentMapId].minutes+=minutes;};
 const act=(entityId,method,status='applied')=>{
  const command={type:'object',entityId,action:`cap:${method}`};
  const before=JSON.stringify(s),r=sim.dispatchSimulation(s,maps,command,{scoped:scope,routines:cat.currentRoutineDocument(),quests:cat.currentQuestDocument()});
  assert.equal(r.status,status,`${entityId}/${method}: ${r.messages.join('; ')}`);
  if(status!=='applied')assert.equal(JSON.stringify(r.state),before);
  s=r.state;scope=r.scoped??scope;trace.push({entityId,method,status,messages:r.messages});return r;
 };
 position('map_bell_yard',4,5);act('bell:object:well','echo_open');assert.equal(s.maps.map_bell_yard.doors.door_well,true);
 act('bell:object:well','echo_open','blocked');
 position('map_bell_cistern',5,9);const item=inv.giveItem(s.inventory,heroId,'bell:item:siltglass_charm');assert.ok(item);act('bell:object:conduit','siltglass_reveal');assert.equal(s.maps.map_bell_cistern.secrets.secret_conduit,true);assert.equal(s.inventory.items.find(i=>i.id===item.id).charges,2);
 forward(5);position('map_bell_cistern',3,10);act('bell:object:pressure_nozzle','ward_disarm');assert.ok(s.expedition.triggeredTraps.includes('map_bell_cistern:trap_store'));
 forward(5);position('map_bell_cistern',2,10);act('bell:object:stair_lip','echo_step');assert.equal(s.maps.map_bell_cistern.x,4);
 forward(5);position('map_bell_cistern',2,10);act('bell:object:remote_record','echo_read');assert.equal(scopes.readScopedValue(scope,{scope:'campaign'},'flag','bell:flag:record',maps),true);
 const loaded=campaign.parseCampaign(campaign.serializeCampaign(s,maps),maps);assert.equal(loaded.maps.map_bell_cistern.x,2);assert.ok(loaded.expedition.triggeredTraps.includes('map_bell_cistern:trap_store'));
 const lock={projectId:'project_mp24',adventureId:'bell',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:v.catalogueHash,providers:bell.adventure.providers};
 const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}};
 const store=new instances.CampaignInstanceStore(storage,maps,lock);store.create('MP24',loaded,scope,'23232323-2323-4232-8232-232323232323');
 const record=store.getRosterSnapshot().records.find(r=>r.character.id===heroId),exported=store.exportCharacter(record.portableId,true);
 cat.installComposedCatalogue(receiving);maps=cat.withCatalogueMaps(legacy);
 const destination=cat.startCatalogueCampaign(campaign.newCampaign(maps),maps),dstLock={...lock,adventureId:'receiving',catalogueHash:rv.catalogueHash,providers:receiving.adventure.providers};
 const copy=portable.copyPortableIntoReserve(destination,exported,dstLock,maps),echo=Object.values(copy.party.characters).find(h=>h.classId==='bell:class:echo_sentinel');
 assert.ok(echo);assert.ok(abilities.usableAbilities(echo,false).some(a=>a.id==='bell:ability:echo_hand'));
 assert.equal(copy.inventory.items.find(i=>i.definitionId==='bell:item:siltglass_charm')?.charges,2);
 return {sceneProfiles:cat.currentCatalogueEnvironments().map(p=>p.id),trace,save:'pass',portable:'pass',ability:'bell:ability:echo_hand',remainingCharges:2};
}
try{
 const source=await scenario(false),production=process.argv.includes('--production')?await scenario(true):null;
 if(production)assert.deepEqual(production,source);
 console.log(JSON.stringify({ok:true,productionParity:production?'pass':'not-requested',actions:source.trace.length,sceneProfiles:source.sceneProfiles,scenarioHash:createHash('sha256').update(JSON.stringify(source)).digest('hex'),save:source.save,portability:source.portable,ability:source.ability,remainingCharges:source.remainingCharges},null,2));
}catch(error){console.error(error.stack);process.exitCode=1;}
