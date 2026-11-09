/** Optional CPU visual QA. Supply a resolvable @napi-rs/canvas module path if not installed.
 * node scripts/render-town-review.mjs /path/to/node_modules/@napi-rs/canvas
 * Renders the production town painter, not a browser/gameplay screenshot.
 */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {TownEnvironment} from '../src/client/town-environment.ts';
import {TOWN_TEXTURES,townAsset,validateTownArt} from '../src/client/town-art.ts';
import {initialGridState,isOpaque,DIRECTIONS} from '../src/shared/rules/grid.ts';
import {viewPose} from '../src/shared/rules/perspective.ts';
const require=createRequire(import.meta.url),{createCanvas,loadImage,GlobalFonts}=require(process.argv[2]||'@napi-rs/canvas');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
GlobalFonts.registerFromPath(resolve(root,'art-source/fonts/DejaVuSerif.ttf'),'MaxxiaSerif');
const map=JSON.parse(await readFile(resolve(root,'public/content/town.json'),'utf8'));validateTownArt(map);
const images=Object.fromEntries(await Promise.all(TOWN_TEXTURES.map(async key=>[key,await loadImage(resolve(root,'public',townAsset(key)))])));
const painter=new TownEnvironment(images,createCanvas),c=createCanvas(440,280),ctx=c.getContext('2d'),initial=initialGridState(map);
let frames=0;const start=performance.now(),before=JSON.stringify(map);
for(const open of [false,true]){
 const state={...initial,doors:Object.fromEntries(map.doors.map(d=>[d.id,open]))},serialized=JSON.stringify(state);
 for(let y=0;y<map.rows.length;y++)for(let x=0;x<map.rows[0].length;x++)if(!isOpaque(map,state,x,y))for(let facing=0;facing<4;facing++){
  const view={...state,x,y,facing};painter.render(ctx,map,view,viewPose(view));const data=ctx.getImageData(0,0,440,280).data;
  for(let i=3;i<data.length;i+=4)assert.equal(data[i],255,`Unpainted pixel at ${x},${y},${facing}`);frames++;
 }
 assert.equal(JSON.stringify(state),serialized,'rendering mutated grid state');
}
assert.equal(JSON.stringify(map),before,'rendering mutated authored map');
const samples=[{name:'Town arrival',...map.spawn},...map.props.filter(p=>['sign_npc_tessa_bell','sign_npc_orro_vane','sign_npc_sister_vale','sign_npc_pell_glass','scene_well','scene_north_clock','scene_cistern_stair'].includes(p.id)).map(p=>{
 const candidates=[{x:p.x,y:p.y+1,facing:0},{x:p.x-1,y:p.y,facing:1},{x:p.x,y:p.y-1,facing:2},{x:p.x+1,y:p.y,facing:3}];return {name:p.name,...candidates.find(v=>!isOpaque(map,initial,v.x,v.y))};
})];
await mkdir(resolve(root,'docs/town-review'),{recursive:true});
const contact=createCanvas(880,320*Math.ceil(samples.length/2)),g=contact.getContext('2d');g.fillStyle='#101923';g.fillRect(0,0,contact.width,contact.height);
for(let i=0;i<samples.length;i++){
 const sample=samples[i],state={...initial,...sample};painter.render(ctx,map,state,viewPose(state));
 await writeFile(resolve(root,`docs/town-review/view-${i}.png`),c.toBuffer('image/png'));
 const x=i%2*440,y=Math.floor(i/2)*320;g.drawImage(c,x,y);g.fillStyle='#efce91';g.font='13px MaxxiaSerif';g.fillText(sample.name+' · production town painter',x+8,y+299);g.fillStyle='#bdc8c9';g.font='10px MaxxiaSerif';g.fillText('CPU render — not browser/gameplay screenshot',x+8,y+314);
}
await writeFile(resolve(root,'docs/PHASE22_TOWN_RENDER_REVIEW.png'),contact.toBuffer('image/png'));
const report={frames,gateVariants:2,facings:4,elapsedMs:Math.round(performance.now()-start),mapUnchanged:true,stateUnchanged:true,completeOpaqueCoverage:true,samples:samples.length,renderer:'production TownEnvironment on @napi-rs/canvas; no browser'};
await writeFile(resolve(root,'docs/TOWN_RENDER_CHECK.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
