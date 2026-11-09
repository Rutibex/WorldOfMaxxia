/** MM16 build delivery verification; verify every packaged file over actual HTTP. */
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import assert from 'node:assert/strict';
import {createStaticServer} from '../engine/world-of-maxxia/server.mjs';
const dir=resolve(import.meta.dirname,'../engine/world-of-maxxia/dist');
const collect=async(d)=>{let r=[];for(const ent of await readdir(d,{withFileTypes:true})){const name=join(d,ent.name);if(ent.isDirectory())r.push(...await collect(name));else if(ent.isFile())r.push(name);}return r;};
const files=await collect(dir),server=createStaticServer(dir);
await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
try{
 const base=`http://127.0.0.1:${server.address().port}/`;
 for(let n=0;n<files.length;n+=24){
  await Promise.all(files.slice(n,n+24).map(async f=>{
   const uri=relative(dir,f).split('/').map(encodeURIComponent).join('/'),response=await fetch(base+uri);
   assert.equal(response.status,200,uri);assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(f),uri);
  }));
 }
 console.log(`PASS: ${files.length} browser output files delivered byte-for-byte over local HTTP.`);
}finally{await new Promise(resolve=>server.close(resolve));}
