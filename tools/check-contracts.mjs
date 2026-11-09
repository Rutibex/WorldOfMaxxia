import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import {readProjectManifest,serializeProjectManifest,ManifestError} from '../engine/world-of-maxxia/src/shared/project/manifest.ts';
import {SCHEMA_SHA256,CURRENT_ENGINE_VERSION} from '../engine/world-of-maxxia/src/shared/project/generated.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),folder=resolve(root,'contracts/fixtures/manifest');
const index=JSON.parse(await readFile(resolve(folder,'index.json'),'utf8'));
const schema=JSON.parse(await readFile(resolve(root,'contracts/schemas/project-manifest-v1.schema.json'),'utf8'));
const ajv=new Ajv2020({strict:true,allErrors:true}),validate=ajv.compile(schema);
const ts=[];
for(const fixture of index.fixtures){
 const text=await readFile(resolve(folder,fixture.file),'utf8');let structural=false;
 try{structural=validate(JSON.parse(text.replace(/^\uFEFF/,'')));}catch{}
 assert.equal(structural,fixture.schemaValid,fixture.name+' independent JSON Schema result');
 let result;
 try{const manifest=readProjectManifest(text);result={name:fixture.name,valid:true,code:null,path:null,roundTrip:serializeProjectManifest(manifest)};}
 catch(error){if(!(error instanceof ManifestError))throw error;result={name:fixture.name,valid:false,code:error.code,path:error.path};}
 for(const key of ['valid','code','path'])assert.equal(result[key],fixture[key],fixture.name+' TS '+key);
 ts.push(result);
}
const native=spawnSync(process.env.MAXXIA_DOTNET??'dotnet',['run','--project','editor/MaxxiaMaker.ContractChecks/MaxxiaMaker.ContractChecks.csproj','--configuration','Release','--',folder],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
if(native.error)throw new Error('C# fixture runner could not start. Install .NET 10 SDK or set MAXXIA_DOTNET.',{cause:native.error});
assert.equal(native.status,0,native.stdout+'\n'+native.stderr);
const line=native.stdout.split(/\r?\n/).find(x=>x.startsWith('MANIFEST_RESULTS='));assert(line,native.stdout);
const cs=JSON.parse(line.slice('MANIFEST_RESULTS='.length));
assert.equal(cs.engineVersion,CURRENT_ENGINE_VERSION);assert.equal(cs.schemaSha256,SCHEMA_SHA256);assert.equal(cs.results.length,ts.length);
for(let i=0;i<ts.length;i++){
 for(const key of ['name','valid','code','path'])assert.equal(cs.results[i][key],ts[i][key],ts[i].name+' C#/TS '+key);
 if(ts[i].valid){assert.deepEqual(JSON.parse(cs.results[i].roundTrip),JSON.parse(ts[i].roundTrip),ts[i].name+' unknown-field-preserving round trip');}
}
console.log(`PASS: ${ts.length} shared fixtures match JSON Schema expectations and C#/TypeScript outcomes; valid documents round-trip without field loss.`);
