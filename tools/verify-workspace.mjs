/** Public release workspace smoke check; avoids private phase handoff ledgers. */
import {access,readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const workspace=await read('package.json');
const engine=await read('engine/world-of-maxxia/package.json');
assert.equal(workspace.version,'0.27.0-mp27');
assert.equal(engine.version,'0.72.0');
assert.equal(workspace.scripts['build:game'],'npm --prefix engine/world-of-maxxia run build:offline');
for(const path of [
  'engine/world-of-maxxia/index.html',
  'engine/world-of-maxxia/src/client/main.ts',
  'engine/world-of-maxxia/public/WorldOfMaxxia.maxxia',
  'editor/MaxxiaMaker.sln',
  'contracts/schemas/project-manifest-v1.schema.json',
  'toolkit/content.mjs',
  'tools/maxxia.mjs',
  'docs/MP27/AUTHORING.md',
  'examples/mp27/perception-lab',
  'website/index.html',
  '.github/workflows/pages.yml',
]) await access(resolve(root,path));
assert((await stat(resolve(root,'engine/world-of-maxxia/public/mp27-proof'))).isDirectory());
console.log(`PASS: public release workspace ${workspace.version}, engine ${engine.version}; source, editor, toolkit, examples and Pages assets present.`);
