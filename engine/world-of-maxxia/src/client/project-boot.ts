import {currentEncounterDocument} from '../shared/content/encounter-director.ts';
import {installAuthoredEncounterSeeds} from '../shared/content/encounters.ts';
import {RuntimeCatalogueSession,MAX_RUNTIME_CATALOGUE_BYTES} from '../shared/content/catalogue-build.ts';
import {readFirstlightAdapter,readCoreProvenance,assertDocumentHash,stageFirstlightOverlay,installFirstlightOverlay,assertClassicCoreReady} from '../shared/content/legacy-adapter.ts';
/** MM04 project boot: selected manifest -> map index -> Phaser-owned map document loads. */
import {readProjectManifest,ManifestError,MAX_MANIFEST_BYTES,type ProjectManifest} from '../shared/project/manifest.ts';
import {readMapIndex,locateMaps,MAX_MAP_INDEX_BYTES,type LocatedMap} from '../shared/project/map-index.ts';
import {MANIFEST_SCHEMA,CURRENT_ENGINE_VERSION} from '../shared/project/generated.ts';
import {readResourceCatalog,locateResources,MAX_RESOURCE_CATALOG_BYTES,legacyResourceUrl,requireResource,type ResourceResolver} from '../shared/project/resources.ts';
import {readEnvironments,DEFAULT_ENVIRONMENTS,MAX_ENVIRONMENT_BYTES,type EnvironmentDatabase} from '../shared/project/environments.ts';
import {readItemDatabase,installItemDatabase,MAX_ITEMS_BYTES} from '../shared/content/items.ts';
import {readClassDatabase,installClassDatabase,MAX_CLASSES_BYTES,resetClassDatabase} from '../shared/content/classes.ts';
import {ENCOUNTER_SEEDS,readEncounterGroups,readEncounterPlacements,installEncounters,resetEncounters,validateEncounterReferences,MAX_ENCOUNTER_GROUP_BYTES,MAX_ENCOUNTER_PLACEMENT_BYTES} from '../shared/content/encounters.ts';
import {newCampaign,validateCampaign,type MapRegistry,type CampaignState} from '../shared/rules/campaign.ts';
import {createDefaultParty,type PartyState} from '../shared/rules/party.ts';
import {readActorDatabase,installActorDatabase,resetActorDatabase,MAX_ACTORS_BYTES} from '../shared/content/actors.ts';
import {readProgression,installProgression,resetProgression,MAX_PROGRESSION_BYTES} from '../shared/content/progression.ts';
import {readSpellDatabase,installSpellDatabase,resetSpellDatabase,MAX_SPELLS_BYTES} from '../shared/content/spells.ts';
import {readMonsterDatabase,installMonsterDatabase,resetMonsterDatabase,MAX_MONSTERS_BYTES,MONSTERS} from '../shared/content/monsters.ts';
import {readConditionDatabase,installConditionDatabase,resetConditionDatabase,MAX_CONDITIONS_BYTES} from '../shared/content/conditions.ts';
import {readLootDatabase,readPickupDatabase,installLootDatabase,installPickupDatabase,resetLootDefinitions,validateLootReferences,MAX_LOOT_BYTES,MAX_PICKUPS_BYTES} from '../shared/content/loot.ts';
import {syncStarterHeroes} from '../shared/content/party.ts';
import {DEFAULT_PARTY,ACTORS} from '../shared/content/actors.ts';
import {isOpaque} from '../shared/rules/grid.ts';
import type {StorageLike} from '../shared/saves/campaign-store.ts';
export const LEGACY_PROJECT_ID='project_world_of_maxxia';
export interface ProjectBoot {
 catalogueHash?:string;manifest:ProjectManifest;manifestUrl:string;environments:EnvironmentDatabase;
 mapDocuments:LocatedMap[];foundationUrl:string|null;legacyContent:boolean;resourceResolver:ResourceResolver|null;itemsUrl:string|null;classesUrl:string|null;actorsUrl:string|null;progressionUrl:string|null;spellsUrl:string|null;monstersUrl?:string|null;encounterGroupsUrl?:string|null;encounterPlacementsUrl?:string|null;lootTablesUrl?:string|null;groundPickupsUrl?:string|null;
}
const relativePattern=new RegExp(MANIFEST_SCHEMA.$defs.RelativePath.pattern);
export function selectProjectUrl(href:string):URL {
 const page=new URL(href),values=page.searchParams.getAll('project');
 if(values.length===0)return new URL('WorldOfMaxxia.maxxia',new URL('./',page));
 if(values.length!==1||values[0].length>240||!relativePattern.test(values[0])||!values[0].toLowerCase().endsWith('.maxxia'))throw new ManifestError('E_PROJECT_SELECTION','$','Use one project-relative .maxxia path, such as ?project=WorldOfMaxxia.maxxia.');
 return new URL(values[0],new URL('./',page));
}
async function limitedText(response:Response,limit:number,label:string):Promise<string>{
 const declared=response.headers.get('Content-Length');
 if(declared&&Number(declared)>limit+3)throw new ManifestError('E_SIZE','$',`${label} download exceeds the ${limit/1024} KiB limit.`);
 if(!response.body)return '';
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>limit+3){await reader.cancel();throw new ManifestError('E_SIZE','$',`${label} download exceeds the ${limit/1024} KiB limit.`);}chunks.push(item.value);}}finally{reader.releaseLock();}
 const joined=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.length;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(joined);}catch{throw new ManifestError('E_JSON','$',`${label} must be valid UTF-8 JSON.`);}
}
async function getText(url:string,kind:string,limit:number,fetcher:(input:string,init?:RequestInit)=>Promise<Response>,signal:AbortSignal):Promise<string>{
 let response:Response;
 try{response=await fetcher(url,{cache:'no-store',redirect:'error',signal});}
 catch(error){if(error instanceof ManifestError)throw error;throw new ManifestError('E_PROJECT_FETCH','$',`${kind} could not be downloaded at ${url}. Check the server and path.`);}
 if(!response.ok)throw new ManifestError('E_PROJECT_HTTP','$',`${kind} could not be loaded (HTTP ${response.status}): ${url}.`);
 return limitedText(response,limit,kind);
}
export async function loadProjectBoot(href:string,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<ProjectBoot>{
 const url=selectProjectUrl(href),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const manifest=readProjectManifest(await getText(url.href,'Project manifest',MAX_MANIFEST_BYTES,fetcher,controller.signal));
  const source=manifest.content;
  let resourceResolver:ResourceResolver|null=null;
  if(typeof source.resources==='string'){
   const catalogUrl=new URL(source.resources,url).href;
   resourceResolver=locateResources(readResourceCatalog(await getText(catalogUrl,'Resource catalogue',MAX_RESOURCE_CATALOG_BYTES,fetcher,controller.signal)),catalogUrl);
  }
  const environments=typeof source.environments==='string'
   ?readEnvironments(await getText(new URL(source.environments,url).href,'Environment database',MAX_ENVIRONMENT_BYTES,fetcher,controller.signal),resourceResolver)
   :DEFAULT_ENVIRONMENTS;
  if(source.kind==='legacy-phase34'){
   const mapDocuments=[['galleries','map_diagnostic_galleries'],['town','map_town'],['vault','map_resonator_vault']].map(([field,id])=>({id,path:source[field] as string,url:new URL(source[field] as string,url).href,cacheKey:'mapdoc:'+id}));
   return {manifest,manifestUrl:url.href,environments,mapDocuments,foundationUrl:new URL(source.foundation as string,url).href,legacyContent:true,resourceResolver,itemsUrl:typeof source.items==='string'?new URL(source.items,url).href:null,classesUrl:typeof source.classes==='string'?new URL(source.classes,url).href:null,actorsUrl:typeof source.actors==='string'?new URL(source.actors,url).href:null,progressionUrl:typeof source.progression==='string'?new URL(source.progression,url).href:null,spellsUrl:typeof source.spells==='string'?new URL(source.spells,url).href:null,monstersUrl:typeof source.monsters==='string'?new URL(source.monsters,url).href:null,encounterGroupsUrl:typeof source.encounterGroups==='string'?new URL(source.encounterGroups,url).href:null,encounterPlacementsUrl:typeof source.encounterPlacements==='string'?new URL(source.encounterPlacements,url).href:null,lootTablesUrl:typeof source.lootTables==='string'?new URL(source.lootTables,url).href:null,groundPickupsUrl:typeof source.groundPickups==='string'?new URL(source.groundPickups,url).href:null};
  }
  const indexUrl=new URL(source.index as string,url).href;
  const index=readMapIndex(await getText(indexUrl,'Map index',MAX_MAP_INDEX_BYTES,fetcher,controller.signal));
  return {manifest,manifestUrl:url.href,environments,mapDocuments:locateMaps(index,indexUrl),foundationUrl:typeof source.foundation==='string'?new URL(source.foundation,url).href:null,legacyContent:false,resourceResolver,itemsUrl:typeof source.items==='string'?new URL(source.items,url).href:null,classesUrl:typeof source.classes==='string'?new URL(source.classes,url).href:null,actorsUrl:typeof source.actors==='string'?new URL(source.actors,url).href:null,progressionUrl:typeof source.progression==='string'?new URL(source.progression,url).href:null,spellsUrl:typeof source.spells==='string'?new URL(source.spells,url).href:null,monstersUrl:typeof source.monsters==='string'?new URL(source.monsters,url).href:null,encounterGroupsUrl:typeof source.encounterGroups==='string'?new URL(source.encounterGroups,url).href:null,encounterPlacementsUrl:typeof source.encounterPlacements==='string'?new URL(source.encounterPlacements,url).href:null,lootTablesUrl:typeof source.lootTables==='string'?new URL(source.lootTables,url).href:null,groundPickupsUrl:typeof source.groundPickups==='string'?new URL(source.groundPickups,url).href:null};
 }finally{clearTimeout(timer);}
}
export function createProjectCampaign(registry:MapRegistry,boot:ProjectBoot,custom?:PartyState):CampaignState {
 const manifest=boot.manifest,map=registry[manifest.start.map.id];
 if(!map)throw new ManifestError('E_REFERENCE','$.start.map.id','Starting map is not in the project map index.');
 let party=custom;
 if(!party){const manifestIds=manifest.startingParty.map(a=>a.id);
 const baselineIds=['hero_tarin','hero_vexa','hero_brindle','hero_orrin','hero_sera','hero_mora'];
 const unchanged=manifestIds.length===baselineIds.length&&manifestIds.every((id,i)=>id===baselineIds[i]);
 const ids=boot.actorsUrl&&unchanged?[...DEFAULT_PARTY]:manifestIds;for(const [i,id] of ids.entries())if(!ACTORS[id])throw new ManifestError('E_REFERENCE',`$.startingParty[${i}].id`,'Starting actor is absent from the configured actors database.');party=createDefaultParty(ids);for(const [i,id]of ids.entries())if(!Object.hasOwn(party.characters,id))throw new ManifestError('E_REFERENCE',`$.startingParty[${i}].id`,'Starting actor is absent from the configured actors database.');party.characters=Object.fromEntries(ids.map(id=>[id,party!.characters[id]]));party.order=ids;party.selectedId=ids[0];}
 if(boot.encounterGroupsUrl)validateEncounterReferences(registry);
 if(boot.lootTablesUrl||boot.groundPickupsUrl)validateLootReferences(registry);
 const state=newCampaign(registry,map.id,party),world=state.maps[map.id];
 if(isOpaque(map,world,manifest.start.x,manifest.start.y))throw new ManifestError('E_START_BLOCKED','$.start','Starting square is blocked in the selected map.');
 Object.assign(world,{x:manifest.start.x,y:manifest.start.y,facing:manifest.start.facing});
 const key=world.x+','+world.y;if(!world.visited.includes(key))world.visited.push(key);
 return validateCampaign(state,registry);
}
/** Preserve existing World of Maxxia slots; independent project identities get isolated slots. */
export function projectCampaignStorage(storage:StorageLike,projectId:string|null,catalogueHash?:string):StorageLike {
 if(catalogueHash){if(!/^[a-f0-9]{64}$/.test(catalogueHash))throw new ManifestError('E_CATALOGUE_HASH','$','Invalid catalogue storage identity.');const prefix='maxxia-catalogue:'+(projectId??LEGACY_PROJECT_ID)+':'+catalogueHash+':';return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key)};}
 if(!projectId||projectId===LEGACY_PROJECT_ID)return storage;
 const prefix='maxxia-project:'+projectId+':';
 return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key)};
}

