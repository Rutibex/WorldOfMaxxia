import {SPELLS} from '../shared/rules/magic.ts';

export type FeedbackIcon='attack'|'miss'|'guard'|'run'|'heal'|'cure'|'revive'|'arcane'|'fire'|'cold'|'lightning'|'holy'|'poison'|'necrotic'|'ward'|'debuff'|'bind'|'sleep'|'special';
export interface FeedbackCue{icon:FeedbackIcon;label:string;emphasis?:'good'|'bad'|'neutral';}

const SPELL_NAMES=new Map(Object.values(SPELLS).map(spell=>[spell.name.toLowerCase(),spell.id]));
const KEYWORDS:[string,FeedbackIcon][]=[
 ['fire','fire'],['ember','fire'],['frost','cold'],['cold','cold'],['lightning','lightning'],['storm','lightning'],
 ['holy','holy'],['pilgrim','holy'],['dawn','holy'],['heal','heal'],['mend','heal'],['return breath','revive'],['revive','revive'],
 ['cleanse','cure'],['antidote','cure'],['poison','poison'],['venom','poison'],['sleep','sleep'],['thorns','sleep'],['binding','bind'],['thread','bind'],
 ['ward','ward'],['steadfast','ward'],['blessing','ward'],['mirror','ward'],['ill omen','debuff'],['withering','debuff'],['crooked','debuff'],['curse','debuff'],
 ['hollow','necrotic'],['malison','debuff'],['arcane','arcane'],['echo','arcane'],['glass','arcane'],['starfall','arcane'],['bell-heart','special'],['resonant','special']
];

import {ITEMS,BASE_ITEM_IDS} from '../shared/content/items.ts';
import type {ResourceResolver} from '../shared/project/resources.ts';
let itemResources:ResourceResolver|null=null;
export function configureItemArt(resources:ResourceResolver|null):void{itemResources=resources;}
export function itemArt(definitionId:string):string{const id=ITEMS[definitionId]?.iconResourceId;return (id && itemResources?.byId.get(id)?.url) || (BASE_ITEM_IDS.has(definitionId) ? `./assets/art/items/${definitionId}.png` : (itemResources?.byId.get('asset_art_items_item_treasure_gem_png')?.url ?? './assets/art/items/item_treasure_gem.png'));}
export function spellArt(spellId:string):string{return `./assets/art/spells/${spellId}.png`;}
export function feedbackArt(icon:FeedbackIcon):string{return `./assets/art/feedback/${icon}.png`;}

export function spellClass(spellId:string):'wizard'|'priest'|'witch'{
 return spellId.includes('_wizard_')?'wizard':spellId.includes('_priest_')?'priest':'witch';
}
export function spellClassLabel(spellId:string):string{return spellClass(spellId).toUpperCase();}

function cue(icon:FeedbackIcon,label:string,emphasis:FeedbackCue['emphasis']='neutral'):FeedbackCue{return {icon,label,emphasis};}

function iconForSpellName(spellName:string):FeedbackIcon{
 const lower=spellName.toLowerCase();
 if(lower.includes('spark')||lower.includes('storm'))return 'lightning';
 if(lower.includes('burning')||lower.includes('ember'))return 'fire';
 if(lower.includes('frost'))return 'cold';
 if(lower.includes('mend')||lower.includes('healing'))return 'heal';
 if(lower.includes('return breath'))return 'revive';
 if(lower.includes('cleanse'))return 'cure';
 if(lower.includes('pilgrim')||lower.includes('blessing')||lower.includes('sheltering')||lower.includes('judgment'))return 'holy';
 if(lower.includes('binding'))return 'bind';
 if(lower.includes('sleep'))return 'sleep';
 if(lower.includes('ill omen')||lower.includes('withering')||lower.includes('crooked bones')||lower.includes('malice'))return 'debuff';
 if(lower.includes('briar')||lower.includes('stone skin')||lower.includes('mirror ward')||lower.includes('steadfast'))return 'ward';
 if(lower.includes('hollow'))return 'necrotic';
 if(lower.includes('venom'))return 'poison';
 return spellClass(SPELL_NAMES.get(lower)??'spell_wizard_glass_eye')==='priest'?'holy':'arcane';
}

export function feedbackCuesFromMessages(messages:string[]):FeedbackCue[]{
 const cues:FeedbackCue[]=[];
 const add=(next:FeedbackCue)=>{if(cues.length<3)cues.push(next);};
 for(const message of messages){
  const line=message.toLowerCase();
  if(/casts /.test(line)){
   const match=message.match(/casts (.+?) \(/);
   const spellName=match?.[1]??'Spell';
   const icon=iconForSpellName(spellName);
   add(cue(icon,spellName,icon==='heal'||icon==='cure'||icon==='ward'||icon==='holy'?'good':icon==='debuff'||icon==='necrotic'||icon==='poison'?'bad':'neutral'));
   continue;
  }
  if(/recovers \d+ hp/.test(line)){add(cue('heal',message.replace(/\.$/,''),'good'));continue;}
  if(/breathes again|revive/.test(line)){add(cue('revive',message.replace(/\.$/,''),'good'));continue;}
  if(/escapes|leads an escape|fails to escape|cloud of smoke/.test(line)){add(cue('run',message.replace(/\.$/,''),line.includes('fails')?'bad':'neutral'));continue;}
  if(/misses /.test(line)){add(cue('miss',message.replace(/\.$/,''),'neutral'));continue;}
  if(/guarded|brace/.test(line)){add(cue('guard',message.replace(/\.$/,''),line.includes('guarded')?'good':'neutral'));continue;}
  if(/thunderous resonant wave|bell-heart telegraph|resonant discharge/.test(line)){add(cue('special',message.replace(/\.$/,''),'bad'));continue;}
  if(/deals .* fire damage/.test(line)){add(cue('fire',message.replace(/\.$/,''),'bad'));continue;}
  if(/deals .* cold damage/.test(line)){add(cue('cold',message.replace(/\.$/,''),'bad'));continue;}
  if(/deals .* lightning damage/.test(line)){add(cue('lightning',message.replace(/\.$/,''),'bad'));continue;}
  if(/deals .* holy damage/.test(line)){add(cue('holy',message.replace(/\.$/,''),'good'));continue;}
  if(/spectral pulse|arcane/.test(line)){add(cue('arcane',message.replace(/\.$/,''),'bad'));continue;}
  if(/poison|venom/.test(line)){add(cue(line.includes('cleanse')||line.includes('cure')?'cure':'poison',message.replace(/\.$/,''),line.includes('cleanse')||line.includes('cure')?'good':'bad'));continue;}
  if(/sleep/.test(line)){add(cue('sleep',message.replace(/\.$/,''),'bad'));continue;}
  if(/binding|bound/.test(line)){add(cue('bind',message.replace(/\.$/,''),'bad'));continue;}
  if(/blessing|steadfast|ward|mirror/.test(line)){add(cue('ward',message.replace(/\.$/,''),'good'));continue;}
  if(/ill omen|withering|crooked|cursed|malison/.test(line)){add(cue('debuff',message.replace(/\.$/,''),'bad'));continue;}
  if(/hits | uses /.test(line)){add(cue('attack',message.replace(/\.$/,''),line.includes('defeated')?'good':'neutral'));continue;}
  for(const [word,icon] of KEYWORDS)if(line.includes(word)){add(cue(icon,message.replace(/\.$/,''),icon==='heal'||icon==='cure'||icon==='revive'||icon==='ward'||icon==='holy'?'good':icon==='miss'||icon==='run'?'neutral':'bad'));break;}
 }
 return cues;
}
