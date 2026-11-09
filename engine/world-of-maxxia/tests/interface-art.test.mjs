import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {portraitAsset,PORTRAIT_STATES} from '../src/client/art-production.ts';
import {portrait,icon} from '../src/client/ui-art.ts';
import {EXPLORATION_COMMANDS,COMBAT_COMMANDS} from '../src/client/ui-contract.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
test('all twelve stable portrait selections have four correctly sized production images',()=>{
 const normalHashes=new Set();const paths=new Set();
 for(let i=0;i<12;i++)for(const state of PORTRAIT_STATES){
  const path=portraitAsset(i,state);assert(path);paths.add(path);const bytes=readFileSync(root+'public/'+path);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),58);assert.equal(bytes.readUInt32BE(20),70);
  const markup=portrait(i,state);assert(markup.includes(path));assert(!markup.includes('<svg'),'no procedural portrait placeholder');
  if(state==='normal')normalHashes.add(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(paths.size,48);assert.equal(normalHashes.size,12,'all twelve identities distinct');
 assert.equal(portraitAsset(5,'normal'),'assets/art/witch-normal.png','Phase 20 Witch ID retained');
 assert.equal(portraitAsset(-1,'normal'),null);assert.equal(portraitAsset(1.5,'normal'),null);
});
test('all normal command and movement glyphs have explicit non-default artwork',()=>{
 const unknown=icon('unknown');
 for(const name of new Set([...EXPLORATION_COMMANDS,...COMBAT_COMMANDS].map(c=>c.icon).concat(['arrow_up','arrow_down','arrow_left','arrow_right','turn_left','turn_right']))){
  if(name!=='sun')assert.notEqual(icon(name),unknown,name+' must not silently fall back to sun');
  assert(icon(name).includes('aria-hidden="true"'));
 }
 assert.notEqual(icon('swords'),icon('shield'));assert.notEqual(icon('potion'),icon('scroll'));assert.notEqual(icon('boot'),icon('bow'));
});
test('final UI material pack, independent frame and bundled fonts are present',()=>{
 for(const name of ['stone','button','parchment','portrait-frame','panel','parchment-panel','gargoyle','ruby','amethyst','compass','title-harbour'])assert(existsSync(root+'public/assets/art/ui/'+name+'.png'));
 const frame=readFileSync(root+'public/assets/art/ui/frame.svg','utf8');assert(frame.includes('viewBox="0 0 640 400"'));assert(frame.includes('data:image/png;base64,'));
 assert(frame.includes('x="8" y="8" width="440" height="280"'),'world viewport stays unobscured');
 for(const name of ['maxxia-serif','maxxia-mono'])assert.equal(readFileSync(root+'public/assets/fonts/'+name+'.woff').subarray(0,4).toString(),'wOFF');
 assert(existsSync(root+'licenses/DejaVu-Fonts.txt'));
});