/** All registered Phaser images in MM05 use the catalogue-aware legacy adapter. */
export function projectAssetUrl(boot:ProjectBoot,legacyPath:string,baseUrl:string):string {
 return legacyResourceUrl(boot.resourceResolver,legacyPath,baseUrl);
}

/** First fully ID-bound art reference. Legacy-only manifests retain the unchanged asset URL. */
export function projectResourceUrl(boot:ProjectBoot,id:string,legacyPath:string,baseUrl:string,allowLegacyFallback=false):string {
 if(boot.resourceResolver?.byId.has(id))return requireResource(boot.resourceResolver,id,'image').url;
 if(boot.resourceResolver&&!allowLegacyFallback)return requireResource(boot.resourceResolver,id,'image').url;
 return legacyResourceUrl(null,legacyPath,baseUrl);
}

/** Load definitions before scene preload, battle creation, equipment initialization or saves. */
export async function loadProjectItems(boot:ProjectBoot,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 if(!boot.itemsUrl)return; // Older manifests retain the bundled MM05 baseline.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const database=readItemDatabase(await getText(boot.itemsUrl,'Items database',MAX_ITEMS_BYTES,fetcher,controller.signal));
  if(boot.resourceResolver)for(const [i,item] of database.items.entries())if(item.iconResourceId){
   const icon=boot.resourceResolver.byId.get(item.iconResourceId);
   if(!icon||icon.kind!=='image')throw new ManifestError('E_ITEM_ICON',`$.items[${i}].iconResourceId`,`${item.name} references an absent or nonimage catalogue resource.`);
  }
  installItemDatabase(database);
 }
 finally{clearTimeout(timer);}
}

