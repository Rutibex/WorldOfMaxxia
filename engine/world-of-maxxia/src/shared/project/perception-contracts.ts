import type {GridMap,GridState} from '../rules/grid.ts';
export interface Illusion {id:string;x:number;y:number;appearance:'wall'|'opening'|'scenery';name:string;description:string;searchable:boolean;revealPuzzleId?:string;}
export interface Puzzle {id:string;x:number;y:number;name:string;kind:'sequence'|'alignment'|'combination';clue:string;tokens:string[];solution:string[];incorrect:string;success:string;reset:string;}
export interface PerceptionDefinition {version:1;illusions:Illusion[];puzzles:Puzzle[];}
export interface PuzzleProgress {values:string[];attempts:number;solved:boolean;}
export interface PerceptionState {version:1;revealed:string[];puzzles:Record<string,PuzzleProgress>;}
const id=(v:unknown)=>typeof v==='string'&&!['constructor','prototype'].includes(v)&&/^[a-z][a-z0-9_]{0,31}$/.test(v);
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=1000;
function exact(v:object,keys:string[]){if(Object.keys(v).some(k=>!keys.includes(k)))throw new TypeError('Unknown perception field.');}
export function validatePerception(map:GridMap):void{
 const d=map.perception;if(d===undefined)return;
 if(!d||d.version!==1||!Array.isArray(d.illusions)||d.illusions.length>32||!Array.isArray(d.puzzles)||d.puzzles.length>16)throw new TypeError('Invalid perception definition.');exact(d,['version','illusions','puzzles']);
 const ids=new Set<string>(),cells=new Set<string>();
 const coord=(v:{x:number;y:number})=>Number.isInteger(v.x)&&Number.isInteger(v.y)&&v.x>0&&v.y>0&&v.y<map.rows.length-1&&v.x<map.rows[0].length-1;
 for(const p of d.puzzles){
  if(!p||!id(p.id)||ids.has(p.id)||!coord(p)||map.rows[p.y][p.x]!=='.'||!['sequence','alignment','combination'].includes(p.kind)||![p.name,p.clue,p.incorrect,p.success,p.reset].every(text)||!Array.isArray(p.tokens)||p.tokens.length<2||p.tokens.length>8||p.tokens.some(v=>!text(v)||v.length>40)||new Set(p.tokens).size!==p.tokens.length||!Array.isArray(p.solution)||p.solution.length<1||p.solution.length>8||p.solution.some(v=>!p.tokens.includes(v))||p.kind==='combination'&&new Set(p.solution).size!==p.solution.length)throw new TypeError('Invalid authored puzzle.');
  exact(p,['id','x','y','name','kind','clue','tokens','solution','incorrect','success','reset']);ids.add(p.id);
  const key=p.x+','+p.y;if(cells.has(key))throw new TypeError('Duplicate puzzle location.');cells.add(key);
  for(const c of map.terrain?.configurations??[])if(c.cells.some(v=>v.x===p.x&&v.y===p.y&&v.kind!=='floor'&&v.kind!=='bridge'))throw new TypeError('Puzzle must remain on stable floor.');
 }
 for(const i of d.illusions){
  if(!i||!id(i.id)||ids.has(i.id)||!coord(i)||!['wall','opening','scenery'].includes(i.appearance)||![i.name,i.description].every(text)||typeof i.searchable!=='boolean'||i.revealPuzzleId!==undefined&&!d.puzzles.some(p=>p.id===i.revealPuzzleId)||i.appearance==='wall'&&map.rows[i.y][i.x]!=='.'||i.appearance==='opening'&&map.rows[i.y][i.x]!=='#'||!i.searchable&&!i.revealPuzzleId)throw new TypeError('Invalid authored illusion.');
  exact(i,['id','x','y','appearance','name','description','searchable','revealPuzzleId']);ids.add(i.id);
  const key=i.x+','+i.y;if(cells.has(key)||map.doors.some(v=>v.x===i.x&&v.y===i.y)||map.secrets?.some(v=>v.x===i.x&&v.y===i.y))throw new TypeError('Conflicting illusion location.');cells.add(key);
  for(const c of map.terrain?.configurations??[])if(c.cells.some(v=>v.x===i.x&&v.y===i.y)||c.blockedEdges.some(v=>v.x===i.x&&v.y===i.y))throw new TypeError('Illusions cannot overlap mutable terrain.');
 }
}
export function validatePerceptionState(map:GridMap,w:GridState):void{
 const v=w.perception;if(v===undefined)return;
 if(!v||v.version!==1||!Array.isArray(v.revealed)||new Set(v.revealed).size!==v.revealed.length||v.revealed.some(id=>!map.perception?.illusions.some(i=>i.id===id))||!v.puzzles||typeof v.puzzles!=='object'||Array.isArray(v.puzzles))throw new TypeError('Invalid perception save.');exact(v,['version','revealed','puzzles']);
 for(const [id,p] of Object.entries(v.puzzles)){
  const def=map.perception?.puzzles.find(v=>v.id===id);
  if(!def||!p||!Array.isArray(p.values)||p.values.length>def.solution.length||p.values.some(v=>!def.tokens.includes(v))||def.kind==='combination'&&new Set(p.values).size!==p.values.length||!Number.isSafeInteger(p.attempts)||p.attempts<0||p.attempts>1000000||typeof p.solved!=='boolean'||p.solved&&!matches(def,p.values))throw new TypeError('Invalid puzzle save.');exact(p,['values','attempts','solved']);
 }
}
export function matches(p:Puzzle,v:string[]):boolean{return v.length===p.solution.length&&(p.kind==='combination'?[...v].sort().every((x,i)=>x===[...p.solution].sort()[i]):v.every((x,i)=>x===p.solution[i]));}
export function illusionRevealed(i:Illusion,w:GridState):boolean{return !!w.perception?.revealed.includes(i.id)||!!(i.revealPuzzleId&&w.perception?.puzzles[i.revealPuzzleId]?.solved)||w.visited.includes(i.x+','+i.y);}
/** Presentation-only projection. Never pass this map into movement, combat or save validation. */
export function perceivedMap(map:GridMap,w:GridState):GridMap{
 const active=map.perception?.illusions.filter(i=>!illusionRevealed(i,w));if(!active?.length)return map;
 const rows=map.rows.map(r=>r.split(''));
 for(const i of active){if(i.appearance==='wall')rows[i.y][i.x]='#';if(i.appearance==='opening')rows[i.y][i.x]='.';}
 return {...map,rows:rows.map(r=>r.join('')),props:[...map.props,...active.filter(i=>i.appearance==='scenery').map(i=>({id:'illusion_'+i.id,x:i.x,y:i.y,kind:'marker' as const,name:i.name,description:i.description}))]};
}
