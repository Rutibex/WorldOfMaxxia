/** Ordinary command proof; compares complete source and offline-production outcomes. */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const engine=new URL('../engine/world-of-maxxia/',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,engine),'utf8'));
async function execute(production=false){
 const runtime=production?readdirSync(new URL('dist/assets/',engine)).find(n=>n.startsWith('runtime-')):null;
 const module=async path=>import(new URL(production?'dist/assets/'+runtime+'/wom-'+path.replaceAll('/','-')+'.js':'src/'+path+'.ts',engine));
 const [catalogue,build,campaign,scopes,simulation,resources,instances,director,definitions]=await Promise.all(['shared/content/catalogue','shared/content/catalogue-build','shared/rules/campaign','shared/rules/scoped-state','shared/rules/simulation','shared/project/resources','shared/saves/campaign-instances','shared/rules/encounter-director','shared/content/encounter-director'].map(module));
 const verified=await build.verifyCatalogueBuild(read('public/mp16-proof/patrol.maxxia-build.json'),'0.61.0'),resolver=resources.locateResources(resources.readResourceCatalog(JSON.stringify(read('public/assets/catalog.json'))),'http://localhost/assets/catalog.json');
 const stage=catalogue.composePackCatalogue(verified.packs,'mp16',catalogue.captureCatalogueBase(),resolver,'0.61.0');catalogue.installComposedCatalogue(stage);
 const maps=catalogue.withCatalogueMaps(campaign.validateMapRegistry(['town','galleries','vault'].map(n=>read('public/content/'+n+'.json')))),doc=definitions.currentEncounterDocument(),outcomes=[];
 for(const route of ['fight','bribe','avoid','rest','boss','reentry']){
  let state=catalogue.startCatalogueCampaign(campaign.newCampaign(maps),maps),scoped=scopes.newScopedState();const trace=[];
  const step=(command,expected='applied')=>{const before=JSON.stringify(state),r=simulation.dispatchSimulation(state,maps,command,{encounters:doc,scoped});assert.equal(r.status,expected,r.messages.join(' '));if(expected==='blocked')assert.equal(JSON.stringify(r.state),before);state=r.state;scoped=r.scoped??scoped;trace.push({command,status:r.status,events:r.events,messages:r.messages});};
  const grid=action=>step({type:'grid',action}),menu=()=>director.encounterMenu(state,scoped,maps,doc),choice=action=>step({type:'encounter',action,encounterId:menu()[0]?.id});
  const fight=()=>{choice('fight');for(let i=0;i<100&&state.combat.active;i++)step({type:'combat',action:'quick_fight'});assert.equal(state.combat.active,null);assert.equal(state.combat.defeated,false);};
  if(route==='boss'){grid('forward');grid('forward');grid('forward');assert.equal(menu()[0].id,'mp16:encounter:warden');fight();assert.equal(state.combat.encounters[definitions.encounterSeedId('mp16:encounter:warden')].phase,1);}
  else if(route==='rest'){step({type:'expedition',action:'rest'});assert.equal(state.elapsedMinutes,480);assert.equal(menu()[0].id,'mp16:encounter:camp');choice('avoid');}
  else{step({type:'wait',minutes:4});assert.equal(menu().length,0);step({type:'encounter',action:'menu'});step({type:'wait',minutes:1});const id=menu()[0].id;const before=JSON.stringify({state,scoped});for(let i=0;i<3;i++)step({type:'encounter',action:'menu'});assert.equal(JSON.stringify({state,scoped}),before);
   if(route==='fight')fight();else{choice(route==='reentry'?'bribe':route);step({type:'encounter',action:'bribe',encounterId:id},'blocked');}
   if(route==='reentry'){grid('turn_right');grid('forward');grid('forward');grid('interact');assert.equal(state.currentMapId,'map_mp16_shelter');grid('interact');assert.equal(state.currentMapId,'map_mp16_watch');assert.notEqual(director.encounterStatus(scoped,doc.encounters.find(e=>e.id===id),maps),'bribed');assert.ok(menu().length);}
  }
  const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}},identity={projectId:'project_mp16_proof',adventureId:'mp16',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:verified.catalogueHash,providers:stage.adventure.providers};
  const store=new instances.CampaignInstanceStore(storage,maps,identity),id=store.create(route,state,scoped,'11111111-1111-4111-8111-111111111116');store.save('auto',state);const reload=new instances.CampaignInstanceStore(storage,maps,identity);reload.activate(id);assert.equal(JSON.stringify(reload.load('auto')),JSON.stringify(state));assert.equal(JSON.stringify(reload.getScopedState()),JSON.stringify(scoped));outcomes.push({route,state,scoped,trace});
 }
 return outcomes;
}
try{const result=await execute();if(process.argv.includes('--production'))assert.equal(JSON.stringify(await execute(true)),JSON.stringify(result));console.log(JSON.stringify({ok:true,productionParity:process.argv.includes('--production')?'pass':'not requested',scenarios:result.map(r=>({route:r.route,commands:r.trace.length,sha256:createHash('sha256').update(JSON.stringify(r)).digest('hex'),instanceSaveReload:'pass',trace:r.trace}))},null,2));}catch(e){console.error(e.stack??String(e));process.exitCode=1;}
