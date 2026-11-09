import {tickUnifiedConditions,applyUnifiedCondition} from './effects.ts';
import {conditionModifier,conditionResistance} from './condition-effects.ts';
import {packCondition} from '../content/effect-definitions.ts';
import {monsterSaveAttribute,monsterUndead,monsterDamageAfterResistance} from '../content/monsters.ts';
import {emitPresentation,takePresentation,type PresentationEvent} from './presentation.ts';
/** Shared spell-point engine; Phase 12 completes all three caster catalogues.
 * Independent of Phaser, DOM and service UI. */
import {CLASSES,derived,modifier,spendSP,heal,damage,withCondition,updateMember,type Character} from './party.ts';
import {SeededRng} from './rng.ts';
import {conditionDefinition,applyConditionPolicy} from '../content/conditions.ts';
import {parseAmountExpression,evaluateAmountExpression,type AmountVariable} from './expressions.ts';
import type {CampaignState,MapRegistry,TravelMap} from './campaign.ts';
import {canCross} from './grid.ts';
import {terrainTransportSafe} from '../project/terrain-contracts.ts';
import {DIRECTIONS,doorAt,isOpaque,tileAt} from './grid.ts';
import {SPELLS,STARTER_SPELLS,spellAllowed,hasSpellAccess,starterSpellsForClass,type SpellDefinition,type SpellTarget,type SpellContext,type SpellEffect} from '../content/spells.ts';
export {SPELLS,STARTER_SPELLS};
export type {SpellDefinition,SpellTarget,SpellContext,SpellEffect};
export type MagicEffectKind='temple_blessing'|'light'|'ill_omen'|'glass_eye'|'binding_thread'|'stone_skin'|'mirror_ward'|'blessing'|'sheltering_hand'|'steadfast'|'hollow_fear'|'borrowed_face'|'sleep_thorns'|'crooked_bones'|'briar_mantle'|'bottle_echo';
export interface MagicEffect {kind:MagicEffectKind;targetId:string;expiresAtMinute?:number;remainingTurns?:number;}
export interface MagicState {effectClock?:number;known:Record<string,string[]>;readied:Record<string,string|null>;effects:MagicEffect[];itemCurses:Record<string,string[]>;}
export function initialMagicState(party:CampaignState['party']):MagicState{
 const known:Record<string,string[]>={},readied:Record<string,string|null>={};
 for(const id of party.order){const caster=party.characters[id];const spells=starterSpellsForClass(caster.classId);known[id]=[...spells];readied[id]=spells[0]??null;}
 return {known,readied,effects:[],itemCurses:Object.fromEntries(party.order.map(id=>[id,[]]))};
}

