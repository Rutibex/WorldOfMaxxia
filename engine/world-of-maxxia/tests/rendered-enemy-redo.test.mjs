import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ANIMATED_ENEMY_ATLASES,animationClip} from '../src/client/art-production.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const report=JSON.parse(readFileSync(root+'art-source/enemy-raster-redo/packing-report.json','utf8'));
test('eight non-Dust Imp monsters and the boss special use packed illustrated raster atlases',()=>{
 assert.equal(Object.keys(report).length,9);
 for(const [key,atlas] of Object.entries(ANIMATED_ENEMY_ATLASES)){
  if(key==='dust_imp')continue;
  const name=key.replaceAll('_','-');const p=root+'public/'+atlas.url;
  assert(existsSync(p),p);assert(report[name],name);
  const b=readFileSync(p);assert.equal(b.readUInt32BE(16),512);assert.equal(b.readUInt32BE(20),512);assert.equal(b[25],6);
  for(const clip of ['idle','attack','hurt','death'])assert(animationClip(atlas,clip).frames.every(f=>f>=0&&f<16));
 }
 assert(existsSync(root+'public/'+ANIMATED_ENEMY_ATLASES.bell_heart.special.url));
});
test('raster packer is active and no executable primitive-drawn enemy generator remains active',()=>{
 assert(existsSync(root+'scripts/pack-rendered-enemies.py'));
 for(const phase of ['one','two','three']){
  assert(!existsSync(root+`scripts/prepare-enemy-art-batch-${phase}.py`));
  assert(existsSync(root+`art-source/legacy-procedural-enemies/prepare-enemy-art-batch-${phase}.py`));
 }
 const script=readFileSync(root+'scripts/pack-rendered-enemies.py','utf8');
 assert(!/ImageDraw|\.ellipse\(|\.polygon\(|\.line\(/.test(script));
});
