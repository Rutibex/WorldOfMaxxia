import type {CampaignState} from '../shared/rules/campaign.ts';
import type {ConditionId} from '../shared/rules/party.ts';
import {changedAllyIds,changedEnemyIds} from './spell-effects.ts';

export type ImpactKind='physical'|'fire'|'cold'|'lightning'|'poison'|'arcane'|'holy'|'necrotic'|'heal'|'guard';
export interface ImpactAtlas{url:string;cell:number;frames:number;ms:number;}
export const IMPACT_ATLASES:Readonly<Record<ImpactKind,ImpactAtlas>>={
 physical:{url:'assets/art/impacts/impact_physical.png',cell:96,frames:6,ms:70},
 fire:{url:'assets/art/impacts/impact_fire.png',cell:96,frames:6,ms:70},
 cold:{url:'assets/art/impacts/impact_cold.png',cell:96,frames:6,ms:78},
 lightning:{url:'assets/art/impacts/impact_lightning.png',cell:96,frames:6,ms:62},
 poison:{url:'assets/art/impacts/impact_poison.png',cell:96,frames:6,ms:80},
 arcane:{url:'assets/art/impacts/impact_arcane.png',cell:96,frames:6,ms:72},
 holy:{url:'assets/art/impacts/impact_holy.png',cell:96,frames:6,ms:74},
 necrotic:{url:'assets/art/impacts/impact_necrotic.png',cell:96,frames:6,ms:74},
 heal:{url:'assets/art/impacts/impact_heal.png',cell:96,frames:6,ms:80},
 guard:{url:'assets/art/impacts/impact_guard.png',cell:96,frames:6,ms:78},
};
export function impactFrame(kind:ImpactKind,elapsed:number,reduced=false):number{
 const atlas=IMPACT_ATLASES[kind];if(reduced)return 2;
 return Math.min(atlas.frames-1,Math.floor(Math.max(0,elapsed)/atlas.ms));
}
export function impactDuration(kind:ImpactKind):number{return IMPACT_ATLASES[kind].frames*IMPACT_ATLASES[kind].ms;}

export const CONDITION_MARKS:Readonly<Record<ConditionId,{url:string;label:string}>>={
 poisoned:{url:'assets/art/conditions/poisoned.png',label:'Poisoned'},
 asleep:{url:'assets/art/conditions/asleep.png',label:'Asleep'},
 frightened:{url:'assets/art/conditions/frightened.png',label:'Frightened'},
 cursed:{url:'assets/art/conditions/cursed.png',label:'Cursed'},
 drunk:{url:'assets/art/conditions/drunk.png',label:'Drunk'},
 hungry:{url:'assets/art/conditions/hungry.png',label:'Hungry'},
};
export function conditionMarkArt(id:ConditionId):string{return CONDITION_MARKS[id].url;}
export function conditionMarkLabel(id:ConditionId):string{return CONDITION_MARKS[id].label;}

export interface PlannedImpact{kind:ImpactKind; enemyIds:string[]; allyIds:string[];}
function detectKind(line:string):ImpactKind|null{
 const s=line.toLowerCase();
 if(/restores up to| heals? |healing chorus|mend flesh|return breath| freed from | free of |cure/i.test(line))return 'heal';
 if(/behind a guard|guarded| block| ward /.test(s))return 'guard';
 if(/arcane|starfall|spark lance|bottle the echo/i.test(s))return 'arcane';
 if(/lightning|shock|storm arc/i.test(s))return 'lightning';
 if(/cold|frost|ice/i.test(s))return 'cold';
 if(/fire|burning|ember/i.test(s))return 'fire';
 if(/poison|venom|malice rain/i.test(s))return 'poison';
 if(/holy|dawn judgment|turn the hollow/i.test(s))return 'holy';
 if(/necrotic|withering|black moon|leech/i.test(s))return 'necrotic';
 if(/ damage| hits | uses | retaliates | returns /i.test(line))return 'physical';
 return null;
}
export function plannedImpactBursts(before:CampaignState,after:CampaignState,messages:readonly string[]):PlannedImpact[]{
 const enemyIds=changedEnemyIds(before,after);
 const allyIds=before.party&&after.party?changedAllyIds(before,after):[];
 const names=(after.party?.order??[]).map(id=>after.party?.characters[id]?.name).filter(Boolean) as string[];
 let enemyKind:ImpactKind|null=null,allyKind:ImpactKind|null=null,guard=false;
 for(const line of messages){
  const kind=detectKind(line);if(!kind)continue;
  if(kind==='guard')guard=true;
  const mentionsHero=names.some(name=>line.includes(name));
  if(kind==='heal')allyKind='heal';
  else if(mentionsHero)allyKind ??= kind;
  else enemyKind ??= kind;
 }
 const planned:PlannedImpact[]=[];
 if(enemyIds.length&&enemyKind)planned.push({kind:enemyKind,enemyIds:[...enemyIds],allyIds:[]});
 if(allyIds.length&&allyKind)planned.push({kind:allyKind,enemyIds:[],allyIds:[...allyIds]});
 if(guard&&allyIds.length)planned.push({kind:'guard',enemyIds:[],allyIds:[...allyIds]});
 return planned;
}
