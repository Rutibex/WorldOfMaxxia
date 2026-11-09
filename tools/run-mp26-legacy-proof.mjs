/** CPU Canvas proof of the exact built PerspectiveRenderer. npm install --no-save @napi-rs/canvas */
import {createCanvas,loadImage} from '@napi-rs/canvas';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {pathToFileURL,fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'validation/MP26-legacy');await mkdir(out,{recursive:true});
globalThis.document={createElement:()=>createCanvas(1,1)};
const json=async p=>JSON.parse(await readFile(p,'utf8')),hash=c=>createHash('sha256').update(c.getContext('2d').getImageData(0,0,440,280).data).digest('hex');
async function prepare(dist){
 const build=await json(resolve(dist,'build-info.json')),folder=resolve(dist,dirname(build.entry)),load=n=>import(pathToFileURL(resolve(folder,'wom-'+n+'.js')).href);
 const [{PerspectiveRenderer},{adaptMapDocument},{initialGridState},{viewPose},upper,town,vault]=await Promise.all([load('client-perspective-renderer'),load('shared-project-map-document'),load('shared-rules-grid'),load('shared-rules-perspective'),load('client-upper-art'),load('client-town-art'),load('client-vault-art')]);
 const environments=await json(resolve(dist,'projects/WorldOfMaxxia/database/environments.json')),catalogue=await json(resolve(dist,'assets/catalog.json')),images=new Map(),maps={};
 await Promise.all([['town',town.TOWN_TEXTURES],['upper',upper.UPPER_TEXTURES],['vault',vault.VAULT_TEXTURES]].flatMap(([folder,keys])=>keys.map(async k=>images.set(folder+'-'+k,await loadImage(resolve(dist,'assets/art/'+folder+'/'+k+'.png'))))));
 for(const p of environments.profiles)for(const id of [p.skyResourceId,...p.materials.map(m=>m.resourceId)])if(id&&!images.has('environment-'+id)){const r=catalogue.resources.find(r=>r.id===id);images.set('environment-'+id,await loadImage(resolve(dist,'assets',r.path)));}
 // Optional overrides share the same ID/resource lookup path as browser preload.
 images.set('ground-item_treasure_gem',await loadImage(resolve(dist,'assets/art/items/item_treasure_gem.png')));
 images.set('environment-proof:resource:wall',await loadImage(resolve(dist,'assets/art/upper/moss-wall.png')));
 let canvas;const scene={textures:{get:k=>({getSourceImage:()=>{assert.ok(images.has(k),'Missing '+k);return images.get(k);}}),exists:k=>images.has(k),createCanvas:(_,w,h)=>{canvas=createCanvas(w,h);return {context:canvas.getContext('2d'),refresh(){}};}},add:{image:()=>({setOrigin(){}}),graphics:()=>({lineStyle(){},strokeRect(){}})}};
 let renderer=new PerspectiveRenderer(scene,environments);
 for(const id of ['map_town','map_diagnostic_galleries','map_resonator_vault'])maps[id]=adaptMapDocument(await json(resolve(dist,'projects/WorldOfMaxxia/maps/'+id+'.json')));
 return {async render(id,mode,facing,rename=false){const map=structuredClone(maps[id]);if(rename)map.id='map_renamed_fixture';const state=initialGridState(map),art=upper.emptyUpperArt();state.facing=facing;
 if(mode!=='fresh'&&mode!=='ground'){for(const k of Object.keys(state.doors))state.doors[k]=true;for(const k of Object.keys(state.secrets))state.secrets[k]=true;}
 if(mode==='completed'){art.claimed=[...upper.UPPER_CACHES,...vault.VAULT_CACHES].map(c=>c.id);art.seenScenes=map.props.map(p=>p.id);art.flags=['flag_upper_descent_ready','flag_vault_valves'];art.triggeredTraps=(map.traps??[]).map(t=>map.id+':'+t.id);}
 if(mode==='ground'){const d=[[0,-1],[1,0],[0,1],[-1,0]][facing];art.ground=[{id:'proof_ground',mapId:map.id,x:state.x+d[0],y:state.y+d[1],corpse:false,definitionId:'item_treasure_gem',empty:false}];}
 const before=JSON.stringify({map,state,art});renderer.render(map,state,viewPose(state),0,art);assert.equal(JSON.stringify({map,state,art}),before);return hash(canvas);},
 async save(name){await writeFile(resolve(out,name),canvas.toBuffer('image/png'));},
 async variants(){const map={...structuredClone(maps.map_diagnostic_galleries),id:'map_pack_geometry',props:[],environmentId:'proof_a'},state=initialGridState(map),art=upper.emptyUpperArt(),a=structuredClone(environments.profiles.find(p=>p.scene?.renderer==='waterworks'));a.id='proof_a';a.scene={renderer:'waterworks',wallTexture:'wall',floorTexture:'floor',doorTexture:'oak-door',legacyScenery:false};const b=structuredClone(a);b.id='proof_b';b.scene.textures={wall:'proof:resource:wall'};b.scene.tintColor='#284b67';b.scene.tintStrength=.18;renderer=new PerspectiveRenderer(scene,{...environments,profiles:[...environments.profiles,a,b]});renderer.render(map,state,viewPose(state),0,art);const first=hash(canvas);await this.save('profile-brass.png');map.environmentId=b.id;renderer.render(map,state,viewPose(state),0,art);const second=hash(canvas);await this.save('profile-night.png');assert.notEqual(first,second);return {first,second};}
 };
}
const current=await prepare(resolve(root,'engine/world-of-maxxia/dist')),index=process.argv.indexOf('--baseline'),baseline=index>=0?await prepare(resolve(process.argv[index+1],'dist')):null,comparisons=[];
for(const id of ['map_town','map_diagnostic_galleries','map_resonator_vault'])for(const mode of ['fresh','opened','completed','ground'])for(let facing=0;facing<4;facing++){
 const actual=await current.render(id,mode,facing),renamed=await current.render(id,mode,facing,true);assert.equal(actual,renamed,'Map identity changes presentation');if(baseline)assert.equal(actual,await baseline.render(id,mode,facing),`MP23 pixels differ ${id}/${mode}/${facing}`);comparisons.push({id,mode,facing,hash:actual});
}
assert.ok(comparisons.some(c=>c.mode==='ground'&&c.hash!==comparisons.find(f=>f.id===c.id&&f.mode==='fresh'&&f.facing===c.facing).hash),'No ground-item fixture was visible');
for(const id of ['map_town','map_diagnostic_galleries','map_resonator_vault']){await current.render(id,'fresh',0);await current.save(id+'.png');}
const variants=await current.variants(),result={status:'pass',method:'Production compiled renderer with CPU Canvas; no browser UI verification',pixelComparisons:baseline?comparisons.length:0,renameComparisons:comparisons.length,variants,comparisons};await writeFile(resolve(out,'render-proof.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:'pass',pixelComparisons:result.pixelComparisons,renameComparisons:result.renameComparisons,variants}));
