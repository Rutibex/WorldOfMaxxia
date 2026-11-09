import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {dispatchSimulation} from '../engine/world-of-maxxia/src/shared/rules/simulation.ts';
import {newCampaign,validateMapRegistry} from '../engine/world-of-maxxia/src/shared/rules/campaign.ts';
import {newScopedState} from '../engine/world-of-maxxia/src/shared/rules/scoped-state.ts';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname.replace(/\/$/,''),engine=root+'/engine/world-of-maxxia';
const child=spawn(process.execPath,['server.mjs'],{cwd:engine,env:{...process.env,PORT:'47812',HOST:'127.0.0.1'},stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:47812/healthz')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:47812/',{waitUntil:'networkidle'});
 const maps=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(engine+'/public/content/'+n+'.json'))));const doc=JSON.parse(readFileSync(root+'/examples/mp12/lever-routines.json'));const runtime=readdirSync(engine+'/dist/assets').find(n=>n.startsWith('runtime-'));
 let state=newCampaign(maps),scoped=newScopedState();const inputs={state,scoped,maps,doc,runtime};const traces=[];
 for(const lever of [2,1,2,2]){const r=dispatchSimulation(state,maps,{type:'routine',routineId:'mp12:routine:lever',args:{lever,owner:state.party.order[0]}},{routines:doc,scoped});assert.equal(r.status,'applied');state=r.state;scoped=r.scoped;traces.push(r);}
 const browserTraces=await page.evaluate(async i=>{const {dispatchSimulation}=await import('/assets/'+i.runtime+'/wom-shared-rules-simulation.js');let state=i.state,scoped=i.scoped;const traces=[];for(const lever of [2,1,2,2]){const r=dispatchSimulation(state,i.maps,{type:'routine',routineId:'mp12:routine:lever',args:{lever,owner:state.party.order[0]}},{routines:i.doc,scoped});state=r.state;scoped=r.scoped;traces.push(r);}return traces;},inputs);
 assert.equal(JSON.stringify(browserTraces),JSON.stringify(traces));
 await page.waitForFunction(()=>window.__MAXXIA_DIAGNOSTICS__?.ready,{timeout:30000});
 console.log('PASS: Chromium production modules and Node produce byte-identical state, scoped state, RNG, messages and typed event traces for wrong input, priming, solve and repeat claim.');
 console.log('Buttons:',await page.locator('button').allTextContents());
 console.log('Page errors:',errors);assert.equal(errors.length,0);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();child.kill();}
