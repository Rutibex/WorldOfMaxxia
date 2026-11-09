/** MM16 safe migration. No file is changed without an explicit destination folder.
 * Usage: node --experimental-strip-types tools/migrate-maps-mm16.mjs INPUT.json OUTPUT.json
 * The input stays untouched. Existing output is never overwritten.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {importLegacyMap,serializeMapDocument,normalizeMapDocument} from '../engine/world-of-maxxia/src/shared/project/map-document.ts';
import {isDeepStrictEqual} from 'node:util';
const [source,destination]=process.argv.slice(2);
if(!source||!destination||process.argv.length!==4){console.error('Usage: node --experimental-strip-types tools/migrate-maps-mm16.mjs INPUT.json OUTPUT.json');process.exit(2);}
const inputPath=resolve(source),outputPath=resolve(destination);
if(inputPath===outputPath)throw new Error('Never overwrite the input map; choose a different output path.');
const legacy=JSON.parse(await readFile(inputPath,'utf8'));
const imported=importLegacyMap(legacy),converted=normalizeMapDocument(imported);
for(const field of ['id','name','rows','spawn','doors','props','secrets','traps','fountains','portals']){
 if(Object.hasOwn(legacy,field)&&!isDeepStrictEqual(legacy[field],converted[field]))throw new Error('Semantic round-trip mismatch: '+field);
}
await writeFile(outputPath,serializeMapDocument(imported),{flag:'wx'});
console.log('Created '+outputPath+' from '+inputPath+' (original unchanged).');
