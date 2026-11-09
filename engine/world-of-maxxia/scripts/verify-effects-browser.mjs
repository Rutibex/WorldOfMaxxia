/** Directed real-browser checks. Install Playwright separately; CHROMIUM_PATH may select a local executable. */
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));}
const root=resolve(import.meta.dirname,'..'),port=31873;
const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<50;i++){try{await fetch(`http://127.0.0.1:${port}/healthz`);break;}catch{await new Promise(r=>setTimeout(r,50));}}
 const args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[],bad=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
 await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
 await page.locator('#welcome:visible').waitFor();await page.locator('#enter').click();await page.locator('#creation-default').click();await page.locator('#chamber-ui:visible').waitFor();
 await page.evaluate(async()=>{
  const {p}=await import('/assets/phaser-dduChEN6.js');const game=p.default.Display.Canvas.CanvasPool.pool.find(v=>v.parent?.game)?.parent.game;if(!game)throw Error('No live Phaser game');
  const scene=game.scene.getScene('chamber');window.qaScene=scene;
  const {newCampaign}=await import(new URL('./wom-shared-rules-campaign.js',document.querySelector('script[type="module"][src]').src).href);const {SPELLS,castExploration}=await import(new URL('./wom-shared-rules-magic.js',document.querySelector('script[type="module"][src]').src).href);const {derived}=await import(new URL('./wom-shared-rules-party.js',document.querySelector('script[type="module"][src]').src).href);
  window.qaFresh=()=>{const state=newCampaign(scene.mapRegistry,'map_town');for(const id of state.party.order){const c=state.party.characters[id];c.level=5;c.hp=derived(c).maxHP;c.sp=derived(c).maxSP;if(['wizard','priest','witch'].includes(c.classId))state.magic.known[id]=Object.values(SPELLS).filter(v=>v.classId===c.classId).map(v=>v.id);}return state;};
  let state=window.qaFresh();const priest=state.party.order.find(id=>state.party.characters[id].classId==='priest');const ally=state.party.order[5];state.party.characters[ally].hp=1;scene.combatArt.reset();scene.applyCampaign(state);scene.handleCombat(castExploration(state,{casterId:priest,spellId:'spell_priest_mend_flesh',targetId:ally},scene.mapRegistry));
 });
 await page.waitForTimeout(80);
 const heal=await page.evaluate(()=>{const fx=window.qaScene.combatArt.effectSprites[0];const id=fx?.targetId;const button=[...document.querySelectorAll('.portrait-slot')].find(v=>v.dataset.characterId===id);const r=button?.getBoundingClientRect(),f=fx?.node.getBoundingClientRect();return {id,correct:!!r&&!!f&&Math.abs((r.x+r.width/2)-(f.x+f.width/2))<3};});assert(heal.correct,'Healing effect must follow the selected sixth portrait');
 await page.evaluate(async()=>{const scene=window.qaScene,state=window.qaFresh();const {castExploration}=await import(new URL('./wom-shared-rules-magic.js',document.querySelector('script[type="module"][src]').src).href);const wizard=state.party.order.find(id=>state.party.characters[id].classId==='wizard');scene.combatArt.reset();scene.applyCampaign(state);scene.handleCombat(castExploration(state,{casterId:wizard,spellId:'spell_wizard_stone_skin'},scene.mapRegistry));});
 assert.equal(await page.locator('.portrait-vfx-layer .combat-effect').count(),6,'All six party members receive ward feedback');
 await page.evaluate(async()=>{const scene=window.qaScene,state=window.qaFresh();state.currentMapId='map_diagnostic_galleries';const {beginEncounter,castCombatSpell}=await import(new URL('./wom-shared-rules-combat.js',document.querySelector('script[type="module"][src]').src).href);let s=beginEncounter(state,scene.mapRegistry).state;const wizard=s.party.order.find(id=>s.party.characters[id].classId==='wizard');s.combat.active.turnIndex=s.combat.active.turnOrder.indexOf(wizard);scene.combatArt.reset();scene.applyCampaign(s);scene.refreshReadouts();scene.renderWorld?.();window.qaCast=()=>{const before=scene.snapshotCampaign();scene.handleCombat(castCombatSpell(before,scene.mapRegistry,{casterId:wizard,spellId:'spell_wizard_spark_lance',targetId:before.combat.active.targetId}));};});
 await page.waitForTimeout(150);await page.evaluate(()=>window.qaCast());
 const timing=await page.evaluate(()=>{const art=window.qaScene.combatArt;const missile=art.effectSprites.find(v=>v.kind==='missile_arcane'),impact=art.impactSprites.find(v=>v.kind==='arcane');return {delay:impact.started-missile.started,missile:missile.kind};});assert(timing.delay>=230&&timing.delay<=260,'Impact must wait for missile flight');
 await page.waitForTimeout(285);if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.QA_SCREENSHOT_DIR,'PHASE303_BROWSER_COMBAT.png')});
 // All sheet images load, all six frame offsets stay inside their strip, at narrow and wide sizes.
 for(const width of [800,1280]){await page.setViewportSize({width,height:900});for(const route of ['effects-gallery.html','status-gallery.html']){await page.goto(`http://127.0.0.1:${port}/${route}`,{waitUntil:'networkidle'});assert(await page.locator('.sheet').count()>0);await page.evaluate(async()=>{const urls=[...document.querySelectorAll('.sheet')].map(v=>getComputedStyle(v).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]).filter(Boolean);for(const url of urls){const im=new Image();im.src=url;await im.decode();if(im.width!==576||im.height!==96)throw Error('Wrong sprite strip dimensions');}});}}
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`http://127.0.0.1:${port}/effects-gallery.html`);assert.equal(await page.locator('.sheet').first().evaluate(v=>getComputedStyle(v).animationName),'none');
 assert.deepEqual(errors,[],'No browser script errors');assert.deepEqual(bad,[],'No missing browser assets');
 console.log('PASS: Chromium title/new adventure, exact sixth-portrait healing, six-member ward, real Spark Lance cast and delayed impact, both galleries at 800/1280px, reduced motion, no page errors or missing assets.');
}finally{await browser?.close();server.kill();}
