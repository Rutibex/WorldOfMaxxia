/** Verify every static CSS reference and the complete portrait pack in the shipped build. */
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {portraitAsset,PORTRAIT_STATES} from '../src/client/art-production.ts';
import {TOWN_TEXTURES,townAsset} from '../src/client/town-art.ts';
import {NPC_SCENES} from '../src/client/npc-scenes.ts';
import {UPPER_TEXTURES,upperAsset} from '../src/client/upper-art.ts';
import {VAULT_TEXTURES,vaultAsset} from '../src/client/vault-art.ts';
import {ANIMATED_ENEMY_ATLASES} from '../src/client/art-production.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','dist');let refs=0;
for(const key of UPPER_TEXTURES){const bytes=await readFile(resolve(root,upperAsset(key)));assert.equal(bytes.readUInt32BE(16),128);assert.equal(bytes.readUInt32BE(20),128);refs++;}
for(const key of VAULT_TEXTURES){const bytes=await readFile(resolve(root,vaultAsset(key)));assert.equal(bytes.readUInt32BE(16),128);assert.equal(bytes.readUInt32BE(20),128);refs++;}
for(const atlas of Object.values(ANIMATED_ENEMY_ATLASES)){const bytes=await readFile(resolve(root,atlas.url));assert.equal(bytes.readUInt32BE(16),atlas.cell*atlas.columns);assert.equal(bytes.readUInt32BE(20),512);assert.equal(bytes[25],6,'Enemy atlas must be RGBA');refs++;}
for(const scene of Object.values(NPC_SCENES)){const bytes=await readFile(resolve(root,scene.url));assert.equal(bytes.readUInt32BE(16),880);assert.equal(bytes.readUInt32BE(20),560);refs++;}
for(const key of TOWN_TEXTURES){const b=await readFile(resolve(root,townAsset(key)));assert.equal(b.readUInt32BE(16),key==='sky'?1320:128);assert.equal(b.readUInt32BE(20),key==='sky'?440:128);refs++;}
for(let i=0;i<12;i++)for(const state of PORTRAIT_STATES){const bytes=await readFile(resolve(root,portraitAsset(i,state)));assert.equal(bytes.readUInt32BE(16),58);assert.equal(bytes.readUInt32BE(20),70);refs++;}
async function styles(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())result.push(...(await styles(resolve(dir,e.name))).map(n=>e.name+'/'+n));else if(e.name.endsWith('.css'))result.push(e.name);}return result;}
for(const name of await styles(resolve(root,'assets'))){
 const file=resolve(root,'assets',name),css=await readFile(file,'utf8');
 for(const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){
  const spec=match[1];if(spec.startsWith('data:'))continue;
  assert(!spec.startsWith('/'),'unresolved root-absolute CSS asset '+spec);
  await stat(resolve(dirname(file),spec));refs++;
 }
}
for(const page of ['interface-gallery.html','art-proof.html','town-gallery.html','npc-gallery.html','upper-gallery.html','vault-gallery.html','enemy-gallery.html'])await stat(resolve(root,page));
console.log(`PASS: ${refs} portrait/CSS asset references, dimensions, and all seven gallery pages.`);
