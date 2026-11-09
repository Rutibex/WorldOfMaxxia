/** Actual browser acceptance for optional catalogue boot and class selection. */
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createStaticServer} from '../engine/world-of-maxxia/server.mjs';
const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));}
const server=createStaticServer(resolve(workspace,'engine/world-of-maxxia/dist'));await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1360,height:950}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:'+server.address().port+'/?project=CatalogueProof.maxxia&catalogue=mp04-proof/catalogue.maxxia-build.json',{waitUntil:'networkidle'});
 await page.locator('#enter').click();await page.locator('select.create-class option[value="brass:class:warden"]').waitFor({state:'attached'});
 await page.locator('select.create-class').selectOption('brass:class:warden');await page.locator('#creation-slots button').nth(1).click();await page.locator('select.create-class').selectOption('glass:class:warden');await page.locator('#creation-begin').click();await page.locator('#chamber-ui:visible').waitFor();
 const state=await page.evaluate(async()=>{const {p}=await import(new URL('./assets/phaser-dduChEN6.js',location.href).href);const scene=p.default.Display.Canvas.CanvasPool.pool.find(v=>v.parent?.game).parent.game.scene.getScene('chamber');window.mp04Scene=scene;scene.autosave();return scene.snapshotCampaign();});
 assert.equal(state.party.characters.hero_custom_001.classId,'brass:class:warden');assert.equal(state.party.characters.hero_custom_002.equipment.melee,'glass:item:blade');assert(state.combat.encounters.enc_mp04_brass);assert(state.combat.encounters.enc_mp04_glass);
 await page.reload({waitUntil:'networkidle'});await page.locator('#resume:visible').click();await page.locator('#chamber-ui:visible').waitFor();assert.deepEqual(errors,[]);console.log('PASS: real catalogue boot, both classes, cross-pack starting gear, both monster placements and save/resume.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
