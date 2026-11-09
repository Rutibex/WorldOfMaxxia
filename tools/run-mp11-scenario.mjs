/** MP11 small headless command replay proof, not a general MP35 scenario DSL. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {newCampaign,validateMapRegistry} from '../engine/world-of-maxxia/src/shared/rules/campaign.ts';
import {replaySimulation} from '../engine/world-of-maxxia/src/shared/rules/simulation.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const file=process.argv[2]?resolve(process.argv[2]):join(root,'examples/mp11/basic-commands.json');
const scenario=JSON.parse(readFileSync(file,'utf8'));
if(scenario.format!=='maxxia-simulation-commands'||scenario.version!==1||!Array.isArray(scenario.commands)||scenario.commands.length>100)throw Error('Invalid MP11 scenario envelope.');
const paths=['town.json','galleries.json','vault.json'].map(name=>join(root,'engine/world-of-maxxia/public/content',name));
const registry=validateMapRegistry(paths.map(p=>JSON.parse(readFileSync(p,'utf8'))));
const execute=()=>replaySimulation(newCampaign(registry),registry,scenario.commands);
const first=execute(),second=execute();
if(first.results.length!==scenario.commands.length||first.results.some(r=>r.status==='failed'))throw Error('Simulation scenario failed: '+JSON.stringify(first.results.map(r=>({status:r.status,messages:r.messages,errorCode:r.errorCode}))));
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
if(digest(first)!==digest(second))throw Error('Nondeterministic simulation replay.');
const {expect={}}=scenario;for(const [key,value] of Object.entries(expect)){
 const actual=key==='facing'?first.state.maps[first.state.currentMapId].facing:first.state[key];
 if(JSON.stringify(actual)!==JSON.stringify(value))throw Error(`Scenario assertion failed: ${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`);
}
console.log(JSON.stringify({format:'maxxia-simulation-proof',version:1,commandCount:first.results.length,eventCount:first.results.reduce((n,r)=>n+r.events.length,0),stateHash:digest(first.state),traceHash:digest(first.results),commands:first.results.map((r,i)=>({index:i+1,status:r.status,events:r.events.map(e=>e.type),messages:r.messages})),status:'PASS'},null,2));
