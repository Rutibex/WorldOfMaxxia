/** Optional CPU visual QA of the exact production vault painter. Not a browser/gameplay capture. */
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {VaultEnvironment} from '../src/client/vault-environment.ts';
import {VAULT_TEXTURES,VAULT_CACHES,vaultAsset,validateVaultArt} from '../src/client/vault-art.ts';
import {emptyUpperArt} from '../src/client/upper-art.ts';
import {initialGridState,isOpaque} from '../src/shared/rules/grid.ts';
import {viewPose} from '../src/shared/rules/perspective.ts';
const require=createRequire(import.meta.url),{createCanvas,loadImage,GlobalFonts}=require(process.argv[2]||'@napi-rs/canvas'),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
GlobalFonts.registerFromPath(resolve(root,'art-source/fonts/DejaVuSerif.ttf'),'MaxxiaSerif');
const map=JSON.parse(await readFile(resolve(root,'public/content/vault.json'),'utf8'));validateVaultArt(map);
const images=Object.fromEntries(await Promise.all(VAULT_TEXTURES.map(async key=>[key,await loadImage(resolve(root,'public',vaultAsset(key)))])));
const painter=new VaultEnvironment(images,createCanvas),c=createCanvas(440,280),ctx=c.getContext('2d'),initial=initialGridState(map),fresh=emptyUpperArt();
const aligned={...initial,doors:Object.fromEntries(map.doors.map(d=>[d.id,true]))};
const completed={...emptyUpperArt(),claimed:VAULT_CACHES.map(c=>c.id),seenScenes:['scene_vault_copper','scene_vault_moon','scene_vault_glass','scene_vault_echo','scene_vault_regulator'],flags:['flag_vault_valves','flag_bell_heart_defeated'],triggeredTraps:map.traps.map(t=>map.id+':'+t.id),fountainDays:Object.fromEntries(map.fountains.map(f=>[map.id+':'+f.id,1])),questItems:['item_quest_regulator'],valveSequence:['scene_vault_copper','scene_vault_moon','scene_vault_glass']};
let frames=0;const start=performance.now(),mapBytes=JSON.stringify(map);
for(const [state,art] of [[initial,fresh],[aligned,{...fresh,flags:['flag_vault_valves'],valveSequence:['scene_vault_copper','scene_vault_moon','scene_vault_glass']}],[{...aligned,secrets:Object.fromEntries(map.secrets.map(s=>[s.id,true]))},completed]]){
 const before=JSON.stringify({state,art});for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(!isOpaque(map,state,x,y))for(let facing=0;facing<4;facing++){
  const world={...state,x,y,facing};painter.render(ctx,map,world,viewPose(world),art,0);const pixels=ctx.getImageData(0,0,440,280).data;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]!==255)throw Error(`Unpainted pixel at ${x},${y},${facing}`);frames++;
 }
 assert.equal(JSON.stringify({state,art}),before,'production painter changed inputs');
}
assert.equal(JSON.stringify(map),mapBytes);
const choose=(target,state)=>[{x:target.x,y:target.y+1,facing:0},{x:target.x-1,y:target.y,facing:1},{x:target.x,y:target.y-1,facing:2},{x:target.x+1,y:target.y,facing:3}].find(v=>!isOpaque(map,state,v.x,v.y));
const sampleDefs=[
 {name:'Vault arrival',...map.spawn,mode:'fresh'},
 ...map.props.filter(p=>['scene_vault_maintenance','scene_vault_copper','scene_vault_echo','scene_vault_regulator','scene_vault_warning'].includes(p.id)).map(p=>({name:p.name,mode:p.id==='scene_vault_regulator'?'completed':p.id==='scene_vault_warning'?'aligned':'fresh',...choose(p,p.id==='scene_vault_regulator'?{...aligned,secrets:Object.fromEntries(map.secrets.map(s=>[s.id,true]))}:p.id==='scene_vault_warning'?aligned:initial)})),
 {name:'Shortcut opened',mode:'completed',x:4,y:12,facing:1},
 {name:'Rest alcove spent spring',mode:'completed',x:3,y:12,facing:0}
];
await mkdir(resolve(root,'docs/vault-review'),{recursive:true});const contact=createCanvas(880,320*Math.ceil(sampleDefs.length/2)),g=contact.getContext('2d');g.fillStyle='#101923';g.fillRect(0,0,contact.width,contact.height);
for(let i=0;i<sampleDefs.length;i++){
 const s=sampleDefs[i],base=s.mode==='fresh'?initial:s.mode==='aligned'?aligned:{...aligned,secrets:Object.fromEntries(map.secrets.map(v=>[v.id,true]))},art=s.mode==='fresh'?fresh:s.mode==='aligned'?{...fresh,flags:['flag_vault_valves'],valveSequence:['scene_vault_copper','scene_vault_moon','scene_vault_glass']}:completed,world={...base,...s};
 painter.render(ctx,map,world,viewPose(world),art,0);await writeFile(resolve(root,`docs/vault-review/view-${i}.png`),c.toBuffer('image/png'));
 const x=i%2*440,y=Math.floor(i/2)*320;g.drawImage(c,x,y);g.fillStyle='#eacb92';g.font='13px MaxxiaSerif';g.fillText(s.name+' · '+s.mode,x+8,y+299);g.fillStyle='#bdc9c9';g.font='10px MaxxiaSerif';g.fillText('Production painter CPU render — not browser screenshot',x+8,y+314);
}
await writeFile(resolve(root,'docs/PHASE26_VAULT_RENDER_REVIEW.png'),contact.toBuffer('image/png'));
const report={frames,facings:4,stateVariants:3,elapsedMs:Math.round(performance.now()-start),fullOpaqueCoverage:true,mapUnchanged:true,stateUnchanged:true,samples:sampleDefs.length,renderer:'production VaultEnvironment on @napi-rs/canvas; not browser'};await writeFile(resolve(root,'docs/VAULT_RENDER_CHECK.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
