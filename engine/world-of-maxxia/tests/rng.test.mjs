import test from 'node:test';
import assert from 'node:assert/strict';
import {SeededRng, seedFromText} from '../src/shared/rules/rng.ts';
import {validateManifest} from '../src/shared/content/manifest.ts';
import {readFile} from 'node:fs/promises';

test('pinned xorshift32 vector prevents accidental algorithm changes',()=>{
 const rng=new SeededRng(1);
 assert.deepEqual(Array.from({length:5},()=>rng.nextUint32()),[270369,67634689,2647435461,307599695,2398689233]);
});
test('same text seed repeats and distinct seeds differ',()=>{
 const sequence=s=>{const r=new SeededRng(s);return Array.from({length:30},()=>r.integer(1,20));};
 assert.deepEqual(sequence('maxxia'),sequence('maxxia'));
 assert.notDeepEqual(sequence('maxxia'),sequence('another world'));
 assert.notEqual(seedFromText(''),0);
});
test('restored state continues exact sequence after JSON round trip',()=>{
 const r=new SeededRng('replay');for(let i=0;i<17;i++)r.nextUint32();
 const snapshot=JSON.parse(JSON.stringify(r.snapshot()));
 const expected=Array.from({length:100},()=>r.integer(1,20));
 const resumed=new SeededRng(999);resumed.restore(snapshot);
 assert.deepEqual(Array.from({length:100},()=>resumed.integer(1,20)),expected);
});
test('invalid seeds, ranges and snapshots fail without mutating state',()=>{
 const r=new SeededRng('valid');const before=r.snapshot();
 for(const v of [null,{}, {algorithm:'xorshift32-v1',state:0},{algorithm:'wrong',state:3},{algorithm:'xorshift32-v1',state:NaN}])assert.throws(()=>r.restore(v));
 for(const range of [[3,1],[0,Infinity],[0,2**32],[.1,2]])assert.throws(()=>r.integer(...range));
 assert.deepEqual(r.snapshot(),before);
 for(const v of [NaN,Infinity,-1,2**32,.2])assert.throws(()=>new SeededRng(v));
 assert.ok(new SeededRng(0).nextUint32()>0);
});
test('dice stay in inclusive bounds and single-point range works',()=>{
 const r=new SeededRng(1337);const seen=new Set();
 for(let i=0;i<10000;i++){const v=r.integer(1,20);assert.ok(v>=1&&v<=20);seen.add(v);}
 assert.equal(seen.size,20);assert.equal(r.integer(7,7),7);
});
test('published content is valid and malformed input is rejected',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/content/foundation.json',import.meta.url),'utf8'));
 assert.equal(validateManifest(manifest).classes.length,6);
 assert.throws(()=>validateManifest({...manifest,classes:['Wizard']}));
 assert.throws(()=>validateManifest({...manifest,classes:Array(6).fill('Wizard')}));
 assert.throws(()=>validateManifest(null));
});
