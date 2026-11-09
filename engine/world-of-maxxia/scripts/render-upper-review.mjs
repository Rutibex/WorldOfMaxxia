/** Optional CPU visual QA of the exact production painter. Not a browser/gameplay capture. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {UpperEnvironment} from '../src/client/upper-environment.ts';
import {UPPER_TEXTURES,UPPER_CACHES,upperAsset,emptyUpperArt,validateUpperArt} from '../src/client/upper-art.ts';
import {initialGridState,isOpaque} from '../src/shared/rules/grid.ts';
import {viewPose} from '../src/shared/rules/perspective.ts';
const require=createRequire(import.meta.url),{createCanvas,loadImage,GlobalFonts}=require(process.argv[2]||'@napi-rs/canvas'),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
GlobalFonts.registerFromPath(resolve(root,'art-source/fonts/DejaVuSerif.ttf'),'MaxxiaSerif');
const map=JSON.parse(await readFile(resolve(root,'public/content/galleries.json'),'utf8'));validateUpperArt(map);
const images=Object.fromEntries(await Promise.all(UPPER_TEXTURES.map(async key=>[key,await loadImage(resolve(root,'public',upperAsset(key)))])));
const painter=new UpperEnvironment(images,createCanvas),c=createCanvas(440,280),ctx=c.getContext('2d'),initial=initialGridState(map),fresh=emptyUpperArt();
const opened={...initial,doors:Object.fromEntries(map.doors.map(d=>[d.id,true])),secrets:Object.fromEntries(map.secrets.map(s=>[s.id,true]))};
const completed={...emptyUpperArt(),claimed:UPPER_CACHES.map(c=>c.id),seenScenes:['scene_upper_ledger','scene_upper_tools'],flags:['flag_upper_descent_ready'],triggeredTraps:map.traps.map(t=>map.id+':'+t.id),fountainDays:Object.fromEntries(map.fountains.map(f=>[map.id+':'+f.id,1]))};
let frames=0;const start=performance.now(),mapBytes=JSON.stringify(map);
for(const [state,art] of [[initial,fresh],[opened,completed]]){
 const before=JSON.stringify({state,art});for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(!isOpaque(map,state,x,y))for(let facing=0;facing<4;facing++){
  const world={...state,x,y,facing};painter.render(ctx,map,world,viewPose(world),art,0);const pixels=ctx.getImageData(0,0,440,280).data;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)throw Error(`Unpainted pixel at ${x},${y},${facing}`);frames++;
 }
 assert.equal(JSON.stringify({state,art}),before,'production painter changed inputs');
}
assert.equal(JSON.stringify(map),mapBytes);
const sampleDefs=[{name:'Upper Cistern arrival',...map.spawn,mode:'fresh'},...map.props.filter(p=>['scene_upper_copper','scene_upper_glass','scene_upper_waterwheel','scene_upper_ledger','scene_upper_descent'].includes(p.id)).map(p=>{
 const mode=p.id==='scene_upper_ledger'?'completed':'fresh',state=mode==='fresh'?initial:opened;
 const options=[{x:p.x,y:p.y+1,facing:0},{x:p.x-1,y:p.y,facing:1},{x:p.x,y:p.y-1,facing:2},{x:p.x+1,y:p.y,facing:3}];return {name:p.name,mode,...options.find(v=>!isOpaque(map,state,v.x,v.y))};
}),{name:'Revealed secret passage',x:3,y:7,facing:1,mode:'completed'},{name:'Open stair / spent resources',x:13,y:14,facing:0,mode:'completed'}];
await mkdir(resolve(root,'docs/upper-review'),{recursive:true});const contact=createCanvas(880,320*Math.ceil(sampleDefs.length/2)),g=contact.getContext('2d');g.fillStyle='#101923';g.fillRect(0,0,contact.width,contact.height);
for(let i=0;i<sampleDefs.length;i++){
 const s=sampleDefs[i],base=s.mode==='fresh'?initial:opened,art=s.mode==='fresh'?fresh:completed,world={...base,...s};painter.render(ctx,map,world,viewPose(world),art,0);await writeFile(resolve(root,`docs/upper-review/view-${i}.png`),c.toBuffer('image/png'));
 const x=i%2*440,y=Math.floor(i/2)*320;g.drawImage(c,x,y);g.fillStyle='#eacb92';g.font='13px MaxxiaSerif';g.fillText(s.name+' · '+s.mode,x+8,y+299);g.fillStyle='#bdc9c9';g.font='10px MaxxiaSerif';g.fillText('Production painter CPU render — not browser screenshot',x+8,y+314);
}
await writeFile(resolve(root,'docs/PHASE25_UPPER_RENDER_REVIEW.png'),contact.toBuffer('image/png'));
const report={frames,facings:4,stateVariants:2,elapsedMs:Math.round(performance.now()-start),fullOpaqueCoverage:true,mapUnchanged:true,stateUnchanged:true,samples:sampleDefs.length,renderer:'production UpperEnvironment on @napi-rs/canvas; not browser'};await writeFile(resolve(root,'docs/UPPER_RENDER_CHECK.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
