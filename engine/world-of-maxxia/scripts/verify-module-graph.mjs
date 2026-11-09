/** Release-only sanity check: all static/dynamic ESM specifiers and linked styles resolve.
 * Complements (does not replace) a real browser test. */
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist'),html=await readFile(resolve(root,'index.html'),'utf8');
const sources=[...html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)].map(m=>m[1]);
for(const path of sources){await stat(resolve(root,path));}
const jsdir=resolve(root,'assets');
async function modules(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())result.push(...(await modules(resolve(dir,e.name))).map(n=>e.name+'/'+n));else if(e.name.endsWith('.js'))result.push(e.name);}return result;}
const filenames=await modules(jsdir);
let checked=0,refs=0;
for(const filename of filenames){
 const full=resolve(jsdir,filename),content=await readFile(full,'utf8');
 // Dynamic and static import/export. Local modules only, network intentionally unsupported.
 for(const m of content.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"\n]+)\1/g)){
  const destination=resolve(dirname(full),m[2]);
  assert(destination.startsWith(root+'/'),'ESM escapes the dist directory');
  await stat(destination);refs++;
 }
 // The offline bundle links CSS from HTML, never attempts to import a CSS file as ESM.
 if(filename.endsWith('wom-client-main.js')){
  assert(!/import\s+['"]\.\/style\.css['"]/.test(content),'Unresolved source CSS import');
  for(const required of ['wom-shared-rules-campaign.js','wom-shared-saves-campaign-store.js','wom-shared-rules-combat.js','wom-shared-rules-noncaster.js','wom-shared-rules-magic.js','wom-shared-rules-inventory.js','wom-shared-rules-expedition.js','wom-shared-rules-services.js'])assert(content.includes(required),`Missing client import ${required}`);
 }
 checked++;
}
assert(html.includes('/runtime-')&&html.includes('/maxxia.css'),'Fingerprinted runtime and stylesheet missing from index');
console.log(`PASS: ${checked} browser ESM files and ${refs} relative ESM imports checked; HTML references and fingerprinted stylesheet exist.`);
