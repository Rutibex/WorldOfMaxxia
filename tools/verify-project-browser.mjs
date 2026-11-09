/** Real Chromium integration for MM02, supports a clean Browser ZIP extraction. */
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createStaticServer} from '../engine/world-of-maxxia/server.mjs';
const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(process.env.MAXXIA_TEST_ROOT??resolve(workspace,'engine/world-of-maxxia'));
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright');}catch{pw=require(resolve(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));}
const server=createStaticServer(resolve(root,'dist')),serve=server.listeners('request')[0];
server.removeAllListeners('request');server.on('request',(req,res)=>{if(req.url.startsWith('/nested/'))req.url=req.url.slice('/nested'.length);serve(req,res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1360,height:950}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const manifest=JSON.parse(await readFile(resolve(root,'dist/WorldOfMaxxia.maxxia'),'utf8'));
 const custom=structuredClone(manifest);custom.projectId='project_browser_fixture';custom.title='Selected Maxxia <Campaign>';custom.start.y=11;custom.start.facing=2;custom.startingParty.reverse();
 await page.route('**/Custom.maxxia',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(custom)}));
 await page.route('**/Future.maxxia',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({...manifest,projectFormatVersion:2})}));
 async function scene(){await page.evaluate(async()=>{const {p}=await import(new URL('./assets/phaser-dduChEN6.js',location.href).href);window.mmScene=p.default.Display.Canvas.CanvasPool.pool.find(v=>v.parent?.game).parent.game.scene.getScene('chamber');});}
 async function newGame(){await page.locator('#welcome:visible').waitFor();await page.locator('#enter').click();await page.locator('#creation-default').click();await page.locator('#chamber-ui:visible').waitFor();await scene();}
 await page.goto(origin+'/',{waitUntil:'networkidle'});await newGame();
 const defaultRaw=await page.evaluate(()=>{const s=window.mmScene.snapshotCampaign();s.party.characters.hero_tarin.xp=321;window.mmScene.applyCampaign(s);window.mmScene.autosave();return localStorage.getItem('world-of-maxxia:campaign:v1:auto');});
 assert(defaultRaw);
 await page.goto(origin+'/?project=WorldOfMaxxia.maxxia',{waitUntil:'networkidle'});await page.locator('#resume:visible').click();await scene();
 assert.equal(await page.evaluate(()=>window.mmScene.snapshotCampaign().party.characters.hero_tarin.xp),321);
 await page.goto(origin+'/?project=Custom.maxxia',{waitUntil:'networkidle'});await page.locator('#welcome:visible').waitFor();
 assert.equal(await page.title(),custom.title);assert.equal(await page.locator('#welcome h1').textContent(),custom.title);assert.equal(await page.locator('#welcome h1 campaign').count(),0);assert.equal(await page.locator('#resume').isVisible(),false);
 await newGame();
 const state=await page.evaluate(()=>window.mmScene.snapshotCampaign());assert.equal(state.maps.map_town.y,11);assert.equal(state.maps.map_town.facing,2);assert.equal(state.party.order[0],'hero_mora');
 await page.evaluate(()=>{const s=window.mmScene.snapshotCampaign();s.party.characters.hero_tarin.xp=555;window.mmScene.applyCampaign(s);window.mmScene.autosave();});
 assert.equal(await page.evaluate(()=>localStorage.getItem('world-of-maxxia:campaign:v1:auto')),defaultRaw);
 await page.reload({waitUntil:'networkidle'});await page.locator('#resume:visible').click();await scene();assert.equal(await page.evaluate(()=>window.mmScene.snapshotCampaign().party.characters.hero_tarin.xp),555);
 await page.goto(origin+'/nested/?project=WorldOfMaxxia.maxxia',{waitUntil:'networkidle'});await page.locator('#welcome:visible').waitFor();assert.equal(await page.locator('#failure').isVisible(),false);
 await page.goto(origin+'/?project=Future.maxxia',{waitUntil:'networkidle'});await page.locator('#failure:visible').waitFor();assert.match(await page.locator('#failure-details').textContent(),/E_PROJECT_VERSION/);assert.match(await page.locator('#failure-message').textContent(),/unsupported/);assert.equal(await page.locator('#welcome').isVisible(),false);
 await page.goto(origin+'/?project=missing.maxxia',{waitUntil:'networkidle'});await page.locator('#failure:visible').waitFor();assert.match(await page.locator('#failure-details').textContent(),/E_PROJECT_HTTP/);
 await page.goto(origin+'/?project=..%2Fbad.maxxia',{waitUntil:'networkidle'});await page.locator('#failure:visible').waitFor();assert.match(await page.locator('#failure-details').textContent(),/E_PROJECT_SELECTION/);
 assert.deepEqual(errors,[]);
 console.log('PASS: default and selected boot, legacy save continuity, safe title, configured start/party, project-isolated autosave/reload, hosted subdirectory, future/missing/unsafe manifest diagnostics.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
