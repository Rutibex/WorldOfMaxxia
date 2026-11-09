/** Validate JSON routines, or execute the shipped lever proof using the browser's dispatcher. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateRoutineDocument} from '../engine/world-of-maxxia/src/shared/rules/routines.ts';
import {dispatchSimulation} from '../engine/world-of-maxxia/src/shared/rules/simulation.ts';
import {newCampaign,validateMapRegistry} from '../engine/world-of-maxxia/src/shared/rules/campaign.ts';
import {newScopedState} from '../engine/world-of-maxxia/src/shared/rules/scoped-state.ts';
try{
 const file=process.argv[2];if(!file)throw Error('Usage: node --experimental-strip-types tools/routines-mp12.mjs FILE [--proof]');
 const document=validateRoutineDocument(JSON.parse(readFileSync(file,'utf8')),file);
 let proof;
 if(process.argv.includes('--proof')){
  const maps=validateMapRegistry(['town','galleries','vault'].map(n=>JSON.parse(readFileSync(new URL('../engine/world-of-maxxia/public/content/'+n+'.json',import.meta.url)))));
  let state=newCampaign(maps),scoped=newScopedState();const trace=[];
  for(const lever of [2,1,2,2]){const r=dispatchSimulation(state,maps,{type:'routine',routineId:'mp12:routine:lever',args:{lever,owner:state.party.order[0]}},{routines:document,scoped});if(r.status!=='applied')throw Error(r.messages.join(' '));state=r.state;scoped=r.scoped;trace.push({lever,status:r.status,events:r.events,messages:r.messages});}
  if(!scoped.campaign.flags['mp12:flag:claimed'])throw Error('Puzzle not solved');
  proof={sha256:createHash('sha256').update(JSON.stringify({state,scoped,trace})).digest('hex'),trace};
 }
 console.log(JSON.stringify({ok:true,routines:document.routines.length,...(proof?{proof}:{})},null,2));
}catch(e){console.error(JSON.stringify({ok:false,code:e.code??'E_ROUTINE_IO',message:e.message}));process.exitCode=1;}