const isRecord=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function validateMagic(input:unknown,s:CampaignState):MagicState{
 if(!isRecord(input)||!isRecord(input.known)||!isRecord(input.readied)||!Array.isArray(input.effects)||input.effects.length>32||!isRecord(input.itemCurses))throw new TypeError('Invalid magic state.');
 if(input.effectClock!==undefined&&(!Number.isSafeInteger(input.effectClock)||(input.effectClock as number)<0||(input.effectClock as number)>s.elapsedMinutes))throw new TypeError('Invalid effect clock');
 if(!s.combat.active&&[...Object.values(s.party.characters),...Object.values(s.combat.encounters).flatMap(e=>e.enemies)].some(a=>(a.conditions??[]).some(c=>packCondition(c.id)?.clock==='rounds')))throw new TypeError('Round conditions require active combat');
 const timed=[...Object.values(s.party.characters),...Object.values(s.combat.encounters).flatMap(e=>e.enemies)].some(a=>(a.conditions??[]).some(c=>packCondition(c.id)?.clock==='minutes'));if(timed&&input.effectClock===undefined)throw new TypeError('Missing authored condition clock');
 const m=input as unknown as MagicState,ids=Object.keys(s.party.characters);
 if(Object.keys(m.itemCurses).length!==ids.length)throw new TypeError('Invalid equipment curse registry.');
 if(Object.keys(m.known).length!==ids.length||Object.keys(m.readied).length!==ids.length)throw new TypeError('Magic character registry mismatch.');
 for(const id of ids){const c=s.party.characters[id],known=m.known[id],ready=m.readied[id];
  if(!Array.isArray(m.itemCurses[id])||m.itemCurses[id].length>6||new Set(m.itemCurses[id]).size!==m.itemCurses[id].length||m.itemCurses[id].some(gearId=>typeof gearId!=='string'||!gearId.startsWith('item_')||!Object.values(c.equipment).includes(gearId)))throw new TypeError('Invalid equipment curse references.');
  if(!Array.isArray(known)||known.length>12||new Set(known).size!==known.length||known.some(spellId=>typeof spellId!=='string'||!SPELLS[spellId]||!spellAllowed(c.classId,spellId))||!(ready===null||known.includes(ready)))throw new TypeError('Invalid spell knowledge or readied spell.');
  if(!hasSpellAccess(c.classId)&&(known.length||ready!==null))throw new TypeError('Noncaster has spells.');
 }
 for(const e of m.effects){
  if(!isRecord(e)||!['temple_blessing','light','ill_omen','glass_eye','binding_thread','stone_skin','mirror_ward','blessing','sheltering_hand','steadfast','hollow_fear','borrowed_face','sleep_thorns','crooked_bones','briar_mantle','bottle_echo'].includes(e.kind)||typeof e.targetId!=='string')throw new TypeError('Invalid spell effect.');
  if(['temple_blessing','light','glass_eye','stone_skin','mirror_ward','blessing','sheltering_hand','steadfast','borrowed_face','briar_mantle'].includes(e.kind)){
   const limit=(e.kind==='light'||e.kind==='temple_blessing')?61:['temple_blessing','glass_eye','stone_skin','mirror_ward','blessing','sheltering_hand','borrowed_face'].includes(e.kind)?31:e.kind==='briar_mantle'?6:4;
   const combatRoundWard=['steadfast','briar_mantle'].includes(e.kind)&&e.remainingTurns!==undefined;
   const maxTurns=e.kind==='briar_mantle'?5:3;
   if(e.targetId!=='party'||(combatRoundWard?!Number.isSafeInteger(e.remainingTurns)||e.remainingTurns!<1||e.remainingTurns!>maxTurns||e.expiresAtMinute!==undefined:!Number.isSafeInteger(e.expiresAtMinute)||e.expiresAtMinute!<=s.elapsedMinutes||e.expiresAtMinute!>s.elapsedMinutes+limit||e.remainingTurns!==undefined))throw new TypeError('Invalid timed party spell.');
  }else{
   const enemy=Object.values(s.combat.encounters).flatMap(enc=>enc.enemies).find(enemy=>enemy.id===e.targetId);
   const max=['ill_omen','crooked_bones'].includes(e.kind)?3:e.kind==='hollow_fear'||e.kind==='bottle_echo'?2:1;
   if(!enemy||enemy.hp===0||!Number.isInteger(e.remainingTurns)||e.remainingTurns!<1||e.remainingTurns!>max||e.expiresAtMinute!==undefined)throw new TypeError('Invalid enemy hex.');
  }
 }
 if(new Set(m.effects.map(e=>e.kind+':'+e.targetId)).size!==m.effects.length)throw new TypeError('Duplicate magical effect.');
 return m;
}
export function effectiveEffects(s:CampaignState):MagicEffect[]{return s.magic.effects.filter(e=>e.expiresAtMinute===undefined||e.expiresAtMinute>s.elapsedMinutes);}
export function expireMagic(s:CampaignState):void{s.magic.effects=effectiveEffects(s).filter(e=>{if(['steadfast','briar_mantle'].includes(e.kind)&&e.remainingTurns!==undefined)return !!s.combat.active;if(!['ill_omen','binding_thread','hollow_fear','sleep_thorns','crooked_bones','bottle_echo'].includes(e.kind))return true;return Object.values(s.combat.encounters).some(enc=>enc.enemies.some(v=>v.id===e.targetId&&v.hp>0));});}
export function hasPartyWard(s:CampaignState,kind:'light'|'glass_eye'|'stone_skin'|'mirror_ward'|'blessing'|'sheltering_hand'|'steadfast'|'borrowed_face'|'briar_mantle'):boolean{return effectiveEffects(s).some(e=>e.kind===kind);}
export function partyDefenseBonus(s:CampaignState):number{return (s.magic.effects.some(e=>e.kind==='temple_blessing'&&e.expiresAtMinute!>s.elapsedMinutes)?1:0)+(hasPartyWard(s,'stone_skin')?2:0)+(hasPartyWard(s,'sheltering_hand')?2:0);}
export function partyAttackBonus(s:CampaignState):number{return hasPartyWard(s,'blessing')?1:0;}
export function partyFearImmune(s:CampaignState):boolean{return hasPartyWard(s,'steadfast');}
export function finishCombatRound(s:CampaignState):void {tickUnifiedConditions(s,1,'rounds');for(const e of s.magic.effects)if(['steadfast','briar_mantle'].includes(e.kind)&&e.remainingTurns!==undefined)e.remainingTurns--;s.magic.effects=s.magic.effects.filter(e=>!['steadfast','briar_mantle'].includes(e.kind)||e.remainingTurns===undefined||e.remainingTurns>0);}
export function inflictFear(s:CampaignState,heroId:string):boolean{if(partyFearImmune(s))return false;const c=s.party.characters[heroId];if(!c||c.hp===0)return false;s.party=updateMember(s.party,{...c,conditions:[...c.conditions.filter(v=>v.id!=='frightened'),{id:'frightened',remaining:3,unit:'turns'}]});return true;}
export function enemyIsFrightened(s:CampaignState,enemyId:string):boolean{return s.magic.effects.some(e=>e.kind==='hollow_fear'&&e.targetId===enemyId);}
export function mitigateArcane(s:CampaignState,raw:number,targetId:string):number{
 const base=s.party.characters[targetId]?.baseResistances.arcane??0;
 const resistance=Math.max(-50,Math.min(75,base+(hasPartyWard(s,'mirror_ward')?25:0)));
 return Math.max(0,Math.ceil(raw*(100-resistance)/100));
}
export function breakBinding(s:CampaignState,enemyId:string):void{s.magic.effects=s.magic.effects.filter(e=>!['binding_thread','sleep_thorns'].includes(e.kind)||e.targetId!==enemyId);}
/** Returns true exactly once for a successfully bound enemy; no attack or movement occurs that turn. */
export function consumeBinding(s:CampaignState,enemyId:string):boolean{
 const e=s.magic.effects.find(e=>['binding_thread','sleep_thorns'].includes(e.kind)&&e.targetId===enemyId);
 if(!e)return false;breakBinding(s,enemyId);return true;
}
export function enemyDefensePenalty(s:CampaignState,enemyId:string):number{return s.magic.effects.some(e=>e.kind==='crooked_bones'&&e.targetId===enemyId)?-3:0;}
export function specialAttackSuppressed(s:CampaignState,enemyId:string):boolean{return s.magic.effects.some(e=>e.kind==='bottle_echo'&&e.targetId===enemyId);}
export function thornMantleActive(s:CampaignState):boolean{return hasPartyWard(s,'briar_mantle');}
export function enemyAttackPenalty(s:CampaignState,enemyId:string):number{return (s.magic.effects.some(e=>e.kind==='ill_omen'&&e.targetId===enemyId)?-2:0)+(enemyIsFrightened(s,enemyId)?-2:0);}
export function enemyFinishedTurn(s:CampaignState,enemyId:string):void{for(const e of s.magic.effects){if(['ill_omen','hollow_fear','crooked_bones','bottle_echo'].includes(e.kind)&&e.targetId===enemyId)e.remainingTurns!--;}s.magic.effects=s.magic.effects.filter(e=>!['ill_omen','hollow_fear','crooked_bones','bottle_echo'].includes(e.kind)||e.remainingTurns!>0);}
export function learnClassSpell(source:CampaignState,casterId:string,spellId:string):{state:CampaignState;message:string;changed:boolean}{
 const c=source.party.characters[casterId],spell=SPELLS[spellId];
 if(!c||!hasSpellAccess(c.classId)||!spell||!spellAllowed(c.classId,spell.id)||!source.party.order.includes(casterId))return {state:source,message:'The chosen caster cannot learn that spell.',changed:false};
 if(source.magic.known[casterId].includes(spellId))return {state:source,message:'Already learned.',changed:false};
 if(c.level<spell.level)return {state:source,message:`Requires level ${spell.level}.`,changed:false};
 const state=structuredClone(source);state.magic.known[casterId].push(spellId);
 return {state,message:`${c.name} learns ${spell.name}.`,changed:true};
}
export const learnWizardSpell=learnClassSpell;
export function readySpell(source:CampaignState,casterId:string,spellId:string):{state:CampaignState;message:string;changed:boolean}{
 const c=source.party.characters[casterId],spell=SPELLS[spellId];
 if(!c||!source.party.order.includes(casterId)||!spell||!spellAllowed(c.classId,spell.id)||!source.magic.known[casterId]?.includes(spellId))return {state:source,message:'That spell is not known by this caster.',changed:false};
 if(source.combat.active&&source.combat.active.turnOrder[source.combat.active.turnIndex]!==casterId)return {state:source,message:'Only the acting hero may ready a spell in combat.',changed:false};
 if(source.magic.readied[casterId]===spellId)return {state:source,message:`${spell.name} is already readied.`,changed:false};
 const state=structuredClone(source);state.magic.readied[casterId]=spellId;return {state,message:`${c.name} readies ${spell.name}.`,changed:true};
}
export interface CastRequest {casterId:string;spellId?:string|null;targetId?:string|null;steps?:1|2;}
const WITCH_CLUES:Record<string,{id:string;x:number;y:number;note:string}[]>={
 map_town:[{id:'well_reflection',x:7,y:7,note:'Rat Whisper: the village well reflects a strange sky; inspect the well for its story.'}],
 map_diagnostic_galleries:[
  {id:'banner_marks',x:5,y:5,note:'Rat Whisper: the gallery banner has six marks around an impossible sun (5,5).'},
  {id:'locked_north',x:4,y:2,note:'Rat Whisper: the northern gallery door (4,2) has a magical lock; Unseal can open it.'},
  {id:'silver_mirror',x:7,y:8,note:'Rat Whisper: beyond the south door, a silver mirror waits at (7,8).'}
 ]
};
export function nearestWitchClue(s:CampaignState){const position=s.maps[s.currentMapId];return (WITCH_CLUES[s.currentMapId]??[]).filter(clue=>!s.quests.flags.includes('witch_clue_'+clue.id)).sort((a,b)=>(Math.abs(a.x-position.x)+Math.abs(a.y-position.y))-(Math.abs(b.x-position.x)+Math.abs(b.y-position.y))||a.id.localeCompare(b.id))[0]??null;}
export function borrowedFaceHints(s:CampaignState,registry?:MapRegistry):string[]{
 if(!hasPartyWard(s,'borrowed_face')||!registry)return [];
 const map=registry[s.currentMapId] as TravelMap|undefined,where=s.maps[s.currentMapId];if(!map)return [];
 const near=(x:number,y:number)=>Math.abs(where.x-x)+Math.abs(where.y-y)<=3;
 return [...map.props.filter(p=>near(p.x,p.y)).map(p=>`${p.name}: ${p.description}`),...map.doors.filter(d=>near(d.x,d.y)).map(d=>`${d.id.replaceAll('_',' ')}: ${d.lockDC?'a lock needs opening':'a door can be opened nearby'}.`),...(map.portals??[]).filter(p=>near(p.x,p.y)).map(p=>`A travel gateway is near (${p.x},${p.y}).`)].slice(0,5);
}
const isUndead=monsterUndead;
function enemyTarget(s:CampaignState,id:string){return s.combat.active?s.combat.encounters[s.combat.active.encounterId].enemies.find(e=>e.id===id&&e.hp>0):undefined;}
function facingDoor(s:CampaignState,registry?:MapRegistry){
 if(!registry)return undefined;
 const map=registry[s.currentMapId],w=s.maps[s.currentMapId],d=DIRECTIONS[w.facing];return doorAt(map,w.x+d.x,w.y+d.y);
}
/** Return a deterministic validation error; never mutate or consume RNG. */
export function foldStepError(s:CampaignState,registry:MapRegistry|undefined,steps:1|2):string|null{
 if(!registry)return 'No map registry for Fold Step.';
 if(steps!==1&&steps!==2)return 'Choose one or two squares.';
 const map=registry[s.currentMapId] as TravelMap,w=s.maps[s.currentMapId],d=DIRECTIONS[w.facing];
 for(let n=1;n<=steps;n++){
  const x=w.x+d.x*n,y=w.y+d.y*n,k=`${x},${y}`;
  if(!canCross(map,w,x-d.x,y-d.y,x,y)||!terrainTransportSafe(map,w,x,y))return 'Fold Step cannot cross stone or a closed door.';
  if(!w.visited.includes(k))return 'Fold Step cannot enter an undiscovered square.';
  if(map.props.some(p=>p.x===x&&p.y===y)||map.portals?.some(p=>p.x===x&&p.y===y)||Object.values(s.combat.encounters).some(enc=>enc.mapId===map.id&&enc.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)))return 'Fold Step cannot bypass an interaction, gateway or enemy.';
 }
 return null;
}
export function checkCast(s:CampaignState,r:CastRequest,registry?:MapRegistry):string|null {
 if(s.combat.defeated)return 'The defeated party cannot cast.';
 const c=s.party.characters[r.casterId],spellId=r.spellId??s.magic.readied[r.casterId],spell=spellId?SPELLS[spellId]:undefined;
 if(!c||!s.party.order.includes(r.casterId)||!hasSpellAccess(c.classId)||c.hp===0)return 'Choose a living spellcaster.';
 if(!spell||!spellAllowed(c.classId,spell.id)||!s.magic.known[r.casterId]?.includes(spell.id))return 'This caster has not learned that spell.';
 if(c.level<spell.level)return 'This spell requires a higher level.';
 if(c.sp<spell.sp)return `${c.name} needs ${spell.sp} SP, but has only ${c.sp}.`;
 const inCombat=!!s.combat.active;
 if(spell.context!=='both'&&spell.context!==(inCombat?'combat':'exploration'))return `${spell.name} cannot be cast ${inCombat?'in combat':'while exploring'}.`;
 if(inCombat&&s.combat.active!.turnOrder[s.combat.active!.turnIndex]!==r.casterId)return 'Only the acting hero may cast in combat.';
 if(spell.target==='enemy'||spell.target==='enemies'){
  const enc=s.combat.active&&s.combat.encounters[s.combat.active.encounterId];const visible=enc?.enemies.filter(e=>e.hp>0).slice(0,3)??[];
  if(spell.target==='enemy'&&!visible.some(e=>e.id===r.targetId))return 'Choose a living, visible enemy target.';
  if(spell.target==='enemies'&&!visible.length)return 'No enemies are in range.';
  if(spell.effect==='turn_undead'&&!visible.some(e=>isUndead(e.kindId)))return 'Turn the Hollow requires a living undead enemy.';
 }
 if(spell.target==='ally'||spell.target==='dead_ally'){
  const ally=r.targetId?s.party.characters[r.targetId]:undefined;
  if(!ally||!s.party.order.includes(r.targetId!)||(spell.target==='dead_ally'?ally.hp!==0:ally.hp===0))return spell.target==='dead_ally'?'Choose a fallen ally.':'Choose a living ally.';
  if(spell.effect==='heal'&&ally.hp>=derived(ally).maxHP)return 'That ally is already at full health.';
  if(spell.effect==='cure'&&!ally.conditions.some(v=>v.id==='poisoned'))return 'That ally is not poisoned.';
  if(spell.effect==='break_curse'&&!ally.conditions.some(v=>v.id==='cursed')&&!s.magic.itemCurses[r.targetId!]?.length)return 'That ally has no curse to break.';
 }
 if(spell.effect==='light'&&hasPartyWard(s,'light'))return 'The party already has a Lantern Globe.';
 if(spell.effect==='chorus'&&!s.party.order.some(id=>{const h=s.party.characters[id];return h.hp>0&&h.hp<derived(h).maxHP;}))return 'No living party member needs healing.';
 if(spell.effect==='steadfast'&&hasPartyWard(s,'steadfast')&&!s.party.order.some(id=>s.party.characters[id].conditions.some(v=>v.id==='frightened')))return 'Steadfast is already active.';
 if(spell.behaviorKey==='spell_priest_blessing'&&hasPartyWard(s,'blessing'))return 'Blessing is already active.';
 if(spell.behaviorKey==='spell_priest_sheltering_hand'&&hasPartyWard(s,'sheltering_hand'))return 'Sheltering Hand is already active.';
 if(spell.effect==='attack_debuff'&&s.magic.effects.some(e=>e.kind==='ill_omen'&&e.targetId===r.targetId))return 'That enemy is already afflicted by Ill Omen.';
 if(['bind','sleep'].includes(spell.effect)&&s.magic.effects.some(e=>['binding_thread','sleep_thorns'].includes(e.kind)&&e.targetId===r.targetId))return 'That enemy is already bound.';
 if(spell.effect==='hints'&&hasPartyWard(s,'borrowed_face'))return 'Borrowed Face is already active.';
 if(spell.effect==='briar'&&hasPartyWard(s,'briar_mantle'))return 'Briar Mantle is already active.';
 if(spell.effect==='secret'&&!nearestWitchClue(s))return 'Rat Whisper knows no new clues on this floor.';
 if(spell.effect==='hearth'&&(s.currentMapId==='map_town'||!registry?.map_town))return 'Hearth Thread requires a dungeon and a known town entrance.';
 if(['bones','echo'].includes(spell.effect)&&s.magic.effects.some(e=>e.kind===(spell.effect==='bones'?'crooked_bones':'bottle_echo')&&e.targetId===r.targetId))return 'That enemy already bears this hex.';
 if(spell.effect==='reveal'&&hasPartyWard(s,'glass_eye'))return 'Glass Eye is already active.';
 if(spell.behaviorKey==='spell_wizard_stone_skin'&&hasPartyWard(s,'stone_skin'))return 'Stone Skin is already active.';
 if(spell.behaviorKey==='spell_wizard_mirror_ward'&&hasPartyWard(s,'mirror_ward'))return 'Mirror Ward is already active.';
 if(spell.effect==='unseal'||spell.effect==='composed'&&spell.effects?.some(e=>e.operation==='unseal')){
  const door=facingDoor(s,registry);
  if(!door)return 'Face an adjacent locked door to use Unseal.';
  if(!door.lockDC)return 'That door has no magical lock to unseal.';
  if(door.questLocked||door.lockDC>16)return 'Quest seals and difficult locks resist Unseal.';
  if(s.maps[s.currentMapId].doors[door.id])return 'That door is already open.';
 }
 if(spell.effect==='fold'||spell.effect==='composed'&&spell.effects?.some(e=>e.operation==='fold'))return foldStepError(s,registry,r.steps??1);
 return null;
}
/** Commit only after checkCast succeeds. All randomness uses the campaign's seeded RNG. */
export function applyCast(s:CampaignState,rng:SeededRng,r:CastRequest,registry?:MapRegistry):string[]{
 const invalid=checkCast(s,r,registry);if(invalid)throw new RangeError(invalid);
 const c=s.party.characters[r.casterId],spell=SPELLS[(r.spellId??s.magic.readied[r.casterId])!];
 s.party=updateMember(s.party,spendSP(c,spell.sp));
 const roll=(min:number,max:number)=>{s.rollCount++;return rng.integer(min,max);};
 const dice=(expr:string)=>{const [n,d]=expr.split('d').map(Number);let sum=0;for(let i=0;i<n;i++)sum+=roll(1,d);return sum;};
 const targetIds=spell.target==='enemies'?(s.combat.active?s.combat.encounters[s.combat.active.encounterId].enemies.filter(e=>e.hp>0).slice(0,3).map(e=>e.id):[]):spell.target==='party'?[...s.party.order]:r.targetId?[r.targetId]:[r.casterId];
 emitPresentation(s,{actorId:r.casterId,targetIds,family:spell.damageType??spell.effects?.find(e=>e.operation==='damage')?.damageType??(['heal','chorus','revive','cure','break_curse'].includes(spell.effect)?'heal':['bind','sleep','bones','echo','attack_debuff'].includes(spell.effect)?'necrotic':['ward','steadfast','briar'].includes(spell.effect)?'guard':'arcane'),spellId:spell.id,hit:true});
 const lines=[`${c.name} casts ${spell.name} (${spell.sp} SP).`];
 if(spell.effect==='composed'){
  // MM11: project-authored primitives share simulation state and seeded RNG with legacy spells.
  // Spell records were validated on installation; an effect never runs arbitrary user code.
  const attr=derived(c).attributes;
  const variables:Record<AmountVariable,number>={LEVEL:c.level,PROFICIENCY:derived(c).proficiency,STR_MOD:modifier(attr.STR),DEX_MOD:modifier(attr.DEX),CON_MOD:modifier(attr.CON),INT_MOD:modifier(attr.INT),WIS_MOD:modifier(attr.WIS),CHA_MOD:modifier(attr.CHA)};
  for(const primitive of spell.effects??[]){
   const ids=primitive.target==='caster'?[r.casterId]:primitive.target==='party'?[...s.party.order]:primitive.target==='enemies'?(s.combat.active?s.combat.encounters[s.combat.active.encounterId].enemies.filter(e=>e.hp>0).slice(0,3).map(e=>e.id):[]):r.targetId?[r.targetId]:[];
   if(primitive.operation==='unseal'){
    const door=facingDoor(s,registry)!;s.maps[s.currentMapId].doors[door.id]=true;lines.push(`${spell.name} opens ${door.id.replaceAll('_',' ')}.`);continue;
   }
   if(primitive.operation==='fold'){
    const pos=s.maps[s.currentMapId],direction=DIRECTIONS[pos.facing],steps=r.steps??1;
    pos.x+=direction.x*steps;pos.y+=direction.y*steps;pos.minutes++;lines.push(`Travelled ${steps} explored square(s).`);continue;
   }
   if(primitive.operation==='ward'){
    s.magic.effects=s.magic.effects.filter(e=>e.kind!==primitive.wardKind||e.targetId!=='party');
    s.magic.effects.push({kind:primitive.wardKind!,targetId:'party',expiresAtMinute:s.elapsedMinutes+primitive.remaining!});
    lines.push(`The party gains ${primitive.wardKind}.`);continue;
   }
   if(primitive.operation==='reveal'){
    s.magic.effects=s.magic.effects.filter(e=>e.kind!=='glass_eye'||e.targetId!=='party');
    s.magic.effects.push({kind:'glass_eye',targetId:'party',expiresAtMinute:s.elapsedMinutes+primitive.remaining!});
    lines.push('The party senses nearby structures.');continue;
   }
   for(const id of ids){
    const amount=primitive.amount!==undefined?evaluateAmountExpression(parseAmountExpression(primitive.amount),variables,roll):0;
    if(primitive.operation==='damage'){
     const enemy=enemyTarget(s,id);if(!enemy)continue;const dealt=Math.min(enemy.hp,monsterDamageAfterResistance(enemy.kindId,primitive.damageType??'arcane',Math.max(0,amount),conditionResistance(enemy.conditions??[],primitive.damageType??'arcane')));enemy.hp-=dealt;if(dealt>0)breakBinding(s,id);
     lines.push(`${spell.name} deals ${dealt} ${primitive.damageType??'arcane'} damage to ${enemy.kindId.replaceAll('_',' ')}.`);
    }else if(primitive.operation==='hex'){
     const enemy=enemyTarget(s,id);if(!enemy)continue;
     if(spell.save){const score=spell.save==='DEX'?monsterSaveAttribute(enemy.kindId,'DEX'):spell.save==='CON'?monsterSaveAttribute(enemy.kindId,'CON'):monsterSaveAttribute(enemy.kindId,'WIS');
      const savingRoll=roll(1,20)+modifier(score)+conditionModifier(enemy.conditions??[],'save');if(savingRoll>=derived(c).spellDC!){lines.push(`${enemy.kindId.replaceAll('_',' ')} resists ${spell.name}.`);continue;}}
     s.magic.effects=s.magic.effects.filter(e=>e.kind!==primitive.hexKind||e.targetId!==id);
     s.magic.effects.push({kind:primitive.hexKind!,targetId:id,remainingTurns:primitive.remaining!});
     lines.push(`${enemy.kindId.replaceAll('_',' ')} gains ${primitive.hexKind}.`);
    }else{
     const ally=s.party.characters[id];if(!ally)continue;
     if(primitive.operation==='revive'){
      if(ally.hp!==0)continue;
      s.party=updateMember(s.party,{...ally,hp:1,sp:0,conditions:ally.conditions.filter(v=>v.id!=='asleep')});
      lines.push(`${ally.name} returns with 1 HP.`);continue;
     }
     if(ally.hp===0)continue;
     if(primitive.operation==='cure'){
      s.party=updateMember(s.party,{...ally,conditions:ally.conditions.filter(v=>v.id!==primitive.conditionId)});
      if(primitive.conditionId==='cursed')s.magic.itemCurses[id]=[];
      lines.push(`${ally.name} is freed from ${conditionDefinition(primitive.conditionId!)?.name??primitive.conditionId}.`);
     }else if(primitive.operation==='heal'){
      const after=heal(ally,Math.max(0,amount));s.party=updateMember(s.party,after);lines.push(`${ally.name} recovers ${after.hp-ally.hp} HP.`);
     }else if(primitive.operation==='resource'){
      const after=primitive.resource==='sp'?{...ally,sp:Math.min(derived(ally).maxSP,Math.max(0,ally.sp+amount))}:amount<0?damage(ally,-amount):heal(ally,amount);
      s.party=updateMember(s.party,after);lines.push(`${ally.name} ${primitive.resource==='sp'?'SP':'HP'} ${amount>=0?'increases':'decreases'} by ${Math.abs((primitive.resource==='sp'?after.sp:after.hp)-(primitive.resource==='sp'?ally.sp:ally.hp))}.`);
     }else if(primitive.operation==='condition'){
      if(primitive.conditionId!.includes(':')){const outcome=applyUnifiedCondition(s,id,primitive.conditionId!,primitive.remaining!,{operations:0,rolls:0},roll);lines.push(`${ally.name}: ${outcome}.`);continue;}
      const after={...ally,conditions:applyConditionPolicy(ally.conditions,{id:primitive.conditionId!,unit:primitive.unit!,remaining:primitive.remaining!})};
      s.party=updateMember(s.party,after);lines.push(`${ally.name} gains ${conditionDefinition(primitive.conditionId!)?.name??primitive.conditionId}.`);
     }
    }
   }
  }
 }
 if(spell.effect==='heal'){const ally=s.party.characters[r.targetId!],amount=Math.max(1,roll(1,8)+modifier(derived(c).attributes.WIS)),after=heal(ally,amount);s.party=updateMember(s.party,after);lines.push(`${ally.name} recovers ${after.hp-ally.hp} HP.`);}
 if(spell.effect==='cure'||spell.effect==='break_curse'){
  const ally=s.party.characters[r.targetId!]!,curse=spell.effect==='break_curse';
  s.party=updateMember(s.party,{...ally,conditions:ally.conditions.filter(v=>v.id!==(curse?'cursed':'poisoned'))});
  if(curse)s.magic.itemCurses[ally.id]=[];
  lines.push(`${ally.name} is freed from ${curse?'every worn curse and the cursed condition':'poison'}.`);
 }
 if(spell.effect==='revive'){
  const ally=s.party.characters[r.targetId!]!;
  s.party=updateMember(s.party,{...ally,hp:1,sp:0,conditions:ally.conditions.filter(v=>v.id!=='asleep')});
  lines.push(`${ally.name} breathes again with 1 HP and no spell points.`);
 }
 if(spell.effect==='chorus'){
  for(const id of s.party.order){const ally=s.party.characters[id];if(ally.hp<=0)continue;
   const amount=Math.max(1,roll(1,8)+modifier(derived(c).attributes.WIS)),after=heal(ally,amount);
   s.party=updateMember(s.party,after);lines.push(`${ally.name} recovers ${after.hp-ally.hp} HP.`);
  }
 }
 if(spell.effect==='steadfast'){
  for(const id of s.party.order){const hero=s.party.characters[id];if(hero.conditions.some(v=>v.id==='frightened'))s.party=updateMember(s.party,{...hero,conditions:hero.conditions.filter(v=>v.id!=='frightened')});}
  s.magic.effects=s.magic.effects.filter(e=>e.kind!=='steadfast');
  s.magic.effects.push(s.combat.active?{kind:'steadfast',targetId:'party',remainingTurns:3}:{kind:'steadfast',targetId:'party',expiresAtMinute:s.elapsedMinutes+4});
  lines.push('All fear is removed; Steadfast wards the party against fear.');
 }
 if(spell.effect==='damage'){
  const enc=s.combat.encounters[s.combat.active!.encounterId];
  const targets=spell.target==='enemies'?enc.enemies.filter(e=>e.hp>0).slice(0,3):enc.enemies.filter(e=>e.id===r.targetId);
  const stat=spell.bonus??CLASSES[c.classId].casting!;
  for(const enemy of targets){let amount=Math.max(1,dice(spell.dice??'1d6')+(spell.behaviorKey==='spell_witch_malice_rain'?0:modifier(derived(c).attributes[stat])));
   if(spell.save){const score=spell.save==='DEX'?monsterSaveAttribute(enemy.kindId,'DEX'):spell.save==='CON'?monsterSaveAttribute(enemy.kindId,'CON'):monsterSaveAttribute(enemy.kindId,'WIS');const total=roll(1,20)+modifier(score)+conditionModifier(enemy.conditions??[],'save');
    if(total>=derived(c).spellDC!){if(spell.saveHalf){amount=Math.floor(amount/2);lines.push(`${enemy.kindId.replaceAll('_',' ')} saves (${total} vs DC ${derived(c).spellDC}).`);}else amount=0;}}
   amount=monsterDamageAfterResistance(enemy.kindId,spell.damageType??'arcane',amount,conditionResistance(enemy.conditions??[],spell.damageType??'arcane'));enemy.hp=Math.max(0,enemy.hp-amount);if(amount>0)breakBinding(s,enemy.id);
   lines.push(`${spell.name} deals ${amount} ${spell.damageType} damage to ${enemy.kindId.replaceAll('_',' ')} (${enemy.hp} HP remaining).`);
  }
 }
 if(spell.effect==='leech'){
  const enemy=enemyTarget(s,r.targetId!)!,before=enemy.hp,raw=dice('2d6'),actual=Math.min(before,raw);
  enemy.hp=before-actual;if(actual)breakBinding(s,enemy.id);
  const healed=heal(s.party.characters[c.id],Math.floor(actual/2));const restored=healed.hp-s.party.characters[c.id].hp;
  s.party=updateMember(s.party,healed);if(restored)emitPresentation(s,{actorId:c.id,targetIds:[c.id],family:'heal',hit:true});
  lines.push(`Leech Kiss drains ${actual} HP (${raw} rolled), restoring ${restored} HP to ${c.name}.`);
 }
 if(['sleep','bones','echo'].includes(spell.effect)){
  const enemy=enemyTarget(s,r.targetId!)!,score=spell.save==='CON'?monsterSaveAttribute(enemy.kindId,'CON'):monsterSaveAttribute(enemy.kindId,'WIS'),saved=roll(1,20)+modifier(score)+conditionModifier(enemy.conditions??[],'save')>=derived(c).spellDC!;
  if(saved)lines.push(`${enemy.kindId.replaceAll('_',' ')} resists ${spell.name}.`);
  else {const kind=spell.effect==='sleep'?'sleep_thorns':spell.effect==='bones'?'crooked_bones':'bottle_echo';
   s.magic.effects.push({kind,targetId:enemy.id,remainingTurns:spell.effect==='sleep'?1:spell.effect==='bones'?3:2});
   lines.push(spell.effect==='sleep'?'Sleep of Thorns steals the foe’s next action unless hit.':spell.effect==='bones'?'Crooked Bones reduces Defense by 3 for three enemy turns.':'Bottle the Echo suppresses special attacks for two enemy turns.');}
 }
 if(spell.effect==='briar'){
  s.magic.effects.push(s.combat.active?{kind:'briar_mantle',targetId:'party',remainingTurns:5}:{kind:'briar_mantle',targetId:'party',expiresAtMinute:s.elapsedMinutes+6});
  lines.push('Briar Mantle retaliates for 2 physical damage against successful melee strikes.');
 }
 if(spell.effect==='hints'){
  s.magic.effects.push({kind:'borrowed_face',targetId:'party',expiresAtMinute:s.elapsedMinutes+31});
  const hints=borrowedFaceHints(s,registry);lines.push(...(hints.length?hints:['Borrowed Face reveals no nearby interactive landmark.']));
 }
 if(spell.effect==='secret'){
  const clue=nearestWitchClue(s)!;s.quests.flags.push('witch_clue_'+clue.id);s.quests.notes.push(clue.note);lines.push(clue.note);
 }
 if(spell.effect==='hearth'){
  const home=registry!.map_town,arrival=s.maps.map_town,key=`${home.spawn.x},${home.spawn.y}`;
  s.maps.map_town={...arrival,...home.spawn,visited:arrival.visited.includes(key)?arrival.visited:[...arrival.visited,key]};
  s.currentMapId='map_town';s.elapsedMinutes+=9;lines.push('Hearth Thread draws the party safely back to the town entrance (10 minutes passed).');
 }
 if(spell.effect==='turn_undead'){
  const enc=s.combat.encounters[s.combat.active!.encounterId];
  for(const enemy of enc.enemies.filter(e=>e.hp>0&&isUndead(e.kindId)).slice(0,3)){
   const save=roll(1,20)+modifier(monsterSaveAttribute(enemy.kindId,'WIS'))+conditionModifier(enemy.conditions??[],'save'),dc=derived(c).spellDC!,saved=save>=dc;
   const raw=dice('2d6'),dmg=saved?Math.floor(raw/2):raw;
   enemy.hp=Math.max(0,enemy.hp-dmg);if(dmg>0)breakBinding(s,enemy.id);
   lines.push(`${spell.name} deals ${dmg} holy damage to ${enemy.kindId.replaceAll('_',' ')}${saved?' (WIS save)':''}.`);
   if(!saved&&enemy.hp>0){s.magic.effects=s.magic.effects.filter(e=>e.kind!=='hollow_fear'||e.targetId!==enemy.id);s.magic.effects.push({kind:'hollow_fear',targetId:enemy.id,remainingTurns:2});lines.push('The undead is frightened for two actions.');}
  }
 }
 if(spell.effect==='light'){s.magic.effects.push({kind:'light',targetId:'party',expiresAtMinute:s.elapsedMinutes+61});lines.push('A steady globe of light follows the party for 60 minutes.');}
 if(spell.effect==='reveal'){s.magic.effects.push({kind:'glass_eye',targetId:'party',expiresAtMinute:s.elapsedMinutes+31});lines.push('Glass Eye reveals nearby geometry without charting new visited squares.');}
 if(spell.effect==='ward'){const kind=spell.behaviorKey==='spell_wizard_stone_skin'?'stone_skin':spell.behaviorKey==='spell_wizard_mirror_ward'?'mirror_ward':spell.behaviorKey==='spell_priest_blessing'?'blessing':'sheltering_hand';s.magic.effects.push({kind,targetId:'party',expiresAtMinute:s.elapsedMinutes+31});lines.push(kind==='stone_skin'?'Stone Skin grants +2 Defense.':kind==='mirror_ward'?'Mirror Ward wards away 25% arcane damage.':kind==='blessing'?'Blessing grants +1 attack.':'Sheltering Hand grants +2 Defense.');}
 if(spell.effect==='attack_debuff'||spell.effect==='bind'){
  const enemy=enemyTarget(s,r.targetId!)!;const wisdom=monsterSaveAttribute(enemy.kindId,'WIS');
  const save=roll(1,20)+modifier(wisdom)+conditionModifier(enemy.conditions??[],'save'),dc=derived(c).spellDC!;
  if(save>=dc)lines.push(`${enemy.kindId.replaceAll('_',' ')} resists ${spell.name} (${save} vs DC ${dc}).`);
  else if(spell.effect==='attack_debuff'){s.magic.effects.push({kind:'ill_omen',targetId:enemy.id,remainingTurns:3});lines.push('Ill Omen: enemy attack −2 for its next three actions.');}
  else{s.magic.effects.push({kind:'binding_thread',targetId:enemy.id,remainingTurns:1});lines.push('Binding Thread holds the foe for its next action unless damaged.');}
 }
 if(spell.effect==='unseal'){const door=facingDoor(s,registry)!;s.maps[s.currentMapId].doors[door.id]=true;lines.push(`Unseal opens ${door.id.replaceAll('_',' ')}.`);}
 if(spell.effect==='fold'){
  const map=s.maps[s.currentMapId],d=DIRECTIONS[map.facing],steps=r.steps??1;
  map.x+=d.x*steps;map.y+=d.y*steps;map.minutes+=1;
  lines.push(`Fold Step travels ${steps} clear, previously explored square${steps===1?'':'s'} forward.`);
 }
 s.elapsedMinutes++;expireMagic(s);return lines;
}
export interface CastResult {state:CampaignState;messages:string[];changed:boolean;events?:PresentationEvent[];}
export function castExploration(source:CampaignState,request:CastRequest,registry?:MapRegistry):CastResult {
 const problem=checkCast(source,request,registry);if(problem)return {state:source,messages:[problem],changed:false};
 if(source.combat.active)return {state:source,messages:['Use combat casting during an encounter.'],changed:false};
 const state=structuredClone(source),rng=new SeededRng(1);rng.restore(state.rng);const messages=applyCast(state,rng,request,registry);state.rng=rng.snapshot();return {state,messages,changed:true,events:takePresentation(state)};
}
