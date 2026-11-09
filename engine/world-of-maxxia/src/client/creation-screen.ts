/** Phase 19 character editor: shared between the title party builder and tavern. */
import {ABILITIES,CLASS_IDS,CLASSES,type ClassId} from '../shared/content/party.ts';
import {portrait} from './ui-art.ts';
import {RACES,RACE_IDS,DEFAULT_RACE_ID} from '../shared/content/races.ts';
import {PORTRAIT_ORDER,PORTRAITS} from '../shared/content/actors.ts';
import {ATTRIBUTE_TOTAL,PORTRAIT_COUNT,proposedHero,createCustomParty,validateBlueprint,type HeroBlueprint} from '../shared/rules/creation.ts';

function make(tag:string,cls?:string,content?:string):HTMLElement{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=content;return el;}
export function heroEditor(mount:HTMLElement,hero:HeroBlueprint,onChange:(h:HeroBlueprint)=>void):void{
 mount.replaceChildren();const heading=make('div','create-subtitle',`Name, race, class, portrait, attributes · ${ATTRIBUTE_TOTAL} total points`);mount.append(heading);
 const name=document.createElement('input');name.className='create-name';name.maxLength=24;name.placeholder='Adventurer name';name.value=hero.name;name.setAttribute('aria-label','Adventurer name');name.addEventListener('input',()=>{hero.name=name.value;onChange(hero);});mount.append(name);
 const cls=document.createElement('select');cls.className='create-class';cls.setAttribute('aria-label','Adventurer class');for(const id of CLASS_IDS){const opt=document.createElement('option');opt.value=id;opt.textContent=CLASSES[id].name+(id.includes(':')?' ['+id.split(':')[0]+']':'');cls.append(opt);}cls.value=hero.classId;
 cls.addEventListener('change',()=>{const updated=proposedHero(0,cls.value as ClassId);hero.classId=updated.classId;hero.creationChoiceId=updated.creationChoiceId;hero.attributes=updated.attributes;onChange(hero);heroEditor(mount,hero,onChange);});mount.append(cls);
 const race=document.createElement('select');race.className='create-race';race.setAttribute('aria-label','Adventurer race');for(const id of RACE_IDS){const opt=document.createElement('option');opt.value=id;opt.textContent=RACES[id].name+(id.includes(':')?' ['+id.split(':')[0]+']':'');race.append(opt);}race.value=hero.raceId??DEFAULT_RACE_ID;race.onchange=()=>{hero.raceId=race.value;onChange(hero);heroEditor(mount,hero,onChange);};mount.append(race);
 mount.append(make('p','panel-note',RACES[hero.raceId??DEFAULT_RACE_ID]?.description??''));
 const choices=CLASSES[hero.classId].creationChoices??[];if(choices.length){const choice=document.createElement('select');choice.className='create-choice';choice.setAttribute('aria-label','Starting specialization');for(const c of choices){const opt=document.createElement('option');opt.value=c.id;opt.textContent=c.name;choice.append(opt);}choice.value=hero.creationChoiceId??choices[0].id;choice.onchange=()=>{hero.creationChoiceId=choice.value;onChange(hero);heroEditor(mount,hero,onChange);};mount.append(choice,make('p','panel-note',choices.find(c=>c.id===choice.value)?.description??''));}
 mount.append(make('p','panel-note',CLASSES[hero.classId].role+' '+CLASSES[hero.classId].features));
 mount.append(make('div','create-subtitle',`Portrait ${PORTRAITS[hero.portraitId??'']?.name??'Legacy portrait'} · ${PORTRAIT_ORDER.length} available`));const portraits=make('div','create-portraits');
 for(const [i,id] of PORTRAIT_ORDER.entries()){const set=PORTRAITS[id],b=document.createElement('button');b.className='create-portrait';b.type='button';b.innerHTML=portrait(set.legacyIndex??0,'normal',id);b.setAttribute('aria-label',set.name);b.setAttribute('aria-pressed',String((hero.portraitId??PORTRAIT_ORDER[hero.portrait])===id));b.addEventListener('click',()=>{hero.portrait=set.legacyIndex??0;hero.portraitId=id;onChange(hero);heroEditor(mount,hero,onChange);});portraits.append(b);}mount.append(portraits);
 const spent=ABILITIES.reduce((n,a)=>n+hero.attributes[a],0),remaining=ATTRIBUTE_TOTAL-spent;
 const indicator=make('p','create-points',`Attribute points remaining: ${remaining} · each score 8–16`);mount.append(indicator);
 const table=make('div','create-abilities');for(const a of ABILITIES){const row=make('div','create-ability');const label=make('strong','',`${a}  ${hero.attributes[a]}`);const minus=document.createElement('button'),plus=document.createElement('button');minus.textContent='−';plus.textContent='+';minus.setAttribute('aria-label',`Decrease ${a}`);plus.setAttribute('aria-label',`Increase ${a}`);minus.disabled=hero.attributes[a]<=8;plus.disabled=hero.attributes[a]>=16||remaining<=0;minus.onclick=()=>{hero.attributes={...hero.attributes,[a]:hero.attributes[a]-1};onChange(hero);heroEditor(mount,hero,onChange);};plus.onclick=()=>{hero.attributes={...hero.attributes,[a]:hero.attributes[a]+1};onChange(hero);heroEditor(mount,hero,onChange);};row.append(label,minus,plus);table.append(row);}mount.append(table);
}
export class CreationScreen {
 private heroes:HeroBlueprint[]=Array.from({length:6},(_,i)=>proposedHero(i));private chosen=0;private root:HTMLElement;private message:HTMLElement;
 constructor(private begin:(heroes:HeroBlueprint[]|null)=>void){
  this.root=document.getElementById('creation-screen')!;this.message=this.root.querySelector<HTMLElement>('#creation-error')!;
  this.root.querySelector('#creation-cancel')!.addEventListener('click',()=>this.hide());
  this.root.querySelector('#creation-default')!.addEventListener('click',()=>{this.hide();this.begin(null);});
  this.root.querySelector('#creation-begin')!.addEventListener('click',()=>{
   try{createCustomParty(this.heroes);this.hide();this.begin(structuredClone(this.heroes));}catch(e){this.message.textContent=e instanceof Error?e.message:String(e);}
  });
 }
 show():void{this.heroes=Array.from({length:6},(_,i)=>proposedHero(i));this.chosen=0;this.message.textContent='';document.getElementById('welcome')!.hidden=true;this.root.hidden=false;this.render();}
 hide():void{this.root.hidden=true;document.getElementById('welcome')!.hidden=false;}
 private render():void{
  const tabs=this.root.querySelector<HTMLElement>('#creation-slots')!,editor=this.root.querySelector<HTMLElement>('#creation-editor')!;tabs.replaceChildren();
  this.heroes.forEach((hero,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${i+1}. ${hero.name||'Unnamed'} · ${CLASSES[hero.classId].name}`;b.setAttribute('aria-pressed',String(i===this.chosen));b.addEventListener('click',()=>{this.chosen=i;this.render();});tabs.append(b);});
  heroEditor(editor,this.heroes[this.chosen],()=>{this.message.textContent='';this.heroes.forEach((h,i)=>{const b=tabs.children[i];if(b)b.textContent=`${i+1}. ${h.name||'Unnamed'} · ${CLASSES[h.classId].name}`;});});
 }
}
export function recruitEditor(mount:HTMLElement,onSubmit:(spec:HeroBlueprint)=>{changed:boolean;message:string}):void{
 let recruit=proposedHero(0);recruit.name='New Adventurer';const editor=make('div'),status=make('p','panel-note');mount.append(editor,status);
 const submit=document.createElement('button');submit.className='panel-button';submit.textContent='Register character · 40 gold (waits at tavern)';submit.addEventListener('click',()=>{try{validateBlueprint(recruit);const result=onSubmit(structuredClone(recruit));status.textContent=result.message;}catch(e){status.textContent=e instanceof Error?e.message:String(e);}});
 heroEditor(editor,recruit,h=>{recruit=h;status.textContent='';});mount.append(submit);
}