/** MM07: install classes before party initialization, loading saves or character creation. */
export async function loadProjectClasses(boot:ProjectBoot,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 if(!boot.classesUrl){resetClassDatabase();return;} // Legacy manifests always reset to the bundled six-class baseline.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try {installClassDatabase(readClassDatabase(await getText(boot.classesUrl,'Classes database',MAX_CLASSES_BYTES,fetcher,controller.signal)));}
 finally {clearTimeout(timer);}
}

/** Install actor seeds and catalogue portrait states after classes and items have loaded. */
export async function loadProjectActors(boot:ProjectBoot,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 if(!boot.actorsUrl){resetActorDatabase();syncStarterHeroes();return;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try {
  const db=readActorDatabase(await getText(boot.actorsUrl,'Actors database',MAX_ACTORS_BYTES,fetcher,controller.signal));
  if(boot.resourceResolver)for(const [i,p] of db.portraits.entries())for(const [state,id] of Object.entries(p.states)){
   const asset=boot.resourceResolver.byId.get(id);
   if(!asset||asset.kind!=='image')throw new ManifestError('E_ACTOR_PORTRAIT',`$.portraits[${i}].states.${state}`,`Portrait ${p.id} references a missing or nonimage asset ${id}.`);
  }
  // MM08 project-owned startingParty is authoritative when content.actors exists.
  // Manifest startingParty remains the legacy compatibility field until a later project migration.
  installActorDatabase(db);syncStarterHeroes();
 }finally{clearTimeout(timer);}
}

/** MM09: install progression before classes, actors, party validation and save restoration. */
export async function loadProjectProgression(boot:ProjectBoot,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 if(!boot.progressionUrl){resetProgression();return;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try {installProgression(readProgression(await getText(boot.progressionUrl,'Progression database',MAX_PROGRESSION_BYTES,fetcher,controller.signal)));}
 finally {clearTimeout(timer);}
}

/** MM10: install spell definitions and class-access lists before loading/creating campaign state. */
export async function loadProjectSpells(boot:ProjectBoot,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 if(!boot.spellsUrl){resetSpellDatabase();resetConditionDatabase();return;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const database=readSpellDatabase(await getText(boot.spellsUrl,'Spells database',MAX_SPELLS_BYTES,fetcher,controller.signal));
  for(const [id]of Object.entries(database.classAccess))if(!Object.hasOwn((await import('../shared/content/classes.ts')).CLASSES,id))throw new ManifestError('E_SPELL_CLASS',`$.classAccess.${id}`,`Caster class ${id} is not in the Classes database.`);
  // Condition files are explicitly declared, so legacy projects never issue surprise requests.
  if(database.conditionsFile){
   const base=boot.spellsUrl.slice(0,boot.spellsUrl.lastIndexOf('/')+1);
   installConditionDatabase(readConditionDatabase(await getText(base+database.conditionsFile,'Condition database',MAX_CONDITIONS_BYTES,fetcher,controller.signal)));
  }else resetConditionDatabase();
  installSpellDatabase(database);
 }finally{clearTimeout(timer);}
}

/** MM13: install validated monster definitions before any encounter or save is created. */
export async function loadProjectMonsters(boot:Pick<ProjectBoot,'monstersUrl'|'encounterGroupsUrl'>,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 if(!boot.monstersUrl){resetMonsterDatabase();return;}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try {
  const database=readMonsterDatabase(await getText(boot.monstersUrl,'Monsters database',MAX_MONSTERS_BYTES,fetcher,controller.signal));
  // Legacy projects without a declared group catalogue still use the original encounter IDs.
  if(!boot.encounterGroupsUrl)for(const encounter of ENCOUNTER_SEEDS)for(const enemy of encounter.enemies)if(!database.monsters.some(m=>m.id===enemy.kindId))
   throw new ManifestError('E_MONSTER_REFERENCE','$.monsters',`Existing encounter ${encounter.id} requires monster ${enemy.kindId}.`);
  installMonsterDatabase(database);
 }
 finally {clearTimeout(timer);}
}

/** MP05: shared core rule databases are installed by ordinary project loaders above;
 * only the original Firstlight projects opt in to this narrow legacy overlay.
 * The adapter owns story items/monsters, retains all historical save IDs and
 * never grants pack-content authors an implicit override route.
 */
export async function loadProjectLegacyAdapter(boot:ProjectBoot,href:string,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 const legacyIds=['project_world_of_maxxia','project_mp04_catalogue_proof'];
 if(!legacyIds.includes(boot.manifest.projectId))return;
 const root=new URL('./',new URL(href));const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 const get=(path:string,kind:string,limit:number)=>getText(new URL(path,root).href,kind,limit,fetcher,controller.signal);
 try{
  const raw=await get('projects/WorldOfMaxxia/legacy/adapter.json','Legacy adapter',16*1024);
  const adapter=readFirstlightAdapter(raw,boot.manifest.projectId);
  const provenance=readCoreProvenance(await get(adapter.coreProvenance,'Core provenance',16*1024));
  const coreNames=['classes','items','monsters','spells','conditions','progression'] as const;
  const locations:Record<string,string|null>={classes:boot.classesUrl,items:boot.itemsUrl,monsters:boot.monstersUrl??null,spells:boot.spellsUrl,progression:boot.progressionUrl};
  for(const name of coreNames)if(name!=='conditions'&&locations[name]!==new URL(`core/classic/database/${name}.json`,root).href)throw new ManifestError('E_CORE_LOCATION',`$.content.${name}`,'Firstlight must use the shared core rules database, not project-local rules.');
  // Integrity and schema checks for every shared rule document. A tampered
  // or missing core bundle is not silently replaced by bundled defaults.
  const checked=await Promise.all(coreNames.map(async name=>{
   const coreText=await get(`core/classic/database/${name}.json`,'Core '+name,name==='spells'?256*1024:512*1024);
   await assertDocumentHash(coreText,provenance.coreDatabases[name],`$.coreDatabases.${name}`);
   return {name,coreText};
  }));
  for(const {name,coreText} of checked){
   if(name==='classes')readClassDatabase(coreText);
   if(name==='items')readItemDatabase(coreText);
   if(name==='monsters')readMonsterDatabase(coreText);
   if(name==='spells')readSpellDatabase(coreText);
   if(name==='conditions')readConditionDatabase(coreText);
   if(name==='progression')readProgression(coreText);
  }
  assertClassicCoreReady();
  const [itemsText,monstersText]=await Promise.all([get(adapter.items,'Legacy items',MAX_ITEMS_BYTES),get(adapter.monsters,'Legacy monsters',MAX_MONSTERS_BYTES)]);
  await Promise.all([assertDocumentHash(itemsText,provenance.legacyOverlay.items,'$.legacyOverlay.items'),assertDocumentHash(monstersText,provenance.legacyOverlay.monsters,'$.legacyOverlay.monsters')]);
  const staged=stageFirstlightOverlay(adapter,itemsText,monstersText);
  // Protect legacy save identity: no lost/renamed IDs across the split.
  if(staged.items.items.length!==48||staged.monsters.monsters.length!==9)throw new ManifestError('E_LEGACY_PARITY','$','The separated core + campaign content no longer matches Firstlight counts.');
  installFirstlightOverlay(staged);
 }catch(error){if(error instanceof ManifestError)throw error;const e=error as {code?:string;path?:string;message?:string};throw new ManifestError(e.code??'E_LEGACY',e.path??'$',e.message??'Legacy adapter failed.');}
 finally{clearTimeout(timer);}
}

/** MM14: install reusable groups and placements after monsters, before creating/loading save state. */
export async function loadProjectEncounters(boot:Pick<ProjectBoot,'encounterGroupsUrl'|'encounterPlacementsUrl'>,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 if(!boot.encounterGroupsUrl&&!boot.encounterPlacementsUrl){resetEncounters();installAuthoredEncounterSeeds(currentEncounterDocument());return;}
 if(!boot.encounterGroupsUrl||!boot.encounterPlacementsUrl)throw new ManifestError('E_ENCOUNTER_PAIR','$.content','Both encounterGroups and encounterPlacements must be configured together.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const [groups,placements]=await Promise.all([
   getText(boot.encounterGroupsUrl,'Encounter groups',MAX_ENCOUNTER_GROUP_BYTES,fetcher,controller.signal),
   getText(boot.encounterPlacementsUrl,'Encounter placements',MAX_ENCOUNTER_PLACEMENT_BYTES,fetcher,controller.signal)]);
  const parsedGroups=readEncounterGroups(groups),parsedPlacements=readEncounterPlacements(placements);
  installEncounters(parsedGroups,parsedPlacements);installAuthoredEncounterSeeds(currentEncounterDocument());
  validateEncounterReferences();
 }finally{clearTimeout(timer);}
}

