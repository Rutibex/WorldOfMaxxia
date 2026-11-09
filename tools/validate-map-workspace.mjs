/** Canonical save guard for the native geometry editor. JSON on stdin, no files mutated. */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {readEnvironments,validateEnvironmentMaps} from '../engine/world-of-maxxia/src/shared/project/environments.ts';
import {readResourceCatalog,locateResources} from '../engine/world-of-maxxia/src/shared/project/resources.ts';
import {readMapIndex,validateIndexedMaps} from '../engine/world-of-maxxia/src/shared/project/map-index.ts';
export function validateWorkspace(value){
 const index=readMapIndex(JSON.stringify(value.index));
 const registry=validateIndexedMaps(index.maps,index.maps.map(m=>value.maps[m.id]));
 if(value.environments){
  const resolver=value.resourceCatalog?locateResources(readResourceCatalog(JSON.stringify(value.resourceCatalog)),'https://maxxia.invalid/catalog.json'):null;
  const database=readEnvironments(JSON.stringify(value.environments),resolver);
  validateEnvironmentMaps(index.maps.map(m=>value.maps[m.id]),database);
 }
 const start=value.start;
 if(start){const map=registry[start.map.id];if(!map||map.rows[start.y]?.[start.x]!=='.')throw new Error('Starting position is blocked or missing.');}
 return registry;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{validateWorkspace(JSON.parse(fs.readFileSync(0,'utf8')));console.log('Map index, geometry, objects and transfers validated.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
