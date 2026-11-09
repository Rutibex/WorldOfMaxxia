import {edgeBlocked,elevationAt} from '../project/terrain-contracts.ts';
import {matches,type Puzzle,type PerceptionState} from '../project/perception-contracts.ts';
import {isOpaque,type GridMap,type GridState} from './grid.ts';
import {settleExpeditionTime} from './expedition.ts';
import type {CampaignState,MapRegistry} from './campaign.ts';
export type PuzzleCommand={type:'puzzle';puzzleId:string;action:'inspect'|'input'|'submit'|'reset';token?:string;slot?:number};
export function perceptionState(w:GridState):PerceptionState{return w.perception??={version:1,revealed:[],puzzles:{}};}
export function perceptionReach(map:GridMap,w:GridState,x:number,y:number):boolean{return Math.abs(w.x-x)+Math.abs(w.y-y)<=1&&Math.abs(elevationAt(map,w,w.x,w.y)-elevationAt(map,w,x,y))<=1&&!edgeBlocked(map,w,w.x,w.y,x,y);}
export function nearbyPuzzles(map:GridMap,w:GridState):Puzzle[]{return map.perception?.puzzles.filter(p=>perceptionReach(map,w,p.x,p.y)&&!isOpaque(map,w,p.x,p.y))??[];}
export function revealBySearch(map:GridMap,w:GridState):string[]{const found:string[]=[];for(const i of map.perception?.illusions??[])if(i.searchable&&perceptionReach(map,w,i.x,i.y)&&!w.perception?.revealed.includes(i.id)){perceptionState(w).revealed.push(i.id);found.push(i.description);}return found;}
export function actPuzzle(source:CampaignState,registry:MapRegistry,c:PuzzleCommand){
 const map=registry[source.currentMapId],w=source.maps[map.id],p=nearbyPuzzles(map,w).find(p=>p.id===c.puzzleId);
 const blocked=(message:string)=>({state:source,changed:false,message});
 if(!p)return blocked('That puzzle is out of reach.');
 if(source.combat.active||source.combat.defeated||!source.party.order.some(id=>source.party.characters[id].hp>0))return blocked('A conscious party outside combat is required.');
 const old=w.perception?.puzzles[p.id];
 if(c.action==='inspect')return blocked(p.name+' — '+p.clue+(old?.solved?' '+p.success:''));
 if(old?.solved)return blocked(p.success);
 if(c.action==='input'&&(!c.token||!p.tokens.includes(c.token)||p.kind==='alignment'&&(!Number.isInteger(c.slot)||c.slot!<0||c.slot!>=p.solution.length)||p.kind!=='alignment'&&c.slot!==undefined))return blocked('Invalid puzzle input.');
 const s=structuredClone(source),state=perceptionState(s.maps[map.id]),v=state.puzzles[p.id]??={values:[],attempts:0,solved:false};let message='';
 if(c.action==='reset'){v.values=[];message=p.reset;}
 else if(c.action==='input'){
  if(p.kind==='alignment'){if(c.slot!>v.values.length)return blocked('Set earlier alignment slots first.');v.values[c.slot!]=c.token!;}
  else if(p.kind==='combination'){const i=v.values.indexOf(c.token!);if(i>=0)v.values.splice(i,1);else if(v.values.length<p.solution.length)v.values.push(c.token!);else return blocked('Reset or deselect a symbol first.');}
  else {if(v.values.length>=p.solution.length)return blocked('Submit or reset this sequence first.');v.values.push(c.token!);}
  message=p.name+': '+v.values.join(' · ');
 }else if(c.action==='submit'){
  if(v.attempts>=1000000)return blocked('Attempt limit reached; reset remains available.');v.attempts++;
  if(matches(p,v.values)){v.solved=true;message=p.success;}else{v.values=[];message=p.incorrect;}
 }
 s.elapsedMinutes++;s.maps[map.id].minutes++;settleExpeditionTime(s);return {state:s,changed:true,message};
}
