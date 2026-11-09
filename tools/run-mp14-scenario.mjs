/** Normal-command social playthrough, with real instance reload and optional production parity. */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const engine=new URL('../engine/world-of-maxxia/',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,engine),'utf8'));
async function execute(production=false){
 const runtime=production?readdirSync(new URL('dist/assets/',engine)).find(n=>n.startsWith('runtime-')):null;
 const module=async path=>import(new URL(production?'dist/assets/'+runtime+'/wom-'+path.replaceAll('/','-')+'.js':'src/'+path+'.ts',engine));
 const [catalogue,build,campaign,scopes,simulation,resources,instances,social]=await Promise.all(['shared/content/catalogue','shared/content/catalogue-build','shared/rules/campaign','shared/rules/scoped-state','shared/rules/simulation','shared/project/resources','shared/saves/campaign-instances','shared/rules/social'].map(module));
 const compiled=process.argv.includes('--composed')?'counter-composed.maxxia-build.json':'counter.maxxia-build.json';
 const verified=await build.verifyCatalogueBuild(read('public/mp14-proof/'+compiled),'0.59.0');
 const resolver=resources.locateResources(resources.readResourceCatalog(JSON.stringify(read('public/assets/catalog.json'))),'http://localhost/assets/catalog.json');
 const stage=catalogue.composePackCatalogue(verified.packs,'mp14',catalogue.captureCatalogueBase(),resolver,'0.59.0');catalogue.installComposedCatalogue(stage);
 const maps=catalogue.withCatalogueMaps(campaign.validateMapRegistry(['town','galleries','vault'].map(n=>read('public/content/'+n+'.json'))));
 let state=catalogue.startCatalogueCampaign(campaign.newCampaign(maps),maps),scoped=scopes.newScopedState();const trace=[];
 const step=(command,expected='applied')=>{const before=JSON.stringify(state),r=simulation.dispatchSimulation(state,maps,command,{routines:catalogue.currentRoutineDocument(),social:catalogue.currentSocialDocument(),scoped});assert.equal(r.status,expected,r.messages.join(' '));if(expected==='blocked')assert.equal(JSON.stringify(r.state),before);state=r.state;scoped=r.scoped??scoped;trace.push({command,status:r.status,events:r.events,messages:r.messages});};
 const grid=action=>step({type:'grid',action}),object=(id,action)=>step({type:'object',entityId:'mp14:object:'+id,action});
 let entityId='mp14:object:keeper';
 const npc=(action,extra={},expected='applied')=>{const nodeId=['talk','leave'].includes(action)?undefined:social.socialView(state,scoped,maps,catalogue.currentSocialDocument(),entityId).nodeId;step({type:'social',entityId,action,...(nodeId?{nodeId}:{}),...extra},expected);};
 const choose=id=>npc('choose',{choiceId:id});
 grid('interact');object('keeper','talk');choose('purpose');choose('polite');choose('refuse');npc('buy',{serviceId:'shop',itemId:'mp14:item:tonic'},'blocked');npc('leave');npc('talk');choose('reconsider');npc('buy',{serviceId:'shop',itemId:'mp14:item:tonic'});npc('sell',{serviceId:'shop',itemInstanceId:state.inventory.items.find(i=>i.definitionId==='mp14:item:tonic').id});npc('leave');
 grid('turn_left');grid('interact');object('tokens','open');object('tokens','claim');grid('turn_right');npc('talk');npc('barter',{serviceId:'barter',offerId:'tonic'});npc('barter',{serviceId:'barter',offerId:'tonic'},'blocked');choose('insult');npc('buy',{serviceId:'shop',itemId:'mp14:item:tonic'},'blocked');npc('tribute',{serviceId:'tribute'});npc('tribute',{serviceId:'tribute'},'blocked');choose('permit');npc('choose',{choiceId:'permit'},'blocked');npc('leave');npc('talk');npc('choose',{choiceId:'permit'},'blocked');npc('leave');
 grid('turn_right');grid('forward');grid('interact');entityId='mp14:object:apprentice';object('apprentice','talk');npc('tribute',{serviceId:'tribute'});npc('buy',{serviceId:'shop',itemId:'mp14:item:tonic'});choose('purpose');choose('refuse');npc('leave');
 assert.equal(scoped.campaign.flags['mp14:flag:inspection_approved'],true);assert.equal(state.inventory.items.filter(i=>i.definitionId==='mp14:item:permit').reduce((n,i)=>n+i.count,0),1);
 const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}},identity={projectId:'project_mp14_proof',adventureId:'mp14',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:verified.catalogueHash,providers:stage.adventure.providers};
 const store=new instances.CampaignInstanceStore(storage,maps,identity),id=store.create('Counter',state,scoped,'11111111-1111-4111-8111-111111111114');store.save('auto',state);const reload=new instances.CampaignInstanceStore(storage,maps,identity);reload.activate(id);assert.equal(JSON.stringify(reload.load('auto')),JSON.stringify(state));assert.equal(JSON.stringify(reload.getScopedState()),JSON.stringify(scoped));return {state,scoped,trace};
}
try{const result=await execute();if(process.argv.includes('--production'))assert.equal(JSON.stringify(await execute(true)),JSON.stringify(result));console.log(JSON.stringify({ok:true,commands:result.trace.length,sha256:createHash('sha256').update(JSON.stringify(result)).digest('hex'),composition:process.argv.includes('--composed')?'core+mp14+counter_extra':'core+mp14',instanceSaveReload:'pass',productionParity:process.argv.includes('--production')?'pass':'not requested',trace:result.trace.map(t=>({command:t.command,status:t.status,eventTypes:t.events.map(e=>e.type)}))},null,2));}catch(e){console.error(e.stack??String(e));process.exitCode=1;}
