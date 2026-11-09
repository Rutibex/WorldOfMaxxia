import type {QuestJournalView,QuestCommand,EndingView} from '../shared/rules/quest-engine.ts';
function element<K extends keyof HTMLElementTagNameMap>(tag:K,text=''):HTMLElementTagNameMap[K]{const e=document.createElement(tag);e.textContent=text;return e;}
function button(parent:HTMLElement,text:string,run:()=>void,enabled=true,reason?:string){const b=element('button',text);b.type='button';b.className='panel-button';b.disabled=!enabled;if(reason)b.title=reason;b.addEventListener('click',run);parent.append(b);}
export function showQuestEnding(ending:EndingView):void{
 if(!ending.campaign)return;document.querySelectorAll<HTMLDialogElement>('#npc-conversation[open],#quest-journal[open],#object-interaction[open]').forEach(d=>d.close());let panel=document.querySelector<HTMLDialogElement>('#quest-ending');if(!panel){panel=document.createElement('dialog');panel.id='quest-ending';panel.className='object-interaction presentation-dialog';panel.setAttribute('aria-label','Adventure ending');document.body.append(panel);}panel.replaceChildren(element('h2',ending.title),element('p',ending.text),element('p','The outcome is recorded in your journal. You may continue exploring and finish other available requests.'));const dialog=panel;button(dialog,'Continue',()=>dialog.close());if(!panel.open)panel.showModal();
}
export function showQuestJournal(read:()=>QuestJournalView,act:(command:QuestCommand)=>string,otherJournal?:()=>void):void{
 let panel=document.querySelector<HTMLDialogElement>('#quest-journal');if(!panel){panel=document.createElement('dialog');panel.id='quest-journal';panel.className='object-interaction';panel.setAttribute('aria-label','Quest journal');document.body.append(panel);}const dialog=panel;let feedback='',recipient:string|undefined;
 const render=()=>{dialog.replaceChildren(element('h2','Quest Journal'));let view:QuestJournalView;try{view=read();}catch(e){dialog.append(element('p',String(e)));button(dialog,'Close',()=>dialog.close());return;}
  if(!recipient||!view.heroes.some(h=>h.id===recipient&&h.conscious))recipient=view.heroes.find(h=>h.id===view.selectedHeroId&&h.conscious)?.id??view.heroes.find(h=>h.conscious)?.id;
  if(view.heroes.some(h=>h.conscious)){const label=element('label','Reward recipient '),select=element('select');select.setAttribute('aria-label','Quest reward recipient');for(const h of view.heroes){const option=element('option',h.name);option.value=h.id;option.disabled=!h.conscious;option.selected=h.id===recipient;select.append(option);}select.addEventListener('change',()=>recipient=select.value);label.append(select);dialog.append(label);}
  if(!view.quests.length)dialog.append(element('p','No requests have been discovered yet.'));
  for(const quest of view.quests){const section=element('section');section.append(element('h3',quest.name),element('p',quest.stateTitle),element('p',quest.description));
   if(quest.objectives.length){section.append(element('h4','Objectives'));const list=element('ul');for(const o of quest.objectives)list.append(element('li',`${o.complete?'✓':'○'} ${o.title}${o.optional?' (optional)':''} — ${o.description}`));section.append(list);}
   if(quest.entries.length){section.append(element('h4','Journal'));const list=element('ol');for(const entry of quest.entries)list.append(element('li',entry.text));section.append(list);}
   for(const transition of quest.transitions)button(section,transition.title,()=>{feedback=act({type:'quest',action:'transition',questId:quest.id,transitionId:transition.id,expectedState:quest.stateId});render();},transition.enabled,transition.reason);
   for(const reward of quest.rewards){const text=`${reward.title}: ${reward.gold} gold, ${reward.xp} XP per active hero${reward.items.length?', '+reward.items.map(i=>i.count+' '+i.name).join(', '):''}`;section.append(element('p',text));button(section,reward.claimed?'Reward claimed':'Claim reward',()=>{feedback=act({type:'quest',action:'claim',questId:quest.id,rewardId:reward.id,heroId:recipient});render();},reward.enabled&&!!recipient,reward.reason);}
   dialog.append(section);
  }
  for(const ending of view.endings)if(ending.campaign)button(dialog,'Review ending: '+ending.title,()=>showQuestEnding(ending));
  const status=element('p',feedback);status.setAttribute('role','status');dialog.append(status);if(otherJournal)button(dialog,'Other adventure journal',()=>{dialog.close();otherJournal();});button(dialog,'Close',()=>dialog.close());
 };render();if(!dialog.open)dialog.showModal();
}
