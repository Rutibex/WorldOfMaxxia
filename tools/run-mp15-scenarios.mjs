/** Four ordinary-command quest outcomes; optional source/production equality, with real save/reload. */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const engine=new URL('../engine/world-of-maxxia/',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,engine),'utf8'));
async function execute(production=false){
 const runtime=production?readdirSync(new URL('dist/assets/',engine)).find(n=>n.startsWith('runtime-')):null;
 const module=async path=>import(new URL(production?'dist/assets/'+runtime+'/wom-'+path.replaceAll('/','-')+'.js':'src/'+path+'.ts',engine));
 const [catalogue,build,campaign,scopes,simulation,resources,instances,social,questState,journal]=await Promise.all(['shared/content/catalogue','shared/content/catalogue-build','shared/rules/campaign','shared/rules/scoped-state','shared/rules/simulation','shared/project/resources','shared/saves/campaign-instances','shared/rules/social','shared/rules/quest-state','shared/rules/quest-engine'].map(module));
 const verified=await build.verifyCatalogueBuild(read('public/mp15-proof/sluice.maxxia-build.json'),'0.60.0'),resolver=resources.locateResources(resources.readResourceCatalog(JSON.stringify(read('public/assets/catalog.json'))),'http://localhost/assets/catalog.json');
 const stage=catalogue.composePackCatalogue(verified.packs,'mp15',catalogue.captureCatalogueBase(),resolver,'0.60.0');catalogue.installComposedCatalogue(stage);
 const maps=catalogue.withCatalogueMaps(campaign.validateMapRegistry(['town','galleries','vault'].map(n=>read('public/content/'+n+'.json')))),doc=catalogue.currentQuestDocument(),main='mp15:quest:broken_sluice';const outcomes=[];
 for(const route of ['repair','divert','refuse','fail']){
  let state=catalogue.startCatalogueCampaign(campaign.newCampaign(maps),maps),scoped=scopes.newScopedState();const trace=[];
  const step=(command,expected='applied')=>{const before=JSON.stringify(state),result=simulation.dispatchSimulation(state,maps,command,{routines:catalogue.currentRoutineDocument(),social:catalogue.currentSocialDocument(),quests:doc,scoped});assert.equal(result.status,expected,result.messages.join(' '));if(expected==='blocked')assert.equal(JSON.stringify(result.state),before);state=result.state;scoped=result.scoped??scoped;trace.push({command,status:result.status,events:result.events,messages:result.messages});};
  const grid=action=>step({type:'grid',action}),object=(id,action)=>step({type:'object',entityId:'mp15:object:'+id,action});
  let npc='edda';
  const conversation=(action,extra={},expected='applied')=>{const entityId='mp15:object:'+npc,nodeId=action==='talk'||action==='leave'?undefined:social.socialView(state,scoped,maps,catalogue.currentSocialDocument(),entityId,doc).nodeId;step({type:'social',entityId,action,...(nodeId?{nodeId}:{}),...extra},expected);};
  const choose=choiceId=>conversation('choose',{choiceId});
  const quest=(questId,action,id,expected='applied')=>step({type:'quest',questId,action,...(action==='transition'?{transitionId:id}:{rewardId:id})},expected);
  grid('interact');object('edda','talk');
  if(route==='refuse'){choose('refuse');conversation('leave');step({type:'quest',action:'journal'});quest(main,'claim','completion','blocked');}
  else{
   choose('accept');if(route==='repair')choose('tools');conversation('leave');grid('turn_left');grid('interact');object('inspection','use');
   if(route==='repair'){
    grid('forward');grid('interact');object('key_box','open');object('key_box','claim');grid('backward');grid('turn_left');grid('forward');grid('interact');object('ledger_box','open');object('ledger_box','claim');quest('mp15:quest:records','transition','record');quest('mp15:quest:records','claim','recording');grid('backward');grid('turn_left');grid('forward');grid('interact');object('tool_box','open');object('tool_box','claim');grid('backward');grid('turn_left');conversation('talk');choose('return_tools');choose('repair');conversation('leave');step({type:'quest',action:'journal'});quest(main,'claim','completion');quest(main,'claim','completion','blocked');conversation('talk');conversation('train',{serviceId:'training'});conversation('leave');
   }else if(route==='divert'){
    grid('turn_right');grid('turn_right');grid('forward');grid('turn_left');grid('forward');grid('turn_right');grid('interact');npc='spirit';object('spirit','talk');choose('respect');choose('help');conversation('leave');grid('turn_right');grid('forward');grid('turn_right');grid('forward');grid('turn_right');npc='edda';conversation('talk');choose('divert');conversation('leave');quest(main,'claim','completion');step({type:'quest',action:'journal'});assert.equal(state.inventory.items.some(i=>i.definitionId==='mp15:item:sluice_key'),false);
   }else{grid('turn_right');conversation('talk');choose('ruin');conversation('leave');step({type:'quest',action:'journal'});quest(main,'claim','completion','blocked');}
  }
  const expected=route==='repair'?'repaired':route==='divert'?'diverted':route==='refuse'?'refused':'failed',q=doc.quests.find(q=>q.id===main);assert.equal(questState.questStateId(scoped,q,maps),expected);assert.equal(state.quests.mainStage,0);assert.equal(trace.flatMap(t=>t.events).filter(e=>e.type==='ending.reached'&&e.ending.campaign).length,1);
  const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}},identity={projectId:'project_mp15_proof',adventureId:'mp15',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:verified.catalogueHash,providers:stage.adventure.providers};
  const store=new instances.CampaignInstanceStore(storage,maps,identity),id=store.create(route,state,scoped,'11111111-1111-4111-8111-111111111115');store.save('auto',state);const reload=new instances.CampaignInstanceStore(storage,maps,identity);reload.activate(id);assert.equal(JSON.stringify(reload.load('auto')),JSON.stringify(state));assert.equal(JSON.stringify(reload.getScopedState()),JSON.stringify(scoped));outcomes.push({route,state,scoped,journal:journal.questJournal(state,scoped,maps,doc),trace});
 }
 return outcomes;
}
try{const result=await execute();if(process.argv.includes('--production'))assert.equal(JSON.stringify(await execute(true)),JSON.stringify(result));console.log(JSON.stringify({ok:true,productionParity:process.argv.includes('--production')?'pass':'not requested',scenarios:result.map(r=>({route:r.route,commands:r.trace.length,sha256:createHash('sha256').update(JSON.stringify(r)).digest('hex'),instanceSaveReload:'pass',trace:r.trace.map(t=>({command:t.command,status:t.status,eventTypes:t.events.map(e=>e.type)}))}))},null,2));}catch(e){console.error(e.stack??String(e));process.exitCode=1;}
