import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('../art-source/phase30-rendered/source-mapping.json',import.meta.url),'utf8'));
for(const [category,expected] of [['items',48],['spells',36],['feedback',19]]){
 test(`Phase 30 rendered ${category}: ${expected} approved raster files with 64x64 RGBA`,()=>{
  const names=Object.keys(manifest[category]);assert.equal(names.length,expected);
  const assetNames=readdirSync(new URL(`../public/assets/art/${category}/`,import.meta.url)).filter(n=>n.endsWith('.png'));
  assert.equal(assetNames.length,expected);assert.deepEqual(assetNames.sort(),names.map(n=>n+'.png').sort());
  for(const name of names){
    const bytes=readFileSync(new URL(`../public/assets/art/${category}/${name}.png`,import.meta.url));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),64);assert.equal(bytes.readUInt32BE(20),64);
    assert.equal(bytes[25],6,'RGBA required '+name);
    assert(bytes.length>2200,'painted detail unexpectedly absent '+name);
    assert(['spell1','spell2','item1','item2'].includes(manifest[category][name].master));
  }
 });
}
test('raster packer is active while the geometry drawer is retired',()=>{
 assert(existsSync(new URL('../scripts/pack-phase30-rendered-art.py',import.meta.url)));
 assert(!existsSync(new URL('../scripts/generate-phase30-art.py',import.meta.url)));
 assert(existsSync(new URL('../art-source/phase30-rendered/legacy/legacy-procedural-icon-generator.py',import.meta.url)));
 const script=readFileSync(new URL('../scripts/pack-phase30-rendered-art.py',import.meta.url),'utf8');
 assert(!script.includes('ImageDraw.Draw(shadow)'));
 assert(script.includes('sample(source,idx)'));
});
