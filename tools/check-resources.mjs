/** Offline asset integrity check: used by MM05 authoring and package verification. */
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readResourceCatalog} from '../engine/world-of-maxxia/src/shared/project/resources.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../engine/world-of-maxxia/public');
let total=0;
for(const manifestPath of ['WorldOfMaxxia.maxxia','projects/ExpansionProof/ExpansionProof.maxxia','projects/SingleMapProof/SingleMapProof.maxxia']){
 const manifest=JSON.parse(await readFile(resolve(root,manifestPath),'utf8'));
 const path=resolve(root,dirname(manifestPath),manifest.content.resources);
 const catalog=readResourceCatalog(await readFile(path,'utf8'));
 const anchor=await realpath(dirname(path));
 for(const entry of catalog.resources){
  const dest=resolve(anchor,entry.path);
  if(!dest.startsWith(anchor+sep))throw Error('Outside catalogue directory: '+entry.id);
  const real=await realpath(dest);
  if(!real.startsWith(anchor+sep))throw Error('Symlink escapes catalogue directory: '+entry.id);
  if(!(await stat(real)).isFile())throw Error('Not a file: '+entry.id);
  total++;
 }
 console.log(`${manifest.projectId}: ${catalog.resources.length} validated catalogue resources`);
}
console.log(`MM05 resource filesystem check PASS (${total} assets)`);
