#!/usr/bin/env node
import {resolve} from 'node:path';
import {scaffold,loadSelection,inspectSelection,buildSelection,TOOLKIT_VERSION} from '../toolkit/content.mjs';
import {writeResolvedArtifact} from '../toolkit/resolver.mjs';
import {ToolError,diagnostic,problem} from '../toolkit/diagnostics.mjs';
const args=process.argv.slice(2),json=args.includes('--json');
const help=`Maxxia content tools ${TOOLKIT_VERSION}

node tools/maxxia.mjs scaffold <directory> --id <namespace> [--title <text>] [--json]
node tools/maxxia.mjs validate <directory> [--dependency <directory>] [--engine <version>] [--json]
node tools/maxxia.mjs inspect <directory> [--dependency <directory>] [--engine <version>] [--json]
node tools/maxxia.mjs build <directory> --out <file.maxxia-build.json> [--dependency <directory>] [--engine <version>] [--json]
node tools/maxxia.mjs help [--json]

node tools/maxxia.mjs resolve <source> [--candidate <source>] [--enable <packId>] [--lock <file.maxxia-lock.json>] [--out <file.maxxia-lock.json>] [--json]
node tools/maxxia.mjs archive <source> --out <file.maxxia-pack.zip> [--candidate <source>] [--json]

Sources may be directories or bounded ZIP archives. --candidate, --dependency and --enable may repeat.
Candidates are available versions; optional providers activate only through --enable or required closure.
A bundled proof core is supplied only if no explicit core candidate exists.
MP04 supports authored maps, routines, classes, items, monsters and resource aliases.
Native map v2 and routine v2 payloads execute through the shared runtime; v1 maps remain metadata fixtures.
`;
async function main(){
 const command=args[0]??'help';if(command==='help'||command==='--help'){
  if(args.slice(1).some(v=>v!=='--json'))problem('E_USAGE',null,'$','Unknown help argument.');
  if(json)console.log(JSON.stringify({ok:true,command:'help',version:TOOLKIT_VERSION,commands:['scaffold','validate','inspect','build','resolve','archive'],usage:help,diagnostics:[]}));else process.stdout.write(help);return;
 }
 if(!['scaffold','validate','inspect','build','resolve','archive'].includes(command))problem('E_USAGE',null,'$',`Unknown command ${command}. Use help.`);
 const options={dependencies:[],candidates:[],enable:[]},positionals=[],seen=new Set();
 for(let i=1;i<args.length;i++){
  const value=args[i];if(!value.startsWith('--')){positionals.push(value);continue;}
  if(value==='--json'){if(seen.has(value))problem('E_USAGE',null,'$','Duplicate --json.');seen.add(value);continue;}
  const allowed=command==='scaffold'?['--id','--title']:['--dependency','--candidate','--enable','--lock','--engine',...(['build','resolve','archive'].includes(command)?['--out']:[])];
  if(!allowed.includes(value))problem('E_USAGE',null,'$',`Unknown option ${value} for ${command}.`);
  if(seen.has(value)&&!['--dependency','--candidate','--enable'].includes(value))problem('E_USAGE',null,'$',`Duplicate option ${value}.`);seen.add(value);
  const operand=args[++i];if(operand===undefined||operand.startsWith('--'))problem('E_USAGE',null,'$',`Missing value for ${value}.`);
  if(value==='--dependency')options.dependencies.push(operand);else if(value==='--candidate')options.candidates.push(operand);else if(value==='--enable')options.enable.push(operand);else options[{'--id':'id','--title':'title','--engine':'engineVersion','--out':'out','--lock':'lock'}[value]]=operand;
 }
 if(positionals.length!==1)problem('E_USAGE',null,'$','Supply exactly one pack directory.');
 if(command==='scaffold'&&!options.id)problem('E_USAGE',null,'$','scaffold requires --id.');
 if(['build','archive'].includes(command)&&!options.out)problem('E_USAGE',null,'$',`${command} requires --out.`);
 let data;
 if(command==='scaffold')data=await scaffold(positionals[0],options);
 else{
  const selection=await loadSelection(positionals[0],options);
  if(command==='inspect')data=inspectSelection(selection);
  else if(command==='build')data=await buildSelection(selection,options.out);
  else if(command==='resolve')data=options.out?await writeResolvedArtifact(selection,options.out,'lock'):selection.resolution;
  else if(command==='archive')data=await writeResolvedArtifact(selection,options.out,'archive');
  else data={directory:resolve(positionals[0]),packId:selection.rootPackId,packs:selection.packs.length,definitions:selection.packs.reduce((n,p)=>n+p.index.definitions.length,0),supportedPayloads:['map','routine','class','item','monster','resource','npc','dialogue','quest','encounter','condition','ability'],playableInCurrentRuntime:inspectSelection(selection).playableInCurrentRuntime};
 }
 if(json)console.log(JSON.stringify({ok:true,command,data,diagnostics:[]}));
 else{console.log(`PASS ${command}`);console.log(JSON.stringify(data,null,2));}
}
try{await main();}catch(error){const value=error instanceof ToolError?error:new ToolError('E_IO',null,'$',error.message);const d=diagnostic(value);if(json)console.log(JSON.stringify({ok:false,command:args[0]??'help',diagnostics:[d]}));else console.error(`${d.code} ${d.file??'<command>'}${d.path}: ${d.message}${d.objectId?' ['+d.objectId+']':''}`);process.exitCode=d.code==='E_USAGE'?2:1;}
