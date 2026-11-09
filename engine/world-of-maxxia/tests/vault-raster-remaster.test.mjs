import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {VAULT_TEXTURES} from '../src/client/vault-art.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const material=['wall','wet-wall','brass-wall','floor','channel-floor','grate-floor','ceiling','seal-door'];
const sprites=VAULT_TEXTURES.filter(s=>!material.includes(s));
test('rendered vault supplies all 31 runtime RGBA assets',()=>{
 assert.equal(material.length,8);assert.equal(sprites.length,23);assert.equal(VAULT_TEXTURES.length,31);
 for(const key of VAULT_TEXTURES){const png=readFileSync(root+'public/assets/art/vault/'+key+'.png');assert.equal(png.readUInt32BE(16),128,key);assert.equal(png.readUInt32BE(20),128,key);assert.equal(png[25],6,'Required RGBA '+key);}
});
test('vault art packaging is raster extraction rather than geometric/vector drawing',()=>{
 const script=readFileSync(root+'scripts/prepare-vault-art.py','utf8');
 assert.match(script,/vault-rendered-materials-master\.png/);assert.match(script,/vault-rendered-props-master\.png/);
 assert.doesNotMatch(script,/from PIL import ImageDraw|ImageDraw\.Draw\(|\.polygon\(|\.ellipse\(|\.rounded_rectangle\(/);
 const assembly=readFileSync(root+'scripts/build-rendered-vault-masters.py','utf8');
 assert.doesNotMatch(assembly,/from PIL import ImageDraw|ImageDraw\.Draw\(|\.polygon\(|\.ellipse\(|\.rounded_rectangle\(/);
});
