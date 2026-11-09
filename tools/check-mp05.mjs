/** MP05 independent, dependency-free core extraction and legacy identity audit. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publicDir=resolve(root,'engine/world-of-maxxia/public');
const path=(dir,name)=>resolve(publicDir,dir,name+'.json');
const text=async file=>readFile(file,'utf8'),json=async file=>JSON.parse(await text(file));
const sha=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const shared='core/classic/database',story='projects/WorldOfMaxxia/legacy/database',original='projects/WorldOfMaxxia/database';
const provenance=await json(resolve(publicDir,'core/classic/provenance.json'));
const adapter=await json(resolve(publicDir,'projects/WorldOfMaxxia/legacy/adapter.json'));
assert.equal(provenance.rulesId,'core:rules:classic');assert.equal(provenance.rulesVersion,'1.0.0');
assert.equal((await json(resolve(root,'toolkit/core/pack.json'))).version,'1.0.1');
assert.equal(adapter.adapterId,'firstlight');assert(adapter.projectIds.includes('project_world_of_maxxia'));assert(adapter.projectIds.includes('project_mp04_catalogue_proof'));
let docs=0;
for(const name of ['classes','items','monsters','spells','conditions','progression']){
 const core=path(shared,name),old=path(original,name);
 assert.equal(await sha(core),provenance.coreDatabases[name],`core ${name} digest`);
 assert.equal(await sha(old),provenance.originalDatabases[name],`original ${name} digest`);
 assert.deepEqual(await readFile(core),await readFile(resolve(root,'toolkit/core/runtime/database',name+'.json')),`toolkit/runtime mirror ${name}`);
 const parsed=await json(core),was=await json(old);
 if(name==='items'||name==='monsters'){
  const local=path(story,name);assert.equal(await sha(local),provenance.legacyOverlay[name],`legacy ${name} digest`);
  const extra=await json(local);assert.deepEqual([...parsed[name],...extra[name]],was[name],`core+adapter identity/data parity ${name}`);
  assert.deepEqual(extra[name].map(x=>x.id).sort(),adapter[name==='items'?'expectedItemIds':'expectedMonsterIds'],`expected ${name} IDs`);
 }else assert.deepEqual(parsed,was,`shared ${name} identical to legacy rules`);
 docs++;
}
assert.deepEqual(await readFile(resolve(publicDir,'core/classic/provenance.json')),await readFile(resolve(root,'toolkit/core/runtime/provenance.json')));
for(const name of ['WorldOfMaxxia.maxxia','CatalogueProof.maxxia']){
 const m=await json(resolve(publicDir,name));
 for(const k of ['items','classes','monsters','spells','progression'])assert.equal(m.content[k],`core/classic/database/${k}.json`);
 assert.equal(m.content.actors,'projects/WorldOfMaxxia/database/actors.json');
 assert.equal(m.content.encounterPlacements,name==='CatalogueProof.maxxia'?'mp04-proof/encounter-placements.json':'projects/WorldOfMaxxia/maps/encounter-placements.json');
}
const main=await text(resolve(root,'engine/world-of-maxxia/src/client/main.ts'));
assert(main.indexOf('await loadProjectMonsters(projectBoot)')<main.indexOf('await loadProjectLegacyAdapter(projectBoot,location.href)'));
assert(main.indexOf('await loadProjectLegacyAdapter(projectBoot,location.href)')<main.indexOf('await loadProjectCatalogue(projectBoot,location.href)'));
console.log(`PASS: MP05 extraction; ${docs} owned core databases, 40 general + 8 adventure items, 2 core + 7 adventure monsters; unchanged historical IDs, source/toolkit mirrors, Firstlight and catalogue-proof manifest ownership.`);
