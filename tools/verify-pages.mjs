/** Static HTML and asset URL checks for project-subpath GitHub Pages hosting. */
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','_site');
for(const name of ['index.html','play/index.html']){
 const page=resolve(root,name), html=await readFile(page,'utf8');
 const refs=[...html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)].map(m=>m[1].split('?')[0]);
 for(const ref of refs) await stat(resolve(dirname(page),ref));
 assert(!/\b(?:href|src)="\/(?:assets|projects|content)\//.test(html),`${name} uses a root-absolute game asset`);
 console.log(`PASS: ${name}: ${refs.length} local links/assets resolve.`);
}
const build=JSON.parse(await readFile(resolve(root,'play/build-info.json'),'utf8'));
await stat(resolve(root,'play',build.entry));
await stat(resolve(root,'play',build.styles));
const css=await readFile(resolve(root,'play',build.styles),'utf8');
assert(!/url\(['"]?\/assets\//.test(css),'Root-absolute CSS asset URL will break under repository prefix.');
console.log(`PASS: MP27 Pages game build ${build.buildId}, portable asset URLs, landing page + /play/ ready.`);
