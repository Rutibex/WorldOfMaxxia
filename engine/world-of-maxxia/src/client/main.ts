import {showPuzzle} from './puzzle-screen.ts';
import {nearbyPuzzles} from '../shared/rules/perception.ts';
import {sceneSpriteInstances} from '../shared/rules/sprite-state.ts';
import {usableAbilities, poolCurrent,checkAbility} from '../shared/rules/abilities.ts';
import {currentEffectDocument,effectDefinition} from '../shared/content/effect-definitions.ts';
import {showEffectMenu} from './effect-screen.ts';
import {currentEncounterDocument} from '../shared/content/encounter-director.ts';
import {encounterMenu} from '../shared/rules/encounter-director.ts';
import {showEncounterMenu} from './encounter-screen.ts';
import {questJournal} from '../shared/rules/quest-engine.ts';
import {showQuestJournal,showQuestEnding} from './quest-screen.ts';
import {showSocialMenu} from './social-screen.ts';
import {socialView} from '../shared/rules/social.ts';
import {interactionMenu,entityPresentationMap} from '../shared/rules/objects.ts';
import {newScopedState} from '../shared/rules/scoped-state.ts';
import {showInteractionMenu} from './interaction-screen.ts';
import {currentRoutineDocument,currentSocialDocument,currentQuestDocument,withCatalogueMaps,startCatalogueCampaign,currentCatalogueAdventure,currentCatalogueEnvironments} from '../shared/content/catalogue.ts';
import {validateRoutineDocument,type RoutineDocument} from '../shared/rules/routines.ts';
import {ManifestError} from '../shared/project/manifest.ts';
import {openLibraryHub,type LibraryLaunch} from './pack-library-ui.ts';
import {installLibrarySelection,selectionReport} from '../shared/content/pack-library.ts';
import {requireResource} from '../shared/project/resources.ts';
import {validateEnvironmentMaps,mergeEnvironments,environmentResourceIds} from '../shared/project/environments.ts';
import {validateMapDocument} from '../shared/project/map-document.ts';
import {progression} from '../shared/content/progression.ts';
import {loadProjectBoot,loadProjectLegacyAdapter,loadProjectCatalogue,loadProjectItems,loadProjectClasses,loadProjectActors,loadProjectProgression,loadProjectSpells,loadProjectMonsters,loadProjectEncounters,loadProjectLoot,createProjectCampaign,projectCampaignStorage,projectAssetUrl,projectResourceUrl} from './project-boot.ts';
import {validateIndexedMaps} from '../shared/project/map-index.ts';
import {nearbyGround,lootGround,type LootRequest} from '../shared/rules/ground.ts';
import {ITEMS,BASE_ITEM_IDS} from '../shared/content/items.ts';
import {configureItemArt} from './phase30-art.ts';
import {messageHistory} from './message-history.ts';
import {campError} from '../shared/rules/expedition.ts';
import {audioDirector} from './audio.ts';
import {installPresentation,showEnding} from './presentation.ts';
import type {PresentationEvent} from '../shared/rules/presentation.ts';
import {nearbyService,serviceAction,TOWN_SERVICES,type ServiceRequest} from '../shared/rules/services.ts';
import {inspectTownScene,inspectUpperScene,inspectVaultScene,UPPER_SCENES,VAULT_SCENES} from '../shared/rules/quests.ts';
import './style.css';
import {CombatArt} from './combat-art.ts';
import {icon} from './ui-art.ts';
import {portraitAsset,PORTRAIT_STATES,configurePortraitArt} from './art-production.ts';
import {PORTRAITS,PORTRAIT_ORDER} from '../shared/content/actors.ts';
import {TOWN_TEXTURES,townAsset,validateTownArt} from './town-art.ts';
import {NPC_SCENES,validateNpcScenes} from './npc-scenes.ts';
import {UPPER_TEXTURES,upperAsset,upperArtState,validateUpperArt} from './upper-art.ts';
import {VAULT_TEXTURES,vaultAsset,validateVaultArt} from './vault-art.ts';
import {createDefaultParty,validateParty,selectMember,exchangeMembers,updateMember,derived,damage,withCondition,type QuickAction,type PreparedStyle,type PartyState} from '../shared/rules/party.ts';
import {explorationShortcut,combatShortcut} from './ui-contract.ts';
import {ENEMY_KINDS,currentEnemies,activeActor,combatTargets,beginEncounter,chooseTarget,combatAction,castCombatSpell,shootVolley,recoverParty,quickFight,afterItemUse,type CombatResult} from '../shared/rules/combat.ts';
import {DIRECTIONS,isOpaque} from '../shared/rules/grid.ts';
import {checkCast,castExploration,readySpell,learnClassSpell,expireMagic,type CastRequest} from '../shared/rules/magic.ts';
import {setPrepared,setQuickAction} from '../shared/rules/noncaster.ts';
import {createCustomParty,type HeroBlueprint} from '../shared/rules/creation.ts';
import {validateCampaign,validateMapRegistry,travelCampaign,type CampaignState,type MapRegistry} from '../shared/rules/campaign.ts';
import {CampaignStore,type SlotId} from '../shared/saves/campaign-store.ts';
import {CampaignInstanceStore,type InstanceIdentity} from '../shared/saves/campaign-instances.ts';
import {PortableRosterVault} from '../shared/saves/portable-roster.ts';
import {CatalogueUpgradeCoordinator,UPGRADE_JOURNAL_KEY,type UpgradePreview} from '../shared/saves/catalogue-upgrades.ts';
import {INSTANCE_PREFIX} from '../shared/saves/campaign-instances.ts';
import { SeededRng, type RngSnapshot } from '../shared/rules/rng.ts';
import {applyGridAction,initialGridState,validateGridMap,FACING_NAMES,doorAt,type GridMap,type GridState,type GridAction} from '../shared/rules/grid.ts';
import {viewPose,type ViewPose} from '../shared/rules/perspective.ts';
import {itemAction,cacheHere,groundDropHere,claimCache,type ItemCommand} from '../shared/rules/inventory.ts';
import { validateManifest } from '../shared/content/manifest.ts';
import {settleExpeditionTime,type ExpeditionResult} from '../shared/rules/expedition.ts';
import {dispatchSimulation,type SimulationCommand,type SimulationResult,type SimulationEvent} from '../shared/rules/simulation.ts';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing interface element: ${id}`);
  return value as T;
}
let pendingNotice:string|null=null;
const notice = (message: string,show=true) => { element('notice').textContent = message;pendingNotice=message;messageHistory.add(message,show); };
const log = (message: string,show=true) => {
  if(pendingNotice===message)pendingNotice=null;else messageHistory.add(message,show);
  const list = element('log'); const entry = document.createElement('li');
  entry.textContent = message; list.prepend(entry);
  while (list.children.length > 4) list.lastElementChild?.remove();
};
let failed = false;
let game: import('phaser').Game | undefined;
function fail(error: unknown): void {
  if (failed) return; failed = true;
  const e = error instanceof Error ? error : new Error(String(error));
  element('loading').hidden = true; element('welcome').hidden = true;
  element('chamber-ui').hidden = true; element('failure').hidden = false;
  element('failure-message').textContent = error instanceof ManifestError ? error.message : 'Please reload, or check that all files are being served over HTTP. The download includes a Node.js launcher.';
  element('failure-details').textContent = e.stack || e.message;
  notice('The engine could not start. See the message above.');
  element<HTMLButtonElement>('seed-form').querySelectorAll('button,input').forEach(e => (e as HTMLButtonElement).disabled = true);
  game?.loop.stop();
}
element('retry').addEventListener('click', () => location.reload());
window.addEventListener('error', event => fail(event.error || event.message));
window.addEventListener('unhandledrejection', event => fail(event.reason));

async function start(libraryLaunch:LibraryLaunch|null=null): Promise<void> {
  installPresentation();
  if (location.protocol === 'file:') throw new Error('Opening index.html directly is not supported. Run Start-World-of-Maxxia.cmd or node server.mjs and open http://localhost:3000.');
  const launchUrl=new URL(location.href);if(libraryLaunch){launchUrl.searchParams.set('project',libraryLaunch.project);launchUrl.searchParams.delete('catalogue');}
  const projectBoot=await loadProjectBoot(launchUrl.href);
  await loadProjectItems(projectBoot);await loadProjectProgression(projectBoot);await loadProjectClasses(projectBoot);await loadProjectSpells(projectBoot);await loadProjectMonsters(projectBoot);await loadProjectLegacyAdapter(projectBoot,launchUrl.href);
  if(libraryLaunch&&libraryLaunch.enabled.length){const outcome=await installLibrarySelection(libraryLaunch.available,libraryLaunch.enabled,projectBoot.resourceResolver,projectBoot.manifest.projectId);projectBoot.resourceResolver=outcome.resources;projectBoot.catalogueHash=outcome.hash;}
  else if(!libraryLaunch)await loadProjectCatalogue(projectBoot,launchUrl.href);
  await loadProjectEncounters(projectBoot);await loadProjectLoot(projectBoot);await loadProjectActors(projectBoot);configureItemArt(projectBoot.resourceResolver);configurePortraitArt(projectBoot.resourceResolver);
  projectBoot.environments=mergeEnvironments(projectBoot.environments,currentCatalogueEnvironments());
  const authoredAdventure=currentCatalogueAdventure();
  document.title=authoredAdventure?.title??projectBoot.manifest.title;const heading=element('welcome').querySelector('h1');if(heading)heading.textContent=document.title;
  element('active-catalogue').textContent=libraryLaunch?`Adventure: ${projectBoot.manifest.title} · Enabled: ${libraryLaunch.enabled.length?libraryLaunch.enabled.join(', '):'shared core only'} · Save catalogue: ${projectBoot.catalogueHash?.slice(0,12)??'original'}…`:projectBoot.catalogueHash?`Catalogue: ${projectBoot.catalogueHash.slice(0,12)}…`:'Original saved adventure';
  element('change-library').addEventListener('click',()=>{location.assign(new URL('./',location.href).href);});
  const selectedProviders=libraryLaunch?selectionReport(libraryLaunch.available,libraryLaunch.enabled).ordered.map(id=>({id,version:libraryLaunch.available.get(id)!.manifest.version})):authoredAdventure?.providers??[{id:'core',version:'1.0.1'}];
  const instanceIdentity:InstanceIdentity={projectId:projectBoot.manifest.projectId,adventureId:authoredAdventure?.id??libraryLaunch?.adventureId??'firstlight',rules:{id:'core:rules:classic',version:'1.0.0'},catalogueHash:projectBoot.catalogueHash??libraryLaunch?.coreHash??null,providers:selectedProviders};
  const Phaser = (await import('phaser')).default;
  const {PerspectiveRenderer}=await import('./perspective-renderer.ts');
  const {Dashboard}=await import('./dashboard.ts');
  const {CreationScreen}=await import('./creation-screen.ts');
  class BootScene extends Phaser.Scene {
    constructor() { super('boot'); }
    preload(): void {
      this.load.on('progress', (progress: number) => {
        element<HTMLProgressElement>('load-progress').value = progress;
        element('loading-label').textContent = `Lighting the chamber… ${Math.round(progress * 100)}%`;
      });
      this.load.on('loaderror', (file: {src: string}) => fail(new Error(`Required asset failed to load: ${file.src}`)));
      if(projectBoot.foundationUrl)this.load.json('foundation',projectBoot.foundationUrl);
      for(const doc of projectBoot.mapDocuments)this.load.json(doc.cacheKey,doc.url);
      const profileImageIds=new Set(projectBoot.environments.profiles.flatMap(environmentResourceIds));
      for(const id of profileImageIds)this.load.image(`environment-${id}`,requireResource(projectBoot.resourceResolver!,id,'image').url);
      const asset=(path:string)=>projectAssetUrl(projectBoot,path,new URL(import.meta.env.BASE_URL,location.href).href);
      for(const name of ['dust-imp','tessa-loop','witch-normal','witch-hurt','witch-afflicted','witch-dead'])this.load.image(`art-${name}`,asset(`assets/art/${name}.png`));
      for(let i=0;i<12;i++)for(const state of PORTRAIT_STATES)this.load.image(`portrait-${i}-${state}`,asset(portraitAsset(i,state)!));
      for(const id of PORTRAIT_ORDER)for(const state of PORTRAIT_STATES){const path=PORTRAITS[id]?.states[state];const resource=path&&projectBoot.resourceResolver?.byId.get(path);if(resource)this.load.image(`portrait-set-${id}-${state}`,resource.url);}
      for(const name of ['stone','button','parchment','portrait-frame','panel','parchment-panel','gargoyle','ruby','amethyst','compass','title-harbour'])this.load.image(`ui-${name}`,name==='stone'?projectResourceUrl(projectBoot,'asset_art_ui_stone_png','assets/art/ui/stone.png',new URL(import.meta.env.BASE_URL,location.href).href,true):asset(`assets/art/ui/${name}.png`));
      for(const key of TOWN_TEXTURES)this.load.image(`town-${key}`,asset(townAsset(key)));
      for(const scene of Object.values(NPC_SCENES))this.load.image(`npc-scene-${scene.id}`,asset(scene.url));
      this.load.image('ground-corpse',asset('assets/art/ground/corpse.png'));
      for(const id of Object.keys(ITEMS))this.load.image('ground-'+id,(ITEMS[id].iconResourceId && projectBoot.resourceResolver?.byId.get(ITEMS[id].iconResourceId!)?.url || asset(`assets/art/items/${BASE_ITEM_IDS.has(id)?id:'item_treasure_gem'}.png`)));
      for(const key of UPPER_TEXTURES)this.load.image(`upper-${key}`,asset(upperAsset(key)));
      for(const key of VAULT_TEXTURES)this.load.image(`vault-${key}`,asset(vaultAsset(key)));
      this.load.svg('sigil', asset('assets/sigil.svg'), {width: 32, height: 32});
    }
    create(): void {
      if (failed) return;
      try {
        const registry=validateIndexedMaps(projectBoot.mapDocuments,projectBoot.mapDocuments.map(doc=>this.cache.json.get(doc.cacheKey)));
        if(projectBoot.manifest.content.environments){
          const documents=projectBoot.mapDocuments.map(doc=>this.cache.json.get(doc.cacheKey)).filter((doc):doc is Record<string,unknown>=>doc!==null&&typeof doc==='object'&&doc.format==='maxxia-map').map(validateMapDocument);
          validateEnvironmentMaps(documents,projectBoot.environments);
        }
        if(registry.map_diagnostic_galleries)validateUpperArt(registry.map_diagnostic_galleries);
        if(registry.map_resonator_vault)validateVaultArt(registry.map_resonator_vault);
        if(registry.map_town){validateNpcScenes(TOWN_SERVICES);validateTownArt(registry.map_town);}
        if(projectBoot.foundationUrl)validateManifest(this.cache.json.get('foundation'));
        this.scene.start('chamber');
      }
      catch (error) { fail(error); }
    }
  }
  class ChamberScene extends Phaser.Scene {
    private party:PartyState=validateParty(createDefaultParty());
    private mapRegistry!:MapRegistry;
    private campaign!:CampaignState;
    private store:CampaignStore|CampaignInstanceStore|null=null;
    private legacyStore:CampaignStore|null=null;
    private instances:CampaignInstanceStore|null=null;
    private storageMessage='';
    private ui?: InstanceType<typeof Dashboard>;
    private renderer3d?: InstanceType<typeof PerspectiveRenderer>;
    private combatArt=new CombatArt(element('combat-stage'));
    private map!: GridMap;
    private world!: GridState;
    private from?: ViewPose;
    private destination?: ViewPose;
    private transitionStarted=0;
    private transitionUntil=0;
    private lastRender=-1000;
    private transitions=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    private rng = new SeededRng('maxxia-first-light');
    private checkpoint: RngSnapshot | null = null;
    private rollCount = 0;
    private entered = false;
    private paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    private removers: (() => void)[] = [];
    private recentCommands:Array<{command:SimulationCommand;status:string;events:SimulationEvent['type'][];rngState:number}>=[];
    constructor() { super('chamber'); }
    create(): void {
      this.mapRegistry=withCatalogueMaps(validateIndexedMaps(projectBoot.mapDocuments,projectBoot.mapDocuments.map(doc=>this.cache.json.get(doc.cacheKey))));
      this.campaign=startCatalogueCampaign(createProjectCampaign(this.mapRegistry,projectBoot),this.mapRegistry);
      this.applyCampaign(this.campaign);
      try{const storage=projectCampaignStorage(window.localStorage,projectBoot.manifest?.projectId??null,projectBoot.catalogueHash);this.legacyStore=new CampaignStore(storage,this.mapRegistry);this.legacyStore.list();this.instances=new CampaignInstanceStore(storage,this.mapRegistry,instanceIdentity);this.store=this.legacyStore;}
      catch(error){this.store=null;this.instances=null;this.legacyStore=null;this.storageMessage=`Browser storage unavailable or instance index damaged: ${error instanceof Error?error.message:String(error)}`;}
      this.renderer3d=new PerspectiveRenderer(this,projectBoot.environments,projectBoot.resourceResolver);
      this.ui=new Dashboard({...(currentEffectDocument().effects.length?{effects:()=>showEffectMenu(()=>{const s=this.snapshotCampaign();return {effects:currentEffectDocument().effects.filter(e=>!e.activation&&(e.context==='both'||e.context===(s.combat.active?'combat':'exploration'))).concat(usableAbilities(s.party.characters[activeActor(s)??s.party.selectedId],!!s.combat.active)),casterId:activeActor(s)??s.party.selectedId,details:Object.fromEntries(currentEffectDocument().effects.filter(e=>e.activation).map(e=>{const h=s.party.characters[activeActor(s)??s.party.selectedId],a=e.activation!;return [e.id,`${a.cost?`${a.cost.id.split(':').at(-1)} ${poolCurrent(h,a.cost.id)}/${a.cost.amount} required · `:''}${a.cooldown?`${a.cooldown.amount} ${a.cooldown.clock} cooldown · `:''}${checkAbility(h,e,s)??'Ready'}`]})),targets:[...s.party.order.map(id=>({id,name:s.party.characters[id].name})),...(s.combat.active?combatTargets(s).map(e=>({id:e.id,name:ENEMY_KINDS[e.kindId].name})):[])]};},(effectId,casterId,targetId)=>this.performSimulation({type:effectDefinition(effectId)?.activation?'ability':'effect',...(effectDefinition(effectId)?.activation?{abilityId:effectId}:{effectId}),casterId,targetId} as any).messages.join(' '))}:{}),...(currentEncounterDocument().encounters.length?{encounters:()=>this.performSimulation({type:'encounter',action:'menu'})}:{}),...(currentQuestDocument().quests.length?{openAuthoredJournal:()=>this.performSimulation({type:'quest',action:'journal'})}:{}),ground:()=>nearbyGround(this.snapshotCampaign(),this.mapRegistry),loot:(r:LootRequest)=>{const result=this.performSimulation({type:'loot',request:r});return {state:result.state,changed:result.changed,message:result.messages.at(-1)??'No loot available.'};},thievery:()=>this.campaign.thievery,campCheck:()=>campError(this.snapshotCampaign()),serviceState:()=>this.campaign.services,nearService:()=>nearbyService(this.snapshotCampaign(),this.mapRegistry),serviceAction:(req:ServiceRequest)=>{const result=this.performSimulation({type:'service',request:req});return {state:result.state,changed:result.changed,message:result.messages.at(-1)??'Service unavailable.'};},expedition:()=>this.campaign.expedition,expeditionAction:(action)=>this.expeditionAction(action),inventory:()=>this.campaign.inventory,inventoryAction:(command:ItemCommand)=>{const result=this.performSimulation({type:'item',request:command});return {state:result.state,changed:result.changed,message:result.messages.join(' '),usedTurn:false};},craftAction:(recipeId:string,crafterId:string)=>{const result=this.performSimulation({type:'craft',request:{recipeId,crafterId}});return {changed:result.changed,message:result.messages.join(' ')};},notes:()=>this.campaign.quests.notes,journal:()=>this.campaign.quests,magic:()=>this.snapshotCampaign().magic,castCheck:r=>checkCast(this.snapshotCampaign(),r,this.mapRegistry),castSpell:r=>{const result=this.performSimulation({type:'spell',request:r});if(result.changed&&!this.campaign.combat.active)this.engageNearby();return {changed:result.changed,message:result.messages.at(-1)??''};},learnWizard:(casterId,spellId)=>{const result=this.performSimulation({type:'learn-spell',casterId,spellId});return {state:result.state,changed:result.changed,message:result.messages.at(-1)??''};},readySpell:(casterId,spellId)=>{const result=this.performSimulation({type:'ready-spell',casterId,spellId});return {state:result.state,changed:result.changed,message:result.messages.at(-1)??''};},combat:()=>({active:!!this.campaign.combat.active,actorId:activeActor(this.campaign),actorName:(this.campaign.combat.active&&this.party.characters[activeActor(this.campaign)??'']?.name)||'Adventurer',targets:combatTargets(this.campaign).map(v=>({id:v.id,name:ENEMY_KINDS[v.kindId].name+(this.campaign.thievery.stolen.includes(v.id)?' · stolen':''),hp:v.hp,maxHP:ENEMY_KINDS[v.kindId].hp})),selectedTargetId:this.campaign.combat.active?.targetId??null}),combatCommand:a=>this.combatCommand(a),configurePrepared:(id,style)=>{this.performSimulation({type:'party',action:'prepared',heroId:id,style});},configureQuick:(id,action)=>{this.performSimulation({type:'party',action:'quick',heroId:id,quickAction:action});},target:id=>{this.performSimulation({type:'combat',action:'target',targetId:id});},snapshot:()=>({map:this.map,world:this.world}),party:()=>this.party,select:id=>{this.performSimulation({type:'party',action:'select',heroId:id});},exchange:(from,to)=>{this.performSimulation({type:'party',action:'exchange',heroId:from,otherId:to});},diagnostic:(id,action)=>{
        let c=this.party.characters[id];const d=derived(c);
        if(action==='wound')c=damage(c,Math.max(0,c.hp-Math.max(1,Math.floor(d.maxHP*.4))));
        if(action==='poison')c=withCondition(c,{id:'poisoned',remaining:3,unit:'ticks'});
        if(action==='exhaust')c={...c,sp:0};
        if(action==='dead')c=damage(c,c.hp);
        if(action==='restore')c={...c,hp:d.maxHP,sp:d.maxSP,conditions:[]};
        if(action==='xp')c={...c,xp:c.xp+250};
        if(action==='fear')c=withCondition(c,{id:'frightened',remaining:3,unit:'turns'});
        if(action==='curse')c=withCondition(c,{id:'cursed',remaining:null,unit:'persistent'});
        if(action==='curse_gear'){const gear=c.equipment.melee??c.equipment.body;if(gear)this.campaign.magic.itemCurses[id]=[...new Set([...this.campaign.magic.itemCurses[id],gear])];}
        if((action==='wizard_level'&&c.classId==='wizard'||action==='priest_level'&&c.classId==='priest'||action==='witch_level'&&c.classId==='witch')&&c.level<progression().maxLevel){const old=derived(c);c={...c,level:c.level+1};const next=derived(c);c.hp=Math.min(next.maxHP,c.hp+next.maxHP-old.maxHP);c.sp=next.maxSP;}
        this.party=validateParty(updateMember(this.party,c));this.autosave();
      },clockMinutes:()=>this.campaign.elapsedMinutes,slots:()=>this.store?.list()??[],save:id=>this.saveSlot(id),load:id=>this.loadSlot(id),exportSave:()=>this.exportFile(),importSave:()=>element<HTMLInputElement>('import-file').click(),returnToTitle:()=>{this.entered=false;element('chamber-ui').hidden=true;element('welcome').hidden=false;this.refreshInstanceSelector(this.instances?.currentId??'legacy');element<HTMLButtonElement>('instance-open').focus();notice('Campaign saved. Open a saved instance or create a new adventure.');}});
      this.renderer3d.render(entityPresentationMap(this.map,this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry),this.world,viewPose(this.world),0,upperArtState(this.campaign),sceneSpriteInstances(this.map,this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry),this.paused,matchMedia('(prefers-reduced-motion: reduce)').matches);
      element<HTMLInputElement>('transitions').checked=this.transitions;
      this.refreshReadouts();
      element('loading').hidden = true; element('welcome').hidden = false;
      element<HTMLButtonElement>('enter').focus();
      notice(this.storageMessage||'Bellwether Quay and the Upper Cistern are ready. Choose New Adventure or Continue.');
      this.refreshResume();
      element('log').replaceChildren(); log('Your expedition record is ready.');
      const on = (id: string, event: string, fn: EventListener) => {
        const node = element(id); node.addEventListener(event, fn);
        this.removers.push(() => node.removeEventListener(event, fn));
      };
      const creator=new CreationScreen((heroes:HeroBlueprint[]|null)=>{
        try{if(!this.instances)throw new Error(this.storageMessage||'Campaign storage unavailable.');
          const custom=heroes?createCustomParty(heroes):undefined;
          const campaign=startCatalogueCampaign(createProjectCampaign(this.mapRegistry,projectBoot,custom),this.mapRegistry);
          const label=`${projectBoot.manifest.title} · Adventure ${this.instances.listInstances().length+1}`.slice(0,64);
          const id=this.instances.create(label,campaign);this.store=this.instances;this.combatArt.reset();this.applyCampaign(campaign,false);this.refreshInstanceSelector(id);this.refreshPortableSelector();this.enterWorld();}
        catch(error){notice(`Character creation failed: ${error instanceof Error?error.message:String(error)}`);}
      });
      on('enter','click',()=>creator.show());
      const resumeSelection=()=>{
        try{const selection=element<HTMLSelectElement>('instance-select').value;
          if(selection==='legacy'){if(!this.legacyStore)throw new Error('Legacy storage unavailable.');this.store=this.legacyStore;}
          else {if(!this.instances)throw new Error('Instance library unavailable.');this.instances.activate(selection);this.store=this.instances;this.refreshPortableSelector();}
          const slot=this.store.list().filter(s=>s.valid).sort((a,b)=>(b.savedAt??'').localeCompare(a.savedAt??''))[0];
          if(slot)this.loadSlot(slot.id);else notice('No readable slot for this campaign.');
        }catch(error){notice(`Cannot open campaign: ${error instanceof Error?error.message:String(error)}`);}
      };
      on('resume','click',resumeSelection);on('instance-open','click',resumeSelection);
      // MP10: each catalogue has its own storage prefix. Never rebind an existing
      // campaign silently when the library selection changes.
      const previous=element<HTMLSelectElement>('upgrade-source');
      const previewButton=element<HTMLButtonElement>('upgrade-preview');
      const adoptButton=element<HTMLButtonElement>('upgrade-adopt');
      const upgradeMessage=element<HTMLElement>('upgrade-message');
      let pendingUpgrade:{coordinator:CatalogueUpgradeCoordinator;preview:UpgradePreview}|null=null;
      const upgradeSourceStorage=(catalogue:string)=>catalogue==='legacy'?projectCampaignStorage(localStorage,projectBoot.manifest.projectId):projectCampaignStorage(localStorage,projectBoot.manifest.projectId,catalogue);
      const upgradeTargetStorage=()=>projectCampaignStorage(localStorage,projectBoot.manifest.projectId,projectBoot.catalogueHash);
      const readUpgradeIdentity=(scope:ReturnType<typeof upgradeSourceStorage>):InstanceIdentity=>{
        const raw=scope.getItem(INSTANCE_PREFIX+'index');if(!raw)throw new Error('This scope has no saved campaigns.');
        const index=JSON.parse(raw) as {entries?:{id:string}[]};const entry=index.entries?.[0];if(!entry)throw new Error('No saved campaign instance was found.');
        const saved=scope.getItem(INSTANCE_PREFIX+entry.id+':auto');if(!saved)throw new Error('Source autosave is missing.');
        return (JSON.parse(saved) as {identity:InstanceIdentity}).identity;
      };
      const makeCoordinator=(selected:string,known?:InstanceIdentity)=>{
        const source=upgradeSourceStorage(selected);
        return new CatalogueUpgradeCoordinator(source,upgradeTargetStorage(),this.mapRegistry,known??readUpgradeIdentity(source),instanceIdentity);
      };
      const refreshUpgradeSources=()=>{
        const selected=previous.value;previous.replaceChildren();
        const id=projectBoot.manifest.projectId,prefix=`maxxia-catalogue:${id}:`;
        const current=projectBoot.catalogueHash??null;
        const found=new Set<string>();
        for(let i=0;i<localStorage.length;i++){
          const key=localStorage.key(i)??'';
          if(!key.startsWith(prefix)||!key.endsWith(':'+INSTANCE_PREFIX+'index'))continue;
          const hash=key.slice(prefix.length,prefix.length+64);
          if(!/^[a-f0-9]{64}$/.test(hash)||hash===current||key!==prefix+hash+':'+INSTANCE_PREFIX+'index')continue;
          found.add(hash);
        }
        for(const hash of [...found].sort()){
          const option=document.createElement('option');option.value=hash;option.textContent=`Older catalogue ${hash.slice(0,12)}…`;previous.append(option);
        }
        if(!current&&found.size===0&&localStorage.getItem(INSTANCE_PREFIX+'index')){
          const option=document.createElement('option');option.value='legacy';option.textContent='Original unscoped campaign instance library';previous.append(option);
        }else if(current&&localStorage.getItem(INSTANCE_PREFIX+'index')){
          const option=document.createElement('option');option.value='legacy';option.textContent='Original unscoped campaign instance library';previous.append(option);
        }
        if([...previous.options].some(o=>o.value===selected))previous.value=selected;
        previous.disabled=!previous.options.length;previewButton.disabled=!previous.options.length;
        adoptButton.disabled=true;pendingUpgrade=null;
      };
      previous.addEventListener('change',()=>{adoptButton.disabled=true;pendingUpgrade=null;upgradeMessage.textContent='Selection changed. Preview the new source again.';});
      on('upgrade-preview','click',()=>{void (async()=>{
        if(this.instances?.currentId)throw new Error('Close the active campaign and reload before changing its catalogue.');
        if(!previous.value)throw new Error('No prior campaign library is available.');
        const coordinator=makeCoordinator(previous.value),report=await coordinator.preview();
        pendingUpgrade=report.status==='ready'?{coordinator,preview:report}:null;adoptButton.disabled=report.status!=='ready';
        upgradeMessage.textContent=`${report.instances} campaign(s), ${report.slots} saves, ${report.transferReceipts} transfer receipts; ${report.opaqueRecords} character records. ${report.status==='ready'?'Eligible for explicit adoption.':'Original content retained; cannot adopt.'} ${[...report.changes,...report.blockers].join(' · ')}`;
      })().catch(error=>{pendingUpgrade=null;adoptButton.disabled=true;upgradeMessage.textContent=`Preview failed: ${error instanceof Error?error.message:String(error)}`;});});
      on('upgrade-adopt','click',()=>{void (async()=>{
        if(!pendingUpgrade||this.instances?.currentId)throw new Error('Reopen and preview a compatible, inactive campaign library first.');
        const {coordinator,preview}=pendingUpgrade;
        if(!window.confirm(`Adopt ${preview.instances} previous campaign(s) into this pack catalogue? All original saves stay in their old library; a recovery journal and original-byte backups are created in the new library.`))return;
        adoptButton.disabled=true;
        await coordinator.adopt(preview.token);pendingUpgrade=null;
        upgradeMessage.textContent=`Migration committed. ${preview.instances} campaigns are now available in this catalogue. Originals retained.`;
        this.refreshInstanceSelector();this.refreshResume();
      })().catch(error=>{upgradeMessage.textContent=`Migration interrupted or refused: ${error instanceof Error?error.message:String(error)}. Use Recover; do not delete the original files.`;});});
      const journalCoordinator=()=>{
        const raw=upgradeTargetStorage().getItem(UPGRADE_JOURNAL_KEY);
        if(!raw)throw new Error('There is no migration journal for the selected catalogue.');
        const j=JSON.parse(raw) as {from:InstanceIdentity};
        const hash=j.from.catalogueHash??'legacy';return makeCoordinator(hash,j.from);
      };
      on('upgrade-recover','click',()=>{void (async()=>{
        const j=await journalCoordinator().recover();upgradeMessage.textContent=`Upgrade journal: ${j?.status??'absent'}. If complete, select the restored campaign above.`;
        this.refreshInstanceSelector();this.refreshResume();
      })().catch(error=>upgradeMessage.textContent=`Recovery refused: ${error instanceof Error?error.message:String(error)}`);});
      on('upgrade-rollback','click',()=>{void (async()=>{
        if(this.instances?.currentId)throw new Error('Reload before rolling back an active campaign.');
        if(!window.confirm('Undo this upgrade only if none of its migrated saves have changed? Originals will remain intact.'))return;
        await journalCoordinator().rollback();upgradeMessage.textContent='Unchanged migrated saves removed. Your original catalogue remains intact.';
        this.refreshInstanceSelector();this.refreshResume();
      })().catch(error=>upgradeMessage.textContent=`Rollback refused: ${error instanceof Error?error.message:String(error)}`);});
      try{refreshUpgradeSources();}catch(error){upgradeMessage.textContent=`Cannot enumerate older libraries: ${String(error)}`;}

      this.refreshInstanceSelector();
      on('title-import','click',()=>element<HTMLInputElement>('import-file').click());
      on('import-file','change',()=>void this.importFile());
      on('roster-export','click',()=>{
        try{
          if(!this.instances?.currentId)throw new Error('First open or create an MP08 campaign instance. Legacy slots must be imported as new instances before exporting a character.');
          const select=element<HTMLSelectElement>('roster-character-select'),id=select.value;
          if(!id)throw new Error('No portable hero is currently selected.');
          const text=this.instances.exportCharacter(id,true),blob=new Blob([text],{type:'application/json'});
          const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='World-of-Maxxia-Character-MP08.json';document.body.append(a);a.click();a.remove();
          window.setTimeout(()=>URL.revokeObjectURL(url),1000);
          notice('Character record exported with unique equipment and dependency provenance. Local campaign transfers are available from the transfer panel.');
        }catch(error){notice(`Character export failed: ${error instanceof Error?error.message:String(error)}`);}
      });
      on('roster-copy-import','click',()=>element<HTMLInputElement>('roster-copy-file').click());
      on('roster-copy-file','change',()=>{void(async()=>{const input=element<HTMLInputElement>('roster-copy-file'),file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>65536)throw new Error('File exceeds64 KiB');if(!this.instances?.currentId)throw new Error('Open the receiving instance first');this.autosave();const state=this.instances.importCharacterCopy(await file.text());this.applyCampaign(state,false);this.refreshPortableSelector();this.refreshReservePanel();notice('A new character copy is in the current reserve. Use Reserve swap to bring them into the active party.');}catch(e){notice('Copy refused: '+String(e));}})();});
      on('roster-import','click',()=>element<HTMLInputElement>('roster-file').click());
      on('roster-file','change',()=>void this.importPortableFile());
      on('transfer-source','change',()=>this.refreshTransferPanel());
      on('transfer-destination','change',()=>this.refreshTransferPanel());
      on('transfer-commit','click',()=>this.commitTransfer());
      on('transfer-export-history','click',()=>this.exportTransferReceipts());
      on('reserve-campaign','change',()=>this.refreshReservePanel());
      on('reserve-swap','click',()=>this.commitReserveSwap());
      this.refreshTransferPanel();
      on('roll', 'click', () => this.roll());
      on('interact','click',()=>this.command('interact'));
      for(const button of document.querySelectorAll<HTMLButtonElement>('[data-move]')){
        const move=button.dataset.move!;button.innerHTML=icon(({forward:'arrow_up',backward:'arrow_down',strafe_left:'arrow_left',strafe_right:'arrow_right',turn_left:'turn_left',turn_right:'turn_right'} as Record<string,string>)[move]);
        const fn=()=>this.command(move as GridAction);button.addEventListener('click',fn);this.removers.push(()=>button.removeEventListener('click',fn));
      }
      on('game','click',event=>{const e=event as MouseEvent,b=(element('game').querySelector('canvas')??element('game')).getBoundingClientRect(),x=(e.clientX-b.left)/b.width*640,y=(e.clientY-b.top)/b.height*400;if(x>=8&&x<448&&y>=8&&y<288){const hit=this.renderer3d?.hitTest(x-8,y-8);if(hit?.kind==='enemy'){if(this.entered&&!this.paused&&!this.ui?.isOpen&&this.campaign.combat.active)this.performSimulation({type:'combat',action:'target',targetId:hit.id});return;}if(hit?.kind==='entity'){if(!this.entered||this.paused||this.ui?.isOpen||this.campaign.combat.active)return;const read=()=>interactionMenu(this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry,hit.id);if(read().entities.length)showInteractionMenu(read,(id,action)=>this.performSimulation({type:'object',entityId:id,action}).messages.join(' '));else notice('That object is visible but out of reach.');return;}if(!this.campaign.combat.active)this.command('interact');}});
      on('transitions','change',()=>{this.transitions=element<HTMLInputElement>('transitions').checked;if(!this.transitions)this.transitionUntil=0;});
      on('capture', 'click', () => {
        this.checkpoint = this.rng.snapshot(); element<HTMLButtonElement>('restore').disabled = false;
        log(`Captured RNG state after ${this.rollCount} roll(s).`); notice('State captured in memory. Roll, restore, then repeat.');
      });
      on('restore', 'click', () => {
        if (!this.checkpoint) return;
        this.rng.restore(this.checkpoint);this.autosave(); log('RNG state restored. The next rolls will replay.');
        element('rng-result').textContent = 'State restored'; notice('RNG restored; roll to verify the same next result.');
      });
      on('seed-form', 'submit', event => {
        event.preventDefault();
        const input = element<HTMLInputElement>('seed'); const seed = input.value.trim() || 'maxxia-first-light';
        input.value = seed; this.rng = new SeededRng(seed); this.rollCount = 0; this.checkpoint = null;
        element<HTMLButtonElement>('restore').disabled = true; element('rng-result').textContent = 'Awaiting roll';
        this.autosave();log(`Sequence reset · seed “${seed}”.`); notice('Sequence reset. The same seed always gives the same rolls.');
      });
      on('pause', 'click', () => { this.paused = !this.paused; this.syncPause(); });
      const keyboard = (event: KeyboardEvent) => {
        if(document.querySelector('.presentation-dialog[open],#object-interaction[open],#npc-conversation[open],#quest-journal[open],#encounter-menu[open],#effect-menu[open]'))return;
        if(this.ui?.isOpen){this.ui.handleKey(event);return;}
        if(!this.entered||failed)return;
        const target=event.target as HTMLElement;
        if(target.closest('#message-display')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Home','End','Space'].includes(event.code))return;
        if((target.matches('input,textarea,select')||target.isContentEditable)&&/^F[1-6]$/.test(event.code)){event.preventDefault();return;}
        const key={code:event.code,ctrl:event.ctrlKey,alt:event.altKey,meta:event.metaKey,shift:event.shiftKey,repeat:event.repeat,typing:target.matches('input,textarea,select')||target.isContentEditable,nativeButton:!!target.closest('button')};
        const action=this.campaign.combat.active?combatShortcut(key):explorationShortcut(key);
        if(!action)return;event.preventDefault();
        if(action.startsWith('combat_target_')){const enemy=combatTargets(this.campaign)[Number(action.slice(-1))-1];if(enemy)this.performSimulation({type:'combat',action:'target',targetId:enemy.id});}
        else if(['forward','backward','turn_left','turn_right','strafe_left','strafe_right','interact'].includes(action))this.command(action as GridAction);
        else this.ui?.activate(action);
      };
      document.addEventListener('keydown', keyboard);
      this.removers.push(() => document.removeEventListener('keydown', keyboard));
      this.events.once('shutdown', () => { for (const remove of this.removers) remove(); });
      this.syncPause();
      // Read-only inspection surface for browser QA; it cannot mutate game state.
      const routinePanel=document.createElement('details');routinePanel.className='title-galleries';
      routinePanel.innerHTML=`<summary>Authored routine test bench (MP12)</summary><p>Import a routine JSON document. For the supplied lever example, pull lever 1, then lever 2. Progress saves with this campaign.</p><input type="file" accept=".json" aria-label="Routine document"><input aria-label="Routine ID" value="mp12:routine:lever"><input aria-label="Routine arguments" value='{"lever":1}'><button type="button">Run routine</button><p role="status"></p>`;
      document.querySelector('main')?.append(routinePanel);
      const routineInputs=routinePanel.querySelectorAll('input'),routineStatus=routinePanel.querySelector('[role="status"]')!;
      routineInputs[0].addEventListener('change',async()=>{try{const f=routineInputs[0].files?.[0];if(!f)return;if(f.size>65536)throw Error('Routine file exceeds 64 KiB');this.authoredRoutines=validateRoutineDocument(JSON.parse(await f.text()),f.name);routineStatus.textContent='Routine document loaded.';}catch(e){this.authoredRoutines=undefined;routineStatus.textContent=String(e);}});
      routinePanel.querySelector('button')!.addEventListener('click',()=>{try{if(!this.entered||this.ui?.isOpen)throw Error('Enter the adventure and close open menus first.');const args=JSON.parse(routineInputs[2].value);if(args.owner===undefined)args.owner=this.party.order[0];const result=this.performSimulation({type:'routine',routineId:routineInputs[1].value,args});routineStatus.textContent=result.messages.join(' ')||result.status;}catch(e){routineStatus.textContent=String(e);}});
      Object.defineProperty(window, '__MAXXIA_DIAGNOSTICS__', {configurable: true, get: () => ({phase: 'MP23', simulationTrace:structuredClone(this.recentCommands), campaign:structuredClone(this.snapshotCampaign()), party:structuredClone(this.party), instance:{id:this.instances?.currentId??null,lock:instanceIdentity,scoped:this.instances?.getScopedState()??null}, ui:{selectedSlot:this.ui?.selectedSlot,modalDepth:this.ui?.depth}, world:{...this.world,doors:{...this.world.doors},visited:[...this.world.visited]}, ready: !failed, entered: this.entered, rolls: this.rollCount, rng: this.rng.snapshot(), roomId: this.map.id, renderer: game?.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas'})});
    }
    private snapshotCampaign():CampaignState {
      return {...this.campaign,party:this.party,maps:{...this.campaign.maps,[this.map.id]:this.world},rng:this.rng.snapshot(),rollCount:this.rollCount};
    }
    private applyCampaign(campaign:CampaignState,presentChanges=true):void {
      const previous=this.campaign;
      settleExpeditionTime(campaign);
      this.campaign=validateCampaign(campaign,this.mapRegistry);
      if(previous&&presentChanges){
       if(!previous.combat.active&&!this.campaign.combat.active&&this.campaign.party.order.some(id=>this.campaign.party.characters[id]?.hp<(previous.party.characters[id]?.hp??0)))void audioDirector.cue('trap');
       if(!previous.quests.ending&&this.campaign.quests.ending){void audioDirector.cue('quest');showEnding(this.campaign);}
       else if(this.campaign.quests.completedStages.length>previous.quests.completedStages.length||Object.values(this.campaign.quests.optional).filter(v=>v==='completed').length>Object.values(previous.quests.optional).filter(v=>v==='completed').length)void audioDirector.cue('quest');
       if(this.campaign.party.resources.gold!==previous.party.resources.gold&&!this.campaign.combat.active&&!previous.combat.active)void audioDirector.cue('coin');
      }
      audioDirector.setContext(this.campaign,this.entered);
      this.party=this.campaign.party;
      this.map=this.mapRegistry[this.campaign.currentMapId];this.world=this.campaign.maps[this.map.id];
      this.rng=new SeededRng(1);this.rng.restore(this.campaign.rng);
      this.rollCount=this.campaign.rollCount;this.checkpoint=null;
      if(document.getElementById('restore'))element<HTMLButtonElement>('restore').disabled=true;
      if(this.ui){this.ui.refreshParty();this.ui.refreshCommands();this.ui.refreshMinimap();}
      if(this.renderer3d){this.renderer3d.render(entityPresentationMap(this.map,this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry),this.world,viewPose(this.world),0,upperArtState(this.campaign),sceneSpriteInstances(this.map,this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry),this.paused,matchMedia('(prefers-reduced-motion: reduce)').matches);this.lastRender=-1000;this.transitionUntil=0;}
      if(this.campaign) this.refreshReadouts();
    }
    private autosave(replaceInvalid=false):void {
      this.campaign=this.snapshotCampaign();
      if(!this.store)return;
      try{this.store.save('auto',this.campaign,replaceInvalid);this.storageMessage='';}
      catch(error){this.storageMessage=`Autosave not written: ${error instanceof Error?error.message:String(error)}`;notice(this.storageMessage);}
      this.refreshResume();
    }
    private refreshResume():void {
      const selected=element<HTMLSelectElement>('instance-select').value;
      const available=selected==='legacy'?this.legacyStore?.list().some(s=>s.valid):this.instances?.listInstances().some(i=>i.id===selected&&i.valid);
      element<HTMLButtonElement>('resume').hidden=!available;
      element<HTMLButtonElement>('instance-open').disabled=!available;
      if((this.store?.list()??[]).some(s=>s.present&&!s.valid))notice('One or more saved slots are unreadable. Their original bytes were preserved.');
    }
    private refreshPortableSelector():void {
      const selector=element<HTMLSelectElement>('roster-character-select'),previous=selector.value;
      selector.replaceChildren();
      const roster=this.instances?.currentId===element<HTMLSelectElement>('instance-select').value?this.instances?.getRosterSnapshot():null;
      for(const record of roster?.records??[]){
        const option=document.createElement('option');option.value=record.portableId;
        option.textContent=`${record.character.name} · level ${record.character.level} · revision ${record.revision}`;selector.append(option);
      }
      if([...selector.options].some(o=>o.value===previous))selector.value=previous;
      element<HTMLButtonElement>('roster-export').disabled=!roster?.records.length;
    }
    private async importPortableFile():Promise<void>{
      const input=element<HTMLInputElement>('roster-file'),file=input.files?.[0];input.value='';if(!file)return;
      try{
        if(file.size>65536)throw new Error('Portable character must be 64 KiB or less.');
        const vault=new PortableRosterVault(localStorage);
        const result=vault.importText(await file.text(),instanceIdentity);
        notice(result.available?'Character staged safely. Importing into a playable party is reserved for MP09.':`Character retained in staging, but unavailable until required providers are restored: ${result.missingProviders.join(', ')}.`);
      }catch(error){notice(`Portable import rejected; existing data unchanged: ${error instanceof Error?error.message:String(error)}`);}
    }
    private refreshTransferPanel():void {
      const msg=element('transfer-message');
      const source=element<HTMLSelectElement>('transfer-source'),destination=element<HTMLSelectElement>('transfer-destination'),hero=element<HTMLSelectElement>('transfer-character'),bench=element<HTMLSelectElement>('transfer-bench');
      const oldSource=source.value,oldDest=destination.value,oldHero=hero.value,oldBench=bench.value;
      const entries=this.instances?.listInstances().filter(e=>e.valid)??[];
      const fill=(node:HTMLSelectElement,options:{value:string;text:string}[],selected:string)=>{
        node.replaceChildren();for(const o of options){const option=document.createElement('option');option.value=o.value;option.textContent=o.text;node.append(option);}
        if(options.some(o=>o.value===selected))node.value=selected;
      };
      const choices=entries.map(e=>({value:e.id,text:e.name}));
      fill(source,choices,oldSource||element<HTMLSelectElement>('instance-select').value);
      fill(destination,choices.filter(v=>v.value!==source.value),oldDest);
      if(destination.value===source.value){destination.value=choices.find(v=>v.value!==source.value)?.value??'';}
      try{
        const sourceSnap=source.value?this.instances?.getInstanceAuto(source.value):null;
        const target=destination.value?this.instances?.getInstanceAuto(destination.value):null;
        const active=sourceSnap?.roster?.records.filter(r=>sourceSnap.campaign.party.order.includes(r.character.id))??[];
        fill(hero,active.map(r=>({value:r.portableId,text:`${r.character.name} · level ${r.character.level} · revision ${r.revision}`})),oldHero);
        if(target&&target.campaign.party.order.length===6){
          fill(bench,target.campaign.party.order.map(id=>({value:id,text:`Bench ${target.campaign.party.characters[id].name} (preserve roster and equipment)`})),oldBench);
          bench.disabled=false;
        }else{fill(bench,[{value:'',text:'No bench slot needed'}],'');bench.disabled=true;}
        msg.textContent=`${active.length} active character(s) in source · ${target?.campaign.party.order.length??0}/6 active slots in destination. Both campaigns must be outside combat.`;
        element<HTMLButtonElement>('transfer-commit').disabled=!hero.value||!destination.value||destination.value===source.value;
      }catch(error){hero.replaceChildren();bench.replaceChildren();element<HTMLButtonElement>('transfer-commit').disabled=true;msg.textContent=`Transfer library needs recovery: ${error instanceof Error?error.message:String(error)}`;}
      this.refreshTransferHistory();this.refreshReservePanel();
    }
    private refreshReservePanel():void {
      const campaign=element<HTMLSelectElement>('reserve-campaign'),reserve=element<HTMLSelectElement>('reserve-hero'),active=element<HTMLSelectElement>('reserve-active'),old=campaign.value;
      const entries=this.instances?.listInstances().filter(v=>v.valid)??[];campaign.replaceChildren();
      for(const e of entries){const option=document.createElement('option');option.value=e.id;option.textContent=e.name;campaign.append(option);}
      if(entries.some(e=>e.id===old))campaign.value=old;
      else {const selected=element<HTMLSelectElement>('instance-select').value;if(entries.some(e=>e.id===selected))campaign.value=selected;}
      reserve.replaceChildren();active.replaceChildren();
      try{
        const snap=campaign.value?this.instances?.getInstanceAuto(campaign.value):null;
        if(snap){
          const party=snap.campaign.party;
          for(const hero of Object.values(party.characters).filter(h=>!party.order.includes(h.id))){const o=document.createElement('option');o.value=hero.id;o.textContent=hero.name+' · level '+hero.level;reserve.append(o);}
          for(const heroId of party.order){const o=document.createElement('option');o.value=heroId;o.textContent=party.characters[heroId].name;active.append(o);}
        }
        element<HTMLButtonElement>('reserve-swap').disabled=!reserve.value||!active.value;
      }catch{element<HTMLButtonElement>('reserve-swap').disabled=true;}
    }
    private commitReserveSwap():void {
      try{
        const campaign=element<HTMLSelectElement>('reserve-campaign').value,reserve=element<HTMLSelectElement>('reserve-hero').value,active=element<HTMLSelectElement>('reserve-active').value;
        if(!this.instances||!campaign||!reserve||!active)throw new Error('Choose a campaign, reserve and active character.');
        const party=this.instances.getInstanceAuto(campaign).campaign.party;
        if(!window.confirm(`Activate ${party.characters[reserve].name} and bench ${party.characters[active].name}? Both records and all their equipment remain saved.`))return;
        this.instances.swapReserve(campaign,reserve,active);
        this.refreshInstanceSelector(campaign);notice('Reserve swap saved. Open the campaign to play your new active party.');
      }catch(error){notice(`Reserve swap rejected: ${error instanceof Error?error.message:String(error)}`);}
    }
    private refreshTransferHistory():void {
      const list=element('transfer-history');list.replaceChildren();
      try{
        const receipts=this.instances?.getTransferReceipts()??[];
        for(const r of receipts.slice(-20).reverse()){
          const li=document.createElement('li');li.textContent=`${r.mode.toUpperCase()} · ${r.status} · ${r.createdAt.slice(0,16).replace('T',' ')} · ${r.id.slice(0,8)} · ${r.sourceInstanceId.slice(0,8)} → ${r.destinationInstanceId.slice(0,8)}`;list.append(li);
        }
        if(!receipts.length){const li=document.createElement('li');li.textContent='No transfer receipts yet.';list.append(li);}
      }catch(error){const li=document.createElement('li');li.textContent=`Cannot inspect receipts: ${error instanceof Error?error.message:String(error)}`;list.append(li);}
    }
    private exportTransferReceipts():void {
      try{
        const receipts=this.instances?.getTransferReceipts()??[];
        const text=JSON.stringify({format:'maxxia-transfer-ledger',version:1,receipts},null,2)+'\n';
        const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='World-of-Maxxia-MP09-Transfer-Receipts.json';document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(error){notice(`Receipt export failed: ${error instanceof Error?error.message:String(error)}`);}
    }
    private commitTransfer():void {
      try{
        if(!this.instances)throw new Error('Campaign instance library is not available.');
        const source=element<HTMLSelectElement>('transfer-source').value,destination=element<HTMLSelectElement>('transfer-destination').value;
        const portableId=element<HTMLSelectElement>('transfer-character').value,mode=element<HTMLSelectElement>('transfer-mode').value as 'move'|'copy';
        const bench=element<HTMLSelectElement>('transfer-bench');
        const sourceSnap=this.instances.getInstanceAuto(source),targetSnap=this.instances.getInstanceAuto(destination),character=sourceSnap.roster?.records.find(r=>r.portableId===portableId);
        if(!character)throw new Error('Source character is not available.');
        const action=mode==='move'?'MOVE':'COPY';
        if(!window.confirm(`${action} ${character.character.name} to the destination? ${mode==='move'?'Source participation ends; historic source slots cannot restore the transferred identity.':'A separate branch with new character/item identities will be created.'}${bench.disabled?'':` The destination character ${targetSnap.campaign.party.characters[bench.value]?.name??bench.selectedOptions[0]?.textContent??''} will be benched, not deleted.`}`))return;
        const receipt=this.instances.transferCharacter({mode,sourceInstanceId:source,destinationInstanceId:destination,portableId,benchId:bench.disabled?undefined:bench.value});
        this.refreshInstanceSelector(destination);
        element('transfer-message').textContent=`${mode==='move'?'Moved':'Copied'} ${character.character.name}. Receipt ${receipt.id}. Open the destination campaign to play.`;
        notice(`Character ${mode==='move'?'moved':'copied'} successfully. Source and destination checkpoints are saved.`);
      }catch(error){const message=`Transfer rejected; existing records preserved: ${error instanceof Error?error.message:String(error)}`;element('transfer-message').textContent=message;notice(message);}
    }
    private refreshInstanceSelector(preferred?:string):void {
      const select=element<HTMLSelectElement>('instance-select');const previous=preferred??select.value;select.replaceChildren();
      const records=this.instances?.listInstances()??[];for(const entry of records){const option=document.createElement('option');option.value=entry.id;option.textContent=`${entry.name} · ${entry.valid?'ready':'unreadable'}`;select.append(option);}
      if(this.legacyStore?.list().some(s=>s.present)){const option=document.createElement('option');option.value='legacy';option.textContent='Legacy MP06 saves (unchanged)';select.append(option);}
      if(!select.options.length){const option=document.createElement('option');option.value='';option.textContent='No campaigns yet — create one';select.append(option);}
      select.value=[...select.options].some(o=>o.value===previous)?previous:records.find(r=>r.valid)?.id??select.options[0].value;
      select.onchange=()=>{this.refreshResume();this.refreshPortableSelector();this.refreshTransferPanel();};this.refreshResume();this.refreshPortableSelector();this.refreshTransferPanel();
    }
    private enterWorld():void {
      this.entered=true;element('welcome').hidden=true;element('chamber-ui').hidden=false;
      notice(`Exploring ${this.map.name}. Space interacts or travels through a nearby gateway.`);
      log(`Entered ${this.map.name} · ${this.world.x}, ${this.world.y} · ${FACING_NAMES[this.world.facing]}.`);
      this.engageNearby();
      element('game').focus({preventScroll:true});this.syncPause();this.refreshReadouts();
    }
    private saveSlot(id:SlotId):void {
      try{if(!this.store)throw new Error(this.storageMessage||'Browser storage unavailable.');
        this.store.save(id,this.snapshotCampaign());notice(`Saved in ${id}.`);log(`Saved ${id}.`);this.refreshResume();}
      catch(error){notice(`Save failed: ${error instanceof Error?error.message:String(error)}`);}
    }
    private loadSlot(id:SlotId):void {
      try{if(!this.store)throw new Error('Browser storage unavailable.');
        const state=this.store.load(id);this.refreshPortableSelector();this.combatArt.reset();this.applyCampaign(state,false);this.enterWorld();notice(`Loaded ${id}: ${this.map.name}.`);log(`Loaded ${id}.`);}
      catch(error){notice(`Load failed: ${error instanceof Error?error.message:String(error)}`);}
    }
    private exportFile():void {
      try{if(!this.store)throw new Error('Storage unavailable; no export service.');
        const content=this.store.exportText(this.snapshotCampaign());const blob=new Blob([content],{type:'application/json'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=this.store instanceof CampaignInstanceStore?'World-of-Maxxia-Instance-MP11.json':'World-of-Maxxia-Legacy-Save-v18.json';document.body.append(a);a.click();a.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Portable campaign snapshot exported with its pack provenance (or legacy save if selected).');}
      catch(error){notice(`Export failed: ${error instanceof Error?error.message:String(error)}`);}
    }
    private async importFile():Promise<void> {
      const input=element<HTMLInputElement>('import-file'),file=input.files?.[0];input.value='';if(!file)return;
      try{if(file.size>600000)throw new Error('Save file is too large.');
        if(!this.instances)throw new Error('Campaign instance storage is unavailable.');
        const imported=this.instances.importText(await file.text());
        const name=`Imported adventure ${this.instances.listInstances().length+1}`;
        if(!window.confirm(`Import into a NEW independent campaign named ${name}? Existing saves will remain unchanged.`))return;
        const id=this.instances.create(name,imported.campaign,imported.scoped);this.store=this.instances;
        this.combatArt.reset();this.applyCampaign(imported.campaign,false);this.refreshInstanceSelector(id);this.refreshPortableSelector();this.enterWorld();notice('Imported adventure saved as a new independent instance.');log('Portable adventure imported.');
      }catch(error){notice(`Import rejected; current adventure unchanged: ${error instanceof Error?error.message:String(error)}`);}
    }
    private roll(): void {
      const result=this.performSimulation({type:'roll',min:1,max:20});
      const rolled=result.events.find(e=>e.type==='roll.result');
      if(rolled?.type==='roll.result')element('rng-result').textContent=`${rolled.value} / 20`;
    }
    private syncPause(): void {
      element('pause').textContent = this.paused ? 'Resume light' : 'Pause light';
      element('pause').setAttribute('aria-pressed', String(this.paused));
    }
    private refreshReadouts():void{
      element('position').textContent=`${this.world.x}, ${this.world.y}`;
      element('facing').textContent=FACING_NAMES[this.world.facing];
      element('game').dataset.light=String(this.campaign.magic.effects.some(e=>e.kind==='light'&&e.expiresAtMinute!>this.campaign.elapsedMinutes));
      const minutes=480+this.campaign.elapsedMinutes;element('clock').textContent=`${(Math.floor(minutes/60)%24).toString().padStart(2,'0')}:${(minutes%60).toString().padStart(2,'0')}`;
      element('compass-letter').textContent=FACING_NAMES[this.world.facing][0];
      element('area-name').textContent=this.map.name.toUpperCase();
      element('view-label').textContent=`${this.world.x}, ${this.world.y} · ${FACING_NAMES[this.world.facing].toUpperCase()}`;
      const vectors=[[0,-1],[1,0],[0,1],[-1,0]],v=vectors[this.world.facing];
      const door=doorAt(this.map,this.world.x+v[0],this.world.y+v[1]);
      const portal=(this.map as import('../shared/rules/campaign.ts').TravelMap).portals?.find(p=>(p.activation??'interact')==='interact'&&((p.x===this.world.x&&p.y===this.world.y)||(p.x===this.world.x+v[0]&&p.y===this.world.y+v[1])));
      const service=nearbyService(this.snapshotCampaign(),this.mapRegistry);
      const remains=nearbyGround(this.snapshotCampaign(),this.mapRegistry);
      const nearCache=cacheHere(this.snapshotCampaign())||groundDropHere(this.snapshotCampaign());
      const fountain=this.map.fountains?.find(f=>(f.x===this.world.x&&f.y===this.world.y)||(f.x===this.world.x+v[0]&&f.y===this.world.y+v[1]&&!isOpaque(this.map,this.world,f.x,f.y)));
      const townScene=this.map.id==='map_town'?this.map.props.find(p=>p.id.startsWith('scene_')&&!this.campaign.quests.seenScenes.includes(p.id)&&((p.x===this.world.x&&p.y===this.world.y)||(p.x===this.world.x+v[0]&&p.y===this.world.y+v[1]&&!isOpaque(this.map,this.world,p.x,p.y)))):undefined;
      const vaultScene=this.map.id==='map_resonator_vault'?this.map.props.find(p=>VAULT_SCENES.includes(p.id as typeof VAULT_SCENES[number])&&((p.x===this.world.x&&p.y===this.world.y)||(p.x===this.world.x+v[0]&&p.y===this.world.y+v[1]&&!isOpaque(this.map,this.world,p.x,p.y)))):undefined;
      const upperScene=this.map.id==='map_diagnostic_galleries'?this.map.props.find(p=>UPPER_SCENES.includes(p.id as typeof UPPER_SCENES[number])&&((p.x===this.world.x&&p.y===this.world.y)||(p.x===this.world.x+v[0]&&p.y===this.world.y+v[1]&&!isOpaque(this.map,this.world,p.x,p.y)))):undefined;
      const entities=interactionMenu(this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry).entities;
      const secret=this.map.secrets?.find(d=>d.x===this.world.x+v[0]&&d.y===this.world.y+v[1]&&this.world.secrets[d.id]);element('object-hint').textContent=nearbyPuzzles(this.map,this.world).length?nearbyPuzzles(this.map,this.world)[0].name+' · Space for puzzle controls.':entities.length?`${entities.map(e=>e.name).join(', ')} · Space for actions.`:remains.length?`${remains[0].name} · Space to loot.`:service?`${service.name} · Space to talk (${service.role}).`:nearCache?`Treasure nearby · Space to collect.`:portal?(!this.campaign.quests.questItems.includes('item_quest_cistern_key')&&portal.id==='portal_town_to_dungeon'?'The cistern stair requires Iona’s brass key.':(portal.id==='portal_upper_to_vault'&&!this.campaign.quests.flags.includes('flag_upper_descent_ready')?'The three bell inscriptions unlock the lower stair.':portal.id==='portal_vault_shortcut'&&!this.campaign.quests.questItems.includes('item_quest_regulator')?'Recover the regulator to open the shortcut.':`Gateway nearby · Space to travel to ${this.mapRegistry[portal.targetMapId].name}.`)):townScene?`${townScene.name} · Space to inspect.`:upperScene?`${upperScene.name} · Space to inspect or recover.`:vaultScene?`${vaultScene.name} · Space to inspect or operate.`:door?`${this.world.doors[door.id]?'Open':'Closed'} door ahead · Space to ${this.world.doors[door.id]?'close':'open'}.`:fountain?`${fountain.name} · Space to drink.`:secret?'A revealed passage · step forward.':'Space inspects nearby scenery.';
      game?.canvas.setAttribute('aria-label',`First-person ${this.map.name} view at ${this.world.x}, ${this.world.y}, facing ${FACING_NAMES[this.world.facing]}.`);
      const nearby=currentEnemies(this.snapshotCampaign()).some(e=>Math.abs(e.x-this.world.x)+Math.abs(e.y-this.world.y)<=3);
      const crown=element('frame-crown');crown.dataset.danger=String(nearby);crown.dataset.secret=String(!!secret);
      crown.textContent=secret?'✧':nearby?'⚠':'✦';crown.setAttribute('aria-label',secret?'A discovered secret passage is directly ahead.':nearby?'Danger: enemy nearby.':'No nearby threat detected.');
      const types=['fire','lightning','cold','poison'] as const;
      for(let i=0;i<types.length;i++){const type=types[i],node=document.querySelector<HTMLElement>(['.gem-nw','.gem-ne','.gem-sw','.gem-se'][i])!;
       const living=this.party.order.map(id=>this.party.characters[id]).filter(c=>c.hp>0),covered=living.filter(c=>derived(c).resistances[type]>0).length;
       node.dataset.active=String(covered>0);node.setAttribute('aria-label',`${type} resistance: ${covered} of ${living.length} living heroes protected.`);
       node.dataset.tip=`${type[0].toUpperCase()+type.slice(1)} protection: ${covered}/${living.length} heroes with positive resistance.`;
      }
      this.renderCombat();this.ui?.refreshParty();this.ui?.refreshMinimap();
    }
    private transientScope=newScopedState();
    private authoredRoutines:RoutineDocument|undefined;
    /** All gameplay commands use the same shared simulation function as headless tests. */
    private performSimulation(command:SimulationCommand):SimulationResult {
      const before=this.snapshotCampaign(),result=dispatchSimulation(before,this.mapRegistry,command,{routines:this.authoredRoutines??currentRoutineDocument(),social:currentSocialDocument(),quests:currentQuestDocument(),encounters:currentEncounterDocument(),scoped:this.instances?.getScopedState()??this.transientScope});
      this.recentCommands.push({command:structuredClone(command),status:result.status,events:result.events.map(e=>e.type),rngState:result.state.rng.state});
      if(this.recentCommands.length>32)this.recentCommands.shift();
      if(result.status==='failed'){const message=`Action rejected (${result.errorCode}): ${result.messages.join(' ')}`;notice(message);log(message);return result;}
      const savedRngCheckpoint=command.type==='roll'?this.checkpoint:null;
      if(result.changed){
        audioDirector.observe(before,result.state,result.presentation,result.messages);
        this.combatArt.observe(before,result.state,result.messages,result.presentation);
        this.renderer3d?.present(result.presentation);
        if(result.scoped){this.transientScope=result.scoped;this.instances?.setScopedState(result.scoped);}
        this.applyCampaign(result.state);
        if(savedRngCheckpoint){this.checkpoint=savedRngCheckpoint;element<HTMLButtonElement>('restore').disabled=false;}
        if(!this.campaign.combat.defeated)this.autosave();
      }
      for(const event of result.events){
        if(event.type==='encounter.offered'||event.type==='ui.open'&&event.screen==='encounter')showEncounterMenu(()=>encounterMenu(this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry,currentEncounterDocument()),command=>this.performSimulation(command).messages.join(' '));
        if(event.type==='ending.reached')showQuestEnding(event.ending);
        if(event.type==='ui.open'&&event.screen==='journal')showQuestJournal(()=>questJournal(this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry,currentQuestDocument()),command=>this.performSimulation(command).messages.join(' '),()=>this.ui?.openOriginalJournal());
        if(event.type==='ui.open'&&event.screen==='social'&&event.id){const id=event.id;showSocialMenu(()=>socialView(this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry,currentSocialDocument(),id,currentQuestDocument()),request=>this.performSimulation({type:'social',entityId:id,...request}).messages.join(' '));}
        if(event.type==='ui.open'&&event.screen==='interaction')showInteractionMenu(()=>interactionMenu(this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry),(id,action)=>this.performSimulation({type:'object',entityId:id,action}).messages.join(' '));
        if(event.type==='ui.open'&&event.screen==='loot')this.ui?.openLoot();
        if(event.type==='ui.open'&&event.screen==='service'&&event.id)this.ui?.openService(event.id);
      }
      this.ui?.refreshParty();this.ui?.refreshCommands();
      const quietNavigation=command.type==='grid'&&result.changed&&(command.action.startsWith('turn_')||
        result.messages.every(m=>/^\d+, \d+ · facing (North|East|South|West)\.$/.test(m)));
      for(const message of result.messages){
        if(quietNavigation){element('notice').textContent=message;pendingNotice=null;}
        else {notice(message);log(message);}
      }
      this.refreshReadouts();return result;
    }
    private expeditionAction(action:'rest'|'bash'|'lockpick'|'search'):ExpeditionResult {
      const result=this.performSimulation({type:'expedition',action});
      if(result.changed){void audioDirector.cue(action==='rest'?'rest':'attack');this.engageNearby();}
      return {state:result.state,changed:result.changed,message:result.messages.at(-1)??''};
    }
    private command(action:GridAction):void {
      if(!this.entered||failed||this.ui?.isOpen||document.querySelector('dialog[open]')||this.time.now<this.transitionUntil)return;
      if(this.campaign.combat.active||this.campaign.combat.defeated){notice('Combat is active. Use Attack, Block or Run; movement is unavailable.');return;}
      if(action==='interact'){const p=nearbyPuzzles(this.map,this.world)[0];if(p){showPuzzle(()=>{const puzzle=nearbyPuzzles(this.map,this.world).find(v=>v.id===p.id);return puzzle?{puzzle,progress:this.world.perception?.puzzles[p.id]}:undefined;},c=>this.performSimulation(c).messages.join(' '));return;}}
      if(action==='interact'&&this.map.id==='map_town'&&this.campaign.expedition.fountainDays['map_town:town_well_spring']===undefined){
        const d=DIRECTIONS[this.world.facing],well=this.map.fountains?.find(f=>f.id==='town_well_spring'&&((f.x===this.world.x&&f.y===this.world.y)||(f.x===this.world.x+d.x&&f.y===this.world.y+d.y&&!isOpaque(this.map,this.world,f.x,f.y))));
        if(well&&this.party.order.some(id=>{const c=this.party.characters[id],max=derived(c);return c.hp>0&&(c.hp<max.maxHP||c.sp<max.maxSP);})&&!window.confirm('Spend Firstlight Well’s one-time full-party healing blessing? It cannot be used again in this adventure.'))return;
      }
      const before=this.world,beforeMap=this.map.id,beforeDoors=JSON.stringify(before.doors);
      const result=this.performSimulation({type:'grid',action});
      if(result.status==='failed')return;
      const moved=result.events.some(e=>e.type==='position.changed'&&e.moved);
      if(result.changed){
        const changedMap=beforeMap!==this.map.id;
        if(changedMap||action==='interact'&&beforeDoors!==JSON.stringify(this.world.doors))void audioDirector.cue('door');
        else if(moved)void audioDirector.cue(this.map.id==='map_town'?'step_town':'step_stone');
        if(moved||changedMap)this.ui?.showContextMap();
        if(changedMap){this.transitionUntil=0;this.lastRender=-1000;}
        else {
          this.from=viewPose(before);this.destination=viewPose(this.world);
          if(action==='turn_left')this.destination.angle=this.from.angle-Math.PI/2;
          if(action==='turn_right')this.destination.angle=this.from.angle+Math.PI/2;
          this.transitionStarted=this.time.now;this.transitionUntil=this.transitions&&Math.abs(before.x-this.world.x)+Math.abs(before.y-this.world.y)<=1&&(moved||action.startsWith('turn_'))?this.time.now+140:0;this.lastRender=-1000;
        }
        this.engageNearby();
      }else if(result.status==='blocked'&&result.messages.some(m=>m.includes('enemy blocks')))this.engageNearby();
      if(!document.querySelector('dialog[open]'))element('game').focus({preventScroll:true});
    }
    private engageNearby():void {
      if(!this.entered||this.campaign.combat.active||this.campaign.combat.defeated)return;
      this.performSimulation({type:'combat',action:'engage'});
    }
    private combatCommand(action:string):void {
      if(!this.entered||this.ui?.isOpen)return;
      if(['quick_fight','shoot','attack','block','run','mug'].includes(action))this.performSimulation({type:'combat',action:action as 'quick_fight'|'shoot'|'attack'|'block'|'run'|'mug'});
    }
    private renderCombat(pose:ViewPose=viewPose(this.world),refreshUi=true):void{
      if(!this.ui)return;
      if(refreshUi)this.ui.refreshCommands();
      const stage=element('combat-stage'),status=element('combat-status'),active=this.campaign.combat.active;
      const enemies=currentEnemies(this.campaign);
      const p=this.world;
      this.combatArt.sync(enemies.filter(e=>!this.map.enemyAppearances?.some(p=>p.kindId===e.kindId)),active?.targetId??null,this.map.id,{x:p.x,y:p.y,facing:p.facing},{map:this.map,state:p,pose});
      if(!refreshUi)return;
      status.hidden=!this.campaign.combat.defeated;
      if(this.campaign.combat.defeated){
        status.replaceChildren();status.append(document.createTextNode('The party has fallen. '));
        const recover=document.createElement('button');recover.textContent='Recover in town';recover.addEventListener('click',()=>this.performSimulation({type:'combat',action:'recover'}));status.append(recover);
        const load=document.createElement('button');load.textContent='Load save (Tab)';load.addEventListener('click',()=>this.ui?.activate('system'));status.append(load);
      }
    }
    update(time:number):void{
      audioDirector.setContext(this.campaign,this.entered);
      this.ui?.updateArt(performance.now());
      if(this.renderer3d&&this.world){
       const moving=time<this.transitionUntil&&this.from&&this.destination;
       if(moving||time-this.lastRender>=90){
        let pose=viewPose(this.world);
        if(moving&&this.from&&this.destination){const t=Math.min(1,(time-this.transitionStarted)/140),e=t*t*(3-2*t);pose={x:this.from.x+(this.destination.x-this.from.x)*e,y:this.from.y+(this.destination.y-this.from.y)*e,angle:this.from.angle+(this.destination.angle-this.from.angle)*e};}
        this.renderer3d.render(entityPresentationMap(this.map,this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry),this.world,pose,this.paused?0:time,upperArtState(this.campaign),sceneSpriteInstances(this.map,this.snapshotCampaign(),this.instances?.getScopedState()??this.transientScope,this.mapRegistry),this.paused,matchMedia('(prefers-reduced-motion: reduce)').matches);
        this.renderCombat(pose,false);this.lastRender=time;
       }
      }
      this.combatArt.update(performance.now(),this.paused||!this.entered||!!document.querySelector('dialog[open]'));
    }
  }
  game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', width: 640, height: 400,
    backgroundColor: '#101920', pixelArt: true, antialias: false,
    banner: false, scene: [BootScene, ChamberScene],
    scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
    render: {roundPixels: true}, audio: {noAudio: true},
    callbacks: {postBoot: (current:import('phaser').Game) => {
      current.canvas.setAttribute('role', 'img');
      current.canvas.setAttribute('aria-label', `First-person view of ${document.title}.`);
    }}
  });
  const canvas = game.canvas;
  canvas.addEventListener('webglcontextlost', event => {event.preventDefault(); fail(new Error('Graphics context lost. Reload to reopen the chamber.'));});
}
void (async()=>{const direct=new URL(location.href).searchParams.has('project')||new URL(location.href).searchParams.has('catalogue');const libraryLaunch=direct?null:await openLibraryHub();await start(libraryLaunch);})().catch(fail);
