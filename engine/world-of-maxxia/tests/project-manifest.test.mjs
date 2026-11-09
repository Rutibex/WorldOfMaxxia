import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readProjectManifest,serializeProjectManifest,ManifestError,createStableId} from '../src/shared/project/manifest.ts';
const base=new URL('../../../contracts/fixtures/manifest/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('index.json',base),'utf8'));
for(const fixture of index.fixtures)test('project manifest: '+fixture.name,()=>{
 const text=readFileSync(new URL(fixture.file,base),'utf8');
 if(fixture.valid){const model=readProjectManifest(text);assert.deepEqual(readProjectManifest(serializeProjectManifest(model)),JSON.parse(text.replace(/^\uFEFF/,'')));}
 else assert.throws(()=>readProjectManifest(text),error=>error instanceof ManifestError&&error.code===fixture.code&&error.path===fixture.path);
});
test('stable IDs use unique opaque lowercase values independent of names',()=>{
 const ids=Array.from({length:100},()=>createStableId('project'));assert.equal(new Set(ids).size,100);assert(ids.every(x=>/^project_[a-f0-9]{32}$/.test(x)));assert.throws(()=>createStableId('../bad'));
});
