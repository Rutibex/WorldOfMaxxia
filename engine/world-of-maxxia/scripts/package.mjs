import {cp,mkdir,rm,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=resolve(root,'release/World-of-Maxxia-Phase34');
await access(resolve(root,'dist/index.html'));
await rm(destination,{recursive:true,force:true});await mkdir(destination,{recursive:true});
for(const name of ['src','public','art-source','docs','tests','scripts','dist','package.json','package-lock.json','tsconfig.json','tsconfig.check-local.json','tsconfig.check-client-offline.json','vite.config.ts','index.html','server.mjs','Start-World-of-Maxxia.cmd','start-world-of-maxxia.sh','README.md','PROJECT_STATE.md','CHANGELOG.md','VERIFICATION.md','PHASE31_NOTES.md','PHASE32A_NOTES.md','PHASE32B_NOTES.md','PHASE32C_NOTES.md','PHASE32D_NOTES.md','PHASE32E_NOTES.md','PHASE32F_NOTES.md','PHASE32G_NOTES.md','PHASE33_NOTES.md','PHASE34_NOTES.md','THIRD_PARTY_NOTICES.md','licenses']) await cp(resolve(root,name),resolve(destination,name),{recursive:true});
console.log(`Packaged source and ready-to-serve build: ${destination}`);
