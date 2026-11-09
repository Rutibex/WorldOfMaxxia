import {SPELLS} from '../shared/rules/magic.ts';
import {legacySpellName} from '../shared/content/spells.ts';
import type {PresentationEvent} from '../shared/rules/presentation.ts';
import type {CampaignState} from '../shared/rules/campaign.ts';

export type EffectKind=
 'missile_arrow'|'missile_arcane'|'missile_fire'|'missile_frost'|'missile_lightning'|'missile_holy'|'missile_shadow'|'missile_bind'|
 'burst_heal'|'burst_ward'|'burst_holy'|'burst_shadow'|'burst_poison'|'burst_portal'|'burst_starfall'|'burst_firefan'|'burst_storm'|'burst_arcane';
export interface EffectAtlas{url:string;cell:number;frames:number;ms:number;mode:'missile'|'burst';}
export const EFFECT_ATLASES:Readonly<Record<EffectKind,EffectAtlas>>={
 missile_arrow:{url:'assets/art/effects/missile_arrow.png',cell:96,frames:6,ms:85,mode:'missile'},
 missile_arcane:{url:'assets/art/effects/missile_arcane.png',cell:96,frames:6,ms:80,mode:'missile'},
 missile_fire:{url:'assets/art/effects/missile_fire.png',cell:96,frames:6,ms:80,mode:'missile'},
 missile_frost:{url:'assets/art/effects/missile_frost.png',cell:96,frames:6,ms:90,mode:'missile'},
 missile_lightning:{url:'assets/art/effects/missile_lightning.png',cell:96,frames:6,ms:75,mode:'missile'},
 missile_holy:{url:'assets/art/effects/missile_holy.png',cell:96,frames:6,ms:90,mode:'missile'},
 missile_shadow:{url:'assets/art/effects/missile_shadow.png',cell:96,frames:6,ms:95,mode:'missile'},
 missile_bind:{url:'assets/art/effects/missile_bind.png',cell:96,frames:6,ms:90,mode:'missile'},
 burst_heal:{url:'assets/art/effects/burst_heal.png',cell:96,frames:6,ms:120,mode:'burst'},
 burst_ward:{url:'assets/art/effects/burst_ward.png',cell:96,frames:6,ms:125,mode:'burst'},
 burst_holy:{url:'assets/art/effects/burst_holy.png',cell:96,frames:6,ms:120,mode:'burst'},
 burst_shadow:{url:'assets/art/effects/burst_shadow.png',cell:96,frames:6,ms:125,mode:'burst'},
 burst_poison:{url:'assets/art/effects/burst_poison.png',cell:96,frames:6,ms:125,mode:'burst'},
 burst_portal:{url:'assets/art/effects/burst_portal.png',cell:96,frames:6,ms:135,mode:'burst'},
 burst_starfall:{url:'assets/art/effects/burst_starfall.png',cell:96,frames:6,ms:115,mode:'burst'},
 burst_firefan:{url:'assets/art/effects/burst_firefan.png',cell:96,frames:6,ms:110,mode:'burst'},
 burst_storm:{url:'assets/art/effects/burst_storm.png',cell:96,frames:6,ms:105,mode:'burst'},
 burst_arcane:{url:'assets/art/effects/burst_arcane.png',cell:96,frames:6,ms:120,mode:'burst'},
};
export function effectFrame(kind:EffectKind,elapsed:number,reduced=false):number{
 const atlas=EFFECT_ATLASES[kind];if(reduced)return 2;
 return Math.min(atlas.frames-1,Math.floor(Math.max(0,elapsed)/atlas.ms));
}
export function effectDuration(kind:EffectKind):number{return EFFECT_ATLASES[kind].frames*EFFECT_ATLASES[kind].ms;}
export interface PlannedEffect{kind:EffectKind; role:'missile'|'burst'; scope:'enemy'|'enemies'|'party'|'self'|'center'; label:string;}
export const SPELL_EFFECTS:Readonly<Record<string,PlannedEffect[]>>={
 'Ill Omen':[{kind:'burst_shadow',role:'burst',scope:'enemy',label:'hex'}],
 'Spark Lance':[{kind:'missile_arcane',role:'missile',scope:'enemy',label:'arcane'}],
 'Frost Needle':[{kind:'missile_frost',role:'missile',scope:'enemy',label:'cold'}],
 'Burning Fan':[{kind:'burst_firefan',role:'burst',scope:'enemies',label:'fire'}],
 'Storm Arc':[{kind:'burst_storm',role:'burst',scope:'enemies',label:'lightning'}],
 'Starfall':[{kind:'burst_starfall',role:'burst',scope:'enemies',label:'arcane'}],
 'Sacred Ember':[{kind:'missile_fire',role:'missile',scope:'enemy',label:'holy fire'}],
 'Dawn Judgment':[{kind:'burst_holy',role:'burst',scope:'enemies',label:'holy'}],
 'Turn the Hollow':[{kind:'burst_holy',role:'burst',scope:'enemies',label:'holy'}],
 'Withering Word':[{kind:'burst_shadow',role:'burst',scope:'enemy',label:'necrotic'}],
 'Malice Rain':[{kind:'burst_poison',role:'burst',scope:'enemies',label:'poison'}],
 'Black Moon':[{kind:'burst_shadow',role:'burst',scope:'enemies',label:'shadow'}],
 'Leech Kiss':[{kind:'missile_shadow',role:'missile',scope:'enemy',label:'shadow'},{kind:'burst_shadow',role:'burst',scope:'enemy',label:'drain'}],
 'Binding Thread':[{kind:'missile_bind',role:'missile',scope:'enemy',label:'bind'}],
 'Sleep of Thorns':[{kind:'missile_bind',role:'missile',scope:'enemy',label:'sleep'}],
 'Crooked Bones':[{kind:'burst_shadow',role:'burst',scope:'enemy',label:'curse'}],
 'Bottle the Echo':[{kind:'burst_arcane',role:'burst',scope:'enemy',label:'echo'}],
 'Mend Flesh':[{kind:'burst_heal',role:'burst',scope:'self',label:'heal'}],
 'Healing Chorus':[{kind:'burst_heal',role:'burst',scope:'party',label:'heal'}],
 'Return Breath':[{kind:'burst_heal',role:'burst',scope:'party',label:'revive'}],
 'Cleanse Venom':[{kind:'burst_heal',role:'burst',scope:'self',label:'cure'}],
 'Blessing':[{kind:'burst_holy',role:'burst',scope:'party',label:'bless'}],
 'Steadfast':[{kind:'burst_holy',role:'burst',scope:'party',label:'ward'}],
 'Sheltering Hand':[{kind:'burst_ward',role:'burst',scope:'party',label:'ward'}],
 'Stone Skin':[{kind:'burst_ward',role:'burst',scope:'self',label:'ward'}],
 'Mirror Ward':[{kind:'burst_ward',role:'burst',scope:'self',label:'ward'}],
 'Pilgrim Light':[{kind:'burst_holy',role:'burst',scope:'party',label:'light'}],
 'Lantern Globe':[{kind:'burst_arcane',role:'burst',scope:'party',label:'light'}],
 'Glass Eye':[{kind:'burst_arcane',role:'burst',scope:'party',label:'reveal'}],
 'Borrowed Face':[{kind:'burst_arcane',role:'burst',scope:'self',label:'mask'}],
 'Rat Whisper':[{kind:'burst_arcane',role:'burst',scope:'self',label:'secret'}],
 'Unseal':[{kind:'burst_portal',role:'burst',scope:'center',label:'unlock'}],
 'Fold Step':[{kind:'burst_portal',role:'burst',scope:'party',label:'fold'}],
 'Hearth Thread':[{kind:'burst_portal',role:'burst',scope:'party',label:'hearth'}],
 'Break Malison':[{kind:'burst_holy',role:'burst',scope:'party',label:'cure'}],
 'Briar Mantle':[{kind:'burst_ward',role:'burst',scope:'party',label:'briar'}],
};
export function plannedEffectsFromMessages(messages:readonly string[]):PlannedEffect[]{
 const spellLine=messages.find(line=>/ casts /.test(line));
 if(spellLine){const match=spellLine.match(/casts (.+?) \(/);if(match)return SPELL_EFFECTS[match[1]]?[...SPELL_EFFECTS[match[1]]]:[];}
 const ranged=messages.find(line=>/(uses .*?(bow|crossbow)|'s .*?(bow|crossbow)|'s .*? misses)/i.test(line));
 if(ranged)return [{kind:'missile_arrow',role:'missile',scope:'enemy',label:'shot'}];
 return [];
}
export function changedEnemyIds(before:CampaignState,after:CampaignState):string[]{
 const ids:string[]=[];
 for(const enc of Object.values(before.combat.encounters))if(enc.mapId===before.currentMapId)for(const enemy of enc.enemies){
  const next=after.combat.encounters[enc.id]?.enemies.find(v=>v.id===enemy.id);if(next&&(next.hp<enemy.hp||next.hp===0&&enemy.hp>0))ids.push(enemy.id);
 }
 return ids;
}
export function changedAllyIds(before:CampaignState,after:CampaignState):string[]{
 const ids:string[]=[];
 for(const id of before.party.order){
  const a=before.party.characters[id],b=after.party.characters[id];
  if(!b)continue;
  if(b.hp!==a.hp||b.conditions.map(v=>v.id).join('|')!==a.conditions.map(v=>v.id).join('|')||(a.hp===0&&b.hp>0))ids.push(id);
 }
 return ids;
}

export function effectsForEvent(event:PresentationEvent):PlannedEffect[]{
 if(event.spellId){const spell=SPELLS[event.spellId];return spell?[...(SPELL_EFFECTS[legacySpellName(spell.behaviorKey)]??[])]:[];}
 if(event.missile)return [{kind:'missile_arrow',role:'missile',scope:'enemy',label:'shot'}];
 return [];
}
