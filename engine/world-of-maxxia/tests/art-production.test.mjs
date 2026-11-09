import test from 'node:test';
import assert from 'node:assert/strict';
import {DUST_IMP,clipFrame,clipDuration,tavernFrame,portraitAsset} from '../src/client/art-production.ts';
test('idle cycles all eight authored frames and wraps; attack/death hold final frame',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>clipFrame(DUST_IMP.clips.idle,i*145)),[0,1,2,3,4,5,6,7]);
 assert.equal(clipFrame(DUST_IMP.clips.idle,1160),0);
 assert.equal(clipFrame(DUST_IMP.clips.attack,99999),10);assert.equal(clipFrame(DUST_IMP.clips.death,99999),15);
 assert.equal(clipDuration('death'),640);
});
test('reduced motion conveys final action state without cycling',()=>{
 assert.equal(clipFrame(DUST_IMP.clips.idle,400,true),0);assert.equal(clipFrame(DUST_IMP.clips.death,0,true),15);
 assert.equal(tavernFrame(2490,true),0);
});
test('tavern blink and portrait IDs preserve existing selection and state semantics',()=>{
 assert.deepEqual([0,2350,2490,2800,3600].map(n=>tavernFrame(n)),[0,1,2,3,0]);
 assert.equal(portraitAsset(5,'hurt'),'assets/art/witch-hurt.png');assert.equal(portraitAsset(11,'normal'),'assets/art/portraits/11-normal.png');assert.equal(portraitAsset(12,'normal'),null);
});
