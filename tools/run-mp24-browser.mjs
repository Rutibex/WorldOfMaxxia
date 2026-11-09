/** Production renderer proof in local Chromium. Optional --baseline <MP23 browser root> enables pixel comparisons. */
import {createStaticServer} from '../engine/world-of-maxxia/server.mjs';
import {resolve,dirname} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'validation/MP24');await mkdir(out,{recursive:true});
const playwrightModule=await import(process.env.MAXXIA_PLAYWRIGHT_MODULE?pathToFileURL(process.env.MAXXIA_PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=playwrightModule.default??playwrightModule;
const browser=await chromium.launch({headless:true,...(process.env.MAXXIA_CHROMIUM_EXECUTABLE?{executablePath:process.env.MAXXIA_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
const servers=[];async function server(folder){const s=createStaticServer(folder);await new Promise(r=>s.listen(0,'127.0.0.1',r));servers.push(s);return 'http://127.0.0.1:'+s.address().port;}
async function review(url){const page=await browser.newPage({viewport:{width:1000,height:760}});await page.goto(url+'/town-gallery.html');await page.waitForFunction(()=>document.querySelector('canvas')&&document.querySelector('#status')?.textContent&&!document.querySelector('#status').textContent.includes('Loading'));
 await page.evaluate(async()=>{
  document.body.innerHTML='<h1>MP24 production scene review</h1><div id="proof"></div>';
  const build=await fetch('build-info.json').then(r=>r.json()),prefix=build.entry.slice(0,build.entry.lastIndexOf('/')+1),load=n=>import('./'+prefix+'wom-'+n+'.js');
  const [{PerspectiveRenderer},{adaptMapDocument},{initialGridState},{viewPose},upper,town,vault]=await Promise.all([load('client-perspective-renderer'),load('shared-project-map-document'),load('shared-rules-grid'),load('shared-rules-perspective'),load('client-upper-art'),load('client-town-art'),load('client-vault-art')]);
  const environments=await fetch('projects/WorldOfMaxxia/database/environments.json').then(r=>r.json()),resources=await fetch('assets/catalog.json').then(r=>r.json()),images=new Map();
  const image=path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(path));im.src=path;});
  await Promise.all([['town',town.TOWN_TEXTURES],['upper',upper.UPPER_TEXTURES],['vault',vault.VAULT_TEXTURES]].flatMap(([folder,keys])=>keys.map(async k=>images.set(folder+'-'+k,await image('assets/art/'+folder+'/'+k+'.png')))));
  for(const p of environments.profiles)for(const id of [p.skyResourceId,...p.materials.map(m=>m.resourceId)])if(id&&!images.has('environment-'+id)){const res=resources.resources.find(r=>r.id===id);images.set('environment-'+id,await image('assets/'+res.path));}
  const scene={textures:{get:k=>({getSourceImage:()=>{if(!images.has(k))throw Error('Missing texture '+k);return images.get(k);}}),exists:k=>images.has(k),createCanvas:(_,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;document.getElementById('proof').replaceChildren(c);window.proofCanvas=c;return {context:c.getContext('2d'),refresh(){}};}},add:{image:()=>({setOrigin(){}}),graphics:()=>({lineStyle(){},strokeRect(){}})}};
  let renderer=new PerspectiveRenderer(scene,environments),map,state,art;const maps={};for(const id of ['map_town','map_diagnostic_galleries','map_resonator_vault'])maps[id]=adaptMapDocument(await fetch('projects/WorldOfMaxxia/maps/'+id+'.json').then(r=>r.json()));
  const hash=async()=>{const data=window.proofCanvas.getContext('2d').getImageData(0,0,440,280).data;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');};
  window.sceneProof={async render(id,facing=0,mode='fresh',rename=false){map=structuredClone(maps[id]);if(rename)map.id='map_renamed_fixture';state=initialGridState(map);state.facing=facing;art=upper.emptyUpperArt();if(mode!=='fresh'){for(const k of Object.keys(state.doors))state.doors[k]=true;for(const k of Object.keys(state.secrets))state.secrets[k]=true;}if(mode==='completed'){art.claimed=[...upper.UPPER_CACHES,...vault.VAULT_CACHES].map(c=>c.id);art.seenScenes=map.props.map(p=>p.id);art.flags=['flag_upper_descent_ready','flag_vault_valves'];art.triggeredTraps=(map.traps??[]).map(t=>map.id+':'+t.id);}
   const before=JSON.stringify({map,state,art});renderer.render(map,state,viewPose(state),0,art);if(before!==JSON.stringify({map,state,art}))throw Error('Renderer mutated input');return hash();},
   async variant(){map={...structuredClone(maps.map_diagnostic_galleries),id:'map_new_pack_geometry',props:[],environmentId:'proof_plain'};state=initialGridState(map);art=upper.emptyUpperArt();const a=structuredClone(environments.profiles.find(p=>p.scene?.renderer==='waterworks'));a.id='proof_plain';a.scene={renderer:'waterworks',wallTexture:'wall',floorTexture:'floor',doorTexture:'oak-door',legacyScenery:false};const b=structuredClone(a);b.id='proof_other';b.scene.wallTexture='pipe-wall';b.scene.tintColor='#314a70';b.scene.tintStrength=.2;const db={...environments,profiles:[...environments.profiles,a,b]};renderer=new PerspectiveRenderer(scene,db);renderer.render(map,state,viewPose(state),0,art);const first=await hash();map.environmentId=b.id;renderer.render(map,state,viewPose(state),0,art);return {first,second:await hash()};}
  };
 });return page;}
try{
 const url=await server(resolve(root,'engine/world-of-maxxia/dist')),page=await review(url),baselineIndex=process.argv.indexOf('--baseline'),baseline=baselineIndex>=0?await review(await server(resolve(process.argv[baselineIndex+1],'dist'))):null,comparisons=[];
 for(const id of ['map_town','map_diagnostic_galleries','map_resonator_vault'])for(const mode of ['fresh','opened','completed'])for(let facing=0;facing<4;facing++){
  const args={id,mode,facing},actual=await page.evaluate(a=>window.sceneProof.render(a.id,a.facing,a.mode),args),renamed=await page.evaluate(a=>window.sceneProof.render(a.id,a.facing,a.mode,true),args);
  assert.equal(actual,renamed,`Map rename changed ${id}/${mode}/${facing}`);
  if(baseline){const previous=await baseline.evaluate(a=>window.sceneProof.render(a.id,a.facing,a.mode),args);assert.equal(actual,previous,`MP23 pixel mismatch ${id}/${mode}/${facing}`);}
  comparisons.push({...args,hash:actual});
 }
 for(const id of ['map_town','map_diagnostic_galleries','map_resonator_vault']){await page.evaluate(id=>window.sceneProof.render(id,0,'fresh'),id);await page.locator('canvas').screenshot({path:resolve(out,id+'.png')});}
 const variants=await page.evaluate(()=>window.sceneProof.variant());assert.notEqual(variants.first,variants.second,'Authored profile did not change image');await page.locator('canvas').screenshot({path:resolve(out,'profile-variant.png')});
 // Actual game boot and normal enter/movement controls on original and composed adventure.
 const boots=[];for(const query of ['?project=projects/WorldOfMaxxia/project.json','?project=projects/WorldOfMaxxia/project.json&catalogue=mp24-proof/brass-bell.maxxia-build.json']){
  const game=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];game.on('pageerror',e=>errors.push(e.message));await game.goto(url+'/'+query);await game.waitForFunction(()=>document.querySelector('#failure')?.hidden===false||document.querySelector('#loading')?.hidden===true);assert.equal(await game.locator('#failure').isVisible(),false,await game.locator('#failure-details').textContent());
  await game.waitForSelector('#welcome:not([hidden])');const buttons=await game.locator('#welcome button').allTextContents();boots.push({query,buttons,errors});await game.screenshot({path:resolve(out,query.includes('catalogue')?'pack-welcome.png':'original-welcome.png')});assert.deepEqual(errors,[]);
  await game.close();
 }
 const result={status:'pass',pixelComparisons:baseline?comparisons.length:0,renameComparisons:comparisons.length,profileVariants:variants,boots,comparisons};await writeFile(resolve(out,'browser-proof.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'pass',pixelComparisons:result.pixelComparisons,renameComparisons:result.renameComparisons,boots:boots.length}));
}finally{await browser.close();await Promise.all(servers.map(s=>new Promise(r=>s.close(r))));}
