import { defineConfig } from 'vite';
import {readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
// Editor sidecars are authoring state, never distributable game assets.
let output='';
async function removeSidecars(folder:string):Promise<void>{
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=resolve(folder,entry.name);
  if(entry.isDirectory())await removeSidecars(path);
  else if(/(?:\.bak|\.save-lock|\.tmp)$/.test(entry.name))await rm(path);
 }
}
export default defineConfig({
 base:'./',server:{allowedHosts:['terminal.local']},
 plugins:[{name:'exclude-editor-sidecars',apply:'build',configResolved(config){output=resolve(config.root,config.build.outDir);},async closeBundle(){await removeSidecars(output);}}],
 build:{target:'es2022',sourcemap:true,rollupOptions:{output:{manualChunks:{phaser:['phaser']}}}}
});
