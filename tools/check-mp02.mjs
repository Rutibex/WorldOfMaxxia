import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const args of [['tools/generate-toolkit-reference-mp02.mjs','--check'],['--test','toolkit/tests/cli.test.mjs'],['engine/world-of-maxxia/node_modules/typescript/bin/tsc','--noEmit','--strict','--skipLibCheck','toolkit/types.d.ts'],['tools/maxxia.mjs','validate','examples/mp02/entry-chamber','--json']]){
 const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',timeout:60000});if(r.error)throw r.error;if(r.status!==0){process.exitCode=r.status??1;break;}
}
