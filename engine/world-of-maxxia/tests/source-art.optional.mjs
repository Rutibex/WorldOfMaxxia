/** Optional provenance checks require the separately preserved art-master archive. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../art-source/',import.meta.url);
const bytes=p=>{const url=new URL(p,root);assert(existsSync(url),'Original masters not installed. Extract Maxxia-Maker-Art-Masters.zip beside the source folder.');return readFileSync(url);};
test('original painted spell and equipment boards retained',()=>{for(const n of ['painted-equipment-spells-master.png','painted-icons-master.png'])assert(bytes('phase30-rendered/'+n).length>100000);});
test('original rendered enemy master retained',()=>assert(bytes('enemy-raster-redo/rendered-enemies-master.png').length>100000));
test('original vault master sheet dimensions retained',()=>{const a=bytes('vault-rendered-materials-master.png'),b=bytes('vault-rendered-props-master.png');assert.equal(a.readUInt32BE(16),512);assert.equal(a.readUInt32BE(20),256);assert.equal(b.readUInt32BE(16),768);assert.equal(b.readUInt32BE(20),512);});
test('original three painted vault references retained',()=>{for(const n of [1,2,3])assert(bytes('vault-painted-reference-'+n+'.png').length>100000);});
