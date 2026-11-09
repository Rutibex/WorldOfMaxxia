import test from 'node:test';
import assert from 'node:assert/strict';
import {EXPLORATION_COMMANDS,explorationShortcut,ModalStack} from '../src/client/ui-contract.ts';

test('exploration command order is the agreed three-by-three Xeen layout',()=>{
 assert.deepEqual(EXPLORATION_COMMANDS.map(c=>c.id),['shoot','cast','rest','bash','lockpick','search','map','information','quick']);
 assert.deepEqual(EXPLORATION_COMMANDS.map(c=>c.key),['S','C','R','B','D','V','M','I','Q']);
 assert.equal(new Set(EXPLORATION_COMMANDS.map(c=>c.key)).size,9);
});
test('every exploration shortcut and six portrait slots resolve correctly',()=>{
 for(const c of EXPLORATION_COMMANDS)assert.equal(explorationShortcut({code:`Key${c.key}`}),c.id);
 for(let i=1;i<=6;i++)assert.equal(explorationShortcut({code:`F${i}`}),`portrait_${i-1}`);
 assert.equal(explorationShortcut({code:'Tab'}),'system');
 assert.equal(explorationShortcut({code:'Equal'}),'view_toggle');
 assert.equal(explorationShortcut({code:'KeyH'}),'help');
});
test('editing, browser modifiers and native button activation do not become world actions',()=>{
 for(const c of ['ArrowUp','Space','KeyS','F1','Tab'])assert.equal(explorationShortcut({code:c,typing:true}),null);
 for(const modifier of ['alt','meta','shift'])assert.equal(explorationShortcut({code:'KeyQ',[modifier]:true}),null);
 assert.equal(explorationShortcut({code:'KeyL',ctrl:true}),null);
 assert.equal(explorationShortcut({code:'Space',nativeButton:true}),null);
 assert.equal(explorationShortcut({code:'Space'}),'interact');
});
test('movement repeats but repeated modal shortcuts do not pile up panels',()=>{
 assert.equal(explorationShortcut({code:'ArrowUp',repeat:true}),'forward');
 assert.equal(explorationShortcut({code:'ArrowLeft',ctrl:true}),'strafe_left');
 assert.equal(explorationShortcut({code:'ArrowRight',ctrl:true}),'strafe_right');
 for(const c of ['KeyM','Space','F1','Tab'])assert.equal(explorationShortcut({code:c,repeat:true}),null);
});
test('nested panel back/replace/clear preserve the intended parent and depth',()=>{
 const s=new ModalStack();s.push({kind:'system'});s.push({kind:'help'});s.push({kind:'bindings'});
 assert.equal(s.depth,3);assert.equal(s.pop().kind,'bindings');assert.equal(s.top.kind,'help');
 s.pop();s.push({kind:'portrait',slot:0});s.replace({kind:'portrait',slot:5});assert.equal(s.depth,2);assert.equal(s.top.slot,5);
 s.pop();assert.equal(s.top.kind,'system');s.clear();assert.equal(s.depth,0);assert.equal(s.top,undefined);assert.throws(()=>s.replace({kind:'map'}));
});
test('pathological panel nesting is bounded without corrupting existing frames',()=>{
 const s=new ModalStack();for(let i=0;i<8;i++)s.push(i);assert.throws(()=>s.push(8));assert.equal(s.depth,8);assert.equal(s.top,7);
});
