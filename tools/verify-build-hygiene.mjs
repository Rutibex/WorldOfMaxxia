/** Integration: actual builds must not publish synthetic editor sidecars. */
import {writeFile,rm,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),engine=resolve(root,'engine/world-of-maxxia');
const names=['__mm03-hygiene.maxxia.bak','__mm03-hygiene.maxxia.save-lock','.__mm03-hygiene.tmp'];
try{
 for(const name of names)await writeFile(resolve(engine,'public',name),'MM03 synthetic export hygiene fixture\n',{flag:'wx'});
 for(const [script,out]of [['build:game',resolve(engine,'dist')],['build:game:vite',resolve(root,'artifacts/vite-game')]]){
  const p=spawnSync(process.execPath,[process.env.npm_execpath??'','run',script],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
  if(p.status!==0)throw new Error(p.stdout+'\n'+p.stderr);
  for(const name of names)await assert.rejects(stat(resolve(out,name)),e=>e.code==='ENOENT');
  await stat(resolve(out,'WorldOfMaxxia.maxxia'));
  console.log(`PASS: ${script} excludes backup/lock/temp files and retains project manifests.`);
 }
}finally{
 for(const name of names)await rm(resolve(engine,'public',name),{force:true});
}