/** MM15: load both reward definitions and placed pickups before campaign state initialization. */
export async function loadProjectLoot(boot:Pick<ProjectBoot,'lootTablesUrl'|'groundPickupsUrl'>,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 // Keep MM14 and older projects working exactly as before.
 resetLootDefinitions();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  if(boot.lootTablesUrl)installLootDatabase(readLootDatabase(await getText(boot.lootTablesUrl,'Loot tables',MAX_LOOT_BYTES,fetcher,controller.signal)));
  if(boot.groundPickupsUrl)installPickupDatabase(readPickupDatabase(await getText(boot.groundPickupsUrl,'Ground pickups',MAX_PICKUPS_BYTES,fetcher,controller.signal)));
 }finally{clearTimeout(timer);}
}

/** MP04 opt-in catalogue overlay: legacy base first, staged composition before encounters/actors. */
export async function loadProjectCatalogue(boot:ProjectBoot,href:string,fetcher:(input:string,init?:RequestInit)=>Promise<Response>=(input,init)=>fetch(input,init)):Promise<void>{
 const page=new URL(href),values=page.searchParams.getAll('catalogue');if(!values.length)return;
 if(values.length!==1||values[0].length>240||!relativePattern.test(values[0])||!values[0].endsWith('.maxxia-build.json'))throw new ManifestError('E_CATALOGUE_SELECTION','$','Use one safe site-relative .maxxia-build.json catalogue path.');
 const url=new URL(values[0],new URL('./',page)),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const text=await getText(url.href,'Compiled pack catalogue',MAX_RUNTIME_CATALOGUE_BYTES,fetcher,controller.signal),session=new RuntimeCatalogueSession(undefined,boot.resourceResolver);const declared=JSON.parse(text).engineVersion;if(declared!==CURRENT_ENGINE_VERSION&&!['0.50.0','0.58.0','0.59.0','0.60.0','0.61.0','0.62.0'].includes(declared))throw new ManifestError('E_ENGINE','$.engineVersion','Rebuild this compiled catalogue for the current engine.');const installed=await session.load(text,declared);boot.resourceResolver=installed.resources;boot.catalogueHash=session.current!.catalogueHash;}
 catch(error){if(error instanceof ManifestError)throw error;const e=error as {code?:string;path?:string;message?:string};throw new ManifestError(e.code??'E_CATALOGUE',e.path??'$',e.message??'Catalogue load failed.');}finally{clearTimeout(timer);}
}
