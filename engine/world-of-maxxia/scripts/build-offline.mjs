/** Portable Phase 34 fallback build when npm registry is unavailable during handoff.
 * Uses the included Phaser 3.90 vendor ESM from the prior verified Phase 5 build,
 * and installed TypeScript (project dependency or global compiler). Normally use npm run build.
 */
import {createHash} from 'node:crypto';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {readFile,writeFile,mkdir,copyFile,stat,cp,readdir,rm} from 'node:fs/promises';
import {resolve,relative,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let ts;
try{ts=require('typescript');}catch{
  try{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');}
  catch{ts={version:'Node built-in TypeScript transform',ModuleKind:{ESNext:0},ScriptTarget:{ES2022:0},transpileModule:(source,options)=>({outputText:stripTypeScriptTypes(source,{mode:'transform',sourceUrl:options.fileName})})};}
}
// All output is reproducible; vendor inputs live outside dist.
const assets=resolve(root,'dist/assets');
await rm(resolve(root,'dist'),{recursive:true,force:true});
await mkdir(assets,{recursive:true});
for(const file of ['phaser-dduChEN6.js','phaser-5BFp2lQq.js'])
 await copyFile(resolve(root,'vendor/phaser',file),resolve(assets,file));
await import('./build-interface-gallery.mjs');
await import('./build-town-gallery.mjs');
await import('./build-npc-gallery.mjs');
await import('./build-upper-gallery.mjs');
await import('./build-vault-gallery.mjs');
await import('./build-enemy-gallery.mjs');
await import('./build-effects-gallery.mjs');
await import('./build-status-gallery.mjs');

for(const file of ['phaser-dduChEN6.js','phaser-5BFp2lQq.js']){
 try{await stat(resolve(assets,file));}catch{throw new Error(`Missing portable Phaser ESM vendor ${file}; use npm ci and npm run build instead.`);}
}
async function sources(dir){const files=[];for(const entry of await readdir(resolve(root,dir),{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())files.push(...await sources(path));else if(path.endsWith('.ts'))files.push(path);}return files;}
const moduleFiles=(await sources('src')).sort();
const release=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const hash=createHash('sha256').update(String(ts.version));for(const file of [...moduleFiles,'src/client/style.css','index.html','scripts/build-offline.mjs'])hash.update(file).update(await readFile(resolve(root,file)));
const buildId=hash.digest('hex').slice(0,16),runtimeName='runtime-'+buildId,runtimeAssets=resolve(assets,runtimeName);
for(const entry of await readdir(assets,{withFileTypes:true}))if(entry.isDirectory()&&entry.name.startsWith('runtime-'))await rm(resolve(assets,entry.name),{recursive:true,force:true});
await mkdir(runtimeAssets,{recursive:true});
for(const entry of await readdir(assets,{withFileTypes:true}))if(entry.isFile()&&(entry.name.startsWith('wom-')||entry.name==='maxxia-phase29.css'))await rm(resolve(assets,entry.name));
const renamed=file=>`wom-${file.replace(/^src\//,'').replace(/\.ts$/,'.js').replaceAll('/','-')}`;
for(const file of moduleFiles){
 let source=await readFile(resolve(root,file),'utf8');
 let js=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,verbatimModuleSyntax:true}}).outputText;
 js=js.replace(/(from\s*['"]|import\s*\(\s*['"])(\.{1,2}\/[^'"\n]+\.ts)(['"])/g,(match,start,spec,end)=>{
   const dest=relative(root,resolve(root,dirname(file),spec));
   if(!moduleFiles.includes(dest))throw new Error(`Unknown source module ${dest} referenced from ${file}`);
   return `${start}./${renamed(dest)}${end}`;
 });
 // JSON module imports stay authoritative in TypeScript and are copied to the portable runtime folder.
 js=js.replace(/(from\s*['"])(\.{1,2}\/[^'"\n]+\.json)(['"]\s*with\s*\{\s*type\s*:\s*['"]json['"]\s*\})/g,(match,start,spec,end)=>{
  const sourceJson=relative(root,resolve(root,dirname(file),spec));
  const destination=sourceJson.replace(/^src\//,'wom-').replaceAll('/','-');
  // The copy is performed once outside this synchronous replacement.
  return start+'./'+destination+end;
 });
 if(file==='src/client/main.ts'){
  js=js.replace(/^import ['"]\.\/style\.css['"];?\s*/m,''); // Browser styles are provided by dist/index.html, not JS CSS imports.
  js=js.replaceAll("import('phaser')","import('./phaser-dduChEN6.js')").replaceAll("import(\"phaser\")","import('./phaser-dduChEN6.js')");
  js=js.replace("(await import('./phaser-dduChEN6.js')).default","(await import('./phaser-dduChEN6.js')).p.default");
  js=js.replaceAll('import.meta.env.BASE_URL',"'./'");
 }
 if(file==='src/client/main.ts')js=js.replaceAll('./phaser-dduChEN6.js','../phaser-dduChEN6.js');
 await writeFile(resolve(runtimeAssets,renamed(file)),js);
}
await copyFile(resolve(root,'src/shared/content/items-default.json'),resolve(runtimeAssets,'wom-shared-content-items-default.json'));
await copyFile(resolve(root,'src/shared/content/classes-default.json'),resolve(runtimeAssets,'wom-shared-content-classes-default.json'));
await copyFile(resolve(root,'src/shared/content/actors-default.json'),resolve(runtimeAssets,'wom-shared-content-actors-default.json'));
await copyFile(resolve(root,'src/shared/content/progression-default.json'),resolve(runtimeAssets,'wom-shared-content-progression-default.json'));
await copyFile(resolve(root,'src/shared/content/spells-default.json'),resolve(runtimeAssets,'wom-shared-content-spells-default.json'));
await copyFile(resolve(root,'src/shared/content/conditions-default.json'),resolve(runtimeAssets,'wom-shared-content-conditions-default.json'));
await copyFile(resolve(root,'src/shared/content/monsters-default.json'),resolve(runtimeAssets,'wom-shared-content-monsters-default.json'));
await copyFile(resolve(root,'src/shared/content/encounter-groups-default.json'),resolve(runtimeAssets,'wom-shared-content-encounter-groups-default.json'));
await copyFile(resolve(root,'src/shared/content/encounter-placements-default.json'),resolve(runtimeAssets,'wom-shared-content-encounter-placements-default.json'));
await copyFile(resolve(root,'src/shared/content/loot-default.json'),resolve(runtimeAssets,'wom-shared-content-loot-default.json'));
await copyFile(resolve(root,'src/shared/content/pickups-default.json'),resolve(runtimeAssets,'wom-shared-content-pickups-default.json'));
const sourceStyle=await readFile(resolve(root,'src/client/style.css'),'utf8');
await writeFile(resolve(runtimeAssets,'maxxia.css'),sourceStyle.replaceAll("url('/assets/","url('../"));
await cp(resolve(root,'public'),resolve(root,'dist'),{recursive:true,filter:path=>!/(?:\.bak|\.save-lock|\.tmp)$/.test(basename(path))});
let html=await readFile(resolve(root,'index.html'),'utf8');
html=html.replace('src="/src/client/main.ts"',`src="./assets/${runtimeName}/${renamed('src/client/main.ts')}"`)
  .replace('</head>',`<link rel="stylesheet" href="./assets/${runtimeName}/maxxia.css"></head>`)
  .replace('<html ',`<html data-release="${release}" data-runtime-build="${buildId}" `);
await writeFile(resolve(root,'dist/index.html'),html);
await writeFile(resolve(root,'dist/build-info.json'),JSON.stringify({release,buildId,entry:`assets/${runtimeName}/${renamed('src/client/main.ts')}`,styles:`assets/${runtimeName}/maxxia.css`},null,2));
for(const file of ['galleries.json','town.json','vault.json'])await copyFile(resolve(root,'public/content',file),resolve(root,'dist/content',file));
console.log(`Built MP27 standalone browser site in dist/ with TypeScript ${ts.version}.`);
