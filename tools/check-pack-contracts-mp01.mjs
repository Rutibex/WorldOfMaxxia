/** Repeatable fixture runner with machine-readable results. No engine/game installation. */
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ContractError,validateCatalogue,validateCharacter,validateLock,validateTransfer} from '../contracts/mp01/validate.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),fixture=resolve(root,'contracts/mp01/fixtures');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const baseline=await read(resolve(root,'contracts/mp01/CONTRACT_V1_MANIFEST.json'));
for(const f of baseline.schemas)assert.equal(createHash('sha256').update(await readFile(resolve(root,'contracts/mp01',f.path))).digest('hex'),f.sha256,'Frozen schema drift '+f.path);
const index=await read(resolve(fixture,'index.json')),results=[];
for(const c of index.cases){let actual={valid:true,code:null,path:null};try{validateCatalogue(await read(resolve(fixture,c.file)));}catch(e){if(!(e instanceof ContractError))throw e;actual={valid:false,code:e.code,path:e.path};}for(const k of ['valid','code','path'])assert.equal(actual[k],c[k],c.name+' '+k);results.push({name:c.name,...actual});}
const packs=[];for(const id of ['core','brass','lantern']){const folder=resolve(fixture,'valid',id),manifest=await read(resolve(folder,'pack.json')),index=await read(resolve(folder,manifest.contentIndex));for(const d of index.definitions){const data=await read(resolve(folder,d.file));assert.equal(data.id,d.id);assert.equal(data.fixtureOnly,true);}packs.push({manifest,index});}
validateCatalogue({engineVersion:'0.49.0',rules:{id:'core:rules:classic',version:'1.0.0'},packs});
validateCharacter(await read(resolve(fixture,'character.json')));validateLock(await read(resolve(fixture,'catalogue-lock.json')));validateTransfer(await read(resolve(fixture,'transfer.json')));
await mkdir(resolve(root,'validation/MP01'),{recursive:true});
await writeFile(resolve(root,'validation/MP01/contract-fixtures.json'),JSON.stringify({phase:'MP01',catalogueCases:results,fixturePackFiles:'passed',portableExamples:'passed'},null,2)+'\n');
console.log(`PASS: ${results.length} catalogue cases; three on-disk fixture packs; portable character, lock and transfer envelopes. Invalid fixtures match diagnostic code and exact path.`);
