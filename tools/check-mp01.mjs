/** Portable orchestration: commands are direct Node invocations, no shell chaining. */
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tasks=[['tools/generate-pack-types-mp01.mjs','--check'],['tools/check-pack-contracts-mp01.mjs'],['--test','contracts/mp01/tests/portability.test.mjs'],['engine/world-of-maxxia/node_modules/typescript/bin/tsc','--noEmit','--strict','--skipLibCheck','contracts/mp01/types.d.ts']];
for(const args of tasks){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',timeout:60000});if(result.error)throw result.error;if(result.status!==0){process.exitCode=result.status??1;break;}}
