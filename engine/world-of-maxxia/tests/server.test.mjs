import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createStaticServer} from '../server.mjs';

test('Node server serves assets and rejects traversal/missing paths/unsupported methods',async(t)=>{
 const dir=await mkdtemp(join(tmpdir(),'maxxia-test-'));
 await mkdir(join(dir,'dist'));const root=join(dir,'dist');
 await writeFile(join(root,'index.html'),'<h1>Maxxia</h1>');await writeFile(join(root,'app.js'),'console.log(1)');
 await writeFile(join(dir,'secret.txt'),'private');await symlink(join(dir,'secret.txt'),join(root,'escape.txt'));
 const server=createStaticServer(root);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
 const request=(path,method='GET')=>new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));});req.on('error',reject);req.end();});
 assert.equal((await request('/')).body,'<h1>Maxxia</h1>');
 assert.match((await request('/app.js')).headers['content-type'],/javascript/);
 assert.equal((await request('/app.js','HEAD')).body,'');
 assert.equal((await request('/healthz')).status,200);
 assert.equal((await request('/missing.js')).status,404);
 assert.equal((await request('/','POST')).status,405);
 for(const path of ['/%2e%2e/secret.txt','/../secret.txt','/.git/config','/escape.txt','/%5c..%5csecret.txt','/%00'])assert.equal((await request(path)).status,403,path);
 assert.equal((await request('/%ZZ')).status,400);
});
