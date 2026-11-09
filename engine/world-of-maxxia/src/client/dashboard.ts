import {perceivedMap} from '../shared/project/perception-contracts.ts';
import {terrainTile,terrainCell,configuration} from '../shared/project/terrain-contracts.ts';
import {progression} from '../shared/content/progression.ts';
import {LootScreen} from './loot-screen.ts';
import type {GroundContainer,LootRequest} from '../shared/rules/ground.ts';
import type {ThieveryState} from '../shared/rules/thievery.ts';
import {LOOT_CACHES} from '../shared/rules/inventory.ts';
import {messageHistory,type HistoryEntry} from './message-history.ts';
import {AdventureScreen,type AdventurePage} from './adventure-screen.ts';
import {showHoverTip,hideHoverTip} from './hover-tooltip.ts';
import {TownServiceScreen,isTownServiceView} from './town-service-screen.ts';
import {CharacterScreen} from './character-screen.ts';
import {openAudioSettings,showCredits,showEnding} from './presentation.ts';
import {recruitEditor} from './creation-screen.ts';
import type {HeroBlueprint} from '../shared/rules/creation.ts';
import {MAIN_STAGES,OPTIONAL_QUESTS,PLOT_ITEMS,type QuestState} from '../shared/rules/quests.ts';
import {TOWN_SERVICES,SHOP_STOCK,RUMORS,type TownService,type ServiceRequest,type ServicesState} from '../shared/rules/services.ts';
import {ITEMS,ITEM_CATEGORIES,type ItemCategory} from '../shared/content/items.ts';
import {itemName,type InventoryState,type ItemCommand} from '../shared/rules/inventory.ts';
import {SPELLS,STARTER_SPELLS,type CastRequest,type MagicState} from '../shared/rules/magic.ts';
import {EXPLORATION_COMMANDS,COMBAT_COMMANDS,ModalStack} from './ui-contract.ts';
import {portrait,icon} from './ui-art.ts';
import {itemArt,spellArt,spellClassLabel} from './phase30-art.ts';
import {conditionMarkArt,conditionMarkLabel} from './status-effects.ts';
import {createNpcSceneElement,updateNpcSceneElement} from './npc-scenes.ts';
import type {GridMap,GridState} from '../shared/rules/grid.ts';
import {ABILITIES,CLASSES,STARTER_GEAR,DAMAGE_TYPES,derived,modifier,training,conditionLabels,portraitState,healthColor,type PartyState,type Character,type PreparedStyle,type QuickAction} from '../shared/rules/party.ts';
import {DIRECTIONS,doorAt} from '../shared/rules/grid.ts';
import {expeditionDay,type ExpeditionState,type ExpeditionResult} from '../shared/rules/expedition.ts';
import {PREPARED_STYLES,preparedInfo} from '../shared/rules/party.ts';
import {classStrikeText,strikeProfile} from '../shared/rules/noncaster.ts';
import type {SlotId, SlotSummary} from '../shared/saves/campaign-store.ts';
interface View{kind:'help'|'bindings'|'system'|'display'|'diagnostics'|'portrait'|'map'|'information'|'quick'|'unavailable'|'confirm_menu'|'detail'|'exchange'|'saves'|'load'|'quick_options'|'spell_cast'|'spell_list'|'items'|'rest'|'service'|'shop'|'bank'|'roster'|'recruit_new'|'journal';title?:string;reason?:string;slot?:number;characterId?:string;detailKey?:string;spellId?:string;targetId?:string;steps?:1|2;category?:ItemCategory;itemId?:string;focusKey?:string;scrollY?:number;serviceId?:string;mode?:'buy'|'sell'|'identify'|'repair';serviceAmount?:number;confirmAction?:'ending_repair'|'ending_disconnect';journalTab?:'quests'|'items'|'notes'|'completed';journalPage?:number;}
export type PartyDiagnostic='wound'|'poison'|'exhaust'|'dead'|'restore'|'xp'|'wizard_level'|'priest_level'|'witch_level'|'fear'|'curse'|'curse_gear';
interface Hooks{effects?:()=>void;encounters?:()=>void;openAuthoredJournal?:()=>void;ground:()=>GroundContainer[];loot:(r:LootRequest)=>{changed:boolean;message:string};thievery:()=>ThieveryState;campCheck:()=>string|null;castCheck:(r:CastRequest)=>string|null;journal:()=>QuestState;serviceState:()=>ServicesState;nearService:()=>TownService|null;serviceAction:(request:ServiceRequest)=>{changed:boolean;message:string};expedition:()=>ExpeditionState;expeditionAction:(action:'rest'|'bash'|'lockpick'|'search')=>ExpeditionResult;inventory:()=>InventoryState;inventoryAction:(command:ItemCommand)=>{changed:boolean;message:string};craftAction:(recipeId:string,crafterId:string)=>{changed:boolean;message:string};notes:()=>string[];magic:()=>MagicState;castSpell:(r:CastRequest)=>{changed:boolean;message:string};readySpell:(casterId:string,spellId:string)=>{changed:boolean;message:string};learnWizard:(casterId:string,spellId:string)=>{changed:boolean;message:string};combat:()=>{active:boolean;actorId:string|null;actorName:string;targets:{id:string;name:string;hp:number;maxHP:number}[];selectedTargetId:string|null};combatCommand:(action:string)=>void;configurePrepared:(id:string,style:PreparedStyle)=>void;configureQuick:(id:string,action:QuickAction)=>void;target:(id:string)=>void;snapshot:()=>{map:GridMap;world:GridState};party:()=>PartyState;select:(id:string)=>void;exchange:(from:string,to:string)=>void;diagnostic:(id:string,action:PartyDiagnostic)=>void;returnToTitle:()=>void;clockMinutes:()=>number;slots:()=>SlotSummary[];save:(id:SlotId)=>void;load:(id:SlotId)=>void;exportSave:()=>void;importSave:()=>void;}
function el<T extends HTMLElement>(id:string):T{const n=document.getElementById(id);if(!n)throw new Error(`Missing dashboard element: ${id}`);return n as T;}
function signed(value:number):string{return value>=0?`+${value}`:String(value);}
function text(tag:string,value:string,className?:string):HTMLElement{const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;}
function panelArt(src:string,alt:string,className='panel-art'):HTMLImageElement{const img=document.createElement('img');img.className=className;img.src=src;img.alt=alt;img.decoding='async';img.loading='lazy';return img;}
function decoratePanelButton(button:HTMLButtonElement,src:string,title:string,meta:string):HTMLButtonElement{const shortcut=button.querySelector('kbd');button.textContent='';button.append(panelArt(src,'' ,'button-art'));const copy=text('span','', 'button-copy');copy.append(text('strong',title),text('small',meta));button.append(copy);if(shortcut)button.append(shortcut);return button;}
export class Dashboard{
 private loot!:LootScreen;private character!:CharacterScreen;private service!:TownServiceScreen;private adventure!:AdventureScreen;
 private stack=new ModalStack<View>();private dialog=el<HTMLDialogElement>('overlay');
 private body=el('panel-body');private parking=el('panel-parking');
 private diagnostics=el('diagnostics-content');private display=el('display-content');
 private origin:HTMLElement|null=null;private focusTrail:(string|null)[]=[];
 private originCharacterId:string|null=null;private viewIsMap=true;private returnKey=0;private lastCombatMode:boolean|null=null;
 constructor(private hooks:Hooks){
  this.loot=new LootScreen({party:()=>hooks.party(),containers:()=>hooks.ground(),take:r=>hooks.loot(r),select:id=>{hooks.select(id);this.refreshParty();}});
  this.refreshCommands();
  const portraits=el('portrait-strip');
  for(let i=0;i<6;i++){
   const button=document.createElement('button');button.className='portrait-slot';button.dataset.slot=String(i);button.dataset.focusKey=`portrait-${i}`;
   button.addEventListener('click',()=>this.openPortrait(i));portraits.append(button);
  }
  this.character=new CharacterScreen({castCheck:r=>this.hooks.castCheck(r),castSpell:r=>this.hooks.castSpell(r),readySpell:(id,spell)=>this.hooks.readySpell(id,spell),inventory:()=>this.hooks.inventory(),inventoryAction:r=>this.hooks.inventoryAction(r),craftAction:(recipeId,crafterId)=>this.hooks.craftAction(recipeId,crafterId),party:()=>this.hooks.party(),magic:()=>this.hooks.magic(),journal:()=>this.hooks.journal(),combat:()=>this.hooks.combat(),onVisibility:()=>this.refreshParty(),select:id=>{this.hooks.select(id);this.refreshParty();},legacy:action=>{const id=this.hooks.party().selectedId;if(action==='inventory')this.push({kind:'items',characterId:id,category:'weapons'});if(action==='spellbook')this.push({kind:'spell_cast',characterId:id});if(action==='setup')this.push({kind:'quick_options',characterId:id});if(action==='exchange')this.push({kind:'exchange',characterId:id});}});
  this.adventure=new AdventureScreen({...hooks,drawMap:(c,m,w,r)=>this.drawMap(c,m,w,r),rest:()=>this.hooks.expeditionAction('rest'),epilogue:()=>showEnding({quests:this.hooks.journal(),party:this.hooks.party()} as import('../shared/rules/campaign.ts').CampaignState)});
  this.service=new TownServiceScreen(()=>this.pop(),()=>this.closeService());
  this.refreshParty();
  el('system-gem').addEventListener('click',()=>this.activate('system'));
  el('options-button').addEventListener('click',()=>this.activate('system'));
  el('diagnostics').addEventListener('click',()=>this.activate('diagnostics'));
  el('view-toggle').addEventListener('click',e=>{e.stopPropagation();this.activate('view_toggle');});
  document.querySelector('.context-pane')!.addEventListener('click',e=>{const target=e.target as HTMLElement;if(target.closest('button,input,select')||window.getSelection()?.toString())return;const display=el('message-display'),r=display.getBoundingClientRect();if(!display.hidden&&(e as MouseEvent).clientX>=r.right-14)return;this.activate('view_toggle');});
  el('message-display').addEventListener('keydown',e=>{if(e.code==='Equal'){e.preventDefault();e.stopPropagation();this.activate('view_toggle');}});
  messageHistory.subscribe((entries,show)=>this.updateHistory(entries,show));
  el('panel-close').addEventListener('click',()=>this.pop());el('panel-back').addEventListener('click',()=>this.pop());
  this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.pop();});
  this.dialog.addEventListener('close',()=>{if(this.service?.isOpen||this.adventure?.isOpen)return;this.stack.clear();this.focusTrail=[];this.parkContent();const heroButton=this.originCharacterId?Array.from(el('portrait-strip').querySelectorAll<HTMLElement>('button')).find(b=>b.dataset.characterId===this.originCharacterId):null;(heroButton??(this.origin?.isConnected?this.origin:null))?.focus({preventScroll:true});this.origin=null;this.originCharacterId=null;this.character?.refresh();if(this.character?.isOpen)this.character.focus();});
  const tip=el('dashboard-tip');
  const showTip=(event:Event)=>{if(this.isOpen)return;const node=(event.target as HTMLElement).closest<HTMLElement>('[data-tip]');if(!node)return;showHoverTip(node.dataset.tip||'',node,event instanceof MouseEvent?event:undefined);};
  const hideTip=()=>{tip.hidden=true;hideHoverTip();};
  el('chamber-ui').addEventListener('pointerover',showTip);el('chamber-ui').addEventListener('focusin',showTip);
  el('chamber-ui').addEventListener('pointermove',showTip);el('chamber-ui').addEventListener('pointerout',hideTip);el('chamber-ui').addEventListener('focusout',hideTip);
  el<HTMLSelectElement>('view-scale').addEventListener('change',()=>this.setScale());
 }
 /** The same 3×3 grid is repopulated in combat mode; no second battle UI. */
 refreshCommands():void{
  const combat=this.hooks.combat(),mode=combat.active,grid=el('command-grid');
  if(this.lastCombatMode!==mode){
   this.lastCombatMode=mode;grid.replaceChildren();grid.setAttribute('aria-label',mode?'Combat commands':'Exploration commands');
   for(const c of mode?COMBAT_COMMANDS:EXPLORATION_COMMANDS){
    const button=document.createElement('button');button.className='command-button';button.dataset.command=c.id;button.dataset.focusKey=c.id;
    const unavailable=!!c.reason;button.dataset.unavailable=String(unavailable);
    button.innerHTML=`${icon(c.icon)}<span>${c.label}</span><kbd>${c.key}</kbd>${unavailable?'<i aria-hidden="true">·</i>':''}`;
    button.setAttribute('aria-label',`${c.label} (${c.key})${unavailable?' — not yet available':''}`);
    const tips:Record<string,string>={lockpick:'Pick a door/chest lock or steal from a faced NPC/monster using the best conscious Dexterity. 10 minutes + 1 food.',search:'Search this tile and its eight neighbors for treasure, traps and secret passages. 10 minutes + 1 food.',bash:'Force a door or chest. 5 minutes + 1 food; every conscious hero loses 1 HP. Chest items may be destroyed.',mug:'Use this hero’s turn to steal the selected enemy’s bonus item. Dexterity check; melee reach. One item per creature, separate from victory loot.'};button.dataset.tip=`${c.label} (${c.key}). ${tips[c.id]??c.reason??'Use the command on the current party member.'}`;
    button.addEventListener('click',()=>this.activate(c.id));grid.append(button);
   }
  }
  const encounter=el('combat-context');encounter.hidden=!mode;
  this.refreshContextMode();
  if(mode){encounter.replaceChildren();encounter.append(text('strong',`TURN: ${combat.actorName} · QUICK: ${(combat.actorId?this.hooks.party().characters[combat.actorId]?.combatSetup.quickAction:null)??'—'}`));
   combat.targets.forEach((target,index)=>{
    const b=document.createElement('button');b.className='target-choice';b.textContent=`${index+1}. ${target.name} · ${target.hp}/${target.maxHP}`;
    b.setAttribute('aria-pressed',String(target.id===combat.selectedTargetId));b.addEventListener('click',()=>this.hooks.target(target.id));encounter.append(b);
   });
  }
 }
 private refreshContextMode():void{el('map-display').hidden=!this.viewIsMap;el('message-display').hidden=this.viewIsMap;el('crest-display').hidden=true;const toggle=el('view-toggle');toggle.setAttribute('aria-label',this.viewIsMap?'Show message history (=)':'Show automap (=)');toggle.setAttribute('aria-pressed',String(!this.viewIsMap));toggle.querySelector('.context-title')!.textContent=this.viewIsMap?'AUTOMAP':'CHAMBER RECORD';document.querySelector<HTMLElement>('.context-pane')!.dataset.mode=this.viewIsMap?'map':'text';}
 showContextMap():void{this.viewIsMap=true;this.refreshContextMode();}
 private updateHistory(entries:readonly HistoryEntry[],show:boolean):void{
  const list=el('message-history'),display=el('message-display'),atBottom=display.scrollHeight-display.scrollTop-display.clientHeight<8,last=Number(list.lastElementChild?.getAttribute('data-message-id')??0);
  for(const entry of entries)if(entry.id>last){const li=document.createElement('li');li.dataset.messageId=String(entry.id);li.textContent=entry.text;list.append(li);}
  while(list.children.length>entries.length)list.firstElementChild?.remove();
  if(show)this.viewIsMap=false;this.refreshContextMode();if(show||atBottom)display.scrollTop=display.scrollHeight;
 }
 get isOpen():boolean{return this.loot.isOpen||this.dialog.open||!!this.character?.isOpen||!!this.service?.isOpen||!!this.adventure?.isOpen;}
 get depth():number{return this.stack.depth;}
 get selectedSlot():number{return this.hooks.party().order.indexOf(this.hooks.party().selectedId);}
 private setScale():void{const v=el<HTMLSelectElement>('view-scale').value;const stage=document.querySelector<HTMLElement>('.stage')!;stage.style.width=v==='fit'?'100%':`${640*Number(v)+12}px`;stage.style.maxWidth='none';}
 private parkContent():void{for(const node of [this.diagnostics,this.display]){if(node.parentElement!==this.parking)this.parking.append(node);}}
 private push(view:View):void{
  hideHoverTip();
  if(view.kind==='quick_options')this.character.close(false);
  if(['map','journal','information','rest'].includes(view.kind)){this.closeAll();this.adventure.open(view.kind as AdventurePage);return;}
  this.adventure?.close(false);
  if(isTownServiceView(view.kind)){
   if(!this.service.isOpen){this.character.close(false);if(this.dialog.open)this.dialog.close();this.stack.clear();this.focusTrail=[];this.service.notify('');}
   const active=document.activeElement as HTMLElement;if(this.stack.top)this.stack.top.scrollY=this.service.content.scrollTop;this.focusTrail.push(active?.dataset.focusKey??null);this.stack.push(view);this.service.notify('');this.render();this.service.focus();return;
  }
  if(this.service.isOpen)this.closeService(false);

  if(view.kind==='spell_cast'||view.kind==='spell_list'){if(this.dialog.open){this.stack.clear();this.dialog.close();}if(view.characterId)this.hooks.select(view.characterId);this.character.open('spellbook');this.refreshParty();return;}
  if(view.kind==='items'){if(this.dialog.open){this.stack.clear();this.dialog.close();}if(view.characterId)this.hooks.select(view.characterId);this.character.open('inventory');this.refreshParty();return;}
  if(this.dialog.open&&this.stack.depth>=8){el('panel-trail').textContent='Close a panel before opening another.';el('panel-back').focus();return;}
  el('dashboard-tip').hidden=true;
  if(!this.dialog.open){this.origin=document.activeElement as HTMLElement;this.originCharacterId=this.origin?.dataset.characterId??null;this.stack.clear();this.focusTrail=[];}
  const active=document.activeElement as HTMLElement;if(this.stack.top)this.stack.top.scrollY=this.dialog.scrollTop;
  this.focusTrail.push(active?.dataset.focusKey??null);this.stack.push(view);this.render();
  if(!this.dialog.open){if(view.kind==='quick_options'){document.querySelector('.surface')!.append(this.dialog);this.dialog.show();}else this.dialog.showModal();}
  el('panel-back').focus({preventScroll:true});
 }
 private closeService(restore=true):void{this.service.close(restore);this.stack.clear();this.focusTrail=[];this.body=el('panel-body');this.refreshParty();}
 private pop():void{
  if(this.service.isOpen){this.stack.pop();const key=this.focusTrail.pop();if(!this.stack.depth){this.closeService();return;}this.service.notify('');this.render();this.service.content.scrollTop=this.stack.top?.scrollY??0;const target=Array.from(this.body.querySelectorAll<HTMLElement>('[data-focus-key]')).find(b=>b.dataset.focusKey===key);(target??this.service.content).focus({preventScroll:true});return;}

  this.stack.pop();const focus=this.focusTrail.pop();
  if(!this.stack.depth){this.parkContent();this.dialog.close();return;}
  this.render();this.dialog.scrollTop=this.stack.top?.scrollY??0;const target=Array.from(this.body.querySelectorAll<HTMLElement>('[data-focus-key]')).find(b=>b.dataset.focusKey===focus);
  (target??el('panel-back')).focus({preventScroll:true});
 }
 openLoot():void{this.closeAll();this.loot.open();}
 closeAll():void{this.loot?.close();this.adventure?.close(false);hideHoverTip();this.service?.close(false);this.body=el('panel-body');this.character?.close(false);this.origin=null;this.originCharacterId=null;this.stack.clear();this.parkContent();this.dialog.close();}
 private button(label:string,fn:()=>void,key?:string):HTMLButtonElement{
  const b=document.createElement('button');b.className='panel-button';b.textContent=label;b.dataset.focusKey=`panel-action-${this.returnKey++}`;
  if(key){b.dataset.shortcut=key;const k=text('kbd',key.toUpperCase());b.append(k);}
  b.addEventListener('click',fn);this.body.append(b);return b;
 }
 private unavailable(title:string,reason:string):void{this.push({kind:'unavailable',title,reason});}
 openOriginalJournal():void{this.closeAll();this.adventure.open('journal',true);}
 activate(action:string):void{
  if(action==='view_toggle'){if(this.isOpen)return;this.viewIsMap=!this.viewIsMap;this.refreshContextMode();if(!this.viewIsMap){const history=el('message-display');history.scrollTop=history.scrollHeight;}return;}
  if(action.startsWith('portrait_')){this.openPortrait(Number(action.slice(9)));return;}
  const c=(this.hooks.combat().active?COMBAT_COMMANDS:EXPLORATION_COMMANDS).find(c=>c.id===action);
  const unavailableReason:string|undefined=c?.reason;
  if(c&&unavailableReason){this.unavailable(c.label,unavailableReason);return;}
  if(action==='dismiss'){this.push({kind:'unavailable',title:'Roster',reason:'Visit Tessa Bell at the Silver Lantern to dismiss or recruit companions.'});return;}
  if(action==='quick'){if(this.dialog.open)this.closeAll();this.character.open('party');return;}
  if(action==='quests'&&this.hooks.openAuthoredJournal){this.closeAll();this.hooks.openAuthoredJournal();return;}
  if(action==='quests'){this.push({kind:'journal',journalTab:'quests',journalPage:0});return;}
  if(action==='rest'){this.push({kind:'rest'});return;}
  if(action==='bash'||action==='lockpick'||action==='search'){this.hooks.expeditionAction(action);return;}
  if(['shoot','attack','block','run','quick_fight','mug'].includes(action)){this.hooks.combatCommand(action);return;}
  if(action==='use'){this.push({kind:'items',characterId:this.hooks.combat().actorId??this.hooks.party().selectedId,category:'misc'});return;}
  if(action==='cast'){const party=this.hooks.party(),actor=this.hooks.combat().actorId,selected=actor??party.selectedId;const chosen=!!CLASSES[party.characters[selected]?.classId]?.casting?selected:party.order.find(id=>!!CLASSES[party.characters[id].classId]?.casting)??selected;this.push({kind:'spell_cast',characterId:chosen});return;}
  if(action==='quick_options'){this.push({kind:'quick_options',characterId:this.hooks.combat().actorId??this.hooks.party().selectedId});return;}
  if(['help','system','diagnostics','map','information','quick'].includes(action))this.push({kind:action as View['kind']});
 }
 refreshParty():void{
  const party=this.hooks.party();
  for(const b of el('portrait-strip').querySelectorAll<HTMLButtonElement>('button')){
   const slot=Number(b.dataset.slot),id=party.order[slot];b.hidden=!id;if(!id)continue;
   const c=party.characters[id],d=derived(c),conditions=conditionLabels(c),state=portraitState(c);
   b.dataset.characterId=id;b.dataset.health=healthColor(c);const fight=this.hooks.combat();b.dataset.inspecting=String(!!this.character?.isOpen&&party.selectedId===id);b.dataset.acting=String(fight.active&&fight.actorId===id);b.setAttribute('aria-pressed',String(this.character?.isOpen?party.selectedId===id:fight.active?fight.actorId===id:party.selectedId===id));
   b.setAttribute('aria-label',`F${slot+1}: ${c.name}, ${CLASSES[c.classId].name}, HP ${c.hp}/${d.maxHP}, SP ${c.sp}/${d.maxSP}, ${conditions.join(', ')||'Good'}`);
   b.dataset.tip=`F${slot+1} · ${c.name} · ${CLASSES[c.classId].name} · HP ${c.hp}/${d.maxHP} · SP ${c.sp}/${d.maxSP} · ${conditions.join(', ')||'Good'}`;
   const marks=c.conditions.map(cond=>`<img class="portrait-condition" src="${conditionMarkArt(cond.id)}" alt="${conditionMarkLabel(cond.id)}" title="${conditionMarkLabel(cond.id)}">`).join('');
   b.innerHTML=`<span class="portrait-face">${portrait(c.portrait,state,c.portraitId)}</span><span class="portrait-status-marks">${marks}</span><span class="portrait-caption"></span><span class="portrait-vitals" aria-hidden="true"><i></i></span><kbd>F${slot+1}</kbd>`;
   b.querySelector('.portrait-caption')!.textContent=c.name;(b.querySelector('.portrait-vitals i') as HTMLElement).style.width=`${c.hp/d.maxHP*100}%`;
  }
  this.character?.refresh();
 }
 openPortrait(slot:number):void{
  if(this.loot.isOpen){const id=this.hooks.party().order[slot];if(id)this.loot.switchTo(id);return;}
  this.adventure?.close(false);hideHoverTip();
  if(this.service?.isOpen){const id=this.hooks.party().order[slot];if(!id)return;this.hooks.select(id);this.stack.replace({...this.stack.top!,characterId:id,itemId:undefined});this.service.notify('');this.render();this.refreshParty();return;}

  if(!this.dialog.open){const id=this.hooks.party().order[slot];if(!id)return;if(this.character.isOpen)this.character.switchTo(id);else {this.hooks.select(id);this.refreshParty();this.character.open('stats');}return;}
  const party=this.hooks.party(),id=party.order[slot];if(!id)return;
  this.hooks.select(id);this.refreshParty();
  if(this.stack.top?.kind==='items'){this.stack.replace({...this.stack.top,characterId:id,itemId:undefined,targetId:undefined});this.render();el('panel-back').focus({preventScroll:true});}
  else if(this.stack.top?.kind==='quick_options'){this.stack.replace({...this.stack.top,characterId:id});this.render();}
  else if(this.stack.top&&['portrait','detail'].includes(this.stack.top.kind)){this.render();el('panel-back').focus({preventScroll:true});}
  else this.push({kind:'portrait'});
 }
 private exchangeWith(id:string):void{
  const from=this.stack.top?.characterId;if(!from)return;
  this.hooks.exchange(from,id);this.refreshParty();this.pop();
 }
 handleKey(event:KeyboardEvent):void{
  if(this.loot.isOpen){this.loot.handleKey(event);return;}
  if(this.adventure.isOpen){if(/^F[1-6]$/.test(event.code)){event.preventDefault();if(!event.repeat)this.openPortrait(Number(event.code.slice(1))-1);}else this.adventure.handleKey(event);return;}
  if(!this.dialog.open&&this.character.isOpen){this.character.handleKey(event);return;}
  if(!this.isOpen)return;
  if(event.code==='Escape'){event.preventDefault();this.pop();return;}
  if(this.service.isOpen&&event.code==='Tab'){this.service.handleTab(event);return;}
  if(this.service.isOpen&&/^F[1-6]$/.test(event.code)){event.preventDefault();if(!event.repeat)this.openPortrait(Number(event.code.slice(1))-1);return;}
  const target=event.target as HTMLElement;
  if(/^F[1-6]$/.test(event.code)){event.preventDefault();if(!event.repeat&&!target.matches('input,textarea,select')){const slot=Number(event.code.slice(1))-1;if(this.stack.top?.kind==='exchange'){const id=this.hooks.party().order[slot];if(id)this.exchangeWith(id);}else if(['spell_cast','spell_list'].includes(this.stack.top?.kind??'')){
    const id=this.hooks.party().order[slot];if(!id)return;const view=this.stack.top!;const spellId=view.spellId??this.hooks.magic().readied[view.characterId??''];const spell=spellId?SPELLS[spellId]:undefined;
    if(view.kind==='spell_cast'&&spell?.target==='ally'){this.stack.replace({...view,targetId:id});this.render();}
    else if(view.kind==='spell_cast'&&!this.hooks.combat().active&&['wizard','priest','witch'].includes(this.hooks.party().characters[id].classId)){this.stack.replace({...view,characterId:id,targetId:undefined});this.render();}
   }else if(this.stack.top?.kind==='items'){const id=this.hooks.party().order[slot];if(id){this.hooks.select(id);this.refreshParty();}this.stack.replace({...this.stack.top,characterId:this.hooks.party().order[slot],itemId:undefined});this.render();}else if(this.stack.top?.kind==='quick_options'){this.stack.replace({...this.stack.top,characterId:this.hooks.party().order[slot]});this.render();}else if(this.stack.top&&['portrait','detail','quick'].includes(this.stack.top.kind))this.openPortrait(slot);}return;}
  if(target.matches('input,textarea,select')||target.isContentEditable||event.ctrlKey||event.altKey||event.metaKey||event.repeat)return;
  const button=Array.from(this.body.querySelectorAll<HTMLButtonElement>('[data-shortcut]')).find(b=>b.dataset.shortcut===event.key.toLowerCase());
  if(button){event.preventDefault();button.focus({preventScroll:true});button.click();return;}
  // Keep arrows and Space from reaching world controls; normal button/scroll behavior stays native.
 }
 private renderMemberPicker():void{
  const party=this.hooks.party(),bar=text('div','','member-picker');bar.setAttribute('role','group');bar.setAttribute('aria-label','Switch inspected character');
  party.order.forEach((id,i)=>{const b=document.createElement('button');b.dataset.focusKey=`switch-${id}`;b.setAttribute('aria-pressed',String(id===party.selectedId));b.setAttribute('aria-label',`Inspect ${party.characters[id].name} (F${i+1})`);b.append(text('small',`F${i+1}`),text('span',party.characters[id].name));b.addEventListener('click',()=>this.openPortrait(i));bar.append(b);});this.body.append(bar);
 }
 private renderCharacterDetail(c:Character,key:string):void{
  const d=derived(c),cls=CLASSES[c.classId],p=(s:string)=>this.body.append(text('p',s));
  el('panel-title').textContent=`${c.name} · ${key}`;
  if(ABILITIES.includes(key as typeof ABILITIES[number])){const a=key as typeof ABILITIES[number];p(`Base ${c.attributes[a]} + adjustment ${signed(c.attributeBonuses[a])} = ${d.attributes[a]}. Current modifier ${signed(modifier(d.attributes[a]))}.`);p('Modifier = floor((score − 10) / 2). Effective attributes are bounded from 1 to 30.');p(`${cls.name}'s primary attribute is ${cls.primary}.${cls.casting?` ${cls.casting} determines spell-point capacity and spell DC.`:''}`);return;}
  if(key==='HP'){p(`Hit points ${c.hp} / ${d.maxHP}. ${c.hp===0?'Dead; ordinary healing cannot revive this character.':'Living.'}`);p(`Class base ${cls.hpBase} + CON modifier ${signed(modifier(d.attributes.CON))} + ${c.level-1} gained levels × max(1, ${cls.hpGain} + CON modifier).`);p('Damage and healing persist through combat. Diagnostic controls can still exercise portrait conditions.');return;}
  if(key==='SP'){p(`Spell points ${c.sp} / ${d.maxSP}.`);p(cls.casting?`8 + 2 × max(0, ${cls.casting} modifier) + 4 × (level − 1). All three caster classes share this resource model. Cast spells via C; one spell-point system serves all casters.`:'This class is not a spellcaster and has no spell-point pool.');return;}
  if(key==='Defense'){p(`Defense ${d.defense} = 10 + armor ${d.armorBonus} + shield ${d.shieldBonus} + DEX contribution ${signed(d.dexContribution)}${c.conditions.some(v=>v.id==='cursed')?' − 2 cursed':''}.`);p(`Prepared class bonus ${signed(d.preparedDefense)}. Medium armor caps positive DEX at +2; heavy armor caps it at +0.`);return;}
  if(key==='Attack'){p(`${d.weaponName} · ${c.equipment.preferredAttack} · attack ${signed(d.attackBonus)} · damage ${d.weaponDice}${signed(d.damageBonus)}.`);p(`Core attack uses proficiency ${signed(d.proficiency)} plus ${d.attackAbility} modifier, accuracy and active condition penalties. Minimum damage on a hit will be 1.`);if(d.spellDC!==null)p(`Spell DC ${d.spellDC} = 10 + proficiency + ${cls.casting} modifier.`);if(cls.traits.length){p(classStrikeText(c));p('Prepared attacks use one Attack press; the selected routine supplies its own modifiers.');}else p('Use C to open the shared spellcasting interface.');return;}
  if(key==='Experience'||key==='Level'){const t=training(c);p(`Level ${c.level} · proficiency ${signed(d.proficiency)} · total XP ${c.xp}.`);p(t.capped?`Level cap: ${progression().maxLevel}.`:`Level ${t.nextLevel} requires ${t.nextXP} total XP and ${t.cost} gold at training. ${t.eligible?'XP requirement met.':`${t.remainingXP} XP still needed.`}`);p('Earning XP does not automatically level the character. Training is available at Captain Brann in Firstlight Village. Custom character creation arrives in Phase 19.');return;}
  if(key==='Resistances'){const list=text('dl','','binding-list');for(const type of DAMAGE_TYPES)list.append(text('dt',type[0].toUpperCase()+type.slice(1)),text('dd',`${d.resistances[type]}%`));this.body.append(list);p('Resistance values are bounded from −50% to +75%. Starting adventurers have no elemental resistance bonuses.');return;}
  if(key==='Conditions'){p(conditionLabels(c).join(', ')||'Good — no adverse conditions.');for(const condition of c.conditions)p(`${condition.id}: ${condition.remaining===null?'until removed':`${condition.remaining} ${condition.unit} remaining`}.`);p('Conditions, timed expiry and poison ticks advance only when game time passes. Reading this sheet never advances the clock; rest and cures follow the expedition rules.');return;}
  if(key==='Equipment'){const list=text('dl','','binding-list');for(const slot of ['melee','ranged','body','offhand','accessoryA','accessoryB'] as const){const id=c.equipment[slot];list.append(text('dt',({melee:'Melee weapon',ranged:'Ranged weapon',body:'Body armor',offhand:'Off hand',accessoryA:'Accessory 1',accessoryB:'Accessory 2'})[slot]),text('dd',id?ITEMS[id].name:'Empty'));}this.body.append(list);p('Equipment changes are made in Items. Damaged equipment can be repaired in town.');this.button('Open Items',()=>this.push({kind:'items',characterId:c.id,category:'weapons'}),'i');return;}
  if(key==='Class abilities'){p(cls.role);p(cls.features);p(`Prepared: ${preparedInfo(c.combatSetup.prepared).name}. Quick default: ${c.combatSetup.quickAction}.`);if(cls.traits.length)p(classStrikeText(c));this.button('Configure prepared style and Quick Fight',()=>this.push({kind:'quick_options',characterId:c.id}),'o');return;}
  if(key==='Awards'){p(c.awards.length?c.awards.join(', '):'No awards earned yet.');p('Awards are stored per character; quest rewards arrive with authored content.');return;}
  if(key==='Supplies'){const r=this.hooks.party().resources;p(`Party gold ${r.gold} · food ${r.food} portions · banked gold ${r.bankGold}.`);p('Supplies are held as physical items in each character bag. Open Items to use or transfer them.');return;}
 }
 private renderPartyDiagnostics():void{
  this.body.append(text('h3','Party state tests'));
  this.body.append(text('p','Test tools only. Changes affect the current session; no combat, reward or healing service is being simulated.','panel-note'));
  const party=this.hooks.party(),select=document.createElement('select');select.id='diagnostic-member';select.setAttribute('aria-label','Test party member');
  for(const id of party.order){const o=document.createElement('option');o.value=id;o.textContent=party.characters[id].name;select.append(o);}select.value=party.selectedId;this.body.append(select);
  const summary=text('p','','diagnostic-summary');summary.id='party-diagnostic-status';summary.setAttribute('role','status');this.body.append(summary);
  const update=()=>{const c=this.hooks.party().characters[select.value],d=derived(c);summary.textContent=`${c.name}: HP ${c.hp}/${d.maxHP}, SP ${c.sp}/${d.maxSP}, XP ${c.xp}, ${conditionLabels(c).join(', ')||'Good'}`;};
  select.addEventListener('change',()=>{this.hooks.select(select.value);this.refreshParty();update();});update();
  for(const [action,label] of [['wound','Wound to 40% HP'],['poison','Apply poison'],['exhaust','Exhaust SP'],['dead','Mark dead'],['restore','Restore selected'],['xp','Add 250 test XP'],['wizard_level','Advance Wizard one level (test only)'],['priest_level','Advance Priest one level (test only)'],['witch_level','Advance Witch one level (test only)'],['fear','Apply fear (test only)'],['curse','Apply cursed condition (test only)'],['curse_gear','Curse equipped gear (test only)']] as [PartyDiagnostic,string][]){this.button(label,()=>{this.hooks.diagnostic(select.value,action);this.refreshParty();update();});}
  this.button('Learn eligible caster spells (test only)',()=>{const c=this.hooks.party().characters[select.value];if(!c||!['wizard','priest','witch'].includes(c.classId)){summary.textContent='Choose a Wizard, Priest or Witch to learn spells.';return;}let result='';for(const spell of Object.values(SPELLS).filter(sp=>sp.classId===c.classId&&sp.level<=c.level)){const r=this.hooks.learnWizard(c.id,spell.id);if(r.changed)result=r.message;}update();summary.textContent+=(result?' · '+result:' · No new eligible spells.');});
 }
 openService(id:string):void{const npc=TOWN_SERVICES.find(n=>n.id===id);if(npc)this.push({kind:'service',serviceId:npc.id,characterId:this.hooks.party().selectedId});}
 private renderService(view:View):void{
  const npc=TOWN_SERVICES.find(n=>n.id===view.serviceId);if(!npc)return;
  const p=(value:string)=>this.body.append(text('p',value));
  const party=this.hooks.party(),state=this.hooks.serviceState();
  el('panel-title').textContent=`${npc.name} · ${npc.role}`;
  if(!this.service.isOpen){const scene=createNpcSceneElement(npc.id);if(scene)this.body.append(scene);}
  p(npc.description);
  const msg=(value:string)=>{if(this.service.isOpen){this.service.notify(value);return;}const note=text('p',value,'panel-note');note.setAttribute('role','status');this.body.prepend(note);};
  const act=(action:ServiceRequest['action'],other:Partial<ServiceRequest>={})=>{
    const previousScroll=this.service.isOpen?this.body.scrollTop:this.dialog.scrollTop,focus=(document.activeElement as HTMLElement)?.dataset.focusKey;
    const response=this.hooks.serviceAction({serviceId:npc.id,action,characterId:view.characterId??party.selectedId,...other});
    if(action==='dismiss'||action==='recruit')this.stack.replace({...view,characterId:this.hooks.party().selectedId});
    this.render();msg(response.message);if(this.service.isOpen)this.body.scrollTop=previousScroll;else this.dialog.scrollTop=previousScroll;if(focus)Array.from(this.body.querySelectorAll<HTMLElement>('[data-focus-key]')).find(e=>e.dataset.focusKey===focus)?.focus({preventScroll:true});
  };
  const sub=(kind:View['kind'],extra:Partial<View>={})=>this.push({kind,serviceId:npc.id,characterId:view.characterId??party.selectedId,...extra});
  const heroId=view.characterId??party.selectedId,hero=party.characters[heroId];
  const active=party.order;
  if(view.kind==='bank'){
   p('The bank holds gold safely. Banked money cannot be spent until you withdraw it. No interest is earned in this demo.');
   const number=document.createElement('input');number.type='number';number.min='1';number.step='1';number.value=String(view.serviceAmount??10);number.addEventListener('input',()=>this.stack.replace({...this.stack.top!,serviceAmount:Number(number.value)}));number.max='1000000';number.setAttribute('aria-label','Gold amount');number.className='service-number';this.body.append(number);
   const amount=()=>Number(number.value);
   this.button('Deposit gold',()=>act('deposit',{amount:amount()}),'d');this.button('Withdraw gold',()=>act('withdraw',{amount:amount()}),'w');return;
  }
  if(view.kind==='recruit_new'){
   p('Create a level-1 adventurer for 40 gold. The recruit waits at the tavern, keeping the current active party unchanged. Duplicated classes are allowed; the roster holds up to 24 characters.');
   recruitEditor(this.body,(spec:HeroBlueprint)=>{const result=this.hooks.serviceAction({serviceId:npc.id,action:'register',blueprint:spec});if(result.changed){this.stack.replace({...view,kind:'roster'});this.render();this.service.notify(result.message);}return result;});return;
  }
  if(view.kind==='roster'){
   p('The Silver Lantern keeps absent companions, inventories and spells safe. Create new level-1 heroes for 40 gold; only six may travel at once.');
   this.body.append(text('h3','Active party'));
   for(const id of active)this.button(`Dismiss ${party.characters[id].name} · ${CLASSES[party.characters[id].classId].name}`,()=>act('dismiss',{characterId:id}));
   this.button(`Create companion · 40 gold (${Object.keys(party.characters).length}/24 roster)`,()=>sub('recruit_new'));
   const bench=Object.keys(party.characters).filter(id=>!active.includes(id));this.body.append(text('h3','Companions at the tavern'));
   if(!bench.length)p('No companions are waiting.');for(const id of bench)this.button(`Recruit ${party.characters[id].name}`,()=>act('recruit',{characterId:id}));return;
  }
  if(view.kind==='shop'){
   const mode=view.mode??'buy',category=view.category??'weapons';
   const tabs=text('div','','member-picker');for(const m of ['buy','sell','identify','repair'] as const){const b=document.createElement('button');b.textContent=m[0].toUpperCase()+m.slice(1);b.setAttribute('aria-pressed',String(m===mode));b.addEventListener('click',()=>{this.stack.replace({...view,mode:m,itemId:undefined});this.render();});tabs.append(b);}this.body.append(tabs);
   if(mode==='buy'||mode==='sell'){
    const categories=text('div','','member-picker');for(const cat of ITEM_CATEGORIES){const b=document.createElement('button');b.textContent=cat;b.setAttribute('aria-pressed',String(cat===category));b.addEventListener('click',()=>{this.stack.replace({...view,category:cat,itemId:undefined});this.render();});categories.append(b);}this.body.append(categories);
   }
   const members=text('div','','member-picker');for(const id of active){const b=document.createElement('button');b.textContent=party.characters[id].name;b.setAttribute('aria-pressed',String(id===heroId));b.addEventListener('click',()=>{this.hooks.select(id);this.refreshParty();this.stack.replace({...view,characterId:id,itemId:undefined});this.render();});members.append(b);}this.body.append(members);
   const inventory=this.hooks.inventory();
   const selling=mode==='sell'&&view.itemId?inventory.items.find(i=>i.id===view.itemId&&i.ownerId===heroId&&!i.equipped):null;
   if(selling){p(`Sell ${itemName(selling)} ×${selling.count} for ${Math.max(1,Math.floor(ITEMS[selling.definitionId].price/2))*selling.count} gold?`);this.button('Confirm sale',()=>act('sell',{itemId:selling.id}));this.button('Cancel sale',()=>{this.stack.replace({...view,itemId:undefined});this.render();});return;}
   if(mode==='buy'){
    p('Stock is finite. Items are quoted at their purchase price and checked for bag capacity before gold is spent.');
    for(const [id,qty] of Object.entries(state.stock))if(ITEMS[id].category===category&&qty>0){const d=ITEMS[id];const b=this.button(`${d.name} · ${d.price} gold · ${qty} remaining`,()=>act('buy',{definitionId:id}));decoratePanelButton(b,itemArt(id),d.name,`${d.price} gold · ${qty} remaining`);}
   }else{
    const items=inventory.items.filter(i=>i.ownerId===heroId&&(mode!=='sell'||ITEMS[i.definitionId].category===category));
    if(!items.length)p('No applicable items on this character.');
    for(const item of items){const d=ITEMS[item.definitionId];let label='',allowed=false;
     if(mode==='sell'){label=`Sell ${itemName(item)} ×${item.count} · ${Math.max(1,Math.floor(d.price/2))*item.count} gold`;allowed=!item.equipped;}
     if(mode==='identify'){label=`Identify ${itemName(item)} · 10 gold`;allowed=!item.identified;}
     if(mode==='repair'){label=`Repair ${itemName(item)} · ${Math.max(1,Math.ceil(d.price*.2))} gold`;allowed=d.maxDurability>0&&item.durability<d.maxDurability;}
     if(allowed){const b=this.button(label,()=>{if(mode==='sell'){this.stack.replace({...view,itemId:item.id});this.render();return;}act(mode,{itemId:item.id});});decoratePanelButton(b,itemArt(item.definitionId),itemName(item),label.replace(/^Sell |^Identify |^Repair /,''));}
    }
   }return;
  }
  if(npc.kind==='tavern'){
   p('Silver Lantern services · food 1 gold/portion · drink 1 gold · tip 2 gold · room 6 gold');
   this.button('Stay in a room · 6 gold, eight hours',()=>act('rest'));
   this.button(`Drink · 1 gold (${hero?.name})`,()=>act('drink'));
   const number=document.createElement('input');number.type='number';number.min='1';number.max='200';number.value=String(view.serviceAmount??6);number.addEventListener('input',()=>this.stack.replace({...this.stack.top!,serviceAmount:Number(number.value)}));number.step='1';number.className='service-number';number.setAttribute('aria-label','Food portions');this.body.append(number);
   this.button('Buy food · 1 gold per portion',()=>act('food',{amount:Number(number.value)}));
   this.button('Tip for a new rumor · 2 gold',()=>act('tip'));
   this.button('Ask about Tessa’s lost ledger (optional quest)',()=>act('quest_optional'));
   if(this.hooks.journal().optional.quest_optional_ledger==='ready')this.button('Return the lost ledger · claim reward',()=>act('turn_in'));
   this.button('Rumors (free)',()=>{this.render();if(!this.hooks.serviceState().rumorsHeard)p('No rumors recorded yet. Tip Tessa to hear one.');for(let i=0;i<this.hooks.serviceState().rumorsHeard;i++)p(RUMORS[i]);});
   this.button('Bank · deposit/withdraw',()=>sub('bank'));
   this.button('Roster · dismiss/recruit',()=>sub('roster'));return;
  }
  if(npc.kind==='merchant'){
   this.button('Browse weapons and equipment',()=>sub('shop',{mode:'buy',category:'weapons'}));
   this.button('Sell carried items',()=>sub('shop',{mode:'sell',category:'weapons'}));
   this.button('Identify unknown items',()=>sub('shop',{mode:'identify'}));
   this.button('Repair equipment',()=>sub('shop',{mode:'repair'}));
   this.button('Ask about Orro’s missing tool roll (optional quest)',()=>act('quest_optional'));
   if(this.hooks.journal().optional.quest_optional_tools==='ready')this.button('Return Orro’s tool roll · claim reward',()=>act('turn_in'));return;
  }
  if(npc.kind==='temple'){
   const members=text('div','','member-picker');for(const id of active){const b=document.createElement('button');b.textContent=party.characters[id].name;b.setAttribute('aria-pressed',String(heroId===id));b.addEventListener('click',()=>{this.hooks.select(id);this.refreshParty();this.stack.replace({...view,characterId:id});this.render();});members.append(b);}this.body.append(members);
   if(hero){const max=derived(hero).maxHP;
    p(`${hero.name}: ${hero.hp}/${max} HP · ${conditionLabels(hero).join(', ')||'Good'}`);
    if(hero.hp>0&&hero.hp<max)this.button(`Heal ${max-hero.hp} HP · ${max-hero.hp} gold`,()=>act('heal'));
    if(hero.hp===0)this.button(`Revive · ${hero.level*50} gold`,()=>act('revive'));
    for(const c of hero.conditions)this.button(`Cure ${c.id} · 10 gold`,()=>act('cure',{condition:c.id}));
    if(this.hooks.magic().itemCurses[heroId]?.length)this.button('Lift equipment curses · 25 gold',()=>act('uncurse'));
   }
   this.button('Donate · 10 gold (+1 party Defense for 60 minutes)',()=>act('donate'));return;
  }
  if(npc.kind==='trainer'){
   const members=text('div','','member-picker');for(const id of active){const b=document.createElement('button');b.textContent=party.characters[id].name;b.setAttribute('aria-pressed',String(id===heroId));b.addEventListener('click',()=>{this.hooks.select(id);this.refreshParty();this.stack.replace({...view,characterId:id});this.render();});members.append(b);}this.body.append(members);
   if(hero){const t=training(hero);p(`${hero.name} · Level ${hero.level} · XP ${hero.xp} · ${t.capped?'Level cap reached.':`Next level ${t.nextLevel}: ${t.nextXP} XP, ${t.cost} gold · ${t.eligible?'Eligible':'Not yet eligible'}`}`);
    if(t.eligible&&!t.capped){if(progression().attributeMilestoneLevels.includes(t.nextLevel!)){p('Choose an attribute for your level milestone (max base 18).');for(const a of ABILITIES)if(hero.attributes[a]<18)this.button(`Train and raise ${a} (${hero.attributes[a]} → ${hero.attributes[a]+1}) · ${t.cost} gold`,()=>act('train',{ability:a}));}
     else this.button(`Train to level ${t.nextLevel} · ${t.cost} gold`,()=>act('train'));}
   }return;
  }
  if(['wizard','priest','witch'].includes(npc.kind)){
   if(npc.id==='npc_nera_salt'){
    this.button('Ask about Nera’s bottled echo (optional quest)',()=>act('quest_optional'));
    if(this.hooks.journal().optional.quest_optional_echo==='ready')this.button('Return the bottled echo · claim reward',()=>act('turn_in'));
   }
   const eligible=active.filter(id=>party.characters[id].classId===npc.kind),members=text('div','','member-picker');
   for(const id of eligible){const b=document.createElement('button');b.textContent=party.characters[id].name;b.setAttribute('aria-pressed',String(id===heroId));b.addEventListener('click',()=>{this.hooks.select(id);this.refreshParty();this.stack.replace({...view,characterId:id});this.render();});members.append(b);}this.body.append(members);
   if(!eligible.length){p(`No active ${npc.kind} to teach.`);return;}
   if(hero?.classId!==npc.kind){p('Choose a student above.');return;}
   p(`Spells cost 15 gold × spell level. ${hero.name} is level ${hero.level}. Known spells are marked.`);
   for(const spell of Object.values(SPELLS).filter(s=>s.classId===npc.kind)){
    const known=this.hooks.magic().known[heroId]?.includes(spell.id),locked=spell.level>hero.level;
    const b=this.button(`${known?'✓ ':''}${spell.name} · level ${spell.level} · ${15*spell.level} gold${locked?' (too advanced)':known?' (known)':''}`,()=>act('learn',{definitionId:spell.id}));decoratePanelButton(b,spellArt(spell.id),spell.name,`${spellClassLabel(spell.id)} · level ${spell.level} · ${15*spell.level} gold${locked?' · too advanced':known?' · known':''}`);b.disabled=!!known||locked;p(spell.description);
   }return;
  }
  if(npc.kind==='quest'){
   p('The village cistern has begun to ring like struck glass. The mechanism below has lost its regulator.');
   if(this.hooks.journal().mainStage===6){
    if(!this.hooks.journal().ending){p('The recovered regulator hums in your hands. Iona offers two futures, both permanent. You may still finish side quests afterward.');
     if(view.confirmAction){p(`Confirm a permanent ending: ${view.confirmAction==='ending_repair'?'repair the waterworks':'disconnect the resonator'}?`);this.button('Confirm ending',()=>act(view.confirmAction!));this.button('Cancel decision',()=>{this.stack.replace({...view,confirmAction:undefined});this.render();});return;}
     this.button('ENDING — Repair the waterworks',()=>{this.stack.replace({...view,confirmAction:'ending_repair'});this.render();});
     this.button('ENDING — Disconnect the resonator',()=>{this.stack.replace({...view,confirmAction:'ending_disconnect'});this.render();});
    }else p(`The adventure is complete: ${this.hooks.journal().ending==='repair'?'the waterworks were repaired':'the resonator was disconnected'}. Your optional quests remain available.`);
   }else this.button('Ask Iona for the cistern task and brass key',()=>act('quest'));
   p('Leave to review stages, side requests, plot items and notes in the Quest Journal (V).');return;
  }
 }
 updateArt(now:number):void{
  this.service?.update(now);const art=this.body.querySelector<HTMLElement>('.npc-scene');if(!art)return;
  updateNpcSceneElement(art,now,matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden);
 }
 private render():void{
  const serviceView=this.stack.top;
  if(serviceView&&isTownServiceView(serviceView.kind)){
   const npc=TOWN_SERVICES.find(n=>n.id===serviceView.serviceId);if(!npc){this.closeService();return;}
   const party=this.hooks.party(),id=party.selectedId,hero=party.characters[id],normalized={...serviceView,characterId:id,itemId:serviceView.characterId===id?serviceView.itemId:undefined};this.stack.replace(normalized);this.body=this.service.content;this.body.replaceChildren();this.returnKey=0;this.service.show(npc,normalized.kind,this.stack.depth,hero.name,party.resources);this.renderService(normalized);return;
  }
  this.body=el('panel-body');
  this.parkContent();this.body.replaceChildren();this.dialog.scrollTop=0;this.returnKey=0;const view=this.stack.top;if(!view)return;this.dialog.dataset.panel=view.kind;this.dialog.classList.toggle('quick-workspace',view.kind==='quick_options');
  const titles:Record<View['kind'],string>={help:'Before you venture forth',bindings:'Keys of the expedition',system:'Control panel',display:'Display options',diagnostics:'Foundation diagnostics',portrait:'Party slot',map:'Expedition automap',information:'Adventure information',quick:'Quick reference',unavailable:'Not available yet',confirm_menu:'Return to the title?',detail:'Character details',exchange:'Exchange party positions',saves:'Save adventure',load:'Load adventure',quick_options:'Quick Fight options',spell_cast:'Cast Spell',spell_list:'Known Spells',items:'Items & Equipment',rest:'Make Camp',journal:'Quest Journal',service:'Town Service',shop:'Trading at the Market',bank:'Tessa’s Bank',roster:'Adventuring Roster',recruit_new:'Register an Adventurer'};
  el('panel-title').textContent=view.title??titles[view.kind];el('panel-kicker').textContent=view.kind==='unavailable'?'COMING IN A LATER PHASE':'WORLD OF MAXXIA';
  el('panel-trail').textContent=this.stack.depth>1?`Panel ${this.stack.depth} · Esc returns one level`:'No world time passes in panels';
  el('panel-back').textContent=this.stack.depth>1?'Back · Esc':'Exit · Esc';el('panel-close').setAttribute('aria-label',this.stack.depth>1?'Back to previous panel':'Close panel');
  const p=(s:string)=>this.body.append(text('p',s));
  if(['service','shop','bank','roster','recruit_new'].includes(view.kind)){this.renderService(view);return;}
  if(view.kind==='journal'){
   const ledger=this.hooks.journal(),tab=view.journalTab??'quests',page=view.journalPage??0;
   const tabs=text('div','','member-picker');
   for(const [id,label] of [['quests','Current Quests'],['items','Quest Items'],['notes','Auto Notes'],['completed','Completed']] as const){
    const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-pressed',String(tab===id));b.addEventListener('click',()=>{this.stack.replace({...view,journalTab:id,journalPage:0});this.render();});tabs.append(b);
   }this.body.append(tabs);
   const entries:{heading:string;body:string}[]=[];
   if(tab==='quests'){
    const current=ledger.mainStage===0?MAIN_STAGES[0]:MAIN_STAGES[ledger.mainStage-1];
    if(current)entries.push({heading:`Main ${current.id.slice(-2)} · ${current.title}`,body:current.objective+' '+current.detail});
    if(ledger.mainStage>0)for(const future of MAIN_STAGES.slice(ledger.mainStage))entries.push({heading:`Upcoming · ${future.title}`,body:'Not started. '+future.detail});
    for(const q of OPTIONAL_QUESTS.filter(q=>ledger.optional[q.id]==='active'||ledger.optional[q.id]==='ready'))entries.push({heading:q.title,body:q.objective+' '+q.detail});
    if(ledger.mainStage===0)entries.push({heading:'Available requests',body:'Speak to Iona Reed in the cistern office at (8,8). Tessa, Orro and Nera also have optional requests.'});
   }
   if(tab==='items'){
    const names:Record<string,string>={item_quest_cistern_key:'Brass cistern key',item_quest_regulator:'Recovered regulator',item_quest_tessa_ledger:'Tessa’s ledger',item_quest_orro_tools:'Orro’s tool roll',item_quest_nera_echo:'Nera’s bottled echo'};
    for(const id of ledger.questItems)entries.push({heading:names[id]??id,body:'Plot item — held by the party separately from character bags; cannot be sold, discarded or transferred.'});
    if(!entries.length)entries.push({heading:'No quest items',body:'Critical objects will appear here instead of using inventory capacity.'});
   }
   if(tab==='notes'){
    for(let i=ledger.notes.length-1;i>=0;i--)entries.push({heading:`Field note ${i+1}`,body:ledger.notes[i]});
    if(!entries.length)entries.push({heading:'No field notes yet',body:'Rumors, inspections and spell discoveries are recorded automatically.'});
   }
   if(tab==='completed'){
    for(const id of ledger.completedStages){const q=MAIN_STAGES.find(entry=>entry.id===id);if(q)entries.push({heading:`✓ ${q.title}`,body:q.objective});}
    for(const q of OPTIONAL_QUESTS.filter(q=>ledger.optional[q.id]==='completed'))entries.push({heading:`✓ ${q.title}`,body:q.objective});
    if(!entries.length)entries.push({heading:'No completed quests',body:'Finished objectives remain accessible here.'});
   }
   const pages=Math.max(1,Math.ceil(entries.length/5)),safePage=Math.max(0,Math.min(pages-1,page));
   for(const entry of entries.slice(safePage*5,safePage*5+5)){this.body.append(text('h3',entry.heading));p(entry.body);}
   if(this.hooks.journal().ending)this.button('View epilogue',()=>{const q=this.hooks.journal(),party=this.hooks.party();showEnding({quests:q,party} as import('../shared/rules/campaign.ts').CampaignState);});
   p(`Page ${safePage+1} of ${pages}. The quest journal records completed stages and supports both final endings.`);
   const controls=text('div','','member-picker');const up=document.createElement('button');up.textContent='Previous · ↑';up.disabled=safePage===0;up.addEventListener('click',()=>{this.stack.replace({...view,journalPage:safePage-1});this.render();});controls.append(up);
   const down=document.createElement('button');down.textContent='Next · ↓';down.disabled=safePage>=pages-1;down.addEventListener('click',()=>{this.stack.replace({...view,journalPage:safePage+1});this.render();});controls.append(down);this.body.append(controls);return;
  }
  if(view.kind==='rest'){
   const party=this.hooks.party();p(`Resting takes eight hours and consumes ${party.order.length} food portions. Currently carrying ${party.resources.food} portions. Living heroes recover HP and SP; dead heroes do not revive. Temporary magic and ailments advance with the clock.`);
   p('Nearby monsters make camping unsafe. Rest does not erase discovered traps or reset enemies.');
   this.button('Rest eight hours (R)',()=>{const result=this.hooks.expeditionAction('rest');if(result.changed)this.closeAll();else {this.body.querySelector('.rest-error')?.remove();const err=text('p',result.message,'rest-error');err.setAttribute('role','alert');this.body.append(err);}},'r');
   this.button('Cancel',()=>this.pop());return;
  }
  if(view.kind==='unavailable'){p(view.reason??'This command will arrive in a later phase.');p('Nothing was spent or changed. Close this panel to continue exploring.');return;}
  if(view.kind==='diagnostics'){this.body.append(this.diagnostics);this.renderPartyDiagnostics();return;}
  if(view.kind==='display'){this.body.append(this.display);return;}
  if(view.kind==='help'){
   p('Explore the authored Firstlight Village and the Upper Cistern with the arrow keys. Up/Down step forward/backward; Left/Right turn 90°. Ctrl+Left/Right strafe. Space opens doors, travels through a nearby portal, or inspects scenery.');
   p('The nine commands on the right keep their Xeen positions. Dotted commands explain which later phase supplies their system. Portraits now inspect real party members. Character details, conditions and party order are available; prepared class attacks, Quick Fight and complete Wizard/Priest/Witch spellbooks are now active. Character inventories, loot, equipment, item use, repairs, expedition camping, traps, fountains, secrets, door bashing, mapping and eight town services are active. Face an NPC and press Space to talk.');
   this.button('Keyboard guide',()=>this.push({kind:'bindings'}),'k');this.button('Display options',()=>this.push({kind:'display'}),'d');return;
  }
  if(view.kind==='bindings'){
   const list=document.createElement('dl');list.className='binding-list';
   const pairs=[['Arrows','Move or turn'],['Ctrl + ← / →','Strafe'],['Space','Interact'],['F1–F6','Inspect portrait slot'],['Tab','Control panel'],['=','Toggle overview / crest'],['H','Help'],...EXPLORATION_COMMANDS.map(c=>[c.key,c.label]),['Combat 1–3','Choose visible enemy target'],['A / B / R','Attack / Block / Run in combat'],['F / O','Quick Fight / Configure quick actions in combat'],['Esc','Close only the top panel']];
   for(const [key,label] of pairs){list.append(text('dt',key),text('dd',label));}this.body.append(list);p('Inside a panel, its own controls own shortcuts. Tab cycles focus. Input fields keep normal editing keys.');return;
  }
  if(view.kind==='system'){
   this.button('Display options',()=>this.push({kind:'display'}),'d');
   this.button('Save (Slot 1)',()=>{this.hooks.save('slot1');this.render();},'s');
   this.button('Save As / Export',()=>this.push({kind:'saves'}),'a');
   this.button('Load adventure',()=>this.push({kind:'load'}),'l');
   this.button('Sound & Music',openAudioSettings,'m');
   this.button('Credits',showCredits,'c');
   this.button('Emergency Recall',()=>this.unavailable('Emergency Recall','Emergency Recall is planned for Phase 32.'),'w');
   this.button('Help',()=>this.push({kind:'help'}),'h');this.button('Main menu',()=>this.push({kind:'confirm_menu'}),'q');return;
  }
  if(view.kind==='saves'||view.kind==='load'){
   p('Browser-local saves stay on this device and browser profile. Export a JSON file for a portable backup. Previous slot contents are backed up on replacement.');
   for(const slot of this.hooks.slots()){
    const name=slot.id==='auto'?'Autosave':`Slot ${slot.id.slice(4)}`;
    const description=text('span',`${name}: ${slot.description}`,'save-slot-label');this.body.append(description);
    if(view.kind==='saves'){
     if(slot.id!=='auto')this.button(`Save to ${name}`,()=>{this.hooks.save(slot.id);this.render();});
    }else if(slot.valid){this.button(`Load ${name}`,()=>{this.closeAll();this.hooks.load(slot.id);});}
   }
   if(view.kind==='saves'){
    this.button('Export current adventure (JSON)',()=>this.hooks.exportSave(),'e');
    this.button('Import save file (JSON)',()=>{this.closeAll();this.hooks.importSave();},'i');
   }
   return;
  }
  if(view.kind==='confirm_menu'){
   p('Returning to the title preserves your current campaign in memory. Autosave also records changed exploration and party state.');
   this.button('Return to title',()=>{this.closeAll();this.hooks.returnToTitle();},'y');this.button('Keep exploring',()=>this.pop(),'n');return;
  }
  const party=this.hooks.party();
  if(view.kind==='spell_cast'||view.kind==='spell_list'){
   const inCombat=this.hooks.combat().active,actor=this.hooks.combat().actorId;
   const id=view.characterId??party.selectedId,c=party.characters[id],m=this.hooks.magic();
   const casterIds=inCombat?(actor?[actor]:[]):party.order.filter(cid=>['wizard','priest','witch'].includes(party.characters[cid].classId));
   if(!c||!['wizard','priest','witch'].includes(c.classId)||!casterIds.includes(id)){p(inCombat?'It is not a spellcaster’s turn. The acting character must use another action.':'Choose a Wizard, Priest or Witch to cast.');return;}
   el('panel-title').textContent=`${c.name} · ${view.kind==='spell_cast'?'Cast Spell':'Known Spells'}`;
   if(!inCombat){const chooser=text('div','','member-picker');for(let i=0;i<party.order.length;i++){const hero=party.characters[party.order[i]];if(!casterIds.includes(hero.id))continue;const b=document.createElement('button');b.textContent=`F${i+1} ${hero.name}`;b.setAttribute('aria-pressed',String(hero.id===id));b.addEventListener('click',()=>{this.stack.replace({...view,characterId:hero.id,spellId:undefined,targetId:undefined});this.render();});chooser.append(b);}this.body.append(chooser);}
   const known=m.known[id]??[];
   if(view.kind==='spell_list'){
    p(`Learned spells · ${c.sp}/${derived(c).maxSP} SP. Select a spell to ready it; choosing a spell does not cost a turn or SP.`);
    for(const spellId of known){const spell=SPELLS[spellId];const b=this.button(`${m.readied[id]===spellId?'✓ ':''}${spell.name} · Lv ${spell.level} · ${spell.sp} SP · ${spell.context}`,()=>{const result=this.hooks.readySpell(id,spellId);if(result.changed||m.readied[id]===spellId){this.pop();}});decoratePanelButton(b,spellArt(spell.id),spell.name,`${spellClassLabel(spell.id)} · Lv ${spell.level} · ${spell.sp} SP · ${spell.context}${m.readied[id]===spellId?' · Readied':''}`);b.setAttribute('aria-label',`Ready ${spell.name}, costs ${spell.sp} spell points`);p(spell.description);}return;
   }
   const spellId=view.spellId??m.readied[id],spell=spellId?SPELLS[spellId]:undefined;
   p(`${c.classId.toUpperCase()} · SP ${c.sp}/${derived(c).maxSP} · Spell DC ${derived(c).spellDC??'—'}`);
   if(spell){const card=text('div','', 'selection-card');card.append(panelArt(spellArt(spell.id),`Art for ${spell.name}`,'selection-art'));const copy=text('div','', 'selection-copy');copy.append(text('strong',spell.name),text('small',`${spellClassLabel(spell.id)} · ${spell.sp} SP · ${spell.context}`),text('p',spell.description));card.append(copy);this.body.append(card);} else p('No spell readied. Choose New.');
   const newSpellButton=this.button('New — select learned spell',()=>this.push({kind:'spell_list',characterId:id}),'n');if(spell)decoratePanelButton(newSpellButton,spellArt(spell.id),`Change from ${spell.name}`,'Browse learned spells');
   if(spell?.target==='ally'||spell?.target==='dead_ally'){
    this.body.append(text('h3','Choose an ally (F1–F6)'));
    for(let i=0;i<party.order.length;i++){const tid=party.order[i],ally=party.characters[tid];const b=this.button(`${view.targetId===tid?'✓ ':''}F${i+1} ${ally.name} · ${ally.hp}/${derived(ally).maxHP} HP`,()=>{this.stack.replace({...view,targetId:tid});this.render();});b.dataset.shortcut=String(i+1);b.setAttribute('aria-pressed',String(view.targetId===tid));}
   }
   if(spell?.effect==='fold'){
    this.body.append(text('h3','Fold Step distance'));
    for(const steps of [1,2] as const){const b=this.button(`${view.steps===steps?'✓ ':''}${steps} square${steps===1?'':'s'} forward`,()=>{this.stack.replace({...view,steps});this.render();});b.setAttribute('aria-pressed',String((view.steps??1)===steps));}
   }
   if(spell?.target==='enemy'){
    this.body.append(text('h3','Choose an enemy (1–3)'));
    for(const [i,t] of this.hooks.combat().targets.entries()){const selected=view.targetId??this.hooks.combat().selectedTargetId;const b=this.button(`${selected===t.id?'✓ ':''}${i+1}. ${t.name} · ${t.hp}/${t.maxHP} HP`,()=>{this.stack.replace({...view,targetId:t.id});this.render();});b.setAttribute('aria-pressed',String(selected===t.id));b.dataset.shortcut=String(i+1);}
   }
   if(spell){this.button(`Cast ${spell.name} (${spell.sp} SP)`,()=>{const targetId=spell.target==='enemy'?(view.targetId??this.hooks.combat().selectedTargetId):(spell.target==='ally'||spell.target==='dead_ally')?view.targetId:undefined;const result=this.hooks.castSpell({casterId:id,spellId:spell.id,targetId,steps:spell.effect==='fold'?(view.steps??1):undefined});if(result.changed)this.closeAll();else {const old=this.body.querySelector('.cast-error');old?.remove();const error=text('p',result.message,'cast-error');error.setAttribute('role','alert');this.body.append(error);}},'c');}
   this.button('Exit without casting',()=>this.pop());return;
  }
  if(view.kind==='items'){
   const combat=this.hooks.combat(),id=combat.active?(combat.actorId??party.selectedId):(view.characterId??party.selectedId),hero=party.characters[id]??party.characters[party.selectedId];
   const inventory=this.hooks.inventory(),category=view.category??'weapons',items=inventory.items.filter(it=>it.ownerId===hero.id&&ITEMS[it.definitionId].category===category);
   p(`Items belonging to ${hero.name} · ${items.length}/9 ${category}. ${combat.active?'Only the acting hero may use a combat item.':'Equipment and transfers are free outside combat.'}`);
   if(!combat.active){const members=text('div','','member-picker');party.order.forEach((pid,n)=>{const b=document.createElement('button');b.textContent=`F${n+1} ${party.characters[pid].name}`;b.setAttribute('aria-pressed',String(pid===hero.id));b.addEventListener('click',()=>{this.hooks.select(pid);this.refreshParty();this.stack.replace({...view,characterId:pid,itemId:undefined,targetId:undefined});this.render();});members.append(b);});this.body.append(members);}
   const tabs=text('div','','member-picker');for(const cat of ITEM_CATEGORIES){const b=document.createElement('button');b.textContent=cat[0].toUpperCase()+cat.slice(1);b.setAttribute('aria-pressed',String(cat===category));b.addEventListener('click',()=>{this.stack.replace({...view,category:cat,itemId:undefined,targetId:undefined});this.render();});tabs.append(b);}this.body.append(tabs);
   const selected=items.find(it=>it.id===view.itemId)??items[0];for(let n=0;n<items.length;n++){
    const item=items[n],d=ITEMS[item.definitionId],b=this.button(`${item.equipped?'✓ ':''}${itemName(item)}${item.count>1?' ×'+item.count:''}${d.maxCharges?' · '+item.charges+' charges':''}${d.maxDurability?' · '+item.durability+'/'+d.maxDurability+' durability':''}`,()=>{this.stack.replace({...view,itemId:item.id});this.render();},String(n+1));decoratePanelButton(b,itemArt(item.definitionId),itemName(item),`${d.category}${item.count>1?' · ×'+item.count:''}${item.equipped?' · equipped':''}${d.maxCharges?' · '+item.charges+' charges':''}${d.maxDurability?' · '+item.durability+'/'+d.maxDurability+' durability':''}`);b.setAttribute('aria-pressed',String(item.id===selected?.id));
   }
   if(!selected){p('This category is empty. Find treasure in the galleries or transfer items from another adventurer.');return;}
   const d=ITEMS[selected.definitionId];const selectedCard=text('div','', 'selection-card');selectedCard.append(panelArt(itemArt(selected.definitionId),`Art for ${itemName(selected)}`,'selection-art'));const selectedCopy=text('div','', 'selection-copy');selectedCopy.append(text('strong',itemName(selected)),text('small',`${d.category.toUpperCase()} · ${selected.identified?d.price+' gold':'Unknown value'} · ${selected.equipped?'Equipped: '+selected.equipped:'Unequipped'}`),text('p',selected.identified?d.description:'Properties are hidden until this item is identified.'));selectedCard.append(selectedCopy);this.body.append(selectedCard);
   p(`Estimated value: ${selected.identified?d.price+' gold':'Unknown'} · ${selected.equipped?'Equipped: '+selected.equipped:'Unequipped'}`);
   if(selected.identified&&d.slot)p(`${d.slot} · ${d.dice??'No damage dice'} · Armor ${d.armor} · Accuracy ${d.accuracy}`);
   const perform=(action:ItemCommand['action'],targetId?:string,slot?:ItemCommand['slot'])=>{if(action==='discard'&&!window.confirm(`Discard ${d.name}? This cannot be undone.`))return;const result=this.hooks.inventoryAction({action,itemId:selected.id,targetId,slot});if(result.changed){this.stack.replace({...view,itemId:action==='transfer'||action==='sell'||action==='discard'?undefined:selected.id});if(this.hooks.combat().active===false&&action==='use'){this.closeAll();return;}}this.render();this.body.prepend(text('p',result.message,'panel-note'));if(result.changed&&this.hooks.combat().active===false&&combat.active)this.closeAll();};
   if(!combat.active){
    if(d.slot&&!selected.equipped){if(d.slot==='accessory'){this.button('Equip in accessory 1',()=>perform('equip',undefined,'accessoryA'),'e');this.button('Equip in accessory 2',()=>perform('equip',undefined,'accessoryB'));}else this.button('Equip',()=>perform('equip'),'e');}
    if(selected.equipped)this.button('Remove equipment',()=>perform('remove'),'r');
    if(!selected.equipped){for(const pid of party.order.filter(pid=>pid!==hero.id))this.button(`Give to ${party.characters[pid].name}`,()=>perform('transfer',pid));}
    if(!selected.identified)this.button('Identify (town service fee)',()=>perform('identify'));
    if(d.maxDurability&&selected.durability<d.maxDurability)this.button('Repair (town only)',()=>perform('repair'));
    if(!selected.equipped){this.button('Sell in town',()=>perform('sell'));this.button('Discard',()=>perform('discard'),'d');}
   }
   if(['heal','antidote','wake','courage'].includes(d.effect)){
    p('Use on which party member?');const picker=text('div','','member-picker');for(const id of party.order){const target=party.characters[id],b=document.createElement('button');b.textContent=`${target.name} · ${target.hp}/${derived(target).maxHP} HP`;b.setAttribute('aria-pressed',String((view.targetId??hero.id)===id));b.addEventListener('click',()=>{this.stack.replace({...view,targetId:id,itemId:selected.id});this.render();});picker.append(b);}this.body.append(picker);
   }
   if(d.effect!=='none')this.button('Use item',()=>perform('use',view.targetId??hero.id),'u');
   if(selected.count>1&&!combat.active)this.button('Split stack in half',()=>{const result=this.hooks.inventoryAction({action:'split',itemId:selected.id,splitCount:Math.floor(selected.count/2)});this.render();this.body.prepend(text('p',result.message,'panel-note'));});
   return;
  }
  if(view.kind==='quick_options'){
   const current=party.characters[view.characterId??party.selectedId]??party.characters[party.order[0]],c=current;
   p('F resolves up to one automatic action per living character. Invalid or unreachable actions safely become Block. Cast Readied Spell spends SP only if a valid target exists; it never spends items or charges.');
   const chooser=text('div','','member-picker');chooser.setAttribute('aria-label','Configure party member');
   party.order.forEach((id,i)=>{const hero=party.characters[id],b=document.createElement('button');b.textContent=`F${i+1} ${hero.name}`;b.dataset.focusKey=`setup-member-${id}`;b.setAttribute('aria-pressed',String(id===c.id));b.addEventListener('click',()=>{this.stack.replace({...view,characterId:id});this.render();});chooser.append(b);});this.body.append(chooser);
   el('panel-title').textContent=`Quick Fight · ${c.name}`;this.body.append(text('h3',`${c.name} · ${CLASSES[c.classId].name}`));
   this.body.append(text('p',`Default: ${c.combatSetup.quickAction.toUpperCase()}. Prepared: ${preparedInfo(c.combatSetup.prepared).name}.`,'panel-note'));
   const columns=text('div','','quick-setup-columns'),defaults=text('section','','quick-defaults'),routines=text('section','','quick-routines');this.body.append(columns);columns.append(defaults,routines);const container=this.body;this.body=defaults;
   this.body.append(text('h3','Default action'));
   for(const action of (['attack','block','run',...(['wizard','priest','witch'].includes(c.classId)?['cast']:[])] as QuickAction[])){const label=action==='attack'?'Attack':action==='block'?'Block':action==='cast'?'Cast Readied Spell (spends SP)':'Run (party escape)';const b=this.button(`${c.combatSetup.quickAction===action?'✓ ':''}${label}`,()=>{this.hooks.configureQuick(c.id,action);this.render();});b.setAttribute('aria-pressed',String(c.combatSetup.quickAction===action));}
   this.body=routines;this.body.append(text('h3','Prepared attack routine'));
   for(const style of PREPARED_STYLES[c.classId]){const info=preparedInfo(style);const b=this.button(`${c.combatSetup.prepared===style?'✓ ':''}${info.name}`,()=>{this.hooks.configurePrepared(c.id,style);this.render();});b.setAttribute('aria-pressed',String(c.combatSetup.prepared===style));this.body.append(text('p',info.description));}
   this.body=container;
   p(classStrikeText(this.hooks.party().characters[c.id]));
   p('Changing a routine or quick default costs no turn. Automatic casts commit only when valid; unready spells, full-health allies, invalid contexts and insufficient SP safely fall back to Block.');return;
  }
  if(view.kind==='exchange'){
   const from=party.characters[view.characterId??party.selectedId];p(`Exchange ${from.name}'s position with which party member? F1–F6 chooses a destination. Esc cancels without changing the order.`);
   party.order.forEach((id,i)=>{const c=party.characters[id];this.button(`F${i+1} · ${c.name} · ${CLASSES[c.classId].name}${id===from.id?' (current position)':''}`,()=>this.exchangeWith(id),String(i+1));});return;
  }
  if(view.kind==='portrait'||view.kind==='detail'){
   const c=party.characters[party.selectedId],d=derived(c);this.renderMemberPicker();
   if(view.kind==='detail'){this.renderCharacterDetail(c,view.detailKey??'HP');return;}
   el('panel-title').textContent=`${c.name} · ${CLASSES[c.classId].name}`;
   const header=text('div','','character-heading'),avatar=text('div','','portrait-preview');avatar.innerHTML=portrait(c.portrait,portraitState(c),c.portraitId);
   const identity=text('div','','character-identity');identity.append(text('p',`Level ${c.level} · ${c.heritage} · Age ${c.age}`),text('p',`Party position ${party.order.indexOf(c.id)+1} · ${conditionLabels(c).join(', ')||'Good'}`));header.append(avatar,identity);this.body.append(header);
   const grid=text('div','','attribute-grid');
   for(const a of ABILITIES){const b=document.createElement('button');b.className='stat-tile';b.dataset.focusKey=`attribute-${a}`;b.setAttribute('aria-label',`${a} ${d.attributes[a]}, modifier ${signed(modifier(d.attributes[a]))}`);b.append(text('span',a),text('strong',String(d.attributes[a])),text('small',signed(modifier(d.attributes[a]))));b.addEventListener('click',()=>this.push({kind:'detail',detailKey:a}));grid.append(b);}this.body.append(grid);
   const stats=text('div','','derived-grid');
   const fields=[['HP',`${c.hp} / ${d.maxHP}`],['SP',`${c.sp} / ${d.maxSP}`],['Defense',String(d.defense)],['Attack',signed(d.attackBonus)],['Level',String(c.level)],['Experience',String(c.xp)],['Resistances','View'],['Conditions',conditionLabels(c).join(', ')||'Good'],['Equipment','View gear'],['Class abilities','View'],['Awards',String(c.awards.length)],['Supplies',`${party.resources.gold} gold`]];
   for(const [key,value] of fields){const b=document.createElement('button');b.className='character-field';b.dataset.focusKey=`field-${key}`;b.append(text('span',key),text('strong',value));b.addEventListener('click',()=>this.push({kind:'detail',detailKey:key}));stats.append(b);}this.body.append(stats);
   const eligibility=training(c);p(eligibility.capped?'Level cap reached.':eligibility.eligible?`Ready for level ${eligibility.nextLevel} training · ${eligibility.cost} gold at a trainer.`:`Next level: ${eligibility.nextXP} total XP · ${eligibility.remainingXP} XP remaining.`);
   const actions=text('div','','character-actions');
   actions.append(this.button('Items',()=>this.push({kind:'items',characterId:c.id,category:'weapons'}),'i'));
   actions.append(this.button('Quick',()=>this.push({kind:'quick'}),'q'));
   if(['wizard','priest','witch'].includes(c.classId))actions.append(this.button('Spellbook',()=>this.push({kind:'spell_cast',characterId:c.id}),'c'));
   actions.append(this.button('Combat setup',()=>this.push({kind:'quick_options',characterId:c.id}),'o'));
   actions.append(this.button('Exchange',()=>this.push({kind:'exchange',characterId:c.id}),'e'));this.body.append(actions);return;
  }
  if(view.kind==='quick'){
   p('Your active party · select a member or press 1–6 to inspect. Party order can be exchanged from a character sheet.');
   const table=document.createElement('table');table.className='party-table';const head=document.createElement('tr');for(const h of ['Member','Lv','HP','SP','Def','Quick','Condition'])head.append(text('th',h));const thead=document.createElement('thead');thead.append(head);table.append(thead);const tbody=document.createElement('tbody');
   party.order.forEach((id,i)=>{const c=party.characters[id],d=derived(c),row=document.createElement('tr'),cell=document.createElement('td'),b=document.createElement('button');b.textContent=`${i+1}. ${c.name}`;b.dataset.shortcut=String(i+1);b.dataset.focusKey=`member-${id}`;b.setAttribute('aria-label',`Inspect ${c.name}, ${CLASSES[c.classId].name}`);b.addEventListener('click',()=>this.openPortrait(i));cell.append(b);row.append(cell);for(const v of [String(c.level),`${c.hp}/${d.maxHP}`,`${c.sp}/${d.maxSP}`,String(d.defense),c.combatSetup.quickAction,conditionLabels(c).join(', ')||'Good'])row.append(text('td',v));tbody.append(row);});table.append(tbody);this.body.append(table);
   p(`Gold ${party.resources.gold} · Food ${party.resources.food} portions · Bank ${party.resources.bankGold}`);p(`Rest uses ${party.order.length} portions for eight hours. Press R in exploration to camp; poisoned and cursed effects may persist.`);this.button('Configure Quick Fight',()=>this.push({kind:'quick_options',characterId:party.selectedId}),'o');return;
  }
  const {map,world}=this.hooks.snapshot();
  if(view.kind==='information'){
   const total=480+this.hooks.clockMinutes(),day=Math.floor(total/1440)+1,time=`${Math.floor(total/60)%24}`.padStart(2,'0')+':'+`${total%60}`.padStart(2,'0');
   const list=text('dl','','binding-list');for(const [k,v] of [['Area',map.name],['Position',`${world.x}, ${world.y}`],['Facing',['North','East','South','West'][world.facing]],['Day',String(day)],['Time',time],['Elapsed',`${this.hooks.clockMinutes()} minutes`]])list.append(text('dt',k),text('dd',v));this.body.append(list);
   const currentService=this.hooks.nearService();if(currentService)p(`Nearby: ${currentService.name} (${currentService.role}); press Space to talk.`);
   const active=this.hooks.magic().effects;for(const effect of active){if(effect.expiresAtMinute!==undefined)p(`${effect.kind.replaceAll('_',' ')}: ${Math.max(0,effect.expiresAtMinute-this.hooks.clockMinutes())} minutes remain.`);else p(`${effect.kind.replaceAll('_',' ')} (${effect.targetId}): ${effect.remainingTurns} ${effect.targetId==='party'?'combat rounds':'affected enemy actions'} remain.`);}
   if(active.some(e=>e.kind==='borrowed_face')){const nearby=[...map.props.filter(o=>Math.abs(o.x-world.x)+Math.abs(o.y-world.y)<=3).map(o=>o.name+' — '+o.description),...map.doors.filter(o=>Math.abs(o.x-world.x)+Math.abs(o.y-world.y)<=3).map(o=>o.id.replaceAll('_',' ')+' — '+(o.lockDC?'locked door':'ordinary door'))];p(nearby.length?'Borrowed Face senses: '+nearby.slice(0,4).join(' · '):'Borrowed Face senses no nearby interactions.');}
   const clues=this.hooks.notes();if(clues.length){p('Rat Whisper notes:');for(const clue of clues.slice(-8))p(clue);}
   p(`Food: ${party.resources.food} portions; eight-hour camp needs ${party.order.length}. Last meal: ${this.hooks.expedition().lastMealAtMinute} elapsed minutes. Hunger begins after 24 hours without a meal.`);
   p(`Known hazards: ${this.hooks.expedition().triggeredTraps.length} disarmed or triggered traps. Fountains refresh on each new calendar day.`);
   this.button('View quest journal (V)',()=>this.push({kind:'journal',journalTab:'quests',journalPage:0}),'v');this.button('View automap',()=>this.push({kind:'map'}),'m');return;
  }
  if(view.kind==='map'){
   const revealing=this.hooks.magic().effects.some(e=>e.kind==='glass_eye'&&e.expiresAtMinute!>this.hooks.clockMinutes());
   p(revealing?'Glass Eye reveals nearby unknown geometry temporarily; it is NOT saved as explored.':'Automap records visited tiles and the walls immediately beside them. Unvisited passages remain hidden.');
   const canvas=document.createElement('canvas');canvas.width=352;canvas.height=352;canvas.className='large-map';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Explored map of ${map.name}; party at ${world.x}, ${world.y} facing ${['North','East','South','West'][world.facing]}`);this.body.append(canvas);
   this.drawMap(canvas,map,world,revealing);
   if(map.id==='map_town')p('Discovered service markers: T = Tavern, M = Market, H = Healer, L = Trainer, G = Guilds, Q = Iona’s quest office.');
   p(`${map.name} · ${world.x},${world.y} · facing ${['North','East','South','West'][world.facing]}. Gold = closed door, green = open, ! = known trap, S = discovered secret, ✦ = fountain.`);
   return;
  }
 }
  /** Fog-of-war automap for both the full view and the upper-right minimap. */
  private drawMap(canvas:HTMLCanvasElement,map:GridMap,world:GridState,revealing:boolean):void{
   map=perceivedMap(map,world);
   const context=canvas.getContext('2d');if(!context)return;
   const size=Math.min((canvas.width-12)/map.rows[0].length,(canvas.height-12)/map.rows.length);
   const ox=(canvas.width-map.rows[0].length*size)/2,oy=(canvas.height-map.rows.length*size)/2;
   const known=new Set(world.visited);context.fillStyle='#111c25';context.fillRect(0,0,canvas.width,canvas.height);
   for(let y=0;y<map.rows.length;y++)for(let x=0;x<map.rows[y].length;x++){
    const visited=known.has(`${x},${y}`),glimpse=revealing&&Math.abs(world.x-x)+Math.abs(world.y-y)<=3;
    const wallNeighbor=terrainTile(map,world,x,y)==='#'&&DIRECTIONS.some(d=>known.has(`${x+d.x},${y+d.y}`));
    if(!visited&&!glimpse&&!wallNeighbor)continue;
    const tile=terrainTile(map,world,x,y),door=doorAt(map,x,y),secret=map.secrets?.find(v=>v.x===x&&v.y===y);
    context.fillStyle=secret&&world.secrets[secret.id]?'#4c786c':door?(world.doors[door.id]?'#72a98d':'#c79f60'):tile==='#'?'#586470':visited?'#294450':'#1c6176';
    context.fillRect(ox+x*size,oy+y*size,Math.max(1,size-1),Math.max(1,size-1));
   }
   context.save();context.strokeStyle='#c0ad83';context.lineWidth=Math.max(1,size*.12);for(const edge of configuration(map,world)?.blockedEdges??[]){const d=DIRECTIONS[edge.direction];if(!known.has(`${edge.x},${edge.y}`)&&!known.has(`${edge.x+d.x},${edge.y+d.y}`))continue;const x=ox+edge.x*size,y=oy+edge.y*size;context.beginPath();if(edge.direction===0){context.moveTo(x,y);context.lineTo(x+size,y);}else if(edge.direction===1){context.moveTo(x+size,y);context.lineTo(x+size,y+size);}else if(edge.direction===2){context.moveTo(x,y+size);context.lineTo(x+size,y+size);}else{context.moveTo(x,y);context.lineTo(x,y+size);}context.stroke();}context.restore();
   const terrainMarks=(configuration(map,world)?.cells??[]).filter(c=>known.has(`${c.x},${c.y}`)&&!['floor','wall'].includes(c.kind)).map(c=>({...c,glyph:c.kind==='pit'?'▼':c.kind==='bridge'?'═':c.kind==='liquid'?'≈':c.kind==='conveyor'?['↑','→','↓','←'][c.direction!]:'✧'}));
   const marks=[...terrainMarks,...LOOT_CACHES.filter(c=>c.mapId===map.id&&this.hooks.thievery().discovered.includes(c.id)&&!this.hooks.inventory().claimed.includes(c.id)).map(c=>({...c,glyph:'C'})),...(map.traps??[]).filter(t=>this.hooks.expedition().triggeredTraps.includes(`${map.id}:${t.id}`)||this.hooks.thievery().discovered.includes(`trap:${map.id}:${t.id}`)).map(t=>({...t,glyph:'!'})),...(map.fountains??[]).filter(f=>known.has(`${f.x},${f.y}`)).map(f=>({...f,glyph:'✦'})),...(map.secrets??[]).filter(o=>world.secrets[o.id]).map(o=>({...o,glyph:'S'})),...(map.id==='map_town'&&size>12?TOWN_SERVICES.filter(n=>known.has(`${n.x},${n.y}`)).map(n=>({...n,glyph:n.kind==='tavern'?'T':n.kind==='quest'?'Q':n.kind==='merchant'?'M':n.kind==='temple'?'H':n.kind==='trainer'?'L':'G'})):[])];
   if(size>8){context.font=`bold ${Math.max(7,Math.floor(size*.65))}px monospace`;context.textAlign='center';context.textBaseline='middle';context.fillStyle='#ffe098';for(const mark of marks)context.fillText(mark.glyph,ox+(mark.x+.5)*size,oy+(mark.y+.5)*size);}
   context.fillStyle='#ffe49a';const cx=ox+(world.x+.5)*size,cy=oy+(world.y+.5)*size;context.beginPath();context.arc(cx,cy,Math.max(2,size*.23),0,Math.PI*2);context.fill();
   const direction=DIRECTIONS[world.facing];context.strokeStyle='#ffe49a';context.lineWidth=Math.max(1,size*.11);context.beginPath();context.moveTo(cx,cy);context.lineTo(cx+direction.x*size*.48,cy+direction.y*size*.48);context.stroke();
  }
  refreshMinimap():void{const {map,world}=this.hooks.snapshot();this.drawMap(el<HTMLCanvasElement>('map-overview'),map,world,this.hooks.magic().effects.some(e=>e.kind==='glass_eye'&&e.expiresAtMinute!>this.hooks.clockMinutes()));}

}
