/** Exercise the actual playable pack through normal commands, optionally against production modules. */
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const engine=new URL('../engine/world-of-maxxia/',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,engine),'utf8'));
async function execute(production=false){
 const runtime=production?readdirSync(new URL('dist/assets/',engine)).find(n=>n.startsWith('runtime-')):null;
 const module=async path=>import(new URL(production?'dist/assets/'+runtime+'/wom-'+path.replaceAll('/','-')+'.js':'src/'+path+'.ts',engine));
 const [catalogue,build,campaign,scopeModule,simulation,resources,instances]=await Promise.all(['shared/content/catalogue','shared/content/catalogue-build','shared/rules/campaign','shared/rules/scoped-state','shared/rules/simulation','shared/project/resources','shared/saves/campaign-instances'].map(module));
 const raw=read('public/mp13-proof/workshop.maxxia-build.json'),verified=await build.verifyCatalogueBuild(raw,'0.58.0');
 const resolver=resources.locateResources(resources.readResourceCatalog(JSON.stringify(read('public/assets/catalog.json'))),'http://localhost/assets/catalog.json');
 const stage=catalogue.composePackCatalogue(verified.packs,'mp13',catalogue.captureCatalogueBase(),resolver,'0.58.0');catalogue.installComposedCatalogue(stage);
 const maps=catalogue.withCatalogueMaps(campaign.validateMapRegistry(['town','galleries','vault'].map(n=>read('public/content/'+n+'.json'))));
 let state=catalogue.startCatalogueCampaign(campaign.newCampaign(maps),maps),scoped=scopeModule.newScopedState();const trace=[];
 const step=(command,expected='applied')=>{const before=JSON.stringify(state),r=simulation.dispatchSimulation(state,maps,command,{routines:catalogue.currentRoutineDocument(),scoped});assert.equal(r.status,expected,r.messages.join(' '));if(expected==='blocked')assert.equal(JSON.stringify(r.state),before);state=r.state;scoped=r.scoped??scoped;trace.push({command,status:r.status,events:r.events,messages:r.messages});};
 const grid=action=>step({type:'grid',action}),object=(name,action,expected)=>step({type:'object',entityId:'mp13:object:'+name,action},expected);
 grid('interact');object('workshop_door','inspect');grid('turn_right');grid('turn_right');grid('interact');object('key_box','open');object('key_box','claim');grid('turn_right');grid('turn_right');object('workshop_door','unlock');grid('forward');grid('forward');grid('interact');object('treasure_chest','open');object('treasure_chest','claim');grid('forward');grid('forward');grid('turn_right');grid('forward');grid('forward');grid('forward');grid('interact');assert.equal(state.currentMapId,'map_mp13_annex');grid('turn_right');grid('turn_right');grid('forward');grid('interact');assert.equal(state.currentMapId,'map_mp13_workshop');grid('forward');grid('forward');grid('forward');grid('turn_left');grid('forward');object('treasure_chest','claim','blocked');grid('forward');grid('forward');grid('forward');grid('turn_right');grid('strafe_left');grid('interact');object('signal_lever','use');
 const storage={data:new Map(),getItem(k){return this.data.get(k)??null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}};
 const identity={projectId:'project_mp13_proof',adventureId:'mp13',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:verified.catalogueHash,providers:stage.adventure.providers};
 const store=new instances.CampaignInstanceStore(storage,maps,identity),id=store.create('Workshop',state,scoped,'11111111-1111-4111-8111-111111111113');store.save('auto',state);
 const reload=new instances.CampaignInstanceStore(storage,maps,identity);reload.activate(id);assert.equal(JSON.stringify(reload.load('auto')),JSON.stringify(state));assert.equal(JSON.stringify(reload.getScopedState()),JSON.stringify(scoped));
 return {state,scoped,trace};
}
try{const source=await execute();if(process.argv.includes('--production'))assert.equal(JSON.stringify(await execute(true)),JSON.stringify(source));const hash=createHash('sha256').update(JSON.stringify(source)).digest('hex');console.log(JSON.stringify({ok:true,commands:source.trace.length,sha256:hash,saveReload:'pass',productionParity:process.argv.includes('--production')?'pass':'not requested',trace:source.trace.map(t=>({command:t.command,status:t.status,eventTypes:t.events.map(e=>e.type)}))},null,2));}catch(e){console.error(e.stack??String(e));process.exitCode=1;}
