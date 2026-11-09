import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readdir,readFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temporary=createServer();await new Promise(r=>temporary.listen(0,'127.0.0.1',r));const port=temporary.address().port;await new Promise(r=>temporary.close(r));
const child=spawn(process.execPath,[resolve(root,'server.mjs')],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
try{
 for(let attempt=0;;attempt++){
  try{const response=await fetch(`http://127.0.0.1:${port}/healthz`);assert.equal(response.status,200);break;}
  catch(error){if(attempt>=49)throw new Error(`Production launcher did not become ready: ${logs}`,{cause:error});await new Promise(r=>setTimeout(r,50));}
 }
 let count=0;
 const check=async dir=>{for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,entry.name);if(entry.isDirectory()){await check(path);continue;}
  const url=relative(resolve(root,'dist'),path).split('\\').join('/');const response=await fetch(`http://127.0.0.1:${port}/${url}`);assert.equal(response.status,200,url);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(path),url);count++;
 }};
 await check(resolve(root,'dist'));
 assert.equal((await fetch(`http://127.0.0.1:${port}/assets/not-present.js`)).status,404);
 console.log(`PASS: production Node launcher, health endpoint and ${count} browser files served byte-for-byte; missing asset is 404.`);
}finally{const exited=new Promise(r=>child.once('exit',r));if(child.exitCode===null){child.kill();await exited;}}
